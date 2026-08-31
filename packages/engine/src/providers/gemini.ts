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
}

const STANDARD_MODEL = "gemini-2.5-flash-image";
const HIGH_MODEL = "gemini-3-pro-image";

/** Transient failures worth one more try before the pose is written off. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

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

      lastError = candidate?.finishReason
        ? `Gemini returned no image (finishReason: ${candidate.finishReason}).`
        : "Gemini returned no image — it may have declined this combination of photographs.";
    }

    throw new Error(lastError || "Gemini returned no image.");
  }
}
