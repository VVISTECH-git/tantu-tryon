import type { GarmentId, Pose } from "./types";

/**
 * The catalogue pose set. One output image per pose, all from the SAME
 * reference photographs.
 *
 * The stance and framing language here is the wording that produced good drape
 * and motif fidelity on real kalamkari sarees — it is kept close to verbatim on
 * purpose. What changed is that the model, the scene, the styling and the
 * fidelity clause have been lifted out into their own fragments, so changing
 * the backdrop no longer means editing five near-identical paragraphs.
 */
export const POSES: Pose[] = [
  {
    id: "front",
    name: "Front · symmetrical",
    body: "She stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at her waist. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around her.",
    drapeNote:
      "The pallu is pleated neatly and thrown up and over the left shoulder from front to back, forming a distinct peaked, pointed shape of fabric rising at the shoulder edge before going over and down her back. Only the front portion of the pallu near the collarbone and shoulder point is visible; the majority of its length falls behind her shoulder and down her back, out of view from the front. The pleats must be clean, straight, and evenly spaced — like neatly pressed fabric folds, not bunched or crumpled.",
  },
  {
    id: "three-quarter",
    name: "Three-quarter front",
    body: "She stands at a slight three-quarter angle to the camera, shoulders and hips turned about 30 degrees away from straight-on, with her face turned back toward the camera. One hand rests lightly on her hip; the other arm hangs naturally at her side. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot at eye level with minimal headroom.",
    drapeNote:
      "The pallu is pleated neatly and draped over the left shoulder, falling forward along the front of her body so the full length of the pleats, pattern and border are visible down to the hem. The pleats are clean, straight and evenly spaced.",
  },
  {
    id: "back",
    name: "Back view",
    body: "She stands with her back to the camera, head turned gently to one side in profile, hair worn down over one shoulder so the blouse back and neckline are visible. Full-length portrait, tightly framed from head to feet at eye level.",
    drapeNote:
      "The pallu is pleated neatly and draped over one shoulder from behind, with the pleats falling down her back and visible against the body of the saree. The lower drape, the pleats at the waist and the hem are fully visible from behind. The pleats are clean, straight and evenly spaced.",
  },
  {
    id: "waist-up",
    name: "Waist-up",
    body: "Tightly cropped from the waist up, facing the camera directly with a slight three-quarter turn of the shoulders. Both hands rest together just below the waist, at the bottom edge of the frame. Framing shows head, shoulders and torso down to the waist only.",
    drapeNote:
      "The pallu is pleated neatly and draped over the left shoulder, with the pleats, border pattern and pallu drape clearly visible in sharp detail across the chest and shoulder. The pleats are clean, straight and evenly spaced.",
  },
  {
    id: "relaxed",
    name: "Relaxed three-quarter",
    body: "She stands in a relaxed, natural three-quarter pose, weight shifted onto one leg and the hip gently angled toward the camera, the way a person naturally stands when resting on one side. One hand rests lightly on her hip; the other arm hangs naturally at her side. Her head and neck follow the natural line of her shoulders, with a soft, easy turn of the face toward the camera — no strain or awkward angle between head and body. Full-length portrait, tightly framed from head to feet at eye level.",
    drapeNote:
      "The pallu is pleated neatly and draped over the shoulder, falling forward along the front of her body so the full length of the pleats, pattern and border are visible down to the hem. The pleats are clean, straight and evenly spaced.",
  },
  {
    id: "walking",
    name: "Walking · editorial",
    body: "She is caught mid-stride walking toward the camera, one foot forward and the fabric moving with her, arms swinging naturally. Full-length portrait from head to feet, shot at eye level, a faint sense of motion in the lower hem only — her face and the garment stay sharp.",
    drapeNote:
      "The pallu is pleated and draped over the left shoulder, lifting slightly with the movement so its border edge is readable against the body of the saree. The waist pleats stay clean and evenly spaced.",
  },
  {
    id: "seated",
    name: "Seated",
    body: "She is seated on a low carved wooden stool, back straight, knees together and angled slightly away from the camera, hands resting one over the other in her lap. Full figure in frame from head to feet, shot at her eye level.",
    drapeNote:
      "The pallu is pleated over the left shoulder and falls down the front; the lower drape pools naturally over the knees without hiding the border. The pleats stay clean and evenly spaced.",
  },
  {
    id: "border-detail",
    name: "Border · macro",
    body: "A tight macro detail photograph of the garment as worn — no face in frame. The camera is close enough to read the weave, the brush or block work and the thread. Shallow depth of field, the detail sharp across the frame, the body behind it softly out of focus.",
    drapeNote:
      "Frame the border and the pallu edge where they meet, so the border's motif and its repeat are both legible.",
  },
  {
    id: "pallu-detail",
    name: "Pallu · macro",
    body: "A tight macro detail photograph of the garment as worn, framed on the shoulder and upper chest — the face may be partly cropped. Shallow depth of field, the fabric detail sharp across the frame.",
    drapeNote:
      "Frame the pleated pallu as it crosses the shoulder, so the pleat edges and the pallu's own motif are both legible.",
    garments: ["saree", "dupatta"],
  },
];

const BY_ID = new Map(POSES.map((p) => [p.id, p]));

export function pose(id: string): Pose {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown pose: ${id}`);
  return found;
}

export function posesFor(garment: GarmentId): Pose[] {
  return POSES.filter((p) => !p.garments || p.garments.includes(garment));
}

/** What a fresh Studio session starts with — the five that proved out in prod. */
export const DEFAULT_POSE_IDS = ["front", "three-quarter", "back", "waist-up", "relaxed"];

/** Garments whose drape has a pallu, so `drapeNote` applies. */
const PALLU_GARMENTS: GarmentId[] = ["saree", "dupatta", "lehenga"];

export function hasPallu(garment: GarmentId): boolean {
  return PALLU_GARMENTS.includes(garment);
}
