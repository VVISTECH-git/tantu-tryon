import { guessMime } from "../mime";
import type { ProviderImage, RenderJobInput, RenderMode, TryOnProvider } from "../types";

/**
 * Google's image model, driven by a composed prompt plus every reference image.
 *
 * It is the only one of the three that can invent a model from a description,
 * which is why it is the default: the competition forces you to supply a model
 * photograph for what should be a garment-only job.
 */

interface GeminiPart {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
  /** A trial image or note from the model's thinking, not the answer. */
  thought?: boolean;
}

/**
 * gemini-2.5-flash-image is retired on 2 October 2026; 3.1 Flash Image is its
 * replacement and, unlike 2.5, takes an output size. Pro is the same id it
 * has been since the preview closed.
 */
const STANDARD_MODEL = "gemini-3.1-flash-image";
const HIGH_MODEL = "gemini-3-pro-image";

export const GEMINI_MODELS = { standard: STANDARD_MODEL, high: HIGH_MODEL } as const;

/** Transient failures worth one more try before the pose is written off. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Finish reasons that mean the model decided not to produce an image.
 *
 * Each of these comes back on a successful, billed call. Retrying one spends
 * the money again for the same answer.
 */
const FINAL_REFUSALS = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_PROHIBITED_CONTENT",
  "RECITATION",
  "IMAGE_RECITATION",
  "BLOCKLIST",
  "SPII",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiProvider implements TryOnProvider {
  id = "gemini" as const;
  label = "Gemini";

  supports(_mode: RenderMode): boolean {
    return true;
  }

  private modelFor(quality: "standard" | "high" | undefined): string {
    if (quality === "high") return process.env.GEMINI_IMAGE_MODEL_HIGH || HIGH_MODEL;
    return process.env.GEMINI_IMAGE_MODEL || STANDARD_MODEL;
  }

  async render(input: RenderJobInput): Promise<ProviderImage> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local — get one at https://aistudio.google.com/apikey.",
      );
    }

    const { request, prompt } = input;
    if (request.references.length === 0) throw new Error("No reference photographs to work from.");

    // Order matters: it must match the numbering in the prompt's legend.
    const parts: GeminiPart[] = [{ text: prompt }];
    for (const ref of request.references) {
      parts.push({ inline_data: { mime_type: ref.mime ?? guessMime(ref.data), data: ref.data } });
    }
    if (request.mode === "person") {
      if (!request.person) throw new Error("Try-on mode needs a photograph of the person.");
      const p = request.person;
      parts.push({ inline_data: { mime_type: p.mime ?? guessMime(p.data), data: p.data } });
    }

    const model = this.modelFor(request.quality);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({ contents: [{ parts }] });

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (input.signal?.aborted) throw new Error("Stopped before it finished.");
      if (attempt > 0) await sleep(1500 * attempt);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: input.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        // A 429 with `limit: 0` is not throttling — it is an unbilled project,
        // and no amount of retrying will fix it. Say so plainly.
        if (res.status === 429 && /limit['"\s:]*0|free_tier/i.test(text)) {
          throw new Error(
            "Gemini refused the request: the image models have no free API tier. Enable billing on this key's Google Cloud project at https://aistudio.google.com/apikey.",
          );
        }
        lastError = `Gemini request failed: ${res.status} ${text.slice(0, 400)}`;
        if (RETRYABLE.has(res.status)) continue;
        throw new Error(lastError);
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
      };
      const candidate = json.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) {
          const mime = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png";
          return { data: inline.data, mime, model };
        }
      }

      const reason = candidate?.finishReason;
      lastError = reason
        ? `Gemini returned no image (finishReason: ${reason}).`
        : "Gemini returned no image — it may have declined this combination of photographs.";

      // Any 200 without an image is a decision, not a hiccup: the call
      // succeeded and was billed. Observed behaviour is that the same request
      // gets the same answer, so a retry here buys nothing and charges again.
      // Retrying is left to the operator, who can see what came back.
      throw new Error(
        reason && FINAL_REFUSALS.has(reason)
          ? `${lastError} That is a refusal — the same request will be refused again, so it was not retried.`
          : `${lastError} The request was billed and not retried, because repeating it usually returns the same answer. Change something before trying again.`,
      );
    }

    throw new Error(lastError || "Gemini returned no image.");
  }
}

// ── One image, one call ─────────────────────────────────────────────────────

export type ImageSize = "1K" | "2K";

export interface GenerateImageOptions {
  /** The whole prompt, already composed. Sent first. */
  prompt: string;
  /** Reference images in the order the prompt refers to them. Raw base64 or data URLs. */
  images: { data: string; mime?: string }[];
  /** A Gemini image model id. Defaults to the standard model. */
  model?: string;
  /** Portrait catalogue frame unless told otherwise. */
  aspectRatio?: string;
  /** Only Gemini 3 image models accept a size; older ones return 400 if it is sent. */
  imageSize?: ImageSize;
  signal?: AbortSignal;
}

