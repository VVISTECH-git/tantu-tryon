/**
 * The prompts the Studio hands out.
 *
 * Stored verbatim. These are proven wordings, and the only reason to keep them
 * is that they can be reproduced exactly — so they are not tidied, merged or
 * deduplicated, and the differences between them are preserved rather than
 * smoothed away. A variation gets a new entry, not an edit.
 *
 * Nothing here calls a provider. The Studio composes text; the generation
 * happens wherever the operator chooses to paste it.
 */

export interface StudioPrompt {
  id: string;
  /**
   * Shown in the Studio.
   *
   * A prompt is written long before it is trusted. Keeping the written set and
   * the offered set separate means a prompt can sit here complete while one
   * pose is proven end to end, and go live by flipping a flag rather than
   * being pasted back in from somewhere.
   */
  live: boolean;
  /** What the pose is, for a person scanning four cards. */
  title: string;
  /** The one line that distinguishes it from the others. */
  summary: string;
  text: string;
}

export const STUDIO_PROMPTS: StudioPrompt[] = [
  {
    id: "P1",
    live: true,
    title: "Front, symmetrical",
    summary: "Hands clasped at the waist, pallu peaked over the left shoulder and away behind.",
    text: "A professional fashion catalog photo of a woman in her mid-20s wearing a cotton saree as per the reference image. She stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at her waist. The saree pallu is pleated neatly and thrown up and over the left shoulder from front to back, forming a distinct peaked, pointed shape of fabric rising at the shoulder edge before going over and down her back. Only the front portion of the pallu near the collarbone and shoulder point is visible; the majority of the pallu length falls behind her shoulder and down her back, out of view from the front. The pleats must be clean, straight, and evenly spaced — like neatly pressed fabric folds, not bunched or crumpled. She has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around her. She is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind her head, with pillars on either side, background softly blurred. Styled with gold jhumka earrings, a gold choker-style necklace, and bangles. Warm, golden directional lighting.",
  },
  {
    id: "P2",
    live: false,
    title: "Three-quarter, hand on hip",
    summary: "Turned 30 degrees, pallu forward down the front so the full pattern reads.",
    text: "Using the exact saree fabric and print shown in the reference image, generate a professional fashion catalog photo of a woman in her mid-20s wearing this saree exactly as shown, without altering, redesigning, or reinterpreting the fabric pattern, print, or colors in any way. The blouse has short sleeves that end above the elbow, well before the elbow joint, exposing the forearm. She has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around her. She is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind her head, with pillars on either side, background softly blurred. Styled with gold jhumka earrings, a gold choker-style necklace, and bangles. Warm, golden directional lighting. She stands at a slight three-quarter angle to the camera, shoulders and hips turned about 30 degrees away from straight-on, with her face turned back toward the camera. One hand rests lightly on her hip; the other arm hangs naturally at her side. The pallu is pleated neatly and draped over the left shoulder, falling forward along the front of her body so the full length of the pleats, pattern, and border are visible down to the hem. The pleats are clean, straight, and evenly spaced.",
  },
];

/** How many the set will hold once every pose has been supplied. */
export const EXPECTED_PROMPTS = 4;

/** What the Studio actually offers today. */
export const LIVE_PROMPTS = STUDIO_PROMPTS.filter((p) => p.live);
