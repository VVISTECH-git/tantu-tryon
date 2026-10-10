import type { Garment } from "@/db";
import { BINDI, BINDI_TYPES, BRAID, FACES, GARMENT, MODEL, pick, qwenInputs } from "@/lib/qwenPrompt";

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
  Dupatta: { type: "dupatta" },
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

function who(c: TwoChoices, seed: number, type: string): string {
  const g = c.gender.toLowerCase();
  const kid = g === "girl" || g === "boy";
  const north = !c.ethnicity || /north/i.test(c.ethnicity);
  const age = kid ? `about ${c.age.replace(/\s*yrs?$/i, "").replace(/-/, " to ")} years old` : c.age ? `in her ${c.age}`.replace("her", g === "male" ? "his" : "her") : "about 20 years old";
  if (g === "girl") return `${MODEL.girl}, ${age}`;
  if (g === "boy") return `${MODEL.boy}, ${age}`;
  if (g === "male") return `${north ? MODEL.man : `a professional ${c.ethnicity} male fashion model, well-groomed, athletic build, confident calm expression, short neat hair`}, ${age}`;
  const base = north ? MODEL.woman : MODEL.woman.replace("North Indian", c.ethnicity!);
  const body = c.body && !/slim/i.test(c.body) ? `, ${c.body.toLowerCase()} body` : "";
  // A braid over one shoulder unless the seller picked a hairstyle; a bindi with traditional wear only.
  const hair = c.hair && !/vibe|match/i.test(c.hair) ? `, ${c.hair.toLowerCase()} hair` : `, ${BRAID}`;
  const bindi = BINDI_TYPES.has(type) ? `, ${BINDI}` : ", no bindi";
  return `${base}, ${FACES[seed % FACES.length]}${body}${hair}${bindi}, ${age}`;
}

/**
 * What each tantu-two pose means, said exactly (10 Oct, from Drapify's playbook: the image model
 * gets the body angle, the hands, the framing and what part of the garment must show — not just a
 * name). Sarees get their own wording where the pallu or pleats matter.
 */
const POSE_TEXT: Record<string, string> = {
  "frontal hero": "standing straight and facing the camera squarely (0°), weight even, arms relaxed at the sides with a soft natural hand; the whole garment visible from neckline to hem. Full-length photo, head to feet.",
  "3/4 profile": "body turned exactly 45° to her left, face turned back towards the camera, one foot slightly ahead; shoulders, waist and hem all show the turn. Full-length photo, head to feet.",
  "full side profile": "body turned 90° so the camera sees her right side, face in profile looking ahead, arms relaxed; the garment's side silhouette clear from shoulder to hem. Full-length photo, head to feet.",
  "back view": "standing with her back to the camera (180°), head turned slightly over one shoulder so a little of the face shows, arms relaxed; the back of the garment fully visible. Full-length photo, head to feet.",
  "walking motion": "walking towards the camera mid-step, one foot forward, arms swinging naturally, the fabric moving with the step. Full-length photo, head to feet.",
  "natural walk": "walking towards the camera mid-step, one foot forward, arms swinging naturally, the dress moving with the step. Full-length photo, head to feet.",
  "walking grace": "walking slowly towards the camera at a slight angle, one foot ahead, one hand lightly holding the pallu at the shoulder, the pleats swinging with the step. Full-length photo, head to feet.",
  "seated drape": "seated upright on a simple low stool, knees together and angled slightly to one side, hands resting in the lap; the garment falls naturally and its print stays visible. Full-length photo including the feet.",
  "sitting casual": "sitting on a low step, knees together, hands resting on the knees, relaxed happy expression; the dress spread naturally. Full-length photo including the feet.",
  "dynamic twirl": "caught mid-twirl, turning on one foot, the skirt flaring out in a full circle, arms slightly out for balance, smiling. Full-length photo, head to feet.",
  "spin / twirl": "caught mid-spin, the skirt flaring out, arms out for balance, laughing. Full-length photo, head to feet.",
  "playful jump": "a small happy jump with both feet just off the ground, arms up, the dress lifting with the movement. Full-length photo, head to feet.",
  "lifestyle candid": "a natural candid moment — looking slightly away from the camera, laughing, one hand touching the hair — standing relaxed. Full-length photo, head to feet.",
  "styling moment": "standing at a slight angle, one hand adjusting the neckline or the dupatta, looking down at it with a soft smile. Full-length photo, head to feet.",
  "editorial silhouette": "standing tall at a slight angle, one hand resting on the hip, chin up, a clean strong silhouette. Full-length photo, head to feet.",
  "neckline detail": "framed from the waist up, facing the camera, shoulders relaxed, so the neckline, its trim and the upper print are seen sharp and close.",
  "neckline / bodice detail": "framed from the waist up, facing the camera, so the neckline and the whole bodice — trims, buttons, gathers — are seen sharp and close.",
  "chest / print detail": "framed from the shoulders to the waist, facing the camera, so the print and any buttons or trims on the chest are seen sharp and close.",
  "sleeve detail": "framed on one arm and shoulder, the arm slightly bent and turned to the camera, so the sleeve's length, cuff, frill or embroidery is seen sharp and close.",
  "hem detail": "framed from the knees down to the feet, standing still, so the hem, its border and the drape of the bottom are seen sharp and close.",
  "close-up portrait": "framed from just above the head to the chest, facing the camera with a warm smile, so the face, the neckline and the jewellery are seen close.",
  "front drape": "standing facing the camera, the saree in a seedha (front) drape: the pallu brought over the right shoulder and spread across the front of the body so its full design faces the camera. Full-length photo, head to feet.",
  "pallu showcase": "standing at 45°, the left arm lifted out to the side holding the end of the pallu so the whole pallu opens out flat towards the camera and its full design is visible. Full-length photo, head to feet.",
  "pallu toss": "turning slightly, the pallu caught mid-air as she tosses it back over the left shoulder, the fabric flying out so its design shows, smiling. Full-length photo, head to feet.",
  "pleat display": "standing facing the camera, one hand lightly spreading the front pleats so each pleat and the border along the hem are clearly visible. Full-length photo, head to feet.",
  "pallu border detail": "framed close on the shoulder and the falling pallu, so the pallu's border and its edge are seen sharp, with the zari or print detail visible.",
  "blouse back detail": "standing with her back to the camera, hair moved to one side, framed from the head to the waist, so the back of the blouse — its neck shape, ties or hooks — is seen sharp and close.",
};

