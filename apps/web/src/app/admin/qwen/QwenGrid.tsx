"use client";
/* eslint-disable @next/next/no-img-element -- images at their own size */

import { useCallback, useEffect, useState } from "react";

export interface QwenItem {
  id: string;
  title: string;
  detail: string;
  when: string;
  status: string;
  seconds: number | null;
  error: string | null;
  prompt: string;
  images: { label: string; src: string | null; full: string | null }[];
}

const STATUS: Record<string, string> = { done: "Made", queued: "Waiting", running: "Making now", failed: "Failed", refused: "Refused" };

/**
 * The Qwen cards, and the big view a tap opens: the product photo, Qwen's image and Gemini's side by
 * side, ‹ › or the arrow keys to the next one, Esc to close, tap an image to see it full size.
 */
export function QwenGrid({ items }: { items: QwenItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const move = useCallback(
    (step: number) => {
      setZoom(null);
      setOpen((o) => (o === null ? o : Math.min(items.length - 1, Math.max(0, o + step))));
    },
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoom) setZoom(null);
        else setOpen(null);
      } else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom, move]);

  const cur = open === null ? null : items[open];

  return (
    <>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {items.map((r, i) => (
          <article key={r.id} className="rounded-xl border border-line bg-surface p-3">
            <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
              <span>
                <b className="text-[14.5px]">{r.title}</b> <span className="text-ink-soft">· {r.detail}</span>
              </span>
              <span className={r.status === "done" ? "text-good" : r.status === "failed" || r.status === "refused" ? "text-danger" : "text-ink-soft"}>
                {STATUS[r.status] ?? r.status}
                {r.seconds ? ` · ${r.seconds} s` : ""}
              </span>
            </header>
            <button type="button" className="grid w-full grid-cols-3 gap-2 text-left" onClick={() => setOpen(i)} aria-label={`Open ${r.title} large`}>
              {r.images.map((im) => (
                <figure key={im.label} className="min-w-0">
                  {im.src ? (
                    <img src={im.src} alt={im.label} className="aspect-[3/4] w-full rounded-lg border border-line-soft bg-surface-2 object-cover" loading="lazy" />
                  ) : (
                    <span className="flex aspect-[3/4] items-center justify-center rounded-lg bg-surface-2 text-[12px] text-ink-faint">{im.label === "Qwen (ours)" ? STATUS[r.status] : "None yet"}</span>
                  )}
                  <figcaption className="mt-1 truncate text-[11.5px] text-ink-soft">{im.label}</figcaption>
                </figure>
              ))}
            </button>
            {r.error && <p className="mt-2 text-[12.5px] text-danger">{r.error.length > 200 ? `${r.error.slice(0, 200)}…` : r.error}</p>}
            <details className="mt-2 text-[12.5px]">
              <summary className="cursor-pointer text-ink-soft">Prompt · {r.when}</summary>
              <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">{r.prompt}</p>
            </details>
          </article>
        ))}
      </div>

      {cur && open !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(16,12,10,0.94)] text-white" role="dialog" aria-modal="true" aria-label={`${cur.title} large`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
            <span>
              <b className="text-[16px]">{cur.title}</b>{" "}
              <span className="opacity-70">
                · {cur.detail} · {open + 1} of {items.length}
              </span>
            </span>
            <span className="hidden opacity-60 md:inline">← → next · tap an image for full size · Esc close</span>
            <button type="button" className="rounded-full px-3 py-1 text-[22px] leading-none hover:bg-white/10" onClick={() => setOpen(null)} aria-label="Close">
              ×
            </button>
          </div>

          {zoom ? (
            <div className="min-h-0 flex-1 overflow-auto" onClick={() => setZoom(null)}>
              <img src={zoom} alt="" className="mx-auto max-w-none cursor-zoom-out" />
            </div>
          ) : (
            <div className="relative grid min-h-0 flex-1 grid-cols-3 gap-3 px-3 pb-4 md:px-14">
              {cur.images.map((im) => (
                <figure key={im.label} className="flex min-h-0 flex-col items-center">
                  <figcaption className="mb-1 text-[12px] uppercase tracking-wide opacity-60">{im.label}</figcaption>
                  {im.full ? (
                    <img src={im.full} alt={im.label} className="min-h-0 w-full flex-1 cursor-zoom-in object-contain" onClick={() => setZoom(im.full)} />
                  ) : (
                    <span className="m-auto opacity-50">None yet</span>
                  )}
                </figure>
              ))}
              <button type="button" disabled={open === 0} onClick={() => move(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-lg px-2 py-6 text-[34px] hover:bg-white/10 disabled:opacity-20" aria-label="Previous">
                ‹
              </button>
              <button type="button" disabled={open === items.length - 1} onClick={() => move(1)} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-lg px-2 py-6 text-[34px] hover:bg-white/10 disabled:opacity-20" aria-label="Next">
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
