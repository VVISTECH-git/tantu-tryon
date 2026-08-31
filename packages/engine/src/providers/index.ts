import { FalProvider } from "./fal";
import { FashnProvider } from "./fashn";
import { GeminiProvider } from "./gemini";
import type { ProviderId, TryOnProvider } from "../types";

export { GeminiProvider, FalProvider, FashnProvider };

/**
 * Adding a self-hosted, saree-fine-tuned model later means adding one class
 * here. Nothing above this line changes — not the prompts, not the API, not
 * the UI.
 */
export function getProvider(id?: string): TryOnProvider {
  const which = (id || process.env.TRYON_PROVIDER || "gemini").toLowerCase();
  switch (which) {
    case "fal":
      return new FalProvider();
    case "fashn":
      return new FashnProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(`Unknown engine: ${which}`);
  }
}

export const PROVIDER_IDS: ProviderId[] = ["gemini", "fal", "fashn"];

/** Which engines have a usable credential right now. Drives the header dot. */
export function configuredProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (process.env.GEMINI_API_KEY) out.push("gemini");
  if (process.env.FAL_KEY) out.push("fal");
  if (process.env.FASHN_API_KEY) out.push("fashn");
  return out;
}
