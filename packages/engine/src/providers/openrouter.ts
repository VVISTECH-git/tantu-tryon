import { guessMime } from "../mime";
import { GeminiError, type GenerateImageOptions, type GeneratedImage } from "./gemini";

/**
 * Image generation through OpenRouter's Image API, for models Google does
 * not serve (Qwen Image 3, 27 Sep). Same shape in and out as the Gemini
 * path, so the rest of the app does not care which one ran.
 *
 * Docs (openrouter.ai/docs/guides/overview/multimodal/image-generation):
 * POST /api/v1/images with model, prompt, resolution, aspect_ratio and
 * input_references (data URLs are accepted); the answer is data[].b64_json.
 * A generation that does not complete is not billed and comes back as an
 * error, so every failure here is recorded as unbilled ("rejected").
 */
export function isOpenRouterModel(model: string): boolean {
  return model.includes("/");
}

export async function generateImageOpenRouter(options: GenerateImageOptions & { model: string }): Promise<GeneratedImage> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new GeminiError("OPENROUTER_API_KEY is not set on this server.", "rejected");

  const body = JSON.stringify({
    model: options.model,
    prompt: options.prompt,
    aspect_ratio: options.aspectRatio ?? "3:4",
    ...(options.imageSize ? { resolution: options.imageSize } : {}),
    input_references: options.images.map((image) => {
      const data = image.data.replace(/^data:[^;]+;base64,/, "");
      return { type: "image_url", image_url: { url: `data:${image.mime ?? guessMime(data)};base64,${data}` } };
    }),
  });

  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://tantu-tryon.vercel.app",
      "X-Title": "Tantu Try-On",
    },
    body,
    signal: options.signal,
  });
  const text = await res.text();
  if (!res.ok) throw new GeminiError(`OpenRouter request failed: ${res.status} ${text.slice(0, 400)}`, "rejected");

  let json: { data?: Array<{ b64_json?: string; media_type?: string }>; error?: { message?: string } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new GeminiError("OpenRouter answered with something that is not JSON.", "rejected");
  }
  const image = json.data?.find((d) => d.b64_json);
  if (!image?.b64_json) {
    throw new GeminiError(`OpenRouter returned no image${json.error?.message ? `: ${json.error.message}` : "."}`, "rejected");
  }
  return { data: image.b64_json, mime: image.media_type ?? guessMime(image.b64_json), model: options.model, ms: Date.now() - started };
}
