import { canReviewLabels, labelById } from "@/lib/partLabels";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * A training photo, only to a signed-in reviewer: these are the shop's own
 * work, so they never get a public address.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!canReviewLabels(account)) throw new Forbidden();
    const row = await labelById((await params).id);
    if (!row) return new Response("Not found", { status: 404 });
    const bytes = await getObject(row.previewKey);
    return new Response(bytes as BodyInit, {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch (error) {
    return unauthorised(error) ?? new Response("Could not load the photo.", { status: 500 });
  }
}
