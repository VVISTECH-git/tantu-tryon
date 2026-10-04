import { and, eq, isNull } from "drizzle-orm";
import { db, garments } from "@/db";
import { canReviewLabels, cleanRegions, labelById, saveFixedMarks } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** Marks fixed on the Products page for one marked photo: saved and approved by this login. JSON `{ regions }`. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const label = await labelById((await params).id);
    if (!label) return Response.json({ error: "Those marks are gone." }, { status: 404 });
    if (!account.platformAdmin) {
      // A shop login fixes only its own products' photos.
      const [g] = label.garmentId
        ? await db.select({ accountId: garments.accountId }).from(garments).where(and(eq(garments.id, label.garmentId), isNull(garments.deletedAt))).limit(1)
        : [];
      if (g?.accountId !== account.id) throw new Forbidden();
    }
    const regions = cleanRegions(((await request.json().catch(() => ({}))) as { regions?: unknown }).regions);
    if (!regions) return Response.json({ error: "Each part needs a name and at least 3 points." }, { status: 400 });
    const row = await saveFixedMarks({ labelId: label.id }, regions, account.username ?? account.name);
    return Response.json({ ok: !!row });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not save the marks." }, { status: 500 });
  }
}
