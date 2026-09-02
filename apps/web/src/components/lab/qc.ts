/**
 * The QC sheet for a lab run.
 *
 * Seven checks, each one a thing a person can look at and mark. They are not
 * scored or averaged — a single failed motif is a failed image, and hiding that
 * behind a percentage is how a bad render reaches a customer.
 */

export type Verdict = "pass" | "fail" | null;

export interface QcCheck {
  key: string;
  label: string;
  /** What the person is actually being asked to compare. */
  against: string;
}

export const QC_CHECKS: QcCheck[] = [
  { key: "pose", label: "Pose match", against: "the locked silhouette and master reference" },
  { key: "body", label: "Body match", against: "the uploaded body photograph" },
  { key: "border", label: "Border match", against: "the uploaded border photograph" },
  { key: "pallu", label: "Pallu match", against: "the uploaded pallu photograph" },
  { key: "blouse", label: "Blouse match", against: "the uploaded blouse photograph" },
  { key: "colour", label: "Colour match", against: "the colours in every upload" },
  { key: "motif", label: "Motif match", against: "motif identity, scale and spacing" },
];

export type QcSheet = Record<string, Verdict>;

export const EMPTY_SHEET: QcSheet = Object.fromEntries(QC_CHECKS.map((c) => [c.key, null]));

export interface LabRun {
  id: string;
  at: string;
  poseId: string;
  modelId: string;
  image?: string;
  error?: string;
  /** Which recipe produced it. An image that cannot be traced is not evidence. */
  recipeId?: string;
  /** The exact text sent. This is the thing that gets iterated on. */
  prompt?: string;
  warnings?: string[];
  engineModel?: string;
  ms?: number;
  qc: QcSheet;
  notes: string;
  decision: "approved" | "rejected" | null;
}

const KEY = "tantu-lab-runs";

/**
 * Runs are kept in the browser only. This is an experiment log, not a record of
 * anything a customer bought, and it should not travel anywhere.
 */
export function loadRuns(): LabRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LabRun[]) : [];
  } catch {
    return [];
  }
}

export function saveRuns(runs: LabRun[]) {
  try {
    // The image is megabytes of base64 and would blow the quota within a few
    // runs. The log keeps what makes a run interpretable — recipe, verdict,
    // notes, prompt — and lets the picture go.
    const light = runs.slice(0, 12).map((run) => ({ ...run, image: undefined }));
    localStorage.setItem(KEY, JSON.stringify(light));
  } catch {
    // Storage full or blocked. The run is still on screen.
  }
}
