import { and, eq, isNull } from "drizzle-orm";
import { db, garments } from "@/db";
import { PART_ORDER, type PartSlot } from "@/lib/garments";
import { canReviewLabels } from "@/lib/partLabels";
import { cropProductPhoto, type CropRect } from "@/lib/photoCrop";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Crop one of a product's photos from the Products page (4 Oct). JSON
 * `{ slot, x, y, w, h }` in percent of the upright photo. The platform
 * admin, or the shop's own owner and studio logins.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const { id } = await params;
    const [garment] = await db.select().from(garments).where(and(eq(garments.id, id), isNull(garments.deletedAt))).limit(1);
    if (!garment || (!account.platformAdmin && garment.accountId !== account.id)) {
      return Response.json({ error: "No such product." }, { status: 404 });
    }
    const body = (await request.json().catch(() => ({}))) as Partial<CropRect> & { slot?: string };
    const slot = String(body.slot ?? "") as PartSlot;
    if (!PART_ORDER.includes(slot)) return Response.json({ error: `Unknown part: ${slot}.` }, { status: 400 });
    const rect = { x: Number(body.x), y: Number(body.y), w: Number(body.w), h: Number(body.h) };
    const ok = Object.values(rect).every(Number.isFinite) && rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0 && rect.x + rect.w <= 100.01 && rect.y + rect.h <= 100.01;
    if (!ok) return Response.json({ error: "That crop is outside the photo." }, { status: 400 });
    await cropProductPhoto(garment, slot, rect, account.username);
    return Response.json({ ok: true });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not crop the photo." }, { status: 500 });
  }
}
