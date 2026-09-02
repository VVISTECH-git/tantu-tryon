import type { GarmentId, GarmentTypeId, PoseRecord } from "@tantu/engine/catalog";
import { poseById, posesFor, productionPoses, validateAll } from "@tantu/engine/catalog";

import SAR_P01 from "@data/poses/saree/SAR-P01.json";
import SAR_P02 from "@data/poses/saree/SAR-P02.json";
import SAR_P03 from "@data/poses/saree/SAR-P03.json";
import SAR_P04 from "@data/poses/saree/SAR-P04.json";
import SAR_P05 from "@data/poses/saree/SAR-P05.json";
import SAR_P06 from "@data/poses/saree/SAR-P06.json";
import SAR_P07 from "@data/poses/saree/SAR-P07.json";
import SAR_P08 from "@data/poses/saree/SAR-P08.json";
import SAR_P09 from "@data/poses/saree/SAR-P09.json";
import SAR_P10 from "@data/poses/saree/SAR-P10.json";
import SAR_P11 from "@data/poses/saree/SAR-P11.json";
import SAR_P12 from "@data/poses/saree/SAR-P12.json";
import SAR_P13 from "@data/poses/saree/SAR-P13.json";
import SAR_P14 from "@data/poses/saree/SAR-P14.json";
import SAR_P15 from "@data/poses/saree/SAR-P15.json";
import SAR_P16 from "@data/poses/saree/SAR-P16.json";
import SAR_P17 from "@data/poses/saree/SAR-P17.json";
import SAR_P24 from "@data/poses/saree/SAR-P24.json";
import SAR_P30 from "@data/poses/saree/SAR-P30.json";
import SAR_P31 from "@data/poses/saree/SAR-P31.json";
import SAR_P32 from "@data/poses/saree/SAR-P32.json";
import SAR_P33 from "@data/poses/saree/SAR-P33.json";
import SAR_P34 from "@data/poses/saree/SAR-P34.json";
import SAR_P35 from "@data/poses/saree/SAR-P35.json";

/**
 * The pose registry, loaded.
 *
 * Records are authored as JSON under `apps/web/data/poses/<garment>/` — one
 * file per pose, the shape the architecture calls for and the shape that
 * migrates to a database row unchanged. They are imported explicitly rather
 * than globbed, so a malformed or missing file is a build error rather than a
 * pose that quietly vanishes from the customer's picker.
 *
 * Adding a pose: write the JSON, add one import line, add it to the array.
 */
export const POSE_RECORDS = [
  SAR_P01, SAR_P02, SAR_P03, SAR_P04, SAR_P05, SAR_P06, SAR_P07,
  SAR_P08, SAR_P09, SAR_P10, SAR_P11, SAR_P12, SAR_P13,
  SAR_P14, SAR_P15, SAR_P16, SAR_P17, SAR_P24,
  SAR_P30, SAR_P31, SAR_P32, SAR_P33, SAR_P34, SAR_P35,
] as unknown as PoseRecord[];

/** Garments the registry covers. Everything else still uses the engine list. */
const REGISTERED: Partial<Record<GarmentId, GarmentTypeId>> = {
  saree: "saree",
  kurti: "kurti",
  lehenga: "lehenga",
  "salwar-suit": "suit",
};

/**
 * One shape for the picker, whether the pose came from the registry or from the
 * engine's own list. The UI never reads pose behaviour off either — it shows
 * `name` and `silhouette`, and hands `id` back when the customer chooses.
 */
export interface PickablePose {
  /** What gets recorded. A registry id (`SAR-P01`) wherever one exists. */
  id: string;
  name: string;
  silhouette: string | null;
  /**
   * The engine pose that generates this. Undefined means the pose is defined
   * but not yet generatable — it has no recipe and no legacy pose behind it.
   */
  enginePoseId?: string;
  /** For the drawn fallback figure, which is keyed by engine pose id. */
  drawnAs?: string;
  status?: PoseRecord["status"];
}

/**
 * Poses a customer may choose for a garment.
 *
 * Production shows `locked` only, as the architecture requires. Outside
 * production `review` and `draft` appear as well, so poses can be worked on;
 * otherwise the Studio would look broken to whoever is building the next one.
 */
export function selectablePoses(garment: GarmentId): PickablePose[] {
  const type = REGISTERED[garment];
  if (type) {
    const records = productionPoses(POSE_RECORDS, type, {
      includeUnlocked: process.env.NODE_ENV !== "production",
    });
    if (records.length > 0) {
      return records.map((r) => ({
        id: r.id,
        name: r.name,
        silhouette: r.assets.silhouette,
        enginePoseId: r.enginePoseId,
        drawnAs: r.enginePoseId,
        status: r.status,
      }));
    }
  }
  // No registry coverage yet for this garment — the engine list still serves.
  return posesFor(garment).map((p) => ({
    id: p.id,
    name: p.name,
    silhouette: null,
    enginePoseId: p.id,
    drawnAs: p.id,
  }));
}

/** What a fresh session starts with: the set that is proven in production. */
export function defaultPoseIds(garment: GarmentId): string[] {
  const available = selectablePoses(garment);
  const preferred = ["SAR-P01", "SAR-P04", "SAR-P08", "SAR-P30", "SAR-P31"];
  const matched = preferred.filter((id) => available.some((p) => p.id === id));
  if (matched.length > 0) return matched;
  return available
    .filter((p) => p.enginePoseId)
    .slice(0, 5)
    .map((p) => p.id);
}

/** The full specification behind a stored poseId. The pipeline resolves here. */
export function poseSpec(id: string): PoseRecord | undefined {
  return poseById(POSE_RECORDS, id);
}

/** Registry problems, for the build check and a future admin view. */
export function registryProblems(): string[] {
  return validateAll(POSE_RECORDS);
}

