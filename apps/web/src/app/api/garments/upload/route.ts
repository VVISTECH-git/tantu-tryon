import sharp from "sharp";
import { PART_ORDER, addUploadedPart, createUploadGarment, getGarment, publicGarment, type PartSlot } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One photograph in.
 *
 * Multipart: `file`, `slot` (saree · body · pallu · border · blouse) and an
 * optional `garmentId` to add to. The browser has already resized the image
 * to about 1600px, so it arrives small and upright; the server still reads
 * its size and normalises it to a JPEG so nothing odd (HEIC, a huge PNG)
 * reaches the sheet builder.
 */
const MAX_BYTES = 4_000_000;

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const form = await request.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") ?? "saree") as PartSlot;
    const garmentId = form.get("garmentId") ? String(form.get("garmentId")) : null;

    if (!(file instanceof Blob)) return Response.json({ error: "No file was sent." }, { status: 400 });
    if (!PART_ORDER.includes(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Image is too large. Please upload a smaller-sized garment image so we can process it properly." }, { status: 413 });
    }

    let garment = garmentId ? await getGarment(garmentId, account.id) : null;
    if (garmentId && !garment) return Response.json({ error: "No such garment." }, { status: 404 });
    garment ??= await createUploadGarment(account.id);

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

    const updated = await addUploadedPart(garment, slot, bytes, "image/jpeg", { width, height });
    return Response.json({ garment: publicGarment(updated) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
