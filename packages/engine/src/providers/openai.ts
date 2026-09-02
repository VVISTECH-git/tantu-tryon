import { guessMime, toRawBase64 } from "../mime";
import type { ProviderImage, RenderJobInput, RenderMode, TryOnProvider } from "../types";

/**
 * OpenAI's image model, driven through the edits endpoint.
 *
 * Chosen over the generations endpoint because edits accepts several reference
 * images alongside the prompt, which is what a garment assembled from parts
 * needs. Gemini takes the same job as inline data on one call; the shape here
 * is multipart, but the contract is identical — prompt plus ordered images.
 */

const DEFAULT_MODEL = "gpt-image-2";

/** Portrait, because a full-length figure in a square frame wastes both sides. */
const SIZE = "1024x1536";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function blobOf(data: string, mime?: string): Blob {
  const raw = toRawBase64(data);
  const bytes = Buffer.from(raw, "base64");
  return new Blob([bytes], { type: mime ?? guessMime(raw) });
}

export class OpenAIProvider implements TryOnProvider {
  id = "openai" as const;
  label = "OpenAI";

  supports(_mode: RenderMode): boolean {
    return true;
  }

  private modelFor(quality: "standard" | "high" | undefined): string {
    return process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  }

  async render(input: RenderJobInput): Promise<ProviderImage> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to apps/web/.env.local — get one at https://platform.openai.com/api-keys.",
      );
    }

    const { request, prompt } = input;
    if (request.references.length === 0) throw new Error("No reference photographs to work from.");

    const model = this.modelFor(request.quality);

    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", SIZE);
    form.append("quality", request.quality === "high" ? "high" : "medium");
    form.append("n", "1");
    // Order matters: it must match the numbering in the prompt's legend.
    request.references.forEach((ref, i) => {
      form.append("image[]", blobOf(ref.data, ref.mime), `ref-${i + 1}.png`);
    });
    if (request.mode === "person" && request.person) {
      form.append("image[]", blobOf(request.person.data, request.person.mime), "person.png");
    }

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (input.signal?.aborted) throw new Error("Stopped before it finished.");
      if (attempt > 0) await sleep(1500 * attempt);

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: input.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        // A 429 is normally throttling and worth retrying. A quota 429 is an
        // empty account, and no amount of waiting adds credit to it.
        if (res.status === 429 && /insufficient_quota|credit_balance|billing/i.test(text)) {
          throw new Error(
            "OpenAI refused the request: this key's account has no credits. Add credits at https://platform.openai.com/settings/organization/billing/.",
          );
        }
        lastError = `OpenAI request failed: ${res.status} ${text.slice(0, 400)}`;
        if (RETRYABLE.has(res.status)) continue;
        throw new Error(lastError);
      }

      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = json.data?.[0]?.b64_json;
      if (b64) return { data: b64, mime: "image/png", model };

      // A 200 with no image is a decision on a billed call, exactly as with
      // Gemini. Repeating it returns the same answer.
      throw new Error("OpenAI returned no image. The request was billed and not retried.");
    }

    throw new Error(lastError || "OpenAI returned no image.");
  }
}
