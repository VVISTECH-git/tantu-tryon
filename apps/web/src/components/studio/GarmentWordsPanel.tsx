"use client";

import { useState } from "react";
import {
  DESCRIBED_FIELDS,
  missingWords,
  type DescribedGarment,
  type GarmentWords,
} from "@/content/garmentWords";

/**
 * The saree in words, editable.
 *
 * These fill the prompt's GARMENT block and the colour and motif words its
 * placement map uses. They start from SLK's record, which is thin and, for
 * colour, sometimes wrong. "Describe from photographs" reads them off the
 * labelled sheet when an engine key exists; either way a person can correct
 * any of them, and the prompt on the right rewrites as they type.
 *
 * Saved per product in this browser, like the orientation corrections.
 */
export function GarmentWordsPanel({
  code,
  rotQuery,
  words,
  saved,
  onChange,
  canDescribe,
}: {
  code: string | null;
  rotQuery: string;
  /** SLK's words with the saved ones laid over — what the prompt will use. */
  words: GarmentWords;
  /** What has been described or typed for this product. */
  saved: DescribedGarment;
  onChange: (next: DescribedGarment) => void;
  canDescribe: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Fourteen inputs is a lot of screen between the photographs and the
  // prompt. Closed by default; the button and the warning stay visible.
  const [open, setOpen] = useState(false);
  const gaps = missingWords(words);
  const touched = Object.keys(saved).length > 0;

  async function describe() {
    if (!code) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`/api/products/${code}/describe${rotQuery}`);
      const payload = (await response.json()) as { words?: DescribedGarment; model?: string; error?: string };
      if (!response.ok || !payload.words) throw new Error(payload.error ?? `Describe failed (${response.status}).`);
      // The engine's reading replaces SLK's words but not what a person typed.
      onChange({ ...payload.words, ...saved });
      setOpen(true);
      setNote(`Read from the photographs by ${payload.model ?? "the engine"}. Check the colours before you copy.`);
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "The description failed.");
    } finally {
      setBusy(false);
    }
  }

  function set(key: keyof DescribedGarment, value: string) {
    const next = { ...saved };
    if (value.trim()) next[key] = value;
    else delete next[key];
    onChange(next);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Garment words</h2>
        <span className="text-[12.5px] text-ink-faint">
          What the prompt says each part looks like. SLK fills what it can; the rest is read from the photographs or typed.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {code && (
            <button
              type="button"
              onClick={() => void describe()}
              disabled={busy || !canDescribe}
              title={
                canDescribe
                  ? "Reads the labelled sheet with the engine and fills these fields. One small text call."
                  : "Needs an engine key on this deployment."
              }
              className="rounded-lg border border-line bg-surface px-4 py-2 text-[13.5px] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Reading…" : "Describe from photographs"}
            </button>
          )}
          {touched && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
            >
              Back to SLK
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
          >
            {open ? "Hide fields" : "Edit fields"}
          </button>
        </div>
      </div>

      {gaps.length > 0 && (
        <p className="mt-3 rounded-xl border border-madder/35 bg-madder/5 px-4 py-2.5 text-[13px] text-madder">
          Not known yet: {gaps.join(", ")}. The placement map needs these; describe from the photographs or fill them in.
        </p>
      )}
      {note && <p className="mt-3 text-[13px] text-ink-soft">{note}</p>}

      {open ? (
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {DESCRIBED_FIELDS.map((f) => (
            <label key={f.key} className={`block ${f.wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
              <span className="text-[12px] font-medium text-ink-faint">{f.label}</span>
              <input
                value={words[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.hint}
                className="mt-1 w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] text-ink outline-none placeholder:text-ink-faint/70 focus:border-accent"
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-ink-soft">
          Body: {words.bodyColour ?? "?"} · Pallu: {words.palluColour ?? "?"}, {words.palluMotif} · Border: {words.borderColour ?? "?"}
          {words.borderWidth ? `, ${words.borderWidth}` : ""} · Blouse: {words.blouseColour ?? "?"}
        </p>
      )}
    </section>
  );
}
