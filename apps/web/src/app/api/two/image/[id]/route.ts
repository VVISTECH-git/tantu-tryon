import { and, eq } from "drizzle-orm";
import { db, generations } from "@/db";
import { requireAccount, unauthorised } from "@/lib/session";
import { readAsset } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * A finished photo's bytes for tantu-two (9 Oct): its pages live on their own site, so they read
 * the image through here (signed in, the owner only) to show it and to save it in any format.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    const { id } = await params;
    const [row] = await db
      .select({ key: generations.imageKey, mime: generations.imageMime })
      .from(generations)
      .where(and(eq(generations.id, id), eq(generations.accountId, account.id)))
      .limit(1);
    if (!row?.key) return Response.json({ error: "No such photo." }, { status: 404 });
    const bytes = await readAsset(row.key);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": row.mime || "image/png", "Cache-Control": "private, max-age=86400" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the photo." }, { status: 500 });
  }
}
