"use client";

import Image from "next/image";
import type { PickablePose } from "@/registry/poses";
import { PoseFigure } from "./PoseFigure";

/**
 * What she does.
 *
 * Poses come from the registry, not from a list in this file: the UI shows a
 * name, a picture and an id, and reads no pose behaviour at all. What a pose
 * means is resolved downstream from the id the customer picks.
 *
 * A pose with a proven recipe is marked. That difference is real — a recipe is
 * instructions written and tested for that pose, and one without falls back to
 * generic wording — so it is shown rather than hidden behind a uniform grid.
 */
export function StepPose({
  poses,
  selected,
  onToggle,
  recipeBacked,
}: {
  poses: PickablePose[];
  selected: string[];
  onToggle: (id: string) => void;
  recipeBacked: Set<string>;
}) {
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Each pose is one photograph. Choose as many as you want — you pay per
        image, so this is the choice that sets the price.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {poses.map((pose) => {
          const on = selected.includes(pose.id);
          const proven = recipeBacked.has(pose.id);
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
                <span className="relative block aspect-4/3 w-full">
                  {pose.silhouette ? (
                    <Image
                      src={pose.silhouette}
                      alt=""
                      fill
                      sizes="220px"
                      className="object-contain mix-blend-multiply"
                    />
                  ) : (
                    <PoseFigure poseId={pose.drawnAs ?? pose.id} />
                  )}
                </span>
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
              <span className="px-2 pb-2 pt-1 text-center">
                <span
                  className={`block text-[12px] leading-tight ${on ? "font-medium text-accent" : "text-ink-soft"}`}
                >
                  {pose.name}
                </span>
                <span className="numeral mt-0.5 block text-[10px] text-ink-faint">
                  {pose.id}
                  {proven && " · tuned"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-[13px] text-ink-faint">
        “Tuned” means this pose has instructions written and tested for it. The
        rest use general wording and vary more.
      </p>
    </div>
  );
}
