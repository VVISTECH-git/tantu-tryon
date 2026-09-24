/**
 * What an image costs the account, in paise.
 *
 * Shared by the server ledger and the browser's price labels so the number a
 * person sees before pressing Generate is the number that is debited.
 */
export const CREDIT_PAISE = {
  standard: 10_00,
  high: 20_00,
} as const;

export type Quality = keyof typeof CREDIT_PAISE;

export const QUALITY_LABEL: Record<Quality, { title: string; detail: string }> = {
  standard: { title: "Catalogue · 1K", detail: "Product pages and listings" },
  high: { title: "HD · 2K", detail: "Zoom views and hero shots" },
};

export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
