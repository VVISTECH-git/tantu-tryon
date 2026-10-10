import { photosToMark } from "@/lib/partLabels";
import { requirePlatform, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** The house shop's product photos waiting for marks, oldest first: the laptop's work list. Platform admin only. */
export async function GET() {
  try {
    await requirePlatform();
    // 10 Oct, user: "stop auto marking" — the work list is empty while AUTO_MARK is off (the default now),
    // so the laptop program idles wherever it runs. Set AUTO_MARK=on to resume.
    if (process.env.AUTO_MARK !== "on") return Response.json([], { headers: { "Cache-Control": "no-store" } });
    return Response.json(await photosToMark(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not list the photos." }, { status: 500 });
  }
}
