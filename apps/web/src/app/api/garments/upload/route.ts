import { DEFAULT_GARMENT_TYPE, garmentType } from "@/content/shots";
import { PART_ORDER, createUploadGarment, getGarment, missingSlots, publicGarment, type PartSlot } from "@/lib/garments";
import { photoTypeAllowed, recordPhoto } from "@/lib/uploads";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One photograph in.
 *
 * Multipart: `file`, `slot` (body · pallu · border · blouse · body_motif ·
 * pallu_motif · whole, or `saree` for one flat photo), an optional
 * `garmentId` to add to, and `type` for the garment the first upload
 * creates. Stored exactly as it arrives (see lib/uploads.ts); the free
 * quality check runs so the tile can say "blurred, retake" at once. Vercel
 * caps a request at 4.5 MB, so a full-size camera original comes the other
 * way: upload-url, a PUT straight to R2, then upload-done.
 */
const MAX_BYTES = 4_400_000;

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

    const mime = file.type || "image/jpeg";
    if (!photoTypeAllowed(mime)) {
      return Response.json({ error: "Please send a JPEG or PNG photo." }, { status: 415 });
    }

    let garment = garmentId ? await getGarment(garmentId, account.id) : null;
    if (garmentId && !garment) return Response.json({ error: "No such garment." }, { status: 404 });
    garment ??= await createUploadGarment(account.id, type.value);

    let recorded;
    try {
      recorded = await recordPhoto(garment, slot, new Uint8Array(await file.arrayBuffer()), mime);
    } catch {
      return Response.json({ error: "We could not read this image. Please try another one (JPEG or PNG)." }, { status: 415 });
    }
    const { garment: updated, quality } = recorded;
    return Response.json(
      { garment: publicGarment(updated), quality, missing: missingSlots(updated) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
