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

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      // min-h-11 so a chip clears the 44px touch target: these are tapped on a
      // phone on the warehouse floor, not only clicked with a mouse.
      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-[14px] transition ${
        active
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
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
      {label && <span className="label mb-1.5 block">{label}</span>}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-accent"
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
      className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-accent"
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  cols = 1,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** The rail is narrow; three across turns every label into two ragged lines. */
  cols?: 1 | 2;
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3.5 py-3 text-left transition ${
            value === option.value
              ? "border-accent bg-accent-wash"
              : "border-line bg-surface hover:border-ink-faint"
          }`}
        >
          <span
            className={`block text-[14px] font-medium leading-snug ${
              value === option.value ? "text-accent" : "text-ink"
            }`}
          >
            {option.label}
          </span>
          {option.hint && (
            <span className="mt-1 block text-[12px] leading-snug text-ink-faint">{option.hint}</span>
          )}
        </button>
      ))}
    </div>
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
