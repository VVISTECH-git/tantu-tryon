import { guessMime, toDataUrl } from "../mime";
import { fetchAsBase64 } from "./http";
import type { ProviderImage, RenderJobInput, RenderMode, TryOnProvider } from "../types";

/** FASHN.ai's own API. Same shape and same limits as the fal-hosted version. */
export class FashnProvider implements TryOnProvider {
  id = "fashn" as const;
  label = "FASHN.ai";

  supports(mode: RenderMode): boolean {
    return mode === "person";
  }

  async render(input: RenderJobInput): Promise<ProviderImage> {
    const key = process.env.FASHN_API_KEY;
    if (!key) throw new Error("FASHN_API_KEY is not set. Get one at https://app.fashn.ai.");

    const { request } = input;
    if (!request.person) {
      throw new Error(
        "FASHN can only dress a person you supply. Switch the engine to Gemini to have the model invented from a description.",
      );
    }
    const garmentRef = request.references[0];
    if (!garmentRef) throw new Error("No garment photograph to work from.");

    const base = "https://api.fashn.ai/v1";
    const modelName = process.env.FASHN_MODEL_NAME || "tryon-v1.6";
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };

    const runRes = await fetch(`${base}/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model_name: modelName,
        inputs: {
          model_image: toDataUrl(request.person.data, request.person.mime ?? guessMime(request.person.data)),
          garment_image: toDataUrl(garmentRef.data, garmentRef.mime ?? guessMime(garmentRef.data)),
          category: "one-pieces",
          output_format: "png",
        },
      }),
    });
    if (!runRes.ok) {
      throw new Error(`FASHN run failed: ${runRes.status} ${(await runRes.text()).slice(0, 400)}`);
    }
    const { id } = (await runRes.json()) as { id: string };

    for (let attempt = 0; attempt < 45; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${base}/status/${id}`, { headers });
      if (!statusRes.ok) continue;
      const status = (await statusRes.json()) as { status: string; output?: string[]; error?: string };
      if (status.status === "completed") {
        const url = status.output?.[0];
        if (!url) throw new Error("FASHN returned no image.");
        const image = await fetchAsBase64(url);
        return { ...image, model: modelName };
      }
      if (status.status === "failed") {
        throw new Error(`FASHN generation failed: ${status.error ?? "unknown error"}`);
      }
    }
    throw new Error("FASHN generation timed out.");
  }
}
