// Generates the PWA icon set with zero dependencies.
// Pure-Node PNG codec + a supersampled resample of `star-source.png`.
//   node scripts/gen-icons.mjs
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "..", "public");
const OUT_DIR = join(PUBLIC_DIR, "icons");
/** The star artwork. Committed so a regeneration needs no network and is reproducible. */
const SOURCE = join(HERE, "star-source.png");

/* ---------------------------------------------------------------- PNG codec */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encode straight (non-premultiplied) RGBA8 pixels as a PNG buffer. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 = deflate / adaptive filtering / no interlace, already zero.

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Decode an 8-bit, non-interlaced PNG to interleaved samples. Enough for the
 * artwork this script consumes; anything else throws rather than guess.
 */
function decodePng(buf) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(signature)) throw new Error("not a PNG");

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const [depth, colour, , , interlace] = buf.subarray(24, 29);
  if (depth !== 8) throw new Error(`unsupported PNG bit depth ${depth}, expected 8`);
  if (interlace !== 0) throw new Error("unsupported interlaced PNG");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (channels === undefined) throw new Error(`unsupported PNG colour type ${colour}`);

  const parts = [];
  for (let o = 8; o + 8 <= buf.length; ) {
    const length = buf.readUInt32BE(o);
    if (buf.toString("ascii", o + 4, o + 8) === "IDAT") parts.push(buf.subarray(o + 8, o + 8 + length));
    o += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));

  // Reverse the per-scanline filters in place; each row predicts from the row
  // above (`up`) and the pixel to the left (`left`), both already unfiltered.
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0, read = 0; y < height; y++) {
    const filter = raw[read++];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? px[y * stride + x - channels] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      const value = raw[read + x];
      let out = value;
      if (filter === 1) out = value + left;
      else if (filter === 2) out = value + up;
      else if (filter === 3) out = value + ((left + up) >> 1);
      else if (filter === 4) out = value + paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
      px[y * stride + x] = out & 0xff;
    }
    read += stride;
  }

  return { width, height, channels, px };
}

/* ----------------------------------------------------------------- artwork */

const art = decodePng(readFileSync(SOURCE));

/**
 * Ink coverage of the artwork at one pixel, in [0,1].
 *
 * Transparency carries the shape when the source has an alpha channel. Without
 * one the source is a flattened drawing, so darkness carries it instead: ink is
 * whatever is not the (light) background.
 */
function artCoverage(x, y) {
  const i = (y * art.width + x) * art.channels;
  if (art.channels === 4) return art.px[i + 3] / 255;
  if (art.channels === 2) return art.px[i + 1] / 255;
  const luma = art.channels === 3 ? (art.px[i] * 0.2126 + art.px[i + 1] * 0.7152 + art.px[i + 2] * 0.0722) : art.px[i];
  return 1 - luma / 255;
}

/**
 * Bilinear sample in normalised coordinates: nx, ny in [-1,1] spans the whole
 * artwork, so the caller's own inset decides how much canvas the star fills.
 * Outside that square there is no artwork, hence no coverage.
 */
function sampleArt(nx, ny) {
  if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return 0;

  const fx = ((nx + 1) / 2) * (art.width - 1);
  const fy = ((ny + 1) / 2) * (art.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, art.width - 1);
  const y1 = Math.min(y0 + 1, art.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const top = artCoverage(x0, y0) * (1 - tx) + artCoverage(x1, y0) * tx;
  const bottom = artCoverage(x0, y1) * (1 - tx) + artCoverage(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/* ----------------------------------------------------------------- painting */

const BG = [0x0a, 0x0f, 0x1e];
const STAR = [0xf8, 0xfa, 0xfc];
const GLOW = [0x38, 0xbd, 0xf8];

const mix = (a, b, t) => a + (b - a) * t;

/**
 * Samples per axis per output pixel. Enough that every source pixel inside an
 * output pixel's footprint is hit: a 32px favicon reduces the 512px artwork by
 * ~18x, and skipping rows of a shape this thin would drop whole arm tips.
 */
function supersampling(radius) {
  return Math.min(16, Math.max(4, Math.ceil(art.width / (2 * radius))));
}

/**
 * @param size    output edge length in px
 * @param inset   fraction of the canvas reserved as padding (maskable safe zone)
 */
function paintIcon(size, inset) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const radius = (size / 2) * (1 - inset);
  const SS = supersampling(radius);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      let glow = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - 0.5;
          const py = y + (sy + 0.5) / SS - 0.5;
          const nx = (px - c) / radius;
          const ny = (py - c) / radius;

          cov += sampleArt(nx, ny);
          // Soft radial bloom behind the star.
          const d = Math.hypot(nx, ny);
          glow += Math.max(0, 1 - d / 1.05) ** 3;
        }
      }

      const samples = SS * SS;
      cov /= samples;
      glow = Math.min(1, (glow / samples) * 0.85);

      const i = (y * size + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const base = mix(BG[ch], GLOW[ch], glow * 0.55);
        rgba[i + ch] = Math.round(mix(base, STAR[ch], cov));
      }
      rgba[i + 3] = 0xff;
    }
  }

  return encodePng(size, size, rgba);
}