function poseText(pose: string): string {
  return POSE_TEXT[pose.trim().toLowerCase()] ?? `${pose}, a natural catalogue pose. Full-length photo, head to feet.`;
}

export function twoPrompt(garment: Garment, c: TwoChoices, anchor = false): string {
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
    // The blouse piece is often attached after the pallu (9 Oct, user): when the reading found one,
    // the blouse is made from it even without its own photo.
    const attached = /Blouse piece:/i.test(String(garment.words?.garmentSpec ?? ""));
    const blouse = has("blouse")
      ? "with a fitted blouse made from the blouse piece in its photo (same colour, print and border)"
      : attached
        ? "with a fitted blouse made from the saree's own blouse piece described above (same ground colour, motifs and border)"
        : "with a plain fitted blouse in a colour taken from the border";
    // The seller's drape and pallu style (Drapify-style choices, 9 Oct) win over the house Nivi default.
    const drapeStyle = c.details["Drape Style"];
    const palluStyle = c.details["Pallu Style"];
    const drape = drapeStyle ? `draped in the ${drapeStyle.replace(/\s*\(.*\)\s*$/, "")} style` : "draped in the standard Nivi style";
    const pallu = palluStyle ? `the pallu worn ${/front|seedha/i.test(palluStyle) ? "in front, seedha style, falling over the right shoulder to the front" : /head/i.test(palluStyle) ? "over the head" : /pinned/i.test(palluStyle) ? "pinned neatly at the left shoulder" : /free/i.test(palluStyle) ? "over the left shoulder, flowing free" : "over the left shoulder"}` : "the pallu over the left shoulder";
    worn = `${drape}: neat pleats at the front centre, ${pallu}, the border running along the bottom hem, ${blouse}`;
    rules = [
      "Keep the saree's body, border and pallu exactly as in the photos: same motifs, colours, scale and order.",
      "The pallu is the decorated end of the saree (its last 1 to 1.2 metres). Where it shows, it carries its own design exactly as read above and as photographed — every panel and band in the same order, ending in its end strip and tassels — and it is never filled with the body print.",
      "The border runs along both long edges of the saree, the pallu included.",
      has("blouse") || attached
        ? "The blouse is made only from the blouse piece. A blouse piece attached at the end of the saree, after the pallu, is cut off and worn as the blouse: it never appears in the draped saree, the pleats or the pallu."
        : "The blouse is plain; no blouse fabric appears on the saree.",
      "The saree reaches the floor.",
    ].join(" ");
  }
  // A dupatta on its own (10 Oct, user: "standalone dupatta is a product that I sell"): it is the
  // product, so the outfit under it stays plain and the whole dupatta shows.
  if (map.type === "dupatta") {
    const how = c.details["How it is worn"] || "Over One Shoulder";
    // 10 Oct, user: "it should be over the hand" — a dupatta falls over the shoulder AND the upper
    // arm in soft folds, never hanging flat and stiff in front of the body with the arm outside it.
    const drape = /both/i.test(how) ? "over both shoulders, covering both upper arms, the two ends falling softly in front in loose folds" : /front|v\)/i.test(how) ? "across the front in a soft V, over both shoulders and upper arms, the ends falling behind" : /neck/i.test(how) ? "loosely around the neck, both ends falling softly in front over the chest" : /head/i.test(how) ? "over the head, covering the hair loosely, one end over the left shoulder and arm" : "over the left shoulder, falling over the left upper arm and down along the arm in soft natural folds, the long end hanging in front past the knee and the other end falling behind";
    const under = c.details["Outfit underneath"] || "Plain Kurti (matching colour)";
    const outfit = /white/i.test(under) ? "a plain white kurti with plain white pants" : /black/i.test(under) ? "a plain black kurti with plain black pants" : /blouse|skirt/i.test(under) ? "a plain fitted blouse with a plain long skirt in a colour taken from the dupatta" : "a plain solid kurti with matching plain pants in a colour taken from the dupatta";
    worn = `draped ${drape}, worn over ${outfit}, so the dupatta's full width, print, border and tassels are clearly visible`;
    rules = "The dupatta is the product: keep its print, its end panels, its borders and its edges exactly as in the photos, and show as much of it as the pose allows. Add tassels, fringe or lace only if the photos show them; a plain hemmed edge stays plain. It is soft cloth: it drapes over the body and arms in natural folds, never hangs flat or stiff like a board, and never floats away from the body. Everything under it is plain and unprinted so it never competes with the dupatta.";
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
  if (anchor) photos.push(`photo ${photos.length + 1} is the approved first photograph of this shoot — this same garment already worn by the model`);
  const spec = garment.words?.garmentSpec;
  const details = Object.entries(c.details).map(([k, v]) => `${k}: ${v}`).join("; ");
  return [
    `INPUT: ${photos.join("; ")}. All photos are of one ${name}.`,
    `Make one catalogue photograph of this exact ${name} ${worn}, on ${who(c, seed, map.type)}.`,
    ...(spec ? [`The garment, read closely from the photos — these details are fixed and must be copied exactly: ${spec}`] : []),
    ...(details ? [`The seller's own details for this garment (follow them): ${details}.`] : []),
    `Priority: 1. the garment's fabric, print and colours exactly as in the photos; 2. correct anatomy (one person, two arms, two hands, five fingers each); 3. pose and framing; 4. a natural, original face.`,
    rules,
    `Draw only what the photos show, and only where they show it. A detail seen only on the back of the garment (a bow, a tie, a zip, buttons) is only on the back: it must not appear in a front or side view. Do not invent any detail the photos do not show.`,
    // 2. Drapify's "inspect the reference up close", 9 Oct.
    `Print: look at the photos up close before drawing. Keep every motif's exact shape, its size compared with the garment, its spacing and its layout (rows, all-over, panels). Do not simplify, enlarge, shrink, merge or reorder motifs — a four-petal flower stays a four-petal flower, a paisley stays a paisley.`,
    ...(anchor
      ? [`Same shoot: the last photo is the approved first picture of this shoot. Keep exactly the same model (face, hair, skin, build), the same garment with every detail${map.type === "saree" ? " — the same blouse, the same border, the same pallu design and the same pleating" : ""}, the same jewellery and accessories, the same background and light. Change only the pose, as described below.`]
      : []),
    `Colour: keep every colour of the fabric exactly as bright, as saturated and as light or dark as in the photos; do not mute, grey, warm or darken them.`,
    `Pose — ${c.pose}: ${poseText(c.pose)} Camera at chest height.`,
    `Scene: ${c.background}${c.backgroundGroup ? ` (${c.backgroundGroup.toLowerCase()} setting)` : ""}, softly blurred behind, bright natural light, neutral white balance that keeps the garment's colours true. Remove the hanger, mannequin, flowers, floor and any shop background from the photos.`,
    ...(c.style ? [`Style: ${c.style.toLowerCase()} catalogue photography.`] : []),
    `The result is a sharp, well-lit, high-end catalogue photograph of a real person, not an illustration. Natural skin texture, no waxy or plastic look. No text, no watermark, no extra people.`,
  ].join("\n");
}
