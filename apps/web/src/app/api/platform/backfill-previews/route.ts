import { eq } from "drizzle-orm";
import { db, garments, type GarmentPartRow } from "@/db";
import { savePreview, saveThumb } from "@/lib/garments";
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

    // A preview, and (28 Sep) the tiny list thumbnail, for every photo that lacks one.
    const needs = (p: GarmentPartRow) => Boolean(p.key) && (!p.previewKey || !p.thumbKey);
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
        // The thumbnail comes from the preview when there is one: far less to read than the original.
        const bytes = await getObject(part.previewKey ?? part.key!).catch(() => null);
        const ok = bytes && bytes.byteLength > 0;
        const previewKey = part.previewKey ?? (ok ? await savePreview(part.key!, bytes) : null);
        const thumbKey = part.thumbKey ?? (ok ? await saveThumb(part.key!, bytes) : null);
        if (!previewKey || !thumbKey) problems.push(`${part.key}: ${bytes ? "could not be read as an image" : "not found in storage"}`);
        if (previewKey && thumbKey) {
          parts.push({ ...part, previewKey, previewUrl: assetUrl(previewKey), thumbKey, thumbUrl: assetUrl(thumbKey) });
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
