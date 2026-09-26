/*
  LOCKED, 26 Sep 2026. C1P1 (body photograph only, pose P1), prompt v4.1
  "one fabric, nothing at her side". v4 put a strip of the saree beside her
  left arm on the phone (11:56), and Gemini decorated its visible end: v4.1
  keeps the rest of the saree straight down her back, hidden, and drops the
  word "end". Otherwise word for word v4. With only a BODY photograph the saree is described as one
  fabric from end to end: no "body" and "pallu" as separate parts, no list
  of things it must not have (naming a pallu made Gemini draw one). Tested
  by hand on UNCLE in Gemini chat: fabric copied with its sprigs, nothing
  invented at the shoulder. Do not edit. To change C1P1, make a new locked
  version and say so; the golden test in lockedPrompts.test.ts guards it.

  Tokens ({her}, {She}, {subject}, {type}, {border_colour}, {blouse_region})
  are filled by composePrompt's fill(); the product's own words come in as
  arguments.
*/

export const C1P1_V41_VERSION = "v4.1-one-fabric-LOCKED";

export function composeC1P1V41(x: {
  /** "saree", or "silk Kalamkari saree" when fibre and craft are known. */
  kind: string;
  fabricDesc: string;
  /** The border words, with its width when known. */
  borderDesc: string;
  /** The blouse sentence, capitalised: "A plain, solid mustard blouse ...". */
  blouseGarment: string;
  /** SCENE line: setting, hair, styling, light. */
  scene: string;
}): string {
  return [
    "REFERENCE: The attached image is one labelled photograph of ONE {type}, labelled BODY. This {type} is a single length of one fabric, printed the same from one end to the other, and the photograph shows that fabric. The photograph has been turned to show the fabric the way it is worn around the waist: the {type}'s length runs from left to right, the border along the bottom edge of the photograph is the hem border, and the border along the top edge is the waist border, tucked in at the waist. From the top border to the bottom border the photograph shows the {type}'s full width, about 115 cm (45 inches): the height of the skirt from {her} waist to the hem. On the model every motif keeps its size relative to that height: a motif that spans a tenth of the photograph's height spans a tenth of the distance from {her} waist to the hem. Copy every motif exactly as it appears in the photograph: its shape and proportions, its fill colours, its outline and inner detail, and the smaller motifs, sprigs or dots between the main motifs, in the same arrangement and spacing, on the same ground colour. The border is the band along the top and bottom edges of the photograph; copy it from there, at its real width, and keep it as narrow as it is. Anything around the fabric in the photograph, such as a wall, a window, the rod or the floor, is the shop, not the {type}. The photograph is only something to copy the fabric from: the output is ONE photograph of one model.",
    "ORIENTATION: On the skirt and in the pleats every motif stands exactly as in the photograph, pointing up toward the waist. Above the waist the fabric turns with the drape and the motifs turn with it: on the band of fabric across {her} chest, which rises from the waist to the shoulder, the upper edge is the hem border and the lower edge is the waist border, so the motifs point toward the band's lower edge.",
    "TASK: Photograph THIS {type} on a model. Do not design a {type} in this style. Reproduce the fabric exactly as photographed: the same motifs, the same colours, the same motif scale and spacing, the same border design and width. Do not substitute a generic print in the same style. Do not add embroidery, zari, texture or embellishment that is not in the photograph. Preserve the original fabric colours exactly as photographed; do not shift them warmer, cooler, brighter or more saturated. Use realistic draping, with natural folds and shadows.",
    [
      "HOUSE RULES: These apply to every image.",
      "- The blouse has no border, no zari, no piping and no trim on the sleeves, neckline or hem.",
      "- Both blouse sleeves are identical: fitted short sleeves ending above the elbow, the same length and width on both arms, never covered by the {type}.",
      "- The midriff and stomach are covered. The {type} is worn at the natural waist, pleats tucked in, and the blouse meets the {type} with no bare skin showing between them, from the front or the side.",
      "- The {type} hem clears the floor and the feet are visible.",
      "- Nothing is added that is not in the photograph or named in the SCENE: no bindi except a small plain one, no belt, no brooch.",
      "- No text, logo or watermark in the image.",
      "- One single photograph of the model, filling the whole frame. No collage, no split frame, no inset, and no copy of the reference photograph in the output.",
    ].join("\n"),
    [
      `GARMENT: A ${x.kind} of one fabric.`,
      `- FABRIC: ${x.fabricDesc}. The whole {type} is this fabric.`,
      `- BORDER: ${x.borderDesc}. It runs along both long edges of the {type}.`,
      `- BLOUSE: ${x.blouseGarment}`,
    ].join("\n"),
    [
      "PLACEMENT MAP:",
      "1. BLOUSE: {blouse_region} The fitted top, both sleeves and the neckline. Both sleeves are fully visible.",
      "2. SAREE FABRIC: everything else. The skirt from the waist to the hem, the pleats at the front of the waist, the band of fabric crossing the chest, and the pleated peak at the shoulder. The chest band runs from {her} right hip up to the top of {her} left shoulder, with the {border_colour} border along its upper edge. It covers {her} left breast, {her} left ribs and the left side of {her} torso completely, then passes over the top of the left shoulder. {Her} right shoulder and the right side of {her} chest are the only places where the blouse is visible above the waist.",
      "3. OVER THE SHOULDER: seen from the front, the {type} shows only as a small pleated peak on top of the left shoulder. From there the rest of the {type} falls straight down the middle of {her} back, completely hidden behind {her} body. Nothing hangs beside or behind {her} left arm: between {her} left arm and {her} body, and outside {her} left arm, only the background is seen. {Her} left side, from the shoulder to the hip, shows only the chest band and the fitted blouse sleeve.",
      "4. BORDER: along the hem, along the upper edge of the chest band, and along the edges of the pleated peak, exactly as narrow as shown.",
    ].join("\n"),
    "POSE: A professional fashion catalog photo of {subject} wearing this {type}. {She} stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at {her} waist. Over the left shoulder the {type} is gathered into 5 to 7 narrow, straight, parallel pleats, pinned at the top of the shoulder, and thrown back so it falls straight down the middle of {her} back. At the shoulder the pleats rise together as one small pointed peak, about a hand's height above the shoulder line; below the shoulder the {type} is completely hidden behind {her} body, and no part of it shows beside {her} arms. The pleats at the front of the waist are 5 to 7 straight vertical folds tucked in at the centre of the waist, falling evenly to the hem. All pleats are clean, straight and evenly spaced, like pressed fabric folds. {She} has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so {her} figure fills most of the vertical frame, with the top of {her} head, the hem of the {type} and the ground under {her} feet all inside the frame, shot straight-on at eye level with minimal headroom and minimal space around {her}.",
    `SCENE: ${x.scene}`,
    "OUTPUT: Return only the image: ONE photograph in portrait orientation, 3:4, taller than wide, with the one model filling the frame, at the highest resolution available. The print is rendered sharply everywhere on the {type}: every motif's outline and inner detail crisp and in focus, as in a high-resolution catalogue photograph that buyers will zoom into. No caption, no notes, no commentary.",
  ].join("\n\n");
}
