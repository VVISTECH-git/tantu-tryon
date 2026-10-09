import { eq } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { assetUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * One generation from any account, for the platform admin to check (9 Oct: the owner's tantu-two
 * shoots live on their Google account; Claude checks them with the admin token): the product
 * photos, the prompt and the picture.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const { id } = await params;
    const [row] = await db
      .select({ g: generations, garment: garments })
      .from(generations)
      .innerJoin(garments, eq(garments.id, generations.garmentId))
      .where(eq(generations.id, id))
      .limit(1);
    if (!row) return Response.json({ error: "No such generation." }, { status: 404 });
    const { g, garment } = row;
    return Response.json(
      {
        id: g.id,
        status: g.status,
        error: g.error,
        model: g.model,
        costPaise: g.costPaise,
        ms: g.ms,
        promptText: g.promptText,
        imageUrl: g.imageKey ? assetUrl(g.imageKey) : null,
        garment: { id: garment.id, type: garment.garmentType, words: garment.words, photos: garment.parts.filter((p) => p.key).map((p) => ({ slot: p.slot, url: assetUrl(p.key!) })) },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read it." }, { status: 500 });
  }
}
