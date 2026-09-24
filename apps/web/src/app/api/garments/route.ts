import { createGarmentFromSlk, publicGarment } from "@/lib/garments";
import { requireAccount, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/** Start a garment from an SLK product code. */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = String(body.code ?? "").trim();
    if (!code) return Response.json({ error: "Which product code?" }, { status: 400 });
    const made = await createGarmentFromSlk(account.id, code);
    if (!made.ok) return Response.json({ error: made.message }, { status: made.status });
    return Response.json({ garment: publicGarment(made.garment) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not start the garment." }, { status: 500 });
  }
}
