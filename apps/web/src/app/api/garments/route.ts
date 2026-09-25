import { createGarmentFromSlk, listGarments, missingSlots, publicGarment } from "@/lib/garments";
import { isHouseShop, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** Start a garment from an SLK product code. */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!isHouseShop(account)) return Response.json({ error: "Product codes come from Tantu's own inventory." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = String(body.code ?? "").trim();
    if (!code) return Response.json({ error: "Which product code?" }, { status: 400 });
    const made = await createGarmentFromSlk(account.id, code);
    if (!made.ok) return Response.json({ error: made.message }, { status: made.status });
    return Response.json({ garment: publicGarment(made.garment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not start the garment." }, { status: 500 });
  }
}

/**
 * The saved products: each record's product ID, how many photographs it
 * holds, which required ones are still missing, and a thumbnail to know it by.
 */
export async function GET() {
  try {
    const account = await requireAccount();
    const rows = await listGarments(account.id);
    const products = rows.map((g) => {
      const pub = publicGarment(g);
      const body = pub.parts.find((p) => p.slot === "body") ?? pub.parts[0];
      return {
        id: g.id,
        productId: g.productCode,
        title: g.title,
        garmentType: g.garmentType,
        photos: g.parts.length,
        slots: g.parts.map((p) => p.slot),
        missing: missingSlots(g),
        thumb: body?.url ?? null,
        updatedAt: g.updatedAt.toISOString(),
      };
    });
    return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the saved products." }, { status: 500 });
  }
}
