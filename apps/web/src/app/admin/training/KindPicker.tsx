"use client";

import { useState } from "react";

const KINDS = [
  { value: "full", label: "Full", hint: "the whole saree draped: what the model should make" },
  { value: "fabric", label: "Fabric", hint: "close-up, blouse piece, folded or held: what goes in" },
  { value: "poster", label: "Poster", hint: "text, advert or chart: left out" },
] as const;

/** One photo's kind, changeable with a tap; saved straight to the training bucket. */
export function KindPicker(props: { shop: string; id: string; file: string; kind: string | null }) {
  const [kind, setKind] = useState(props.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: string) {
    if (next === kind || busy) return;
    const before = kind;
    setKind(next);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/training/kinds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop: props.shop, id: props.id, file: props.file, kind: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setKind(before);
      setError(res ? (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save.") : "No internet.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" role="radiogroup" aria-label={`What ${props.file} is`}>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            title={k.hint}
            onClick={() => void choose(k.value)}
            className={`flex-1 rounded-md border px-2 py-1 text-[12.5px] font-semibold ${
              kind === k.value
                ? k.value === "poster"
                  ? "border-ink-faint bg-surface-3 text-ink-soft"
                  : k.value === "full"
                    ? "border-accent bg-accent text-white"
                    : "border-good bg-good text-white"
                : "border-line text-ink-soft hover:border-ink-faint"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
