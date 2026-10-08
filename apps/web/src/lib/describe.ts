import Anthropic from "@anthropic-ai/sdk";
import type { DescribedGarment } from "@/content/garmentWords";

/**
 * The saree in words, read from its labelled sheet.
 *
 * The prompt's GARMENT block and its placement map lean on colour and motif
 * words — "her left breast is blue, never cream" — and SLK's record cannot
 * supply them: its colour is the product's trade colour, which on 300021 was
 * "beige" for a saree whose body is blue. So the words are read off the sheet
 * by a vision model, once per garment, and kept with it.
 *
 * Three readers, tried in order, whichever keys the deployment has: Claude,
 * then OpenAI, then Gemini. One refused key should not leave the button dead
 * when another is present. This is a short text call, opt-in from a button.
 */

const FIELDS: (keyof DescribedGarment)[] = [
  "bodyColour",
  "bodyDesc",
  "palluColour",
  "palluMotif",
  "palluDesc",
  "palluTopDesc",
  "palluEndDesc",
  "borderColour",
  "borderDesc",
  "blouseColour",
  "blouseDesc",
];

const INSTRUCTIONS = `The attached image is a sheet of labelled photographs of ONE saree. Panels may be labelled BODY, PALLU, BORDER, BLOUSE, or SAREE (the whole saree laid flat: body in the upper part of that panel, pallu in the lower part, borders along the long edges). Some panels may be absent. Read the label printed above each panel to know which part it is; when only SAREE is present, read body, pallu, border and blouse from their positions within it (a self blouse matches the body). Describe each fabric factually for a catalogue writer, in British English, lower case except where a proper noun needs a capital. Do not guess at anything not visible; leave a field out if its panel is absent. Return ONLY this JSON object, no other text, no code fence:

{
  "bodyColour": "one or two words: the dominant ground colour of the BODY panel, e.g. 'deep blue'",
  "bodyDesc": "one sentence without a full stop: ground colour, motif colours, motif type, arrangement, e.g. 'deep blue ground with white birds and climbing vines in a dense all-over repeat'",
  "palluColour": "dominant ground colour of the PALLU panel",
  "palluMotif": "the main pallu motif, singular, e.g. 'peacock', 'paisley', 'temple tower'; if the pallu is a plain repeat of the body motif write 'pallu motif'",
  "palluDesc": "one sentence without a full stop describing the PALLU panel from the top of the panel (nearest the saree body) to the bottom (the end of the saree)",
  "palluTopDesc": "the section of the pallu nearest the saree body, as a phrase starting with 'the', e.g. 'the blue vine band section'; if there is no distinct section write 'the pallu print'",
  "palluEndDesc": "the finishing edge at the end of the saree, as a phrase starting with 'The', e.g. 'The scalloped bell-motif edge'; if there is no distinct edge write 'The end edge of the pallu'",
  "borderColour": "dominant border colour, one word",
  "borderDesc": "one phrase: colours and style of the BORDER, e.g. 'orange and gold zari border'",
  "blouseColour": "dominant ground colour of the BLOUSE panel",
  "blouseDesc": "one sentence without a full stop: ground colour, motif colours and motif type of the BLOUSE panel"
}`;

interface Reader {
  id: string;
  configured: () => boolean;
  read: (sheetBase64: string, mime: string) => Promise<{ text: string; model: string }>;
}

const claude: Reader = {
  id: "claude",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  async read(data, mime) {
    const model = process.env.ANTHROPIC_TEXT_MODEL || "claude-opus-5";
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model,
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg", data } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      throw new Error(`Claude declined to describe the sheet (${response.stop_details?.category ?? "no category"}).`);
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, model: response.model };
  },
};

const openai: Reader = {
  id: "openai",
  configured: () => Boolean(process.env.OPENAI_API_KEY),
  async read(data, mime) {
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: INSTRUCTIONS },
              { type: "image_url", image_url: { url: `data:${mime};base64,${data}`, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI refused the request: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: json.choices?.[0]?.message?.content ?? "", model };
  },
};

