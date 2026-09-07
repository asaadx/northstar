// Generates the PWA icon set with zero dependencies.
// Pure-Node PNG encoder + a supersampled astroid ("north star") rasterizer.
//   node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

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

/* ----------------------------------------------------------------- painting */

const BG = [0x0a, 0x0f, 0x1e];
const STAR = [0xf8, 0xfa, 0xfc];
const GLOW = [0x38, 0xbd, 0xf8];

const mix = (a, b, t) => a + (b - a) * t;

/**
 * Astroid star field: |x|^(2/3) + |y|^(2/3) <= 1 is a 4-cusped concave star,
 * which reads as a "north star" at icon sizes. Returns coverage in [0,1].
 */
function starCoverage(nx, ny) {
  const k = 0.6666666666666666;
  const v = Math.pow(Math.abs(nx), k) + Math.pow(Math.abs(ny), k);
  return v <= 1 ? 1 : 0;
}

/**
 * @param size    output edge length in px
 * @param inset   fraction of the canvas reserved as padding (maskable safe zone)
 */
function paintIcon(size, inset) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling factor per axis -> 16 samples/px
  const c = (size - 1) / 2;
  const radius = (size / 2) * (1 - inset);

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

          cov += starCoverage(nx, ny);
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
