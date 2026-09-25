import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { findFabric } from "./fabricBox";

/** A plain wall with a busy striped "saree" hung on it, where we put it. */
async function scene(W: number, H: number, box: { x: number; y: number; w: number; h: number }) {
  const px = Buffer.alloc(W * H * 3, 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = x >= box.x * W && x < (box.x + box.w) * W && y >= box.y * H && y < (box.y + box.h) * H;
      const v = inside ? (((x >> 2) + (y >> 2)) % 2 ? 40 : 220) : 200 + ((x * 7 + y * 3) % 5);
      px.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
  }
  return new Uint8Array(await sharp(px, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer());
}

describe("finding the saree in a photo", () => {
  it("boxes a busy fabric hung on a plain wall", async () => {
    const truth = { x: 0.2, y: 0.1, w: 0.55, h: 0.75 };
    const box = await findFabric(await scene(600, 800, truth));
    expect(box).not.toBeNull();
    // Never cuts into the fabric…
    expect(box!.x).toBeLessThanOrEqual(truth.x + 0.005);
    expect(box!.y).toBeLessThanOrEqual(truth.y + 0.005);
    expect(box!.x + box!.w).toBeGreaterThanOrEqual(truth.x + truth.w - 0.005);
    expect(box!.y + box!.h).toBeGreaterThanOrEqual(truth.y + truth.h - 0.005);
    // …and leaves only a small margin of wall.
    expect(truth.x - box!.x).toBeLessThan(0.06);
    expect(truth.y - box!.y).toBeLessThan(0.06);
    expect(box!.x + box!.w - (truth.x + truth.w)).toBeLessThan(0.06);
    expect(box!.y + box!.h - (truth.y + truth.h)).toBeLessThan(0.06);
  });

  it("gives up on a photo with nothing to find", async () => {
    const flat = new Uint8Array(await sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 210, g: 205, b: 200 } } }).jpeg().toBuffer());
    expect(await findFabric(flat)).toBeNull();
  });
});
