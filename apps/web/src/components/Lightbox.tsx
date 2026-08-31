"use client";

import { useEffect, useState } from "react";
import { downloadDataUrl, EXPORT_PRESETS, reframe } from "@/lib/image";

export interface LightboxItem {
  poseName: string;
  dataUrl: string;
  prompt: string;
  provider: string;
  model: string;
  ms: number;
}

/**
 * The viewer, with the thing no competitor offers: a wipe between the render
 * and the fabric it came from. Motif drift is invisible in a gallery and
 * obvious the moment the two are laid over each other.
 *
 * Both images are drawn into the SAME box with object-contain and the wipe is a
 * clip-path over the top, so the two are actually registered against each other
 * rather than being two differently-cropped pictures side by side.
 */
export function Lightbox({
  item,
  reference,
  onClose,
  onPrev,
  onNext,
  filenameStem,
}: {
  item: LightboxItem;
  reference?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  filenameStem: string;
}) {
  const [compare, setCompare] = useState(false);
  const [wipe, setWipe] = useState(50);
  const [showPrompt, setShowPrompt] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev?.();
      if (event.key === "ArrowRight") onNext?.();
      if (event.key.toLowerCase() === "c" && reference) setCompare((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, reference]);

  async function exportAs(ratio: number, id: string) {
    setExporting(id);
    try {
      const framed = await reframe(item.dataUrl, ratio);
      downloadDataUrl(framed, `${filenameStem}-${id}.jpg`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ground">
      <div className="flex items-center gap-4 border-b border-line px-6 py-3.5">
        <span className="display text-[18px]">{item.poseName}</span>
        <span className="hidden text-[12px] text-ink-faint sm:inline">
          {item.provider} · {item.model} · {(item.ms / 1000).toFixed(1)}s
        </span>

        <div className="ml-auto flex items-center gap-2">
          {reference && (
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((value) => !value)}
              className={`rounded-full border px-4 py-2 text-[14px] transition ${
                compare
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              Compare with fabric
            </button>
          )}
          <button
            type="button"
            aria-pressed={showPrompt}
            onClick={() => setShowPrompt((value) => !value)}
            className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] text-ink-soft transition hover:text-ink"
          >
            Prompt
          </button>
          <button
            type="button"
            onClick={() => downloadDataUrl(item.dataUrl, `${filenameStem}.png`)}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-white transition hover:bg-accent-hover"
          >
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-[20px] text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          >
            ×
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous"
            className="absolute left-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-[18px] text-ink-soft shadow-sm transition hover:text-ink"
          >
            ‹
          </button>
        )}

        <div className="relative h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.dataUrl}
            alt={item.poseName}
            className="h-full w-auto rounded-xl object-contain"
          />

          {compare && reference && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={reference}
                alt="The reference fabric"
                aria-hidden
                className="absolute inset-0 h-full w-full rounded-xl bg-surface-2 object-contain"
                style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-madder"
                style={{ left: `${wipe}%` }}
              />
              <span className="label absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1">
                the real fabric
              </span>
              <span className="label absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1">
                the render
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={wipe}
                onChange={(event) => setWipe(Number(event.target.value))}
                aria-label="Compare wipe position"
                className="absolute inset-x-0 bottom-4 mx-auto w-2/3 accent-[var(--color-madder)]"
              />
            </>
          )}
        </div>

        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next"
            className="absolute right-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-[18px] text-ink-soft shadow-sm transition hover:text-ink"
          >
            ›
          </button>
        )}
      </div>

      {showPrompt && (
        <div className="max-h-56 overflow-auto border-t border-line bg-surface px-6 py-5">
          <p className="label mb-2">the exact prompt used — yours to read, edit and re-run</p>
          <p className="max-w-prose text-[14px] leading-relaxed text-ink-soft">{item.prompt}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-3.5">
        <span className="label mr-1">export for</span>
        {EXPORT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={exporting !== null}
            onClick={() => void exportAs(preset.ratio, preset.id)}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-50"
          >
            {exporting === preset.id ? "preparing…" : preset.label}
          </button>
        ))}
        <span className="ml-auto hidden text-[12px] text-ink-faint md:inline">
          ← → to move · C to compare · Esc to close
        </span>
      </div>
    </div>
  );
}
