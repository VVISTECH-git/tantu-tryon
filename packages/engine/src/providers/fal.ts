import { guessMime, toDataUrl } from "../mime";
import { fetchAsBase64 } from "./http";
import type { ProviderImage, RenderJobInput, RenderMode, TryOnProvider } from "../types";

/**
 * FASHN's try-on model hosted on fal, over fal's queue REST API — no SDK, so
 * the package stays dependency-free.
 *
 * This family of models only ever dresses a supplied person, and it ignores
 * prompts entirely: no pose control, no scene, no invented model. It is here as
 * a comparison engine, not the default.
 */
export class FalProvider implements TryOnProvider {
  id = "fal" as const;
  label = "fal · FASHN";

  supports(mode: RenderMode): boolean {
    return mode === "person";
  }

  async render(input: RenderJobInput): Promise<ProviderImage> {
    const key = process.env.FAL_KEY;
    if (!key) {
      throw new Error("FAL_KEY is not set. Get one at https://fal.ai/dashboard/keys.");
    }
    const { request } = input;
    if (!request.person) {
      throw new Error(
        "fal can only dress a person you supply. Switch the engine to Gemini to have the model invented from a description.",
      );
    }
    const garmentRef = request.references[0];
    if (!garmentRef) throw new Error("No garment photograph to work from.");

    const model = process.env.FAL_TRYON_MODEL || "fal-ai/fashn/tryon/v1.6";
    const headers = { "Content-Type": "application/json", Authorization: `Key ${key}` };

    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model_image: toDataUrl(request.person.data, request.person.mime ?? guessMime(request.person.data)),
        garment_image: toDataUrl(garmentRef.data, garmentRef.mime ?? guessMime(garmentRef.data)),
        category: "one-pieces",
        output_format: "png",
      }),
    });
    if (!submit.ok) {
      throw new Error(`fal submit failed: ${submit.status} ${(await submit.text()).slice(0, 400)}`);
    }
    const queued = (await submit.json()) as { status_url?: string; response_url?: string };
    if (!queued.status_url || !queued.response_url) throw new Error("fal returned no queue URLs.");

    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(queued.status_url, { headers });
      if (!statusRes.ok) continue;
      const status = (await statusRes.json()) as { status?: string };
      if (status.status === "COMPLETED") break;
      if (attempt === 59) throw new Error("fal generation timed out.");
    }

    const resultRes = await fetch(queued.response_url, { headers });
    if (!resultRes.ok) {
      throw new Error(`fal result failed: ${resultRes.status} ${(await resultRes.text()).slice(0, 400)}`);
    }
    const result = (await resultRes.json()) as { images?: Array<{ url?: string }> };
    const url = result.images?.[0]?.url;
    if (!url) throw new Error("fal returned no image.");

    // Pull the bytes down rather than handing back a URL that expires — a
    // render you cannot re-read later is a render you did not really keep.
    const image = await fetchAsBase64(url);
    return { ...image, model };
  }
}
