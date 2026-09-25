import { PART_ORDER, getGarment, missingSlots, publicGarment, type PartSlot } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";
import { getObject, headObject } from "@/lib/storage";
import { MAX_PHOTO_BYTES, photoTypeAllowed, recordPhoto } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Step two: the original is in R2, record it as the part.
 *
 * JSON `{ garmentId, slot, key }`. The key must be one of this garment's
 * part keys, and the object must exist, be a photo and be under the size
 * cap. Nothing is re-encoded: the bytes are read only to measure them and
 * run the free quality check.
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json().catch(() => ({}))) as { garmentId?: string; slot?: string; key?: string };
    const slot = String(body.slot ?? "") as PartSlot;
    if (!body.garmentId || !body.key) return Response.json({ error: "garmentId and key are required." }, { status: 400 });
    if (!PART_ORDER.includes(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });

    const garment = await getGarment(body.garmentId, account.id);
    if (!garment) return Response.json({ error: "No such garment." }, { status: 404 });
    if (!body.key.startsWith(`garments/${garment.id}/${slot}-`)) {
      return Response.json({ error: "That upload does not belong to this garment." }, { status: 400 });
    }

    const head = await headObject(body.key);
    if (!head) return Response.json({ error: "The photo did not arrive. Please try again." }, { status: 409 });
    if (head.size > MAX_PHOTO_BYTES) return Response.json({ error: "That photo is too large." }, { status: 413 });
    const mime = head.contentType ?? "image/jpeg";
    if (!photoTypeAllowed(mime)) return Response.json({ error: "Please send a JPEG or PNG photo." }, { status: 415 });

    let recorded;
    try {
      recorded = await recordPhoto(garment, slot, await getObject(body.key), mime, body.key, account.username);
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
