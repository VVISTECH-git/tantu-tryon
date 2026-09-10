/**
 * The words a prompt needs about one saree.
 *
 * A prompt that only says "the BODY print" leaves the image model to work out
 * which panel is which from a small sheet, and it guesses. Naming each part in
 * words — "deep blue ground with white birds" — gives it a second anchor, and
 * the placement map can then say "her left breast is blue, never cream"
 * instead of hoping.
 *
 * Two sources fill these, in order:
 *
 * 1. SLK's design record. Fibre, craft and the border height are reliable.
 *    Colour and the motif fields are thin ("Flowers", "Climbers") and the
 *    colour is the product's trade colour, which on 300021 is "beige" for a
 *    saree whose body is blue. So SLK is the fallback, not the answer.
 * 2. A description read from the photographs — by the describe route when an
 *    engine key exists, or typed in by a person. Saved per product in the
 *    browser.
 */

/** Everything the templates can ask for. */
export interface GarmentWords {
  /** "saree", from productType. */
  type: string;
  /** "cotton", from fibreType. Null when SLK has not recorded one. */
  fibre: string | null;
  /** "Kalamkari", from craftTechnique. */
  craft: string | null;

  /** "blue" — the ground colour of the body. */
  bodyColour: string | null;
  /** "deep blue ground with white and cream birds, flowers and climbing vines in a dense all-over repeat" */
  bodyDesc: string;

  /** "cream" */
  palluColour: string | null;
  /** "peacock" — the main pallu motif, singular. */
  palluMotif: string;
  /** The pallu from the end nearest the body to the end of the saree. */
  palluDesc: string;
  /** "the blue vine band section" — the part of the pallu nearest the body. */
  palluTopDesc: string;
  /** "The scalloped bell-motif edge" — the finishing edge. Capitalised; it opens sentences. */
  palluEndDesc: string;

  /** "orange" */
  borderColour: string | null;
  /** "orange and gold zari border" */
  borderDesc: string;
  /** "2 to 3 inches", from SLK's borderHeight. Null when not recorded. */
  borderWidth: string | null;

  /** "cream" */
  blouseColour: string | null;
  /** "cream ground with blue sparrows and vines" */
  blouseDesc: string;
}

/** What a description — from the engine or a person — can supply. Everything optional. */
export type DescribedGarment = Partial<
  Pick<
    GarmentWords,
    | "fibre"
    | "craft"
    | "bodyColour"
    | "bodyDesc"
    | "palluColour"
    | "palluMotif"
    | "palluDesc"
    | "palluTopDesc"
    | "palluEndDesc"
    | "borderColour"
    | "borderDesc"
    | "borderWidth"
    | "blouseColour"
    | "blouseDesc"
  >
>;

/** The fields, in the order a person reads a saree, with what to call them. */
export const DESCRIBED_FIELDS: { key: keyof DescribedGarment; label: string; hint: string; wide?: boolean }[] = [
  { key: "fibre", label: "Fibre", hint: "cotton" },
  { key: "craft", label: "Craft", hint: "Kalamkari" },
  { key: "bodyColour", label: "Body ground colour", hint: "blue" },
  { key: "bodyDesc", label: "Body", hint: "deep blue ground with white birds and climbing vines in a dense all-over repeat", wide: true },
  { key: "palluColour", label: "Pallu ground colour", hint: "cream" },
  { key: "palluMotif", label: "Pallu main motif", hint: "peacock" },
  { key: "palluDesc", label: "Pallu", hint: "cream ground with two large facing peacocks, a blue vine band above and a scalloped bell-motif edge below", wide: true },
  { key: "palluTopDesc", label: "Pallu section nearest the body", hint: "the blue vine band section" },
  { key: "palluEndDesc", label: "Pallu end edge", hint: "The scalloped bell-motif edge" },
  { key: "borderColour", label: "Border colour", hint: "orange" },
  { key: "borderDesc", label: "Border", hint: "orange and gold zari border" },
  { key: "borderWidth", label: "Border width", hint: "2 to 3 inches" },
  { key: "blouseColour", label: "Blouse ground colour", hint: "cream" },
  { key: "blouseDesc", label: "Blouse", hint: "cream ground with blue sparrows and vines", wide: true },
];

type Design = Record<string, string | null> | null | undefined;

function lower(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v.toLowerCase() : null;
}

/**
 * "Khadi (2-3 Inch)" → "2 to 3 inches". "3 Inch" → "3 inches".
 *
 * SLK's borderHeight carries the width as a parenthetical after the border's
 * weave name. Anything without a number is not a width and is left out.
 */
export function parseBorderWidth(borderHeight: string | null | undefined): string | null {
  if (!borderHeight) return null;
  const m = /(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")/i.exec(borderHeight);
  if (m) return `${m[1]} to ${m[2]} inches`;
  const single = /(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")/i.exec(borderHeight);
  if (single) return `${single[1]} ${single[1] === "1" ? "inch" : "inches"}`;
  return null;
}

/** Words from SLK alone, before any description. */
export function slkGarmentWords(design: Design): GarmentWords {
  const d = design ?? {};
  const colour = lower(d.colour);
  const motif = lower(d.motif);
  const palluMotif = lower(d.palluMotif);
  const borderMotif = d.borderMotif?.trim() || null;
  const blouse = [lower(d.blouseStyle), lower(d.blouseMotif)].filter(Boolean);

  return {
    type: lower(d.productType) ?? "saree",
    fibre: lower(d.fibreType),
    craft: d.craftTechnique?.trim() || null,

    bodyColour: colour,
    bodyDesc: [colour ? `${colour} ground` : null, motif ? `${motif} motif` : null].filter(Boolean).join(", ") || "the body print as photographed",

    palluColour: null,
    palluMotif: palluMotif ?? "pallu motif",
    palluDesc: palluMotif ? `${palluMotif} design across the pallu` : "the pallu design as photographed",
    palluTopDesc: "the pallu print",
    palluEndDesc: "The end edge of the pallu",

    borderColour: null,
    borderDesc: borderMotif ? `${borderMotif} border` : "the border as photographed",
    borderWidth: parseBorderWidth(d.borderHeight),

    blouseColour: null,
    blouseDesc: blouse.length ? `${blouse.join(" ")} blouse fabric` : "the blouse fabric as photographed",
  };
}

/** SLK's words, with whatever has been described or typed laid over them. */
export function garmentWordsFrom(design: Design, described?: DescribedGarment | null): GarmentWords {
  const base = slkGarmentWords(design);
  if (!described) return base;
  const out: Record<string, string | null> = { ...base };
  for (const [key, value] of Object.entries(described)) {
    const v = typeof value === "string" ? value.trim() : null;
    if (v) out[key] = v;
  }
  return out as unknown as GarmentWords;
}

/** The fields the placement maps lean on hardest. Missing ones make a weaker prompt. */
export function missingWords(w: GarmentWords): string[] {
  const gaps: string[] = [];
  if (!w.bodyColour) gaps.push("body ground colour");
  if (!w.palluColour) gaps.push("pallu ground colour");
  if (!w.borderColour) gaps.push("border colour");
  if (!w.blouseColour) gaps.push("blouse ground colour");
  if (!w.borderWidth) gaps.push("border width");
  return gaps;
}
