import { eq } from "drizzle-orm";
import { db, garments, type GarmentPartRow } from "@/db";
import { savePreview } from "@/lib/garments";
import { requirePlatform, unauthorised } from "@/lib/session";
import { assetUrl, getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One-off: a screen preview for every photo recorded before previews existed
 * (28 Sep), so older photos open as fast as new ones. Platform admin only.
 *
 * Writes only `previewKey` / `previewUrl` on each part, straight to the row:
 * not through updateGarment, which would also drop the cached sheet. The
 * originals are read, never changed. Works in batches (`?limit=`, default
 * 15 photos) so each call stays well inside the time limit; call again until
 * `remaining` is 0.
 */
export async function POST(request: Request) {
  try {
    await requirePlatform();
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 15), 1), 40);
    const rows = await db.select({ id: garments.id, parts: garments.parts }).from(garments);

    const needs = (p: GarmentPartRow) => Boolean(p.key) && !p.previewKey;
    let made = 0;
    let failed = 0;
    const problems: string[] = [];
    for (const row of rows) {
      if (made + failed >= limit) break;
      if (!row.parts.some(needs)) continue;
      const parts: GarmentPartRow[] = [];
      for (const part of row.parts) {
        if (!needs(part) || made + failed >= limit) {
          parts.push(part);
          continue;
        }
        const bytes = await getObject(part.key!).catch(() => null);
        const previewKey = bytes && bytes.byteLength > 0 ? await savePreview(part.key!, bytes) : null;
        if (!previewKey) problems.push(`${part.key}: ${bytes ? "could not be read as an image" : "not found in storage"}`);
        if (previewKey) {
          parts.push({ ...part, previewKey, previewUrl: assetUrl(previewKey) });
          made++;
        } else {
          parts.push(part);
          failed++;
        }
      }
      await db.update(garments).set({ parts }).where(eq(garments.id, row.id));
    }

    const after = await db.select({ parts: garments.parts }).from(garments);
    const remaining = after.reduce((n, r) => n + r.parts.filter(needs).length, 0);
    return Response.json({ made, failed, remaining, problems }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not make previews." }, { status: 500 });
  }
}