export interface GeneratedImage {
  data: string;
  mime: string;
  model: string;
  ms: number;
  /** Google's own reason when it declined, so the caller can tell a refusal from a hiccup. */
  finishReason?: string;
}

/**
 * The plain path the guided flow uses: a composed prompt and its images in,
 * one PNG out.
 *
 * Separate from `GeminiProvider.render`, which is shaped around the older
 * RenderRequest and never set a generationConfig — which is why every Lab
 * image came back square when the prompt asked for a portrait. This one sends
 * the aspect ratio and size the way the v1beta schema describes them.
 *
 * Billing note for callers: a 200 with no image is still charged. This
 * function does not retry those, and it says which kind of failure it saw so
 * the ledger can record the cost honestly.
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local — get one at https://aistudio.google.com/apikey.");
  }
  if (!options.prompt.trim()) throw new Error("An empty prompt was about to be sent.");
  if (options.images.length === 0) throw new Error("No reference images to work from.");

  const model = options.model || process.env.GEMINI_IMAGE_MODEL || STANDARD_MODEL;
  const parts: GeminiPart[] = [{ text: options.prompt }];
  for (const image of options.images) {
    const data = image.data.replace(/^data:[^;]+;base64,/, "");
    parts.push({ inline_data: { mime_type: image.mime ?? guessMime(data), data } });
  }

  const imageConfig: Record<string, string> = { aspectRatio: options.aspectRatio ?? "3:4" };
  // 2.5-generation models reject imageSize outright; only send it where it is understood.
  if (options.imageSize && /gemini-3/.test(model)) imageConfig.imageSize = options.imageSize;

  // Thinking "high" for the 3.1 Flash image models (Google: default "minimal",
  // supported "minimal" and "high"). On minimal the app dropped rules the same
  // prompt kept in Gemini chat (UNCLE C1P2, 26 Sep). Pro thinks by default and
  // takes no level here.
  const thinks = /gemini-3\.1-flash(-lite)?-image/.test(model);
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig,
      ...(thinks ? { thinkingConfig: { thinkingLevel: "high" } } : {}),
    },
  });
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const started = Date.now();
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (options.signal?.aborted) throw new Error("Stopped before it finished.");
    if (attempt > 0) await sleep(1500 * attempt);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: options.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429 && /limit['"\s:]*0|free_tier/i.test(text)) {
        throw new GeminiError(
          "Gemini refused the request: the image models have no free API tier. Enable billing on this key's Google Cloud project.",
          "unbilled",
        );
      }
      lastError = `Gemini request failed: ${res.status} ${text.slice(0, 400)}`;
      if (RETRYABLE.has(res.status)) continue;
      // A 4xx before generation costs nothing.
      throw new GeminiError(lastError, "rejected");
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };
    const candidate = json.candidates?.[0];
    // The last image that is not a thought: thinking can return trial images first.
    const finalPart = [...(candidate?.content?.parts ?? [])]
      .reverse()
      .find((part) => !part.thought && (part.inlineData ?? part.inline_data)?.data);
    if (finalPart) {
      const inline = (finalPart.inlineData ?? finalPart.inline_data)!;
      const mime = finalPart.inlineData?.mimeType ?? finalPart.inline_data?.mime_type ?? "image/png";
      return { data: inline.data!, mime, model, ms: Date.now() - started };
    }

    const reason = candidate?.finishReason ?? json.promptFeedback?.blockReason;
    // A 200 without an image was billed. The same request gets the same
    // answer, so this is not retried; the caller changes something first.
    throw new GeminiError(
      reason
        ? `Gemini returned no image (finishReason: ${reason}).`
        : "Gemini returned no image — it may have declined this combination of photographs.",
      reason && FINAL_REFUSALS.has(reason) ? "refused" : "empty",
      reason,
    );
  }

  throw new GeminiError(lastError || "Gemini returned no image.", "rejected");
}

/**
 * What kind of failure, for the money.
 *
 *   refused   200, the model declined — billed
 *   empty     200, nothing came back — billed
 *   rejected  4xx/5xx before generation — not billed
 *   unbilled  the key's project has no billing — not billed, and nothing will work until it does
 */
export type GeminiFailureKind = "refused" | "empty" | "rejected" | "unbilled";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: GeminiFailureKind,
    readonly finishReason?: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }

  /** Whether Google charged for the call that produced this error. */
  get billed(): boolean {
    return this.kind === "refused" || this.kind === "empty";
  }
}
