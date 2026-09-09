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
        {/*
          Dropdowns, not button grids. Four model types and three backgrounds
          as tiles took most of the rail's height for a choice made once; as
          selects they take one line each and leave room for the rules.
        */}
        <section>
          <Label>Model</Label>
          <div className="mt-2.5">
            <Select
              label="Model source"
              value={selections.modelSource}
              onChange={(v) => onChange({ ...selections, modelSource: v as Selections["modelSource"] })}
              options={[
                { value: "generated", label: "Generated model" },
                { value: "photo", label: "From my photo" },
              ]}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              label="Model type"
              value={selections.modelType}
              onChange={(v) => {
                const modelType = v as Selections["modelType"];
                onChange({ ...selections, modelType, age: defaultAge(modelType) });
              }}
              options={MODEL_TYPES.map((m) => ({ value: m.id, label: m.label }))}
            />
            {/* A photograph has an age already; asking for one would be ignored. */}
            {selections.modelSource === "generated" && (
              <Select
                label="Age"
                value={selections.age}
                onChange={(age) => onChange({ ...selections, age })}
                options={ages.map((a) => ({ value: a, label: a }))}
              />
            )}
          </div>
          {selections.modelSource === "photo" && (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              Attach your photo after the saree references. Face clearly visible, facing the camera, even light, plain background. Full length gives the best result.
            </p>
          )}
        </section>

        <section>
          <Label>Background</Label>
          <div className="mt-2.5">
            <Select
              label="Background"
              value={selections.background}
              onChange={(v) => onChange({ ...selections, background: v as Selections["background"] })}
              options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.label }))}
            />
          </div>
        </section>

        <section>
          <Label>Reference images</Label>
          <div className="mt-2.5">
            <Select
              label="Reference images"
              value={selections.attachMode}
              onChange={(v) => onChange({ ...selections, attachMode: v as Selections["attachMode"] })}
              options={[
                { value: "sheet", label: "One labelled sheet" },
                { value: "files", label: "Four separate files" },
              ]}
            />
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
            What you will attach beside the prompt. The prompt describes it accordingly.
          </p>
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

function Select({
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
