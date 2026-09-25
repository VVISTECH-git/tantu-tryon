import { DEFAULT_GARMENT_TYPE, garmentType } from "@/content/shots";
import { PART_ORDER, createUploadGarment, getGarment, type PartSlot } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";
import { extensionFor, keys, presignPut, storageConfigured } from "@/lib/storage";
import { photoTypeAllowed } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Step one of a full-size upload: where to PUT the camera original.
 *
 * JSON `{ slot, type, garmentId?, contentType }`. Makes the garment on the
 * first photo, as the multipart route does, and returns a URL good for five
 * minutes, bound to this key and this content type. 501 when there is no
 * R2 (a laptop without keys): the phone then falls back to the multipart
 * route.
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!storageConfigured()) return Response.json({ error: "Direct upload is not set up here." }, { status: 501 });
    const body = (await request.json().catch(() => ({}))) as { slot?: string; type?: string; garmentId?: string; contentType?: string };
    const slot = String(body.slot ?? "") as PartSlot;
    const type = garmentType(body.type ?? DEFAULT_GARMENT_TYPE);
    const contentType = body.contentType ?? "image/jpeg";

    if (!PART_ORDER.includes(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });
    if (!type.enabled) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
    if (!photoTypeAllowed(contentType)) return Response.json({ error: "Please send a JPEG or PNG photo." }, { status: 415 });

    let garment = body.garmentId ? await getGarment(body.garmentId, account.id) : null;
    if (body.garmentId && !garment) return Response.json({ error: "No such garment." }, { status: 404 });
    garment ??= await createUploadGarment(account.id, type.value);

    const key = keys.part(garment.id, slot, extensionFor(contentType));
    const url = await presignPut(key, contentType);
    return Response.json({ garmentId: garment.id, key, url, contentType }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not start the upload." }, { status: 500 });
  }
}
