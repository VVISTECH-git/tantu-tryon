import { eq, inArray } from "drizzle-orm";
import { db, settings } from "@/db";

/**
 * Which Google image model makes the pictures, and what each one costs.
 *
 * The admin picks one row on the settings page; every everyday (1K)
 * generation uses it. Prices are read from Google's own pricing page each
 * time that page opens, and the dollar rate from a public exchange-rate
 * feed, so the table is never a number someone typed in months ago. When
 * either source cannot be read, the last good reading saved in `settings`
 * is shown instead, marked as such, and failing that the list prices
 * checked by hand on the date below.
 */

export type ImageSize = "1K" | "2K";

export interface ImageOption {
  id: string;
  model: string;
  /** The size as Google's price page names it. */
  priceSize: "0.5K" | "1K" | "2K";
  name: string;
  detail: string;
  /** Rows the app cannot use are still priced, so the table matches Google's. */
  selectable: boolean;
}

export const IMAGE_OPTIONS: ImageOption[] = [
  { id: "lite-1k", model: "gemini-3.1-flash-lite-image", priceSize: "1K", name: "Nano Banana 2 Lite", detail: "1K only", selectable: true },
  { id: "nb2-512", model: "gemini-3.1-flash-image", priceSize: "0.5K", name: "Nano Banana 2", detail: "512px, too small for catalogue photos", selectable: false },
  { id: "nb2-1k", model: "gemini-3.1-flash-image", priceSize: "1K", name: "Nano Banana 2", detail: "1K", selectable: true },
  { id: "nb2-2k", model: "gemini-3.1-flash-image", priceSize: "2K", name: "Nano Banana 2", detail: "2K", selectable: true },
  { id: "pro-1k", model: "gemini-3-pro-image", priceSize: "1K", name: "Nano Banana Pro", detail: "1K", selectable: true },
  { id: "pro-2k", model: "gemini-3-pro-image", priceSize: "2K", name: "Nano Banana Pro", detail: "2K", selectable: true },
  { id: "nb-2.5", model: "gemini-2.5-flash-image", priceSize: "1K", name: "Nano Banana (2.5)", detail: "Google shuts it down on 2 Oct 2026", selectable: false },
];

export const DEFAULT_IMAGE_OPTION = "lite-1k";

export function imageOption(id: string | null | undefined): ImageOption {
  const found = IMAGE_OPTIONS.find((o) => o.id === id && o.selectable);
  return found ?? IMAGE_OPTIONS.find((o) => o.id === DEFAULT_IMAGE_OPTION)!;
}

/** USD per image: normal (answer now) and batch (answer within 24 hours). */
export interface UsdPrice {
  normal: number | null;
  batch: number | null;
}
export type PriceTable = Record<string, UsdPrice>;

/** Checked by hand against ai.google.dev/gemini-api/docs/pricing on 2026-09-25. */
const HAND_CHECKED: PriceTable = {
  "lite-1k": { normal: 0.0336, batch: 0.0168 },
  "nb2-512": { normal: 0.045, batch: 0.022 },
  "nb2-1k": { normal: 0.067, batch: 0.034 },
  "nb2-2k": { normal: 0.101, batch: 0.05 },
  "pro-1k": { normal: 0.134, batch: 0.067 },
  "pro-2k": { normal: 0.134, batch: 0.067 },
  "nb-2.5": { normal: 0.039, batch: 0.0195 },
};
const HAND_CHECKED_ON = "2026-09-25";

// Google localises the page by the server's location; the parser reads the English words.
const PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing?hl=en";

// ── Reading Google's page ─────────────────────────────────────────────────────

function pageText(html: string): string {
  const noCode = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
  return noCode
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#36;|&dollar;/g, "$")
    .replace(/\s+/g, " ");
}

/** "$0.067 per 1K image", "$0.134 per 1K/2K image", "$0.0336 per 1K resolution image", "$0.039 per image". */
function sizedPrices(block: string): Partial<Record<"0.5K" | "1K" | "2K" | "any", number>> {
  const out: Partial<Record<"0.5K" | "1K" | "2K" | "any", number>> = {};
  for (const m of block.matchAll(/\$([0-9]*\.?[0-9]+) per (0\.5K|1K\/2K|1K|2K|4K)\b/g)) {
    const usd = Number(m[1]);
    const sizes = m[2] === "1K/2K" ? (["1K", "2K"] as const) : m[2] === "4K" ? [] : [m[2] as "0.5K" | "1K" | "2K"];
    for (const s of sizes) out[s] ??= usd;
  }
  const flat = block.match(/\$([0-9]*\.?[0-9]+) per image/);
  if (flat) out.any = Number(flat[1]);
  return out;
}

/**
 * Each model's section runs from its id to the next "Try it in Google AI
 * Studio" heading. Inside it the normal prices come first, then a block that
 * starts "Batch Free Tier", then Flex and Priority, which the app never uses.
 */
