"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * A setting that stays out of the way until it is wanted.
 *
 * The Studio's model, scene, pose and quality controls all have defaults that
 * work; showing all of them at once put 56 controls and three screens of
 * scrolling in front of a job whose minimum input is one photograph. Each is now
 * a summary line you can open.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  /** The current value, so the row is useful without being opened. */
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-line-soft">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          onClick={() => setOpen((value) => !value)}
          // Same geometry as SettingRow — 28-unit label column, same padding,
          // same 44px minimum — so the rail reads as one list of settings.
          className="flex min-h-14 w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-surface-2"
        >
          <span className="w-28 shrink-0 text-[14px] font-medium">{title}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{summary}</span>
          <span
            aria-hidden
            className={`shrink-0 text-[14px] leading-none text-ink-faint transition-transform duration-200 ${
              open ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </button>
      </h2>

      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