const gemini: Reader = {
  id: "gemini",
  configured: () => Boolean(process.env.GEMINI_API_KEY),
  async read(data, mime) {
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: INSTRUCTIONS }, { inline_data: { mime_type: mime, data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini refused the request: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { text: json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "", model };
  },
};

/*
  Gemini Flash first, on the prepaid Google key that also pays for the
  images: a few seconds and paise per read. Claude used to come first, so
  every read went to Opus, slow and costly, on another bill (25 Sep).
*/
const READERS: Reader[] = [gemini, openai, claude];

export function canDescribe(): boolean {
  return READERS.some((r) => r.configured());
}

export type DescribeResult =
  | { ok: true; words: DescribedGarment; model: string; reader: string }
  | { ok: false; status: 502 | 503; message: string };

/** Read a labelled sheet (raw base64 PNG) into garment words with whichever reader answers first. */
export async function describeSheet(sheetBase64: string, mime = "image/png"): Promise<DescribeResult> {
  // Only the first configured reader: a failed Gemini read must not quietly
  // fall through to a dearer model. The words can be typed instead.
  const readers = READERS.filter((r) => r.configured()).slice(0, 1);
  if (readers.length === 0) {
    return { ok: false, status: 503, message: "No engine key on this deployment, so the photographs cannot be read. Fill the words in by hand." };
  }

  const failures: string[] = [];
  for (const reader of readers) {
    let answer: { text: string; model: string };
    try {
      answer = await reader.read(sheetBase64, mime);
    } catch (problem) {
      failures.push(`${reader.id}: ${problem instanceof Error ? problem.message : String(problem)}`);
      continue;
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(answer.text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, unknown>;
    } catch {
      failures.push(`${reader.id}: did not return the fields as JSON.`);
      continue;
    }

    const words: DescribedGarment = {};
    for (const key of FIELDS) {
      const value = raw[key];
      if (typeof value !== "string" || !value.trim()) continue;
      let v = value.trim().replace(/\.$/, "");
      if (key.endsWith("Colour")) v = v.toLowerCase();
      if (key === "palluEndDesc") v = v.charAt(0).toUpperCase() + v.slice(1);
      if (key === "palluTopDesc") v = v.charAt(0).toLowerCase() + v.slice(1);
      words[key] = v;
    }
    return { ok: true, words, model: answer.model, reader: reader.id };
  }

  return { ok: false, status: 502, message: failures.join(" · ") };
}

/**
 * The cut of a stitched garment, read from its photo (8 Oct, user: "the sleeves are half
 * sleeves; read from the input"). The image model is told these in plain words, so it does
 * not guess them. One Gemini Flash read, a few paise.
 */
const CUT_INSTRUCTIONS = `You are a garment technician. Look closely at this product photo of one garment (it may be on a hanger, a mannequin or laid flat) and describe its construction exactly, so a photographer can dress a model in it without seeing the photo.
Return JSON with these keys, each a short precise phrase:
- "garment": what it is (e.g. "tiered maxi frock", "straight kurti", "crop top and long skirt set")
- "neckline": exact shape and any detail (e.g. "wide scoop neck with a small central V-notch", "deep V-neck with a narrow band")
- "sleeves": exact length and style. Judge where the sleeve ends against the arm: "sleeveless", "cap sleeves", "short sleeves ending well above the elbow", "half sleeves ending just above the elbow", "elbow-length sleeves", "three-quarter sleeves ending below the elbow", "full-length sleeves to the wrist"; add the style (puff, gathered cuff, straight, bell, frill).
- "length": where the hem falls on a person (e.g. "ankle length", "mid-calf", "knee length", "hip length")
- "waist_and_skirt": waist seam, gathers, tiers (count them), flare, frills
- "print": the motifs, their size, spacing and arrangement
- "colours": the ground colour and the print colours
- "other": buttons, ties, borders, piping, lining, pockets, anything else visible; "none" if nothing
Be literal: describe what you see, never what is usual. If something is hidden, say "not visible".`;

export async function describeGarmentCut(data: string, mime: string): Promise<{ ok: true; spec: string; model: string } | { ok: false; message: string }> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, message: "No Gemini key to read the photo with." };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: CUT_INSTRUCTIONS }, { inline_data: { mime_type: mime, data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });
    if (!res.ok) return { ok: false, message: `Gemini refused the read: ${res.status} ${(await res.text()).slice(0, 200)}` };
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const f = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, string>;
    const part = (k: string, label: string) => (f[k] && !/^(none|not visible)$/i.test(f[k].trim()) ? `${label}: ${f[k].trim()}` : null);
    const spec = [
      part("garment", "Garment"),
      part("neckline", "Neckline"),
      part("sleeves", "Sleeves"),
      part("length", "Length"),
      part("waist_and_skirt", "Waist and skirt"),
      part("print", "Print"),
      part("colours", "Colours"),
      part("other", "Other details"),
    ]
      .filter(Boolean)
      .join(". ");
    return spec ? { ok: true, spec: `${spec}.`, model } : { ok: false, message: "The read came back empty." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
