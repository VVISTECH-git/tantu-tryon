import Anthropic from "@anthropic-ai/sdk";
import { buildContactSheet } from "@/lib/contactSheet";
import { QUERY_KEY, parseRotations } from "@/lib/rotation";
import type { DescribedGarment } from "@/content/garmentWords";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The saree in words, read from its photographs.
 *
 * The prompt's GARMENT block and its placement map lean on colour and motif
 * words — "her left breast is blue, never cream" — and SLK's record cannot
 * supply them: its colour is the trade colour of the product, which on 300021
 * is "beige" for a saree whose body is blue. So the words are read off the
 * labelled sheet by a vision model, once per product, and saved in the
 * browser with the product.
 *
 * Three readers, tried in order, whichever keys the deployment has: Claude,
 * then OpenAI, then Gemini. One refused key (Gemini returned 403 on the first
 * deployment) should not leave the button dead when another key is present.
 * This is the one place the Studio spends money: a short text call, opt-in
 * from a button.
 */

const ORDER = ["body", "pallu", "border", "blouse"] as const;

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

const INSTRUCTIONS = `The attached image is a sheet of labelled photographs of ONE saree: BODY, PALLU, BORDER, BLOUSE. Read the label printed above each panel to know which part it is. Describe each fabric factually for a catalogue writer, in British English, lower case except where a proper noun needs a capital. Do not guess at anything not visible. Return ONLY this JSON object, no other text, no code fence:

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

interface Part {
  slot: string | null;
  url: string;
}

interface Reader {
  id: string;
  configured: () => boolean;
  /** @returns the model's text answer and which model answered. */
  read: (sheetBase64: string) => Promise<{ text: string; model: string }>;
}

const claude: Reader = {
  id: "claude",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  async read(data) {
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
            { type: "image", source: { type: "base64", media_type: "image/png", data } },
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
  async read(data) {
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
              { type: "image_url", image_url: { url: `data:image/png;base64,${data}`, detail: "high" } },
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
  async read(data) {
    // gemini-2.5-flash was retired for new keys in 2026; the API's own error
    // named this as the replacement.
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: INSTRUCTIONS }, { inline_data: { mime_type: "image/png", data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini refused the request: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return { text: json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "", model };
  },
};

// The same three keys the Studio page checks to enable the button.
const READERS: Reader[] = [claude, openai, gemini];

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const readers = READERS.filter((r) => r.configured());
  if (readers.length === 0) {
    return Response.json(
      { error: "No engine key on this deployment, so the photographs cannot be read. Fill the words in by hand." },
      { status: 503 },
    );
  }
  const base = process.env.SLK_API_BASE;
  const secret = process.env.SLK_READ_SECRET;
  if (!base || !secret) {
    return Response.json({ error: "Product lookup is not configured." }, { status: 503 });
  }

  const { code } = await params;
  if (!/^\d{1,12}$/.test(code)) {
    return Response.json({ error: "That is not an SLK product code." }, { status: 400 });
  }

  let images: Part[];
  try {
    const lookup = await fetch(`${base}/api/v1/products/${code}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!lookup.ok) {
      return Response.json({ error: `SLK refused the lookup (${lookup.status}).` }, { status: 502 });
    }
    images = ((await lookup.json()) as { images?: Part[] }).images ?? [];
  } catch {
    return Response.json({ error: "Could not reach SLK." }, { status: 502 });
  }

  const bySlot = new Map(images.map((i) => [(i.slot ?? "").trim().toLowerCase().replace(/\s+/g, "-"), i.url]));
  const present = ORDER.filter((slot) => bySlot.has(slot));
  if (present.length === 0) {
    return Response.json({ error: `${code} has no photographs.` }, { status: 404 });
  }

  const rotations = parseRotations(new URL(request.url).searchParams.get(QUERY_KEY));

  const parts = await Promise.all(
    present.map(async (slot) => {
      const file = await fetch(bySlot.get(slot)!, { cache: "no-store" });
      if (!file.ok) throw new Error(`Could not fetch the ${slot} photograph.`);
      return {
        key: slot,
        label: slot.toUpperCase(),
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        rotate: rotations[slot] ?? 0,
      };
    }),
  ).catch((error: Error) => error);
  if (parts instanceof Error) {
    return Response.json({ error: parts.message }, { status: 502 });
  }

  // The same sheet the person attaches, at a size that keeps the motifs
  // legible without sending four megapixels to a text model.
  const sheet = await buildContactSheet(parts, { cell: 800 });

  const failures: string[] = [];
  for (const reader of readers) {
    let answer: { text: string; model: string };
    try {
      answer = await reader.read(sheet.data);
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

    // Only the fields asked for, only as trimmed strings, colours lower-cased,
    // the pallu end capitalised because it opens sentences in the prompt.
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

    return Response.json({ words, model: answer.model, reader: reader.id }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ error: failures.join(" · ") }, { status: 502 });
}
