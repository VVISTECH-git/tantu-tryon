import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { balancePaise, grantCredits } from "@/lib/spend";

export const runtime = "nodejs";

/**
 * Credit for a shop (8 Oct): the Platform page's Grant credit, reachable by the
 * laptop's scripts. Platform admin only. `{ shop?: id, rupees }`; no shop means
 * the caller's own (the house shop for the admin's laptop token).
 */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { shop?: string; rupees?: number };
    const rupees = Number(body.rupees);
    if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 100_000) return Response.json({ error: "Rupees must be between 1 and 1,00,000." }, { status: 400 });
    const shop = typeof body.shop === "string" && body.shop ? body.shop : account.id;
    await grantCredits(shop, Math.round(rupees * 100), "platform grant");
    return Response.json({ shop, balancePaise: await balancePaise(shop) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not grant credit." }, { status: 500 });
  }
}
