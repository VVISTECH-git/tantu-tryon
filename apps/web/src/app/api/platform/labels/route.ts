import { listLabels, saveLabel, type LabelUpload } from "@/lib/partLabels";
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
    return unauthorised(error) ?? Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}

/** Every photo with its verdict and note, so the laptop can pick up what staff flagged. */
export async function GET() {
  try {
    await requirePlatform();
    const rows = await listLabels();
    return Response.json(
      rows.map(({ id, source, taskNo, status, note, reviewedBy, reviewedAt }) => ({ id, source, taskNo, status, note, reviewedBy, reviewedAt })),
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not list the photos." }, { status: 500 });
  }
}
