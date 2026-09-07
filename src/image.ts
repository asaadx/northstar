/**
 * Reward pictures are shrunk and re-encoded before they reach state. A photo
 * straight from the camera roll is several megabytes, and the whole state
 * record is rewritten on every check-in, so the stored copy is capped at a
 * size a 4rem node could ever need on a 3x display.
 */

const MAX_EDGE = 256;
const QUALITY = 0.82;

/**
 * Centre-crop `file` to a square, scale it to at most `MAX_EDGE`, and return
 * it as a data URL. Prefers WebP and falls back to JPEG where the canvas
 * cannot encode it.
 */
export async function toRewardImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const edge = Math.min(side, MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;

    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("northstar: 2d canvas unavailable");

    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      edge,
      edge,
    );

    const webp = canvas.toDataURL("image/webp", QUALITY);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
