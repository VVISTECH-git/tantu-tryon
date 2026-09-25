import { DEFAULT_GARMENT_TYPE, garmentType } from "@/content/shots";
import { PRODUCT_ID_PATTERN, createUploadGarment, missingSlots, openProductGarment, publicGarment } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Open the record for a product ID before any photograph is taken.
 *
 * JSON `{ productId, type }`. Every photograph taken next is saved against
 * this record; the same ID on another day reopens it.
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json().catch(() => ({}))) as { productId?: string; type?: string; noProductId?: boolean };
    // Without a product ID: a fresh record each time, marked "No product ID",
    // which can be given one later from its shot screen.
    if (body.noProductId === true) {
      const type = garmentType(body.type ?? DEFAULT_GARMENT_TYPE);
      if (!type.enabled) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
      const garment = await createUploadGarment(account.id, type.value);
      return Response.json({ garment: publicGarment(garment), missing: missingSlots(garment) }, { headers: { "Cache-Control": "no-store" } });
    }
    const productId = (body.productId ?? "").trim();
    if (!PRODUCT_ID_PATTERN.test(productId)) {
      return Response.json({ error: "Enter the product ID: letters and numbers, up to 40 characters." }, { status: 400 });
    }
    const type = garmentType(body.type ?? DEFAULT_GARMENT_TYPE);
    if (!type.enabled) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
    const garment = await openProductGarment(account.id, productId, type.value);
    return Response.json({ garment: publicGarment(garment), missing: missingSlots(garment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not open the product." }, { status: 500 });
  }
}
