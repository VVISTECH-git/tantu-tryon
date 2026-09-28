import { PART_ORDER, getGarment, missingSlots, publicGarment, type PartSlot } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";
import sharp from "sharp";
import { cleanEdit } from "@tantu/shared/photoEdit";
import { getObject, getObjectStart, headObject, previewKeyFor, putObject } from "@/lib/storage";
import { MAX_PHOTO_BYTES, photoTypeAllowed, recordPhoto, recordPhotoWithPreview } from "@/lib/uploads";

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
    const body = (await request.json().catch(() => ({}))) as { garmentId?: string; slot?: string; key?: string; previewKey?: string; brightness?: number };
    // The one edit the phone cannot make itself (28 Sep); crop, turns and straighten arrive already in the photo.
    const brightness = cleanEdit({ brightness: body.brightness })?.brightness ?? 0;
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
      // With the phone's own preview: size from the original's first bytes, the
      // check from the preview. Otherwise the whole original, as before.
      if (brightness) {
        // Brightness chosen on the edit screen: applied to the photo itself at full resolution
        // and the highest JPEG quality, and the screen copies made from that.
        const bright = await sharp(await getObject(body.key)).autoOrient().modulate({ brightness: 1 + brightness }).jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
        await putObject(body.key, bright, "image/jpeg");
        recorded = await recordPhoto(garment, slot, bright, "image/jpeg", body.key, account.username);
      }
      const preview = !recorded && body.previewKey === previewKeyFor(body.key) && (await headObject(body.previewKey)) ? body.previewKey : null;
      recorded ??= preview
        ? await recordPhotoWithPreview(garment, slot, body.key, await getObjectStart(body.key), preview, await getObject(preview), account.username, () => getObject(body.key!))
        : await recordPhoto(garment, slot, await getObject(body.key), mime, body.key, account.username);
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
