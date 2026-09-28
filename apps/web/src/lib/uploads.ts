import sharp from "sharp";
import { shotFor } from "@/content/shots";
import type { Garment } from "@/db";
import { addUploadedPart, recordPart, type PartSlot } from "@/lib/garments";
import { checkQuality } from "@/lib/quality";

/**
 * A merchant's photograph, kept exactly as the camera made it.
 *
 * No resize, no re-encode: the sheet builder and the reader work from the
 * original, and the originals are deleted once a product has moved on to
 * the shop's own store. Only the size is read here — upright, so a portrait
 * photo stored as sideways pixels plus an orientation tag counts as portrait.
 */

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The camera's own files. A 50 MP phone writes 15–20 MB. */
export const MAX_PHOTO_BYTES = 40_000_000;

export function photoTypeAllowed(mime: string): boolean {
  return (PHOTO_TYPES as readonly string[]).includes(mime);
}

export async function uprightSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const meta = await sharp(bytes).metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  return {
    width: (turned ? meta.height : meta.width) ?? 0,
    height: (turned ? meta.width : meta.height) ?? 0,
  };
}

/** Size, free quality check, part row. `storedKey` when the bytes are already in R2. */
export async function recordPhoto(garment: Garment, slot: PartSlot, bytes: Uint8Array, mime: string, storedKey?: string, takenBy?: string | null) {
  const { width, height } = await uprightSize(bytes);
  const shot = shotFor(garment.garmentType, slot);
  const quality = await checkQuality({ bytes: Buffer.from(bytes), width, height, expected: shot?.orientation ?? null });
  const updated = await addUploadedPart(garment, slot, bytes, mime, { width, height }, quality, storedKey, takenBy);
  return { garment: updated, quality };
}

/**
 * The phone sent its own screen copy (28 Sep): the size comes from the
 * original's header (its first bytes; the whole file only if the header does
 * not fit), the quality check from the preview. The check measures at 512 px,
 * so a 1600 px preview gives the same verdict as the original.
 */
export async function recordPhotoWithPreview(
  garment: Garment,
  slot: PartSlot,
  key: string,
  originalStart: Uint8Array,
  previewKey: string,
  previewBytes: Uint8Array,
  takenBy: string | null,
  wholeOriginal: () => Promise<Uint8Array>,
) {
  const size = await uprightSize(originalStart).catch(async () => uprightSize(await wholeOriginal()));
  const shot = shotFor(garment.garmentType, slot);
  const quality = await checkQuality({ bytes: Buffer.from(previewBytes), width: size.width, height: size.height, expected: shot?.orientation ?? null });
  const updated = await recordPart(garment, slot, key, previewKey, size, quality, takenBy);
  return { garment: updated, quality };
}
