"use client";

import Image from "next/image";
import type { PickablePose } from "@/registry/poses";
import { PoseFigure } from "./PoseFigure";

/**
 * Pick poses by looking at them.
 *
 * Reading "Relaxed three-quarter" and guessing what comes back is how someone
 * ends up paying for five images they did not want. Each option carries a
 * picture of the stance, where the pallu falls and how tight the crop is.
 *
 * This component knows nothing about what a pose means. It shows a name and a
 * picture, and hands the pose id back — the definition lives in the registry.
 *
 * Silhouettes are large source files (up to 5MB) so they go through next/image:
 * the browser gets a resized WebP a few kilobytes wide, and the master stays in
 * the repo at full resolution. Poses with no silhouette yet fall back to the
 * drawn figure.
 */
export function PosePicker({
  poses,
  selected,
  onToggle,
}: {
  poses: PickablePose[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    // Two across, not three: the silhouettes carry real anatomy now, and at a
    // third of the rail's width the hands and feet stop being readable.
    <div className="grid grid-cols-2 gap-2">
      {poses.map((pose) => {
        const on = selected.includes(pose.id);
        const generatable = Boolean(pose.enginePoseId);
        return (
          <label
            key={pose.id}
            className={`flex flex-col overflow-hidden rounded-xl border transition has-[:focus-visible]:border-accent ${
              generatable ? "cursor-pointer" : "cursor-not-allowed opacity-55"
            } ${
              on ? "border-accent bg-accent-wash" : "border-line bg-surface hover:border-ink-faint"
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={!generatable}
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
                    sizes="200px"
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
            <span
              className={`px-2 pb-2 pt-1 text-center text-[11px] leading-tight ${
                on ? "font-medium text-accent" : "text-ink-soft"
              }`}
            >
              {pose.name}
              {!generatable && (
                <span className="mt-0.5 block text-[10px] text-ink-faint">No recipe yet</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
