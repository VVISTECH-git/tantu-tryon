import type { Garment } from "@/db";
import { FACES, GARMENT, HAIR, MODEL, pick, qwenInputs } from "@/lib/qwenPrompt";

/**
 * The prompt for a tantu-two shoot (9 Oct): the seller's own choices on tantu-two's screens —
 * the garment tile, the details they ticked, the model, one pose and the background — on top of
 * the house garment prompt (the cut read from the photo, the rules, colour, "draw only what the
 * photos show"). Every value arrives as short plain text from fixed option lists on the page;
 * it is cleaned here before it goes anywhere near the prompt.
 */

/** tantu-two's garment tiles → our garment types. */
export const TWO_GARMENTS: Record<string, { type: string; name?: string }> = {
  "Kids Frocks": { type: "frock" },
  Frocks: { type: "frock" },
  "Kurti Set": { type: "kurti", name: "kurti set" },
  Saree: { type: "saree" },
  Lehenga: { type: "lehenga", name: "lehenga choli (a lehenga skirt with its blouse)" },
  Western: { type: "frock", name: "western dress" },
  "Men Ethnic": { type: "kurti", name: "men's ethnic kurta set" },
  "Shirt / T-Shirt / Pair": { type: "kurti", name: "shirt or t-shirt" },
  Trouser: { type: "kurti", name: "trouser" },
};

export interface TwoChoices {
  garment: string;
  details: Record<string, string>;
  gender: string;
  age: string;
  ethnicity?: string;
  body?: string;
  hair?: string;
  style?: string;
  pose: string;
  background: string;
  backgroundGroup?: string;
  ratio?: string;
}

const clean = (v: unknown, max = 80) =>
  String(v ?? "")
    .replace(/[\r\n"`<>{}\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function cleanChoices(raw: unknown): TwoChoices | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const garment = clean(r.garment, 40);
  if (!TWO_GARMENTS[garment]) return null;
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries((r.details as Record<string, unknown>) ?? {}).slice(0, 30)) {
    const key = clean(k, 40);
    const value = Array.isArray(v) ? v.map((x) => clean(x, 40)).filter(Boolean).join(", ") : clean(v, 80);
    if (key && value && !/^(none|ai auto-detect|auto-detect|auto)$/i.test(value)) details[key] = value;
  }
  return {
    garment,
    details,
    gender: clean(r.gender, 12) || "Female",
    age: clean(r.age, 16),
    ethnicity: clean(r.ethnicity, 30),
    body: clean(r.body, 30),
    hair: clean(r.hair, 40),
    style: clean(r.style, 30),
    pose: clean(r.pose, 60) || "Frontal Hero",
    background: clean(r.background, 80) || "Clean White",
    backgroundGroup: clean(r.backgroundGroup, 30),
    ratio: clean(r.ratio, 6),
  };
}

const RATIOS = new Set(["1:1", "3:4", "4:3", "4:5", "5:4", "2:3", "3:2", "9:16", "16:9"]);
export function twoRatio(c: TwoChoices): string {
  return c.ratio && RATIOS.has(c.ratio) ? c.ratio : "3:4";
}

const SLOT_WORDS: Record<string, string> = {
  whole: "the front of the garment",
  saree: "the saree fabric",
  back: "the back of the garment",
  detail: "a close-up of the print",
  bottom: "the bottom piece (pants or skirt)",
  dupatta: "the dupatta",
  extra1: "another view of the same garment",
  extra2: "another view of the same garment",
  extra3: "another view of the same garment",
  blouse: "the blouse",
  body: "the body fabric",
  pallu: "the pallu",
  border: "the border",
};

function who(c: TwoChoices, seed: number): string {
  const g = c.gender.toLowerCase();
  const kid = g === "girl" || g === "boy";
  const north = !c.ethnicity || /north/i.test(c.ethnicity);
  const age = kid ? `about ${c.age.replace(/\s*yrs?$/i, "").replace(/-/, " to ")} years old` : c.age ? `in her ${c.age}`.replace("her", g === "male" ? "his" : "her") : "about 20 years old";
  if (g === "girl") return `${MODEL.girl}, ${age}`;
  if (g === "boy") return `${MODEL.boy}, ${age}`;
  if (g === "male") return `${north ? MODEL.man : `a professional ${c.ethnicity} male fashion model, well-groomed, athletic build, confident calm expression, short neat hair`}, ${age}`;
  const base = north ? MODEL.woman : MODEL.woman.replace("North Indian", c.ethnicity!);
  const body = c.body && !/slim/i.test(c.body) ? `, ${c.body.toLowerCase()} body` : "";
  const hair = c.hair && !/vibe|match/i.test(c.hair) ? `, ${c.hair.toLowerCase()} hair` : `, ${HAIR[(seed * 3 + 1) % HAIR.length]}`;
  return `${base}, ${FACES[seed % FACES.length]}${body}${hair}, ${age}`;
}

