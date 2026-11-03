import { requirePlatform, unauthorised } from "@/lib/session";
import { newShareToken, shareToken } from "@/lib/share";

export const runtime = "nodejs";

/** The current share link's token (made on first ask). Platform admin only. */
export async function GET() {
  try {
    await requirePlatform();
    return Response.json({ token: (await shareToken()) ?? (await newShareToken()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the link." }, { status: 500 });
  }
}

/** A new link; the old one stops working. */
export async function POST() {
  try {
    await requirePlatform();
    return Response.json({ token: await newShareToken() });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not make a new link." }, { status: 500 });
  }
}
