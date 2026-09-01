"use client";

import type { Pose } from "@tantu/engine/catalog";
import { PoseFigure } from "./PoseFigure";

/**
 * Pick poses by looking at them.
 *
 * Reading "Relaxed three-quarter" and guessing what comes back is how someone
 * ends up paying for five images they did not want. Each option carries a
 * diagram of the stance, where the pallu falls and how tight the crop is.
 */
export function PosePicker({
  poses,
  selected,
  onToggle,
}: {
  poses: Pose[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {poses.map((pose) => {
        const on = selected.includes(pose.id);
        return (
          <label
            key={pose.id}
            className={`flex cursor-pointer flex-col overflow-hidden rounded-xl border transition has-[:focus-visible]:border-accent ${
              on ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-ink-faint"
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(pose.id)}
              className="sr-only"
            />
            <span className="relative block px-2 pt-2">
              <PoseFigure poseId={pose.id} />
              <span
                aria-hidden
                className={`absolute right-2 top-2 grid size-[15px] place-items-center rounded-[4px] border ${
                  on ? "border-accent bg-accent" : "border-line bg-surface"
                }`}
              >
                {on && (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M2.5 6.3l2.4 2.4 4.6-5"
                      stroke="var(--color-surface)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </span>
            <span
              className={`px-2 pb-2 pt-1 text-center text-[11px] leading-tight ${
                on ? "font-medium text-accent" : "text-ink-soft"
              }`}
            >
              {pose.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}