export function parsePricing(html: string): PriceTable {
  const text = pageText(html);
  const table: PriceTable = {};
  for (const option of IMAGE_OPTIONS) {
    const start = text.indexOf(`${option.model} Try it in`);
    if (start < 0) continue;
    const next = text.indexOf("Try it in Google AI Studio", start + option.model.length + 12);
    const section = text.slice(start, next < 0 ? start + 4000 : next);
    const [normalBlock = "", rest = ""] = section.split(/ Batch Free Tier /);
    const batchBlock = rest.split(/ (?:Flex|Priority) Free Tier /)[0] ?? "";
    const pick = (block: string) => {
      const p = sizedPrices(block);
      return p[option.priceSize] ?? p.any ?? null;
    };
    const normal = pick(normalBlock);
    const batch = rest ? pick(batchBlock) : null;
    if (normal !== null) table[option.id] = { normal, batch };
  }
  return table;
}

// ── Saved readings ────────────────────────────────────────────────────────────

const KEYS = {
  prices: "google_image_prices_usd",
  pricesAt: "google_image_prices_at",
  rate: "usd_inr_paise",
  rateAt: "usd_inr_at",
  option: "image_option",
} as const;

async function read(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function write(key: string, value: string): Promise<void> {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function chosenImageOption(): Promise<ImageOption> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEYS.option)).limit(1);
  return imageOption(row?.value);
}

export async function setImageOption(id: string): Promise<void> {
  const option = IMAGE_OPTIONS.find((o) => o.id === id && o.selectable);
  if (option) await write(KEYS.option, option.id);
}

/** The last prices read from Google, or the hand-checked list: what the spend brake estimates with. */
export async function savedPrices(): Promise<PriceTable> {
  const saved = await read([KEYS.prices]);
  try {
    return { ...HAND_CHECKED, ...(saved[KEYS.prices] ? (JSON.parse(saved[KEYS.prices]!) as PriceTable) : {}) };
  } catch {
    return HAND_CHECKED;
  }
}

/** USD per image for a model at a size, from a price table. */
export function usdFor(table: PriceTable, model: string, size: ImageSize): number | null {
  const option = IMAGE_OPTIONS.find((o) => o.model === model && o.priceSize === size) ?? IMAGE_OPTIONS.find((o) => o.model === model);
  return option ? (table[option.id]?.normal ?? null) : null;
}

// ── Live readings ─────────────────────────────────────────────────────────────

export interface Reading<T> {
  value: T;
  /** "live": read just now. "saved": the last good reading, from `at`. "hand": the list in this file. */
  source: "live" | "saved" | "hand";
  at: string;
  problem?: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (Tantu price check)", "accept-language": "en-US,en;q=0.9" } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.text();
}

export async function livePrices(): Promise<Reading<PriceTable>> {
  const now = new Date().toISOString();
  try {
    const table = parsePricing(await fetchText(PRICING_URL));
    const found = Object.keys(table).length;
    if (found < IMAGE_OPTIONS.length - 1) throw new Error(`Google's page changed: only ${found} of ${IMAGE_OPTIONS.length} prices found`);
    await Promise.all([write(KEYS.prices, JSON.stringify(table)), write(KEYS.pricesAt, now)]);
    return { value: { ...HAND_CHECKED, ...table }, source: "live", at: now };
  } catch (error) {
    const problem = error instanceof Error ? error.message : "Google's price page could not be read";
    const saved = await read([KEYS.prices, KEYS.pricesAt]);
    if (saved[KEYS.prices] && saved[KEYS.pricesAt]) {
      return { value: { ...HAND_CHECKED, ...(JSON.parse(saved[KEYS.prices]!) as PriceTable) }, source: "saved", at: saved[KEYS.pricesAt]!, problem };
    }
    return { value: HAND_CHECKED, source: "hand", at: HAND_CHECKED_ON, problem };
  }
}

/** Rupees per dollar, from open.er-api.com (daily rates, no key needed). */
export async function liveRate(): Promise<Reading<number>> {
  const now = new Date().toISOString();
  try {
    const json = JSON.parse(await fetchText("https://open.er-api.com/v6/latest/USD")) as { result?: string; rates?: Record<string, number> };
    const inr = json.rates?.INR;
    if (json.result !== "success" || !inr || inr < 50 || inr > 200) throw new Error("The exchange-rate feed gave no usable rupee rate");
    await Promise.all([write(KEYS.rate, String(Math.round(inr * 100))), write(KEYS.rateAt, now)]);
    return { value: inr, source: "live", at: now };
  } catch (error) {
    const problem = error instanceof Error ? error.message : "The exchange rate could not be read";
    const saved = await read([KEYS.rate, KEYS.rateAt]);
    if (saved[KEYS.rate]) return { value: Number(saved[KEYS.rate]) / 100, source: "saved", at: saved[KEYS.rateAt] ?? "earlier", problem };
    return { value: Number(process.env.USD_INR) || 96, source: "hand", at: HAND_CHECKED_ON, problem };
  }
}
