"use client";

import { STEPS, type StepId } from "./types";

/**
 * Where you are, and what is left.
 *
 * The old Studio put every control on one screen, which meant a first-time
 * visitor had to work out what mattered before doing anything. Steps make the
 * order explicit and let each screen ask one question.
 *
 * A step you have not reached is not clickable — going back is always allowed,
 * skipping ahead is not, because a later step reads what an earlier one chose.
 */
export function Stepper({
  current,
  furthest,
  onGo,
}: {
  current: StepId;
  furthest: number;
  onGo: (id: StepId) => void;
}) {
  const index = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Progress" className="border-b border-line bg-surface">
      <ol className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-6">
        {STEPS.map((step, i) => {
          const state = i === index ? "current" : i < index ? "done" : "ahead";
          const reachable = i <= furthest;
          return (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(step.id)}
                aria-current={state === "current" ? "step" : undefined}
                className={`w-full border-b-2 px-2 py-3 text-left transition disabled:cursor-not-allowed ${
                  state === "current"
                    ? "border-accent text-ink"
                    : state === "done"
                      ? "border-accent/30 text-ink-soft hover:text-ink"
                      : "border-transparent text-ink-faint"
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="numeral text-[11px] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-[14px] font-medium">{step.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                  {step.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
