import { requirePlatform, unauthorised } from "@/lib/session";
import { listShops } from "@/lib/shops";
import { grantCredits } from "@/lib/spend";

export const runtime = "nodejs";

/** Add shop credit (rupees) to one shop. Platform admin only. */
export async function POST(request: Request) {
  try {
    await requirePlatform();
    const { shopId, rupees } = (await request.json().catch(() => ({}))) as { shopId?: string; rupees?: number };
    const amount = Number(rupees);
    if (!shopId || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return Response.json({ error: "Choose a shop and an amount between ₹1 and ₹1,00,000." }, { status: 400 });
    }
    const shops = await listShops();
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return Response.json({ error: "No such shop." }, { status: 404 });
    await grantCredits(shop.id, Math.round(amount * 100), "platform grant");
    return Response.json({ ok: true, balancePaise: shop.balancePaise + Math.round(amount * 100) });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not grant the credit." }, { status: 500 });
  }
}
