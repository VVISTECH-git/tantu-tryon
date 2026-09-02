import type { GarmentCode, GarmentTypeId, PoseRecord, PoseStatus } from "./types";
import { GARMENT_CODES } from "./types";

export * from "./types";

/**
 * Queries over a set of pose records.
 *
 * Pure functions taking the records as an argument — the registry does not read
 * files or know where records come from, so the same code serves JSON today and
 * a database later.
 */

const ID_PATTERN = /^(SAR|KUR|LEH|SUT)-P(\d{2,3})$/;

export function parsePoseId(id: string): { code: GarmentCode; index: number } | null {
  const m = ID_PATTERN.exec(id);
  if (!m) return null;
  return { code: m[1] as GarmentCode, index: Number(m[2]) };
}

export function garmentTypeOf(id: string): GarmentTypeId | null {
  const parsed = parsePoseId(id);
  return parsed ? GARMENT_CODES[parsed.code] : null;
}

export function posesForGarment(records: PoseRecord[], garment: GarmentTypeId): PoseRecord[] {
  return records.filter((r) => r.garmentType === garment);
}

export function poseById(records: PoseRecord[], id: string): PoseRecord | undefined {
  return records.find((r) => r.id === id);
}

export function withStatus(records: PoseRecord[], ...statuses: PoseStatus[]): PoseRecord[] {
  return records.filter((r) => statuses.includes(r.status));
}

/**
 * What a customer is allowed to see.
 *
 * Production shows locked poses only. Outside production, poses still in draft
 * or review are shown too, so they can be worked on — but never deprecated
 * ones, which exist purely so old jobs remain readable.
 *
 * The environment is passed in rather than read from process.env: the engine is
 * also imported by the browser bundle, where process does not exist.
 */
export function productionPoses(
  records: PoseRecord[],
  garment: GarmentTypeId,
  options: { includeUnlocked?: boolean } = {},
): PoseRecord[] {
  const forGarment = posesForGarment(records, garment);
  return options.includeUnlocked
    ? withStatus(forGarment, "locked", "review", "draft")
    : withStatus(forGarment, "locked");
}

/** Every problem that would make a record unusable. Empty means it is sound. */
export function validatePose(record: PoseRecord): string[] {
  const problems: string[] = [];
  const parsed = parsePoseId(record.id);

  if (!parsed) {
    problems.push(`${record.id}: id must look like SAR-P01`);
  } else if (GARMENT_CODES[parsed.code] !== record.garmentType) {
    problems.push(
      `${record.id}: id prefix is ${parsed.code} (${GARMENT_CODES[parsed.code]}) but garmentType is ${record.garmentType}`,
    );
  }

  if (record.version < 1) problems.push(`${record.id}: version must start at 1`);
  if (record.showcasePurpose.length === 0) {
    problems.push(`${record.id}: showcasePurpose is empty — a pose must sell something`);
  }
  if (!record.assets.silhouette && !record.enginePoseId) {
    problems.push(`${record.id}: nothing to show — no silhouette and no engine pose to draw`);
  }
  return problems;
}

/**
 * Locked poses that cannot yet be generated faithfully, because the pipeline
 * has neither a photographic reference nor a pose-specific recipe to steer it.
 *
 * Not an error — it is the gap the reference layer exists to close, and it
 * should be visible rather than discovered during a paid render.
 */
export function posesWithoutControl(records: PoseRecord[]): PoseRecord[] {
  return records.filter(
    (r) => r.status === "locked" && !r.assets.masterReference && !r.recipe,
  );
}

export function validateAll(records: PoseRecord[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const record of records) {
    if (seen.has(record.id)) problems.push(`${record.id}: duplicate id`);
    seen.add(record.id);
    problems.push(...validatePose(record));
  }
  return problems;
}
