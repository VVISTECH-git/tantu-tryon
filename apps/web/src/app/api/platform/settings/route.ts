import { IMAGE_OPTIONS, chosenImageOption, livePrices, liveRate } from "@/lib/imageModels";
import { requirePlatform, unauthorised } from "@/lib/session";
import { listShops } from "@/lib/shops";

export const runtime = "nodejs";

/**
 * The platform settings for the phone: the same as the web Platform page.
 * Every image model with Google's live price per image (read fresh, like
 * the page), which one is in use, and every shop with its balance for
 * granting credit. Platform admin only.
 */
export async function GET() {
  try {
    await requirePlatform();
    const [prices, rate, chosen, shops] = await Promise.all([livePrices(), liveRate(), chosenImageOption(), listShops()]);
    const inr = (usd: number | null | undefined) => (usd == null ? null : Math.round(usd * rate.value * 100));
    return Response.json(
      {
        chosen: chosen.id,
        rate: { inrPerUsd: rate.value, source: rate.source, at: rate.at },
        prices: { source: prices.source, at: prices.at },
        options: IMAGE_OPTIONS.map((o) => ({
          id: o.id,
          name: o.name,
          detail: o.detail,
          selectable: o.selectable,
          normalPaise: inr(prices.value[o.id]?.normal),
          batchPaise: inr(prices.value[o.id]?.batch),
        })),
        shops: shops.map((s) => ({ id: s.id, name: s.name, owner: s.owner, house: s.house, balancePaise: s.balancePaise })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the platform settings." }, { status: 500 });
  }
}
