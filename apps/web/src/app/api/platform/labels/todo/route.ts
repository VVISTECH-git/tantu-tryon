import { photosToMark } from "@/lib/partLabels";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** The house shop's product photos waiting for marks, oldest first: the laptop's work list. Platform admin only. */
export async function GET() {
  try {
    await requirePlatform();
    return Response.json(await photosToMark(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not list the photos." }, { status: 500 });
  }
}
