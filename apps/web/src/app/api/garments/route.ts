import { createGarmentFromSlk, listGarments, missingSlots, publicGarment } from "@/lib/garments";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, generations } from "@/db";
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
    // A record is made when Continue is tapped, before any photo; one left
    // with no photos is not shown (28 Sep: empty rows filled the list).
    // Up to 2,000: the catalogue import alone is 413 (7 Oct); the first 200 cut the list short.
    const rows = (await listGarments(account.id, 2000)).filter((g) => g.parts.length > 0);
    // Images made per product (30 Sep): shown in the list, for photographers too.
    const made = rows.length
      ? await db
          .select({ garmentId: generations.garmentId, n: count() })
          .from(generations)
          .where(and(inArray(generations.garmentId, rows.map((g) => g.id)), eq(generations.status, "done")))
          .groupBy(generations.garmentId)
      : [];
    const images = new Map(made.map((m) => [m.garmentId, m.n]));
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
        // The tiny list copy, else the preview, never the camera original (6-15 MB left the list blank, 28 Sep).
        thumb: (body && "thumbUrl" in body ? body.thumbUrl : undefined) ?? (body && "previewUrl" in body ? body.previewUrl : undefined) ?? body?.url ?? null,
        updatedAt: g.updatedAt.toISOString(),
        images: images.get(g.id) ?? 0,
      };
    });
    return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the saved products." }, { status: 500 });
  }
}
