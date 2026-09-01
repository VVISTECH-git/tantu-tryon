/**
 * Provider errors arrive as things like
 *   `Gemini request failed: 400 {"error":{"code":400,"message":"..."}}`
 * which is a debug string, not a sentence. This turns the ones we have actually
 * seen into something a person can act on, and keeps the raw text available
 * behind a disclosure rather than throwing it away.
 */

interface Explained {
  headline: string;
  advice?: string;
  detail: string;
}

/**
 * Operator problems get operator instructions only where an operator is
 * reading. On a public deployment, telling a visitor to edit a file in our
 * repository and restart a server they do not run is both useless and a small
 * leak of how the thing is built; the raw text is still one click away under
 * "detail" for whoever needs it.
 */
const forOperator = process.env.NODE_ENV === "development";

const RULES: { match: RegExp; headline: string; advice?: string }[] = [
  {
    match: /no free API tier|billing/i,
    headline: "The image engine is not accepting requests.",
    advice: forOperator
      ? "Image generation has no free tier. Turn on billing for the key's Google Cloud project, then try again."
      : "Its account needs attention before anything can be generated. Nothing was charged for this.",
  },
  {
    match: /GEMINI_API_KEY is not set/i,
    headline: "The image engine is not connected.",
    advice: forOperator
      ? "Add GEMINI_API_KEY to apps/web/.env.local and restart the dev server."
      : "This deployment has no engine key yet, so nothing can be rendered. Nothing was charged.",
  },
  {
    match: /\b429\b|rate.?limit|quota/i,
    headline: "The engine is rate-limiting us.",
    advice: "Too many renders at once. Wait a moment and retry this pose.",
  },
  {
    match: /finishReason:\s*(SAFETY|PROHIBITED|BLOCKLIST)/i,
    headline: "The engine declined this image.",
    advice:
      "Its safety filter refused the combination. A different pose, or a cleaner reference photograph, usually clears it.",
  },
  {
    match: /returned no image|declined this combination/i,
    headline: "The engine produced no image.",
    advice:
      "Usually a reference photograph it could not read. Try a sharper, better-lit shot of the fabric.",
  },
  {
    match: /\b(400|invalid|malformed)\b/i,
    headline: "The engine rejected the request.",
    advice: "Often an image that is too large or in an unsupported format.",
  },
  {
    match: /\b(500|502|503|504)\b|timed out/i,
    headline: "The engine is having trouble.",
    advice: "A problem on their side, not yours. Retrying this pose usually works.",
  },
  {
    match: /cannot run in|can only dress a person/i,
    headline: "This engine cannot do that job.",
    advice: "Switch to Gemini, which can invent a model from a description.",
  },
  {
    match: /Interrupted|abort/i,
    headline: "Stopped before it finished.",
  },
];

export function explain(raw: string): Explained {
  for (const rule of RULES) {
    if (rule.match.test(raw)) {
      return { headline: rule.headline, advice: rule.advice, detail: raw };
    }
  }
  return { headline: "The render did not complete.", detail: raw };
}
