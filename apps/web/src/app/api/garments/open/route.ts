import { DEFAULT_GARMENT_TYPE, garmentType } from "@/content/shots";
import { PRODUCT_ID_PATTERN, createUploadGarment, missingSlots, openProductGarment, publicGarment } from "@/lib/garments";
import { deviceFrom, openAutoProduct, peekAutoProductId, usedFrom } from "@/lib/autoProductId";
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
    const body = (await request.json().catch(() => ({}))) as { productId?: string; type?: string; noProductId?: boolean; auto?: boolean; used?: unknown };
    // The photographer login gets its product IDs given out (9001, 9002, …)
    // and may not start a record without one (28 Sep).
    if (body.auto === true) {
      const type = garmentType(body.type ?? DEFAULT_GARMENT_TYPE);
      if (!type.enabled) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
      const garment = await openAutoProduct(account.id, type.value, deviceFrom(request), usedFrom(body.used));
      return Response.json({ garment: publicGarment(garment), missing: missingSlots(garment) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.noProductId === true && account.role === "photographer") {
      return Response.json({ error: "The photographer login always gets a product ID. Tap Continue to photos." }, { status: 403 });
    }
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
    // A platform admin may file products of types not live yet (the catalogue import, 7 Oct).
    if (!type.enabled && !account.platformAdmin) return Response.json({ error: `${type.label} is coming soon.` }, { status: 400 });
    const garment = await openProductGarment(account.id, productId, type.value);
    return Response.json({ garment: publicGarment(garment), missing: missingSlots(garment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not open the product." }, { status: 500 });
  }
}

/** The product ID the next automatic Continue would get (photographer login). */
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    return Response.json({ nextId: await peekAutoProductId(account.id, deviceFrom(request), usedFrom(new URL(request.url).searchParams.get("used"))) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the next product ID." }, { status: 500 });
  }
}
