/**
 * The pose registry schema.
 *
 * A pose is structured configuration, not a picture. The picture is one field
 * on the record. Everything the generation pipeline needs to know about what a
 * pose *means* lives here, so that no UI component ever has to decide it.
 *
 * These types are deliberately free of any framework and of any file access, so
 * the same schema serves the JSON files today and a database later without the
 * logical model changing.
 */

/** Garment code. The prefix of every pose id, so ids never collide. */
export type GarmentCode = "SAR" | "KUR" | "LEH" | "SUT";

export const GARMENT_CODES: Record<GarmentCode, string> = {
  SAR: "saree",
  KUR: "kurti",
  LEH: "lehenga",
  SUT: "suit",
};

export type GarmentTypeId = (typeof GARMENT_CODES)[GarmentCode];

/**
 * `draft` still being designed · `review` being tested · `locked` approved for
 * production · `deprecated` kept for history, never offered again.
 *
 * Customers see `locked` only. See `productionPoses`.
 */
export type PoseStatus = "draft" | "review" | "locked" | "deprecated";

export interface PoseAssets {
  /**
   * The flat silhouette shown in the pose picker.
   *
   * Null for poses that predate the silhouette set — they are still selectable
   * and still generate; the picker falls back to a drawn figure.
   */
  silhouette: string | null;
  /**
   * The photographic reference that steers generation geometry.
   *
   * Null until the reference layer is built — a pose can be selected without
   * one, but it cannot be generated faithfully from a silhouette alone.
   */
  masterReference: string | null;
  thumbnail: string | null;
}

export type Orientation =
  | "front"
  | "three-quarter-left"
  | "three-quarter-right"
  | "profile-left"
  | "profile-right"
  | "back"
  | "back-three-quarter";

export interface PoseBody {
  orientation: Orientation;
  /** Degrees from straight-on. Negative turns the model's left toward camera. */
  torsoAngle: number;
  headDirection: "camera" | "away" | "profile" | "over-shoulder" | "toward-garment";
  weightDistribution: "balanced" | "left" | "right";
  leftLeg: "neutral" | "forward" | "back" | "lifted" | "crossed";
  rightLeg: "neutral" | "forward" | "back" | "lifted" | "crossed";
}

export interface HandSpec {
  position: string;
  /** What the hand does to the garment. "none" means it must not touch it. */
  interaction: string;
}

export interface PoseHands {
  left: HandSpec;
  right: HandSpec;
}

/**
 * Garment behaviour is deliberately NOT one shared shape. A kurti has no pallu
 * and a saree has no side slit; forcing them into one interface would produce a
 * record full of nulls and a pipeline full of optional checks.
 */
export interface SareeBehaviour {
  pallu: {
    position: string;
    displayMode: string;
    mustRemainVisible: boolean;
  };
  pleats: { visibility: "full" | "partial" | "hidden" };
  border: { visibility: string };
  blouse: { visibility: "front" | "back" | "partial" | "hidden" };
}

export interface KurtiBehaviour {
  front: { visibility: string };
  sleeve: { visibility: string };
  sideSlit: { visibility: string };
  hem: { visibility: string };
  trouser: { visibility: string };
  dupatta: { position: string; displayMode: string } | null;
}

export interface LehengaBehaviour {
  skirt: { flare: string };
  dupatta: { position: string; displayMode: string } | null;
  blouse: { visibility: string };
  waist: { visibility: string };
  embroidery: { visibility: string };
}

export interface GenerationConstraints {
  preservePoseGeometry: boolean;
  preserveGarmentConstruction: boolean;
  allowHandRepositioning: boolean;
  allowBodyRotation: boolean;
  allowPalluReinterpretation: boolean;
}

interface PoseRecordBase {
  /** `SAR-P01`. Permanent. A different pose gets a new id, never a reused one. */
  id: string;
  name: string;
  status: PoseStatus;
  /** Bumped for metadata corrections. A different pose gets a new id instead. */
  version: number;
  createdAt: string;
  updatedAt: string;
  assets: PoseAssets;
  body: PoseBody;
  hands: PoseHands;
  /** What this pose exists to sell. Not decoration — it drives QC. */
  showcasePurpose: string[];
  generationConstraints: GenerationConstraints;
  /** Identifier of the pose-specific recipe, once recipes exist. */
  recipe: string | null;
  /**
   * The legacy engine pose this record stands in for, while generation still
   * runs off `poses.ts`. Removed once recipes replace that path.
   */
  enginePoseId?: string;
}

export type PoseRecord =
  | (PoseRecordBase & { garmentType: "saree"; garmentBehaviour: SareeBehaviour })
  | (PoseRecordBase & { garmentType: "kurti"; garmentBehaviour: KurtiBehaviour })
  | (PoseRecordBase & { garmentType: "lehenga"; garmentBehaviour: LehengaBehaviour })
  | (PoseRecordBase & { garmentType: "suit"; garmentBehaviour: KurtiBehaviour });

export type SareePoseRecord = Extract<PoseRecord, { garmentType: "saree" }>;
