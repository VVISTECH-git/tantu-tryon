import { and, eq, isNull } from "drizzle-orm";
import { db, garments } from "@/db";
import { canReviewLabels, cleanRegions, saveFixedMarks } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Marks drawn on the Products page for a photo nobody marked yet. JSON `{ slot, regions }`; saved as approved by this login. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const { id } = await params;
    const [g] = await db.select({ accountId: garments.accountId }).from(garments).where(and(eq(garments.id, id), isNull(garments.deletedAt))).limit(1);
    if (!g || (!account.platformAdmin && g.accountId !== account.id)) return Response.json({ error: "No such product." }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { slot?: string; regions?: unknown };
    const regions = cleanRegions(body.regions);
    if (!body.slot || !regions) return Response.json({ error: "Each part needs a name and at least 3 points." }, { status: 400 });
    const row = await saveFixedMarks({ garmentId: id, slot: body.slot }, regions, account.username ?? account.name);
    if (!row) return Response.json({ error: "That photo is not there." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not save the marks." }, { status: 500 });
  }
}
