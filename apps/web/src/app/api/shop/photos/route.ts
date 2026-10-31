import { and, desc, inArray, isNull, sql } from "drizzle-orm";
import { db, garments } from "@/db";
import { captureShotsFor, garmentType } from "@/content/shots";

export const runtime = "nodejs";

/**
 * The shop's photos for products, by the code on their tag (31 Oct).
 *
 * The aartisanz upload portal (ndt-portal) asks this with the tag codes in
 * Durga Rao's file, and puts a product live on aartisanz.com once every shot
 * on the photographer's list is done. The tag photo is never returned.
 *
 * Open like /api/products/[code]: it answers only for codes the caller already
 * has, and returns a title plus addresses R2 already serves publicly.
 *
 * A photo still waiting to be turned upright (`rotate` set) counts as missing,
 * so a sideways picture never reaches the shop.
 */

const MAX_CODES = 200;

export interface ShopPhotos {
  code: string;
  type: string;
  title: string;
  /** In the photographer's order. */
  photos: { slot: string; label: string; url: string }[];
  /** Labels of shots not taken yet. */
  missing: string[];
  ready: boolean;
  updatedAt: string;
}

export async function POST(request: Request) {
  let codes: string[];
  try {
    const body = (await request.json()) as { codes?: unknown };
    if (!Array.isArray(body.codes)) throw new Error();
    codes = [...new Set(body.codes.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()).filter(Boolean))];
  } catch {
    return Response.json({ error: "Send { codes: [...] }." }, { status: 400, headers: CORS });
  }
  if (codes.length > MAX_CODES) return Response.json({ error: `At most ${MAX_CODES} codes at a time.` }, { status: 400, headers: CORS });
  if (!codes.length) return Response.json({ products: [] }, { headers: CORS });

  const rows = await db
    .select()
    .from(garments)
    .where(and(inArray(sql`upper(${garments.productCode})`, codes), isNull(garments.deletedAt)))
    .orderBy(desc(garments.updatedAt));

  const out = new Map<string, ShopPhotos>();
  for (const g of rows) {
    const code = (g.productCode ?? "").toUpperCase();
    if (out.has(code)) continue; // the most recently worked-on one wins
    const shots = captureShotsFor(g.garmentType);
    const upright = (slot: string) => g.parts.find((p) => p.slot === slot && !p.rotate && p.url);
    const photos = shots.flatMap((s) => {
      const p = upright(s.slot);
      return p ? [{ slot: s.slot, label: s.label, url: p.url }] : [];
    });
    const missing = shots.filter((s) => !upright(s.slot)).map((s) => s.label);
    out.set(code, {
      code,
      type: garmentType(g.garmentType).label,
      title: g.title,
      photos,
      missing,
      ready: photos.length > 0 && missing.length === 0,
      updatedAt: g.updatedAt.toISOString(),
    });
  }
  return Response.json({ products: [...out.values()] }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

const CORS = { "Access-Control-Allow-Origin": "*" };
