"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Section({
  step,
  title,
  hint,
  right,
  children,
}: {
  step?: number;
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line-soft px-6 py-7 last:border-b-0">
      <div className="mb-1.5 flex items-baseline gap-2.5">
        {step !== undefined && (
          <span className="label !text-madder">{String(step).padStart(2, "0")}</span>
        )}
        <h2 className="display text-[19px]">{title}</h2>
        {right && <div className="ml-auto flex items-center gap-3">{right}</div>}
      </div>
      {hint && <p className="mb-4 max-w-prose text-[14px] leading-relaxed text-ink-soft">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * One row of the settings rail: a label in a fixed column, a control beside it.
 *
 * Every setting uses this geometry — the selects here and the collapsible rows
 * in Disclosure — so the rail reads as one list instead of three different
 * treatments stacked on each other.
 */
export function SettingRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-line-soft px-6 py-3">
      {/*
        Aligned to the control, not to the block.

        Three of these rows put a hint under the select, so the content column
        is two lines tall while the label is one. Centring the row against
        that dropped the label into the gap between the select and its hint.
        The label now carries the control's own height and centres inside it,
        which lands it level with the select whether or not a hint follows —
        and level with the first line of the Notes textarea, which is where it
        belongs there too.
      */}
      <label
        htmlFor={htmlFor}
        className="flex min-h-11 w-28 shrink-0 items-center text-[14px] font-medium"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * A single choice from many. Replaces a wrapped grid of pills — nine garment
 * pills at a 44px touch height cost roughly 150px of a 380px rail to express
 * one value.
 */
export function Select({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none transition focus:border-accent"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A multiple choice, one card each.
 *
 * The rail used to ask the same question — pick from a short list — three
 * different ways: a select with its hint stranded underneath for Worn as,
 * bare checkboxes for the poses, hand-built cards for the quality. The named
 * one-line choices settled on the select, where the hint can describe the
 * choice made rather than all of them at once.
 *
 * This is the one that did not settle there, because it is the only list you
 * pick several from and there are nine of them. A select cannot say "these
 * five", and nine bare checkboxes in a row read as a form rather than as a
 * choice.
 */
export function CheckList({
  options,
  selected,
  onToggle,
  cols = 1,
}: {
  options: { value: string; label: string; hint?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  /** The rail is narrow; two across breaks the longer names over ragged lines. */
  cols?: 1 | 2;
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((option) => {
        const on = selected.includes(option.value);

        return (
          <label
            key={option.value}
            className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition has-[:focus-visible]:border-accent ${
              on
                ? "border-accent bg-accent-wash"
                : "border-line bg-surface hover:border-ink-faint"
            }`}
          >
            {/* The real checkbox is hidden rather than removed — it still takes
                focus and still answers to the space bar, and the card wears the
                focus ring for it. */}
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(option.value)}
              className="sr-only"
            />

            {/* Drawn rather than native, so the tick can sit on the accent fill. */}
            <span
              aria-hidden
              className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition ${
                on ? "border-accent bg-accent" : "border-line bg-surface"
              }`}
            >
              {on && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2.5 6.3l2.4 2.4 4.6-5"
                    stroke="var(--color-surface)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>

            <span className="min-w-0">
              <span
                className={`block text-[14px] leading-snug font-medium ${
                  on ? "text-accent" : "text-ink"
                }`}
              >
                {option.label}
              </span>
              {option.hint && (
                <span className="mt-1 block text-[12px] leading-snug text-ink-faint">
                  {option.hint}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** A select with its own caption, for use inside a panel rather than a row. */
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-ink-soft">{label}</span>
      <Select value={value} onChange={onChange} options={options} />
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] text-ink-soft">{label}</span>}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-accent"
      />
    </label>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-accent"
    />
  );
}

/**
 * Destructive actions arm before they fire. A misplaced click should never be
 * the last thing that happens to five renders.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = "",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        }}
        className={`text-[13px] text-ink-faint underline underline-offset-2 transition hover:text-danger ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
        }}
        className="rounded-full bg-danger px-3 py-1 text-[13px] font-medium text-white transition hover:brightness-110"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          clearTimeout(timer.current);
          setArmed(false);
        }}
        className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
      >
        cancel
      </button>
    </span>
  );
}
