/**
 * What a Generate is about to cost, shown before the button is pressed.
 *
 * Every tool in this market meters you in "credits" whose relationship to money
 * is deliberately unclear. This shows the real provider cost in real currency.
 * The rates are estimates and configurable — nothing here bills anyone.
 */

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Provider list price per generated image, in USD. */
export const COST_PER_IMAGE_USD = {
  standard: number(process.env.NEXT_PUBLIC_COST_STANDARD_USD, 0.04),
  high: number(process.env.NEXT_PUBLIC_COST_HIGH_USD, 0.15),
};

/** Display-only conversion. Set NEXT_PUBLIC_INR_PER_USD to keep it honest. */
const INR_PER_USD = number(process.env.NEXT_PUBLIC_INR_PER_USD, 88);

export function estimateCost(images: number, quality: "standard" | "high") {
  const usd = images * COST_PER_IMAGE_USD[quality];
  return { usd, inr: usd * INR_PER_USD };
}

export function formatCost(images: number, quality: "standard" | "high"): string {
  const { usd, inr } = estimateCost(images, quality);
  return `≈ $${usd.toFixed(2)} · ₹${inr.toFixed(0)}`;
}
