// The vocabulary half of the engine: everything a browser needs to render the
// Studio controls, with none of the server-only provider code behind it.
export * from "./types";
export { SLOTS, slot, slotsFor } from "./slots";
export type { SlotDef } from "./slots";
export { GARMENTS, garment } from "./garments";
export type { GarmentDef } from "./garments";
export { POSES, pose, posesFor, hasPallu, DEFAULT_POSE_IDS } from "./poses";
export { SCENES, scene } from "./scenes";
export { guessMime, toRawBase64, toDataUrl } from "./mime";
