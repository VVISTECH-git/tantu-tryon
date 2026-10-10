import { saveAutoMarks, type AutoMarks } from "@/lib/partLabels";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Marks the laptop made by itself on one product photo, saved as "To check".
 * 409 when the photo was retaken meanwhile: it comes back on the next list.
 */
export async function POST(request: Request) {
  try {
    await requirePlatform();
    if (process.env.AUTO_MARK !== "on") return Response.json({ error: "Auto-marking is switched off." }, { status: 409 });
    const u = (await request.json().catch(() => null)) as AutoMarks | null;
    if (!u?.garmentId || !u.slot || !u.key || !u.preview || !(u.width > 0) || !(u.height > 0) || !Array.isArray(u.regions)) {
      return Response.json({ error: "Send garmentId, slot, key, width, height, regions and preview." }, { status: 400 });
    }
    const saved = await saveAutoMarks(u);
    if (!saved) return Response.json({ error: "That photo was retaken; it will be marked again." }, { status: 409 });
    return Response.json(saved);
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: error instanceof Error ? error.message : "Could not save the marks." }, { status: 500 });
  }
}