/**
 * The star alone: white, with the artwork's shape in the alpha channel. The app
 * wears it as a CSS mask, so only alpha is read and the mark keeps taking its
 * colour from `currentColor` the way the inline glyph it replaced did.
 */
function paintMask(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const radius = size / 2;
  const SS = supersampling(radius);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS - 0.5 - c) / radius;
          const ny = (y + (sy + 0.5) / SS - 0.5 - c) / radius;
          cov += sampleArt(nx, ny);
        }
      }

      const i = (y * size + x) * 4;
      rgba[i] = 0xff;
      rgba[i + 1] = 0xff;
      rgba[i + 2] = 0xff;
      rgba[i + 3] = Math.round((cov / (SS * SS)) * 255);
    }
  }

  return encodePng(size, size, rgba);
}

/**
 * Social preview card: the same star on the same plate, at the 1.91:1 ratio
 * link previews crop to. Deliberately wordless. Every platform renders
 * `og:title` and `og:description` as text beside the image, so baking copy in
 * would duplicate it at a size nobody controls, and this codec has no font
 * rasterizer to do it well anyway.
 */
function paintOg(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  // Sized off the short edge so the card keeps a wide margin at any crop.
  const radius = (height / 2) * 0.62;
  const SS = supersampling(radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let cov = 0;
      let glow = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS - 0.5 - cx) / radius;
          const ny = (y + (sy + 0.5) / SS - 0.5 - cy) / radius;

          cov += sampleArt(nx, ny);
          // Wider than the icon's bloom: a card has room for it to fall off.
          glow += Math.max(0, 1 - Math.hypot(nx, ny) / 1.6) ** 3;
        }
      }

      const samples = SS * SS;
      cov /= samples;
      glow = Math.min(1, (glow / samples) * 0.85);

      const i = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const base = mix(BG[ch], GLOW[ch], glow * 0.55);
        rgba[i + ch] = Math.round(mix(base, STAR[ch], cov));
      }
      rgba[i + 3] = 0xff;
    }
  }

  return encodePng(width, height, rgba);
}

/* -------------------------------------------------------------------- emit */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, inset: 0.16 },
  { file: "icon-512.png", size: 512, inset: 0.16 },
  // Maskable icons are cropped to a circle/squircle: keep art inside 80% of the edge.
  { file: "icon-maskable-192.png", size: 192, inset: 0.3 },
  { file: "icon-maskable-512.png", size: 512, inset: 0.3 },
  { file: "apple-touch-icon.png", size: 180, inset: 0.2 },
  { file: "favicon-32.png", size: 32, inset: 0.1 },
];

for (const { file, size, inset } of targets) {
  const png = paintIcon(size, inset);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file.padEnd(26)} ${size}x${size}  ${png.length} bytes`);
}

// 256px covers the 5rem mark at 3x device pixel ratio.
const mask = paintMask(256);
writeFileSync(join(OUT_DIR, "star-mask.png"), mask);
console.log(`${"star-mask.png".padEnd(26)} 256x256  ${mask.length} bytes`);

// 1200x630 is what every link scraper crops toward. Served from the root, so
// `og:image` stays a stable absolute URL across deploys.
const og = paintOg(1200, 630);
writeFileSync(join(PUBLIC_DIR, "og.png"), og);
console.log(`${"og.png".padEnd(26)} 1200x630  ${og.length} bytes`);
