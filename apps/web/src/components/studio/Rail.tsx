"use client";

import { useState } from "react";
import {
  BACKGROUNDS,
  MODEL_TYPES,
  SAFETY_RULES,
  agesFor,
  defaultAge,
  type Selections,
} from "@/content/promptTemplates";

/**
 * Everything you set, in one column.
 *
 * Product first, because nothing below it means anything until there is a
 * saree. Then the choices that fill the prompt's slots — who wears it, how
 * old, where, and which fidelity rules are on. Each change rewrites the prompt
 * on the right immediately; there is no Apply.
 */
export function Rail({
  onFind,
  busy,
  error,
  selections,
  onChange,
  hasProduct,
}: {
  onFind: (code: string) => void;
  busy: boolean;
  error: string | null;
  selections: Selections;
  onChange: (next: Selections) => void;
  hasProduct: boolean;
}) {
  const [code, setCode] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (code.trim()) onFind(code.trim());
  }

  const ages = agesFor(selections.modelType);

  return (
    <div className="space-y-7">
      <section>
        <Label>Product</Label>
        <form onSubmit={submit} className="mt-2.5 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="300021"
            aria-label="Product code"
            className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-[15px] tabular-nums outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || code.trim() === ""}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
          >
            {busy ? "…" : "Find"}
          </button>
        </form>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          The code on the label. Photographs and details come from SLK.
        </p>
        {error && (
          <p className="mt-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </section>

      <fieldset className={`space-y-7 border-0 p-0 ${hasProduct ? "" : "opacity-50"}`} disabled={!hasProduct}>
        <section>
          <Label>Model type</Label>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {MODEL_TYPES.map((m) => (
              <Choice
                key={m.id}
                on={selections.modelType === m.id}
                onClick={() =>
                  onChange({ ...selections, modelType: m.id, age: defaultAge(m.id) })
                }
              >
                {m.label}
              </Choice>
            ))}
          </div>
          <select
            value={selections.age}
            onChange={(e) => onChange({ ...selections, age: e.target.value })}
            aria-label="Age"
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
          >
            {ages.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </section>

        <section>
          <Label>Background</Label>
          <div className="mt-2.5 grid gap-1.5">
            {BACKGROUNDS.map((b) => (
              <Choice
                key={b.id}
                on={selections.background === b.id}
                onClick={() => onChange({ ...selections, background: b.id })}
              >
                {b.label}
              </Choice>
            ))}
          </div>
        </section>

        <section>
          <Label>Design safety rules</Label>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            Each one adds a sentence to the prompt.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {SAFETY_RULES.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
                <input
                  type="checkbox"
                  checked={selections.rules[r.id] ?? false}
                  onChange={(e) =>
                    onChange({
                      ...selections,
                      rules: { ...selections.rules, [r.id]: e.target.checked },
                    })
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="text-ink-soft">{r.label}</span>
              </label>
            ))}
          </div>
        </section>
      </fieldset>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
      {children}
    </h2>
  );
}

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-3 py-2 text-left text-[14px] transition ${
        on
          ? "border-accent bg-accent-wash text-accent"
          : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
