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
 * This is the one place the Studio spends money, and it is a text call at
 * flash pricing, opt-in from a button. It needs the same key the engine uses.
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

const INSTRUCTIONS = `The attached image is a sheet of labelled photographs of ONE saree: BODY, PALLU, BORDER, BLOUSE. Read the label printed above each panel to know which part it is. Describe each fabric factually for a catalogue writer, in British English, lower case except where a proper noun needs a capital. Do not guess at anything not visible. Return ONLY this JSON object, no other text:

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

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  // gemini-2.5-flash was retired for new keys in 2026; the API's own error
  // named this as the replacement.
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: INSTRUCTIONS }, { inline_data: { mime_type: "image/png", data: sheet.data } }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach Gemini." }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: `Gemini refused the request: ${res.status} ${text.slice(0, 300)}` }, { status: 502 });
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Gemini did not return the fields as JSON." }, { status: 502 });
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

  return Response.json({ words, model }, { headers: { "Cache-Control": "no-store" } });
}