export function twoPrompt(garment: Garment, c: TwoChoices): string {
  const map = TWO_GARMENTS[c.garment]!;
  const kid = /^(girl|boy)$/i.test(c.gender);
  const base = GARMENT[map.type] ?? GARMENT.kurti!;
  const name = (kid && base.childName) || map.name || base.name;
  let worn = (kid && base.childWorn) || base.worn;
  // A kurti set (9 Oct): worn with the seller's own bottom and dupatta when they are photographed,
  // not the house default of black leggings.
  // A saree (9 Oct): its own blouse piece when photographed; the pallu read and kept part by part.
  let rules = base.rules;
  if (map.type === "saree") {
    const has = (slot: string) => garment.parts.some((p) => p.slot === slot && p.key);
    const blouse = has("blouse") ? "with a fitted blouse made from the blouse piece in its photo (same colour, print and border)" : "with a plain fitted blouse in a colour taken from the border";
    worn = `draped in the standard Nivi style: neat pleats at the front centre, the pallu over the left shoulder, the border running along the bottom hem, ${blouse}`;
    rules = [
      "Keep the saree's body, border and pallu exactly as in the photos: same motifs, colours, scale and order.",
      "The pallu is the decorated end of the saree (its last 1 to 1.2 metres). Where it shows, it carries its own design exactly as read above and as photographed — every panel and band in the same order, ending in its end strip and tassels — and it is never filled with the body print.",
      "The border runs along both long edges of the saree, the pallu included.",
      has("blouse") ? "The blouse is made only from the blouse piece; that fabric never appears on the saree itself." : "The blouse is plain; no blouse fabric appears on the saree.",
      "The saree reaches the floor.",
    ].join(" ");
  }
  // A lehenga (9 Oct): with its own blouse and, when the photos show one, its dupatta.
  if (map.type === "lehenga") {
    const has = (slot: string) => garment.parts.some((p) => p.slot === slot && p.key);
    const blouse = has("blouse") ? "with the blouse exactly as in its photo" : "with the matching blouse if one is in the photos, otherwise a plain fitted blouse in a colour taken from the lehenga";
    const dupatta = has("dupatta") ? ", the dupatta from its photo draped as the seller chose (or over one shoulder and across the front)" : ", and if a dupatta is part of the set in the photos, that exact dupatta draped over one shoulder; otherwise no dupatta";
    worn = `worn as it is cut, the full flared lehenga skirt reaching the ankle, ${blouse}${dupatta}, with traditional gold jewellery kept light`;
  }
  if (map.type === "kurti") {
    const has = (slot: string) => garment.parts.some((p) => p.slot === slot && p.key);
    // One photo often shows the whole set laid together (9 Oct, MA-03054: kurti, folded pants and
    // the dupatta in one shot), so what is in the photos counts even without its own box.
    const bottom = has("bottom") ? "with the matching bottom (pants, palazzo or skirt) exactly as in its photo" : c.details["Bottom Colour"] || c.details["Bottom Color"] ? "with plain straight pants in the colour the seller chose" : "with the matching bottom if one is in the photos (copy its colour and fabric), otherwise plain straight pants in a colour taken from the kurti";
    const dupatta = has("dupatta") ? ", the dupatta from its photo draped as the seller chose (or over one shoulder)" : ", and if a dupatta is part of the set in the photos, that exact dupatta draped over one shoulder with its own print and border; otherwise no dupatta";
    worn = `worn as it is cut, ${bottom}${dupatta}, with simple flat sandals`;
  }
  const n = Number((garment.productCode ?? "").match(/(\d+)$/)?.[1] ?? NaN);
  const seed = Number.isFinite(n) ? n : pick(garment.productCode ?? garment.id);
  const photos = qwenInputs(garment, 6).map((p, i) => `photo ${i + 1} shows ${SLOT_WORDS[p.slot] ?? "the garment"}`);
  const spec = garment.words?.garmentSpec;
  const details = Object.entries(c.details).map(([k, v]) => `${k}: ${v}`).join("; ");
  const detailPose = /detail|close|sleeve|hem|print|chest/i.test(c.pose);
  const framing = detailPose ? "a close photo of that part of the garment, worn" : "a full-length photo from head to feet";
  return [
    `INPUT: ${photos.join("; ")}. All photos are of one ${name}.`,
    `Make one catalogue photograph of this exact ${name} ${worn}, on ${who(c, seed)}.`,
    ...(spec ? [`The garment, read closely from the photos — these details are fixed and must be copied exactly: ${spec}`] : []),
    ...(details ? [`The seller's own details for this garment (follow them): ${details}.`] : []),
    `Priority: 1. the garment's fabric, print and colours exactly as in the photos; 2. correct anatomy (one person, two arms, two hands, five fingers each); 3. pose and framing; 4. a natural, original face.`,
    rules,
    `Draw only what the photos show, and only where they show it. A detail seen only on the back of the garment (a bow, a tie, a zip, buttons) is only on the back: it must not appear in a front or side view. Do not invent any detail the photos do not show.`,
    `Colour: keep every colour of the fabric exactly as bright, as saturated and as light or dark as in the photos; do not mute, grey, warm or darken them.`,
    `Pose: ${c.pose}. ${framing}, camera at chest height.`,
    `Scene: ${c.background}${c.backgroundGroup ? ` (${c.backgroundGroup.toLowerCase()} setting)` : ""}, softly blurred behind, bright natural light, neutral white balance that keeps the garment's colours true. Remove the hanger, mannequin, flowers, floor and any shop background from the photos.`,
    ...(c.style ? [`Style: ${c.style.toLowerCase()} catalogue photography.`] : []),
    `The result is a sharp, well-lit, high-end catalogue photograph of a real person, not an illustration. Natural skin texture, no waxy or plastic look. No text, no watermark, no extra people.`,
  ].join("\n");
}
