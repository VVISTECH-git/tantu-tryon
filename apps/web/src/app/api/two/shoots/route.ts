import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { garmentType as typeOf } from "@/content/shots";
import { requireAccount, unauthorised } from "@/lib/session";
import { assetUrl } from "@/lib/storage";

export const runtime = "nodejs";

const PER_PAGE = 12;

/**
 * "My photos" on tantu-two (9 Oct): the seller's shoots, newest first — each product's own photos
 * and every picture made from them — so nothing is lost when the page is closed.
 *
 *   GET ?page=1  → { shoots: [{ garmentId, garment, createdAt, photos, pictures }], page, pages }
 */
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    const made = await db
      .select({ id: generations.id, garmentId: generations.garmentId, promptId: generations.promptId, imageKey: generations.imageKey, startedAt: generations.startedAt })
      .from(generations)
      .where(and(eq(generations.accountId, account.id), eq(generations.status, "done")))
      .orderBy(desc(generations.startedAt));
    const order: string[] = [];
    for (const g of made) if (g.imageKey && !order.includes(g.garmentId)) order.push(g.garmentId);
    const pages = Math.max(1, Math.ceil(order.length / PER_PAGE));
    const ids = order.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const rows = ids.length
      ? await db.select().from(garments).where(and(inArray(garments.id, ids), eq(garments.accountId, account.id), isNull(garments.deletedAt)))
      : [];
    const shoots = ids
      .map((id) => rows.find((r) => r.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((g) => {
        const words = (g.words ?? {}) as Record<string, string>;
        const pictures = made.filter((m) => m.garmentId === g.id && m.imageKey);
        return {
          garmentId: g.id,
          garment: words.twoGarment || typeOf(g.garmentType).label,
          productCode: g.productCode,
          createdAt: pictures[0]?.startedAt ?? g.createdAt,
          photos: g.parts.filter((p) => p.key).map((p) => ({ slot: p.slot, url: assetUrl(p.thumbKey ?? p.previewKey ?? p.key!) })),
          pictures: pictures.map((m) => ({ id: m.id, pose: m.promptId, url: assetUrl(m.imageKey!), createdAt: m.startedAt })),
        };
      });
    return Response.json({ shoots, page, pages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load your photos." }, { status: 500 });
  }
}
