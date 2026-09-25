import { findFabric } from "@/lib/fabricBox";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Where the saree is in a photo, for the crop screen's starting box.
 *
 * The phone sends a small copy (a few hundred pixels; the original never
 * leaves the phone for this), as the raw JPEG body. Answers `{ box }` in
 * fractions of the photo, or `{ box: null }` when it cannot tell. No AI
 * call: this is arithmetic on the pixels, and free.
 */
export async function POST(request: Request) {
  try {
    await requireAccount();
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000) {
      return Response.json({ error: "Send a small JPEG of the photo." }, { status: 400 });
    }
    const box = await findFabric(bytes).catch(() => null);
    return Response.json({ box }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not look at the photo." }, { status: 500 });
  }
}
