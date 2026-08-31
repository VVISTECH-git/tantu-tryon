import { composePrompt } from "./compose";
import { pose as poseById } from "./poses";
import { getProvider } from "./providers/index";
import type { ProviderId, RenderOutcome, RenderReport, RenderRequest } from "./types";

export interface RenderOptions {
  provider?: ProviderId;
  /** How many poses to have in flight at once. Keeps us under rate limits. */
  concurrency?: number;
  /** Called as each pose settles, so a UI can fill in progressively. */
  onOutcome?: (outcome: RenderOutcome) => void;
  /**
   * Abort everything still in flight. A Stop button that only stops the screen
   * while the provider keeps billing is worse than no Stop button at all.
   */
  signal?: AbortSignal;
}

export function validateRequest(request: RenderRequest): string[] {
  const problems: string[] = [];
  if (request.references.length === 0) problems.push("Add at least one photograph of the garment.");
  if (request.poses.length === 0) problems.push("Choose at least one pose.");
  if (request.mode === "person" && !request.person) {
    problems.push("Try-on mode needs a photograph of the person.");
  }
  if (request.mode === "mannequin" && !request.references.some((r) => r.slot === "mannequin")) {
    problems.push("Mannequin mode needs the photograph of the garment on the mannequin.");
  }
  return problems;
}

/**
 * Renders every requested pose from the same references.
 *
 * A pose that fails is recorded and skipped — one refused image must never cost
 * you the other four, which is exactly what a single all-or-nothing call does.
 */
export async function renderPoses(
  request: RenderRequest,
  options: RenderOptions = {},
): Promise<RenderReport> {
  const problems = validateRequest(request);
  if (problems.length) throw new Error(problems.join(" "));

  const provider = getProvider(options.provider);
  if (!provider.supports(request.mode)) {
    throw new Error(`${provider.label} cannot run in ${request.mode} mode.`);
  }

  const started = Date.now();
  const poses = request.poses.map(poseById);
  const outcomes: RenderOutcome[] = new Array(poses.length);
  const limit = Math.max(1, options.concurrency ?? 3);

  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next++;
      const pose = poses[index];
      if (!pose) return;
      // A pose that has not started yet is simply never started.
      if (options.signal?.aborted) return;

      const prompt = composePrompt(request, pose);
      const poseStarted = Date.now();
      try {
        const image = await provider.render({ request, pose, prompt, signal: options.signal });
        outcomes[index] = {
          ok: true,
          poseId: pose.id,
          poseName: pose.name,
          data: image.data,
          mime: image.mime,
          prompt,
          provider: provider.id,
          model: image.model,
          ms: Date.now() - poseStarted,
        };
      } catch (error) {
        outcomes[index] = {
          ok: false,
          poseId: pose.id,
          poseName: pose.name,
          prompt,
          provider: provider.id,
          error: error instanceof Error ? error.message : String(error),
          ms: Date.now() - poseStarted,
        };
      }
      options.onOutcome?.(outcomes[index]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, poses.length) }, worker));

  // Poses skipped by an abort leave holes; they never ran, so they are not
  // outcomes and must not be counted as failures.
  const settled = outcomes.filter((outcome): outcome is RenderOutcome => Boolean(outcome));
  const succeeded = settled.filter((outcome) => outcome.ok).length;
  return {
    outcomes: settled,
    succeeded,
    failed: settled.length - succeeded,
    ms: Date.now() - started,
  };
}
