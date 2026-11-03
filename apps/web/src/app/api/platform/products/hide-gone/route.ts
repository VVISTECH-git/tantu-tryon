import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, garments, generations, settings } from "@/db";
import { deleteGarment } from "@/lib/garments";
import { requirePlatform, unauthorised } from "@/lib/session";
import { listObjects } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Hide every product whose photos are no longer in storage (3 Nov: the old
 * test products' photos were deleted from R2, leaving their rows behind).
 *
 * Hiding sets deletedAt, the same mark an admin delete leaves when images
 * remain, so every list and lookup skips the product. Nothing is removed:
 * the ids hidden are kept under one setting, and DELETE puts them back.
 * Platform admin only.
 */
const UNDO_KEY = "productsHiddenPhotosGone";

export async function POST() {
  try {
    await requirePlatform();
    const stored = new Set((await listObjects("garments/")).map((o) => o.key));
    const rows = await db.select({ id: garments.id, parts: garments.parts }).from(garments).where(isNull(garments.deletedAt));
    // Gone: it has photos, every one is ours (an R2 key), and none of those keys is left.
    const gone = rows
      .filter((g) => g.parts.length > 0 && g.parts.every((p) => p.key && !stored.has(p.key)))
      .map((g) => g.id);
    if (gone.length) {
      await db.transaction(async (tx) => {
        await tx.update(garments).set({ deletedAt: new Date() }).where(inArray(garments.id, gone));
        const prev = await tx.select().from(settings).where(eq(settings.key, UNDO_KEY));
        const ids = [...new Set([...(prev[0] ? (JSON.parse(prev[0].value) as string[]) : []), ...gone])];
        await tx
          .insert(settings)
          .values({ key: UNDO_KEY, value: JSON.stringify(ids) })
          .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(ids), updatedAt: new Date() } });
      });
    }
    return Response.json({ hidden: gone.length, kept: rows.length - gone.length });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not hide them." }, { status: 500 });
  }
}

async function hiddenIds(): Promise<string[]> {
  const prev = await db.select().from(settings).where(eq(settings.key, UNDO_KEY));
  return prev[0] ? (JSON.parse(prev[0].value) as string[]) : [];
}

/** How many products this button has hidden and not yet shown again or deleted. */
export async function GET() {
  try {
    await requirePlatform();
    return Response.json({ hidden: (await hiddenIds()).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read it." }, { status: 500 });
  }
}

/**
 * Delete the hidden products for good, the same way a single admin delete
 * does: a product with images made from it stays hidden (its images keep
 * their record); the rest are removed. Pressed by the admin on the page.
 */
export async function PATCH() {
  try {
    await requirePlatform();
    const ids = await hiddenIds();
    const rows = ids.length ? await db.select().from(garments).where(inArray(garments.id, ids)) : [];
    let removed = 0;
    const stillHidden: string[] = [];
    for (const g of rows) {
      // 3 Nov, user: delete them for good, AI images included (their files are already gone from storage).
      await db.delete(generations).where(eq(generations.garmentId, g.id));
      const outcome = await deleteGarment(g);
      if (outcome === "removed") removed++;
      else stillHidden.push(g.id);
    }
    if (stillHidden.length) {
      await db.update(settings).set({ value: JSON.stringify(stillHidden), updatedAt: new Date() }).where(eq(settings.key, UNDO_KEY));
    } else {
      await db.delete(settings).where(eq(settings.key, UNDO_KEY));
    }
    return Response.json({ removed, keptHidden: stillHidden.length });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not delete them." }, { status: 500 });
  }
}

/** Undo: show again every product this button hid. */
export async function DELETE() {
  try {
    await requirePlatform();
    const ids = await hiddenIds();
    if (ids.length) {
      await db.transaction(async (tx) => {
        await tx.update(garments).set({ deletedAt: null }).where(and(inArray(garments.id, ids)));
        await tx.delete(settings).where(eq(settings.key, UNDO_KEY));
      });
    }
    return Response.json({ shown: ids.length });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not undo." }, { status: 500 });
  }
}
