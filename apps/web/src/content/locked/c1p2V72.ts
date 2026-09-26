/*
  LOCKED, 26 Sep 2026. C1P2 (body photograph only, pose P2), prompt v7.2
  "rules first". v7.2 = v7.1 plus two lines, after the app run at 14:28: a
  thin seam across the pallu where the invented band used to go, and the
  chest band's motifs standing upright instead of following its diagonal. The input and the rules it implies come first (body only:
  one design through the whole saree, the pallu included; no blouse photo:
  plain blouse; rod photo turned to the worn view), then the pallu described
  once, positively, with its motifs lying on their side all the way down.
  v7.1 adds natural legs and both feet to the pose (v7 drew a thin, bent
  lower body). Passed by hand on UNCLE in Gemini chat. Do not edit. To change
  C1P2, make a new locked version and say so; lockedPrompts.test.ts guards it.

  Tokens ({her}, {She}, {subject}, {type}, {blouse_region}) are filled by
  composePrompt's fill(); the product's own words come in as arguments.
*/

export const C1P2_V72_VERSION = "v7.2-rules-first-LOCKED";

export function composeC1P2V72(x: {
  kind: string;
  fabricDesc: string;
  borderDesc: string;
  /** "in the colour of the border", or a colour from the motifs when the border has none. */
  blouseColourRule: string;
  blouseGarment: string;
  scene: string;
}): string {
  return [
    "INPUT: One photograph is attached, labelled BODY. No pallu photograph and no blouse photograph were given.",
    [
      "RULES FROM THE INPUT:",
      "1. Only the body was photographed, so this {type} has ONE design from end to end. The design in the BODY photograph is the design of the whole {type}: the skirt, the pleats, the fabric across the chest and the pallu. The pallu carries exactly the same design as the body, continuing unchanged to its very end.",
      `2. No blouse was photographed, so the blouse is plain and solid, ${x.blouseColourRule}, with no print.`,
      "3. The BODY photograph was taken with the {type} hanging on a rod and has been turned to show the fabric the way it is worn: the border along the bottom edge of the photograph is the hem border, and the border along the top edge is the waist border, tucked in at the waist.",
    ].join("\n"),
    "REFERENCE: From the top border to the bottom border the BODY photograph shows the {type}'s full width, about 115 cm (45 inches): the height of the skirt from {her} waist to the hem. On the model every motif keeps its size relative to that height: a motif that spans a tenth of the photograph's height spans a tenth of the distance from {her} waist to the hem. Copy every motif exactly as it appears in the photograph: its shape and proportions, its fill colours, its outline and inner detail, and the smaller motifs, sprigs or dots between the main motifs, in the same arrangement and spacing, on the same ground colour. The border is the band along the top and bottom edges of the photograph; copy it at its real width and keep it as narrow as it is. Anything around the fabric in the photograph, such as a wall, a window, the rod or the floor, is the shop, not the {type}. The photograph is only something to copy the fabric from: the output is ONE photograph of one model.",
    "ORIENTATION: On the skirt and in the pleats every motif stands exactly as in the photograph, pointing up toward the waist. Above the waist the fabric turns with the drape and the motifs turn with it. On the band of fabric across {her} chest, the upper edge is the hem border and the lower edge is the waist border, so the motifs point toward the band's lower edge. On the chest band the motifs are tilted along the band, following its diagonal. On the pallu hanging from {her} shoulder the fabric runs from top to bottom, so the motifs lie on their side: the long edge that continues up across the chest to the neck is the hem border, the outer long edge away from {her} body is the waist border, and every motif's tip points toward that outer edge, away from {her} body, all the way down the pallu.",
    "TASK: Photograph THIS {type} on a model. Do not design a {type} in this style. Reproduce the fabric exactly as photographed: the same motifs, the same colours, the same motif scale and spacing, the same border design and width. Do not substitute a generic print in the same style. Do not add embroidery, zari, texture or embellishment that is not in the photograph. Preserve the original fabric colours exactly as photographed; do not shift them warmer, cooler, brighter or more saturated. Use realistic draping, with natural folds and shadows.",
    [
      "HOUSE RULES: These apply to every image.",
      "- The blouse has no border, no zari, no piping and no trim on the sleeves, neckline or hem.",
      "- Both blouse sleeves are identical: fitted short sleeves ending above the elbow, the same length and width on both arms, never covered by the {type}.",
      "- The midriff and stomach are covered. The {type} is worn at the natural waist, pleats tucked in, and the blouse meets the {type} with no bare skin showing between them, from the front or the side.",
      "- The {type} clears the floor and the feet are visible.",
      "- Nothing is added that is not in the photograph or named in the SCENE: no bindi except a small plain one, no belt, no brooch.",
      "- No text, logo or watermark in the image.",
      "- One single photograph of the model, filling the whole frame. No collage, no split frame, no inset, and no copy of the reference photograph in the output.",
    ].join("\n"),
    [
      `GARMENT: A ${x.kind} of one design.`,
      `- DESIGN: ${x.fabricDesc}. This design covers the whole {type}, the pallu included.`,
      `- BORDER: ${x.borderDesc}. It runs along both long edges of the {type}.`,
      `- BLOUSE: ${x.blouseGarment}`,
    ].join("\n"),
    [
      "PLACEMENT MAP:",
      "1. BLOUSE: {blouse_region} The fitted top, sleeves and neckline. The right side of the chest and the right sleeve are fully visible as blouse.",
      "2. SAREE DESIGN: everything else. The skirt from the waist to the hem, the pleats at the front of the waist, the band of fabric crossing the chest, and the pallu. The chest band is wide: it covers {her} left breast, {her} left ribs and {her} waist completely, so the blouse shows only on {her} right shoulder and the right side of {her} chest.",
      "3. THE PALLU: pleated at the left shoulder, it falls down the front of {her} left side to just above the hem, flat and open. From the shoulder to its lower edge it shows the same design as the skirt: the same motifs and the smaller motifs between them, the same size and spacing, lying on their side as described in ORIENTATION. The pallu is one continuous, unbroken piece of fabric from the shoulder to its lower edge. The border runs down its two long edges.",
      "4. BORDER: along the hem, along the upper edge of the chest band, and down both long edges of the pallu, exactly as narrow as shown.",
    ].join("\n"),
    "POSE: A professional fashion catalog photo of {subject} wearing this {type}. {She} stands at a three-quarter angle, shoulders and hips turned about 30 degrees, never in profile, with {her} left side nearer the camera and {her} face toward the camera. {Her} right hand is placed on {her} right hip with the elbow bent outward, clearly visible; {her} left arm hangs naturally at {her} side beside the pallu, not covering it; {her} hands are never clasped together. {She} stands naturally with {her} weight on both feet, feet slightly apart, both feet visible below the hem. {Her} hips and legs have natural, healthy proportions; the skirt falls straight and full from {her} hips to the hem. The pallu is gathered into 5 to 7 narrow, straight, parallel pleats at the left shoulder and falls forward down the front of {her} body, flat and open. All pleats are clean, straight and evenly spaced, like pressed fabric folds. {She} has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so {her} figure fills most of the vertical frame, with the top of {her} head, the hem of the {type} and the ground under {her} feet all inside the frame, shot at eye level with minimal headroom.",
    `SCENE: ${x.scene}`,
    "OUTPUT: Return only the image: ONE photograph in portrait orientation, 3:4, taller than wide, with the one model filling the frame, at the highest resolution available. The print is rendered sharply everywhere on the {type}: every motif's outline and inner detail crisp and in focus, as in a high-resolution catalogue photograph that buyers will zoom into. No caption, no notes, no commentary.",
  ].join("\n\n");
}

/** The courtyard as the tested v7.1 has it: an arch behind her, not a symmetrical frame (she is turned). */
export const C1P2_COURTYARD = "A traditional Indian courtyard, framed by a stone arch behind {her}, with pillars on either side, background softly blurred.";
