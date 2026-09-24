import sharp from "sharp";
import { DEFAULT_GARMENT_TYPE, garmentType, shotFor } from "@/content/shots";
import { PART_ORDER, addUploadedPart, createUploadGarment, getGarment, missingSlots, publicGarment, type PartSlot } from "@/lib/garments";
import { checkQuality } from "@/lib/quality";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One photograph in.
 *
 * Multipart: `file`, `slot` (body · pallu · border · blouse · body_motif ·
 * pallu_motif · whole, or `saree` for one flat photo), an optional
 * `garmentId` to add to, and `type` for the garment the first upload
 * creates. The browser has already resized the image to about 2000px, so it
 * arrives small and upright; the server still reads its size, normalises it
 * to a JPEG so nothing odd (HEIC, a huge PNG) reaches the sheet builder, and
 * runs the free quality check so the tile can say "blurred, retake" at once.
 */
const MAX_BYTES = 4_000_000;

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const form = await request.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") ?? "saree") as PartSlot;
    const garmentId = form.get("garmentId") ? String(form.get("garmentId")) : null;
    const type = garmentType(String(form.get("type") ?? DEFAULT_GARMENT_TYPE));

    if (!(file instanceof Blob)) return Response.json({ error: "No file was sent." }, { status: 400 });
    if (!PART_ORDER.includes(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });
    if (!type.enabled) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Image is too large. Please upload a smaller-sized garment image so we can process it properly." }, { status: 413 });
    }

    let garment = garmentId ? await getGarment(garmentId, account.id) : null;
    if (garmentId && !garment) return Response.json({ error: "No such garment." }, { status: 404 });
    garment ??= await createUploadGarment(account.id, type.value);

    const input = Buffer.from(await file.arrayBuffer());
    let bytes: Buffer;
    let width: number;
    let height: number;
    try {
      const image = sharp(input).autoOrient();
      const meta = await image.metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      bytes = await image.jpeg({ quality: 90 }).toBuffer();
    } catch {
      return Response.json({ error: "We could not read this image. Please try another one (JPEG or PNG)." }, { status: 415 });
    }

    const shot = shotFor(garment.garmentType, slot);
    const quality = await checkQuality({ bytes, width, height, expected: shot?.orientation ?? null });

    const updated = await addUploadedPart(garment, slot, bytes, "image/jpeg", { width, height }, quality);
    return Response.json(
      { garment: publicGarment(updated), quality, missing: missingSlots(updated) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
