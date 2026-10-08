/**
 * The poses each garment type can be photographed in (8 Oct, user: "P1–P5 are
 * for sarees; each item needs its own"). The saree keeps P1–P5, which the
 * frozen Gemini prompts know; every other type has its own list, used by the
 * Qwen track. `how` is the sentence the model is given; `framing` says how
 * much of the body is in frame.
 */
export interface Pose {
  id: string;
  title: string;
  /** One line under the title on the pose list. */
  summary: string;
  /** The pose, as a sentence for the model. */
  how: string;
  framing: "full" | "waist" | "detail";
  group: "front" | "side" | "back" | "garment";
}

const STAND = "standing straight, weight even, arms relaxed at the sides, looking at the camera";
const QUARTER = "turned about 30 degrees to the camera, one hand on the hip, the other relaxed, looking at the camera";
const BACK = "back to the camera, head turned in profile, so the back of the garment shows";
const SEATED = "seated on a low wooden stool, back straight, hands resting in the lap, the garment arranged neatly";
const WALK = "mid-step walking towards the camera, one foot forward, arms swinging naturally, a soft smile";
const TWIRL = "mid-twirl, turning so the skirt flares out in a full circle, arms slightly out, joyful";

export const POSES: Record<string, Pose[]> = {
  saree: [
    { id: "P1", title: "Front, symmetrical", summary: "Hands clasped at the waist, pallu peaked over the left shoulder and away behind.", how: STAND, framing: "full", group: "front" },
    { id: "P2", title: "Three-quarter, hand on hip", summary: "Turned 30 degrees, pallu forward down the left front so the full pattern reads.", how: "turned about 30 degrees to the camera, one hand on the hip, the pallu forward down the left front so its full pattern shows", framing: "full", group: "side" },
    { id: "P3", title: "Back view, head in profile", summary: "Back to the camera, pallu falling down the back, lower drape and hem seen from behind.", how: "back to the camera, head turned in profile, the pallu falling down the back, the hem and lower drape seen from behind", framing: "full", group: "back" },
    { id: "P4", title: "Waist up, pallu detail", summary: "Cropped from the waist up, pallu end brought over the left forearm so its print is in frame.", how: "framed from the waist up, the pallu end brought over the left forearm so its print fills the frame", framing: "waist", group: "garment" },
    { id: "P5", title: "Relaxed three-quarter, weight on one leg", summary: "Hip angled to the camera, hand on hip, pallu forward down the left front to the hem.", how: "relaxed three-quarter stance, weight on one leg, hip angled to the camera, one hand on the hip, the pallu forward down the left front", framing: "full", group: "front" },
  ],
  frock: [
    { id: "F1", title: "Front, standing", summary: "Straight on, the whole frock from neck to hem.", how: STAND, framing: "full", group: "front" },
    { id: "F2", title: "Three-quarter, hand on hip", summary: "Turned a little, hand on hip, the flare of the skirt visible.", how: QUARTER, framing: "full", group: "side" },
    { id: "F3", title: "Twirl", summary: "Skirt flaring out in a circle; shows the flow and the tiers.", how: TWIRL, framing: "full", group: "front" },
    { id: "F4", title: "Walking", summary: "A step towards the camera, the skirt in motion.", how: WALK, framing: "full", group: "front" },
    { id: "F5", title: "Seated, skirt spread", summary: "On a stool, the skirt spread around; the print laid out.", how: SEATED + ", the skirt spread out around the stool", framing: "full", group: "front" },
    { id: "F6", title: "Back view", summary: "From behind; the back of the frock and the hem.", how: BACK, framing: "full", group: "back" },
  ],
  kurti: [
    { id: "K1", title: "Front, standing", summary: "Straight on, head to feet.", how: STAND, framing: "full", group: "front" },
    { id: "K2", title: "Three-quarter, hand on hip", summary: "Turned a little, one hand on the hip.", how: QUARTER, framing: "full", group: "side" },
    { id: "K3", title: "Side profile", summary: "Full side view; the fall of the kurti.", how: "standing in full side profile to the camera, head turned towards the camera, arms relaxed", framing: "full", group: "side" },
    { id: "K4", title: "Back view", summary: "From behind; the back of the kurti.", how: BACK, framing: "full", group: "back" },
    { id: "K5", title: "Seated", summary: "On a stool, hands in the lap.", how: SEATED, framing: "full", group: "front" },
    { id: "K6", title: "Neckline & sleeve close-up", summary: "Waist up; the neckline and the sleeve detail fill the frame.", how: "framed from the waist up, one hand raised lightly to the collarbone so the neckline and the sleeve are both clear", framing: "waist", group: "garment" },
  ],
  coord_set: [
    { id: "C1", title: "Front, standing", summary: "Straight on; top and pants both in frame.", how: STAND, framing: "full", group: "front" },
    { id: "C2", title: "Three-quarter, hand on hip", summary: "Turned a little, one hand on the hip.", how: QUARTER, framing: "full", group: "side" },
    { id: "C3", title: "Walking", summary: "A step towards the camera; the pants in motion.", how: WALK, framing: "full", group: "front" },
    { id: "C4", title: "Back view", summary: "From behind; the back of the set.", how: BACK, framing: "full", group: "back" },
    { id: "C5", title: "Seated", summary: "On a stool, hands in the lap.", how: SEATED, framing: "full", group: "front" },
  ],
  lehenga: [
    { id: "L1", title: "Front, standing", summary: "Straight on; top and skirt from neck to hem.", how: STAND, framing: "full", group: "front" },
    { id: "L2", title: "Twirl", summary: "The skirt flaring out in a full circle.", how: TWIRL, framing: "full", group: "front" },
    { id: "L3", title: "Three-quarter, hand on hip", summary: "Turned a little, one hand on the hip.", how: QUARTER, framing: "full", group: "side" },
    { id: "L4", title: "Seated, skirt spread", summary: "On a low seat, the skirt spread in a wide circle.", how: SEATED + ", the skirt spread out in a wide circle on the floor", framing: "full", group: "front" },
    { id: "L5", title: "Back view", summary: "From behind; the back of the top and the skirt.", how: BACK, framing: "full", group: "back" },
  ],
  blouse: [
    { id: "B1", title: "Front, waist up", summary: "Straight on from the waist up; the blouse fills the frame.", how: "standing straight, framed from the waist up, arms relaxed, looking at the camera", framing: "waist", group: "front" },
    { id: "B2", title: "Three-quarter, waist up", summary: "Turned a little, from the waist up.", how: "turned about 30 degrees to the camera, framed from the waist up, one hand on the hip", framing: "waist", group: "side" },
    { id: "B3", title: "Back, waist up", summary: "From behind, from the waist up; the back design.", how: "back to the camera, framed from the waist up, head turned in profile, so the back of the blouse shows", framing: "waist", group: "back" },
    { id: "B4", title: "Sleeve & neckline close-up", summary: "Close on the neckline and one sleeve.", how: "framed from the chest up and to one side, so the neckline and one sleeve fill the frame", framing: "detail", group: "garment" },
  ],
  dupatta: [
    { id: "D1", title: "Over one shoulder, front", summary: "Draped over the left shoulder, falling in front.", how: STAND + ", the dupatta over the left shoulder falling in front", framing: "full", group: "front" },
    { id: "D2", title: "Over both shoulders", summary: "Draped across both shoulders like a shawl, ends in front.", how: STAND + ", the dupatta across both shoulders with both ends falling in front", framing: "full", group: "front" },
    { id: "D3", title: "Over the head", summary: "Draped over the head and shoulders.", how: STAND + ", the dupatta draped over the head and both shoulders", framing: "full", group: "front" },
    { id: "D4", title: "Back, falling down", summary: "From behind; the dupatta falling down the back.", how: BACK + ", the dupatta falling down the back to the hem", framing: "full", group: "back" },
  ],
};

/** The poses for a garment type; sarees for anything unknown. */
export function posesFor(type: string): Pose[] {
  return POSES[type] ?? POSES.saree!;
}

export function poseFor(type: string, id: string): Pose | undefined {
  return posesFor(type).find((p) => p.id === id);
}

/** The first pose: the one the first image is made in unless another is chosen. */
export function primaryPose(type: string): Pose {
  return posesFor(type)[0]!;
}
