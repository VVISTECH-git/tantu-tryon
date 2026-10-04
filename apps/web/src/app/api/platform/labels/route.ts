import { inArray } from "drizzle-orm";
import { db, garments } from "@/db";
import { CroppedOnWebsite, listLabels, saveLabel, type LabelUpload } from "@/lib/partLabels";
import { assetUrl } from "@/lib/storage";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * The laptop's upload of marked training photos (4 Oct): one photo per call,
 * its screen-sized copy inline and the original PUT straight to the bucket
 * on the URL returned. Platform admin only.
 */
export async function POST(request: Request) {
  try {
    await requirePlatform();
    const u = (await request.json().catch(() => null)) as LabelUpload | null;
    if (!u?.source || !u.preview || !(u.width > 0) || !(u.height > 0) || !Array.isArray(u.regions)) {
      return Response.json({ error: "Send source, width, height, regions and preview." }, { status: 400 });
    }
    return Response.json(await saveLabel(u));
  } catch (error) {
    if (error instanceof CroppedOnWebsite) return Response.json({ error: error.message }, { status: 409 });
    return unauthorised(error) ?? Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}

/**
 * Every photo with its verdict and note, so the laptop can pick up what staff
 * flagged. A photo cropped on the website also comes with its new photo and
 * the moved marks, for the laptop to take in place of its own.
 */
export async function GET() {
  try {
    await requirePlatform();
    const rows = await listLabels();
    const edited = rows.filter((r) => r.photoEditedAt && r.garmentId);
    const products = edited.length
      ? await db.select({ id: garments.id, parts: garments.parts }).from(garments).where(inArray(garments.id, edited.map((r) => r.garmentId!)))
      : [];
    const photoOf = (garmentId: string | null, slot: string | null) => {
      const part = products.find((g) => g.id === garmentId)?.parts.find((p) => p.slot === slot && p.key);
      return part?.key ? assetUrl(part.key) : null;
    };
    return Response.json(
      rows.map(({ id, source, taskNo, status, note, reviewedBy, reviewedAt, photoEditedAt, garmentId, slot, regions, width, height }) => ({
        id,
        source,
        taskNo,
        status,
        note,
        reviewedBy,
        reviewedAt,
        photoEditedAt,
        ...(photoEditedAt ? { photoUrl: photoOf(garmentId, slot), regions, width, height } : {}),
      })),
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not list the photos." }, { status: 500 });
  }
}
