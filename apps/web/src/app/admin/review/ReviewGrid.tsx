"use client";
/* eslint-disable @next/next/no-img-element -- review images at their own size */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface ReviewItem {
  id: string;
  productCode: string;
  label: string;
  input: string | null;
  inputFull: string | null;
  output: string;
  verdict: "approved" | "rejected" | null;
}

/**
 * The review cards, and the big view a tap opens (8 Oct, user: "pop them up, don't download"):
 * the product photo and the made image side by side, ‹ › or the arrow keys to the next product,
 * G / N or the buttons to mark it, Esc to close. Tapping an image in the big view zooms it.
 */
export function ReviewGrid({ items: initial }: { items: ReviewItem[] }) {
  const router = useRouter();
  // Keyed by the page in page.tsx, so a fresh list from the server starts it afresh.
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState<"input" | "output" | null>(null);
  const [busy, setBusy] = useState(false);

  const mark = useCallback(
    async (i: number, next: "approved" | "rejected") => {
      const item = items[i];
      if (!item) return;
      const value = item.verdict === next ? null : next;
      setBusy(true);
      const res = await fetch(`/api/generations/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ verdict: value }) }).catch(() => null);
      setBusy(false);
      if (res?.ok) setItems((all) => all.map((x, j) => (j === i ? { ...x, verdict: value } : x)));
    },
    [items],
  );

  const move = useCallback((step: number) => {
    setZoom(null);
    setOpen((o) => (o === null ? o : Math.min(items.length - 1, Math.max(0, o + step))));
  }, [items.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoom) setZoom(null);
        else {
          setOpen(null);
          router.refresh();
        }
      }
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key.toLowerCase() === "g") void mark(open, "approved").then(() => move(1));
      else if (e.key.toLowerCase() === "n") void mark(open, "rejected").then(() => move(1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom, move, mark, router]);

  const cur = open === null ? null : items[open];

  return (
    <>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {items.map((r, i) => (
          <article key={r.id} className={`rounded-xl border bg-surface p-3 ${r.verdict === "approved" ? "border-good" : r.verdict === "rejected" ? "border-danger" : "border-line"}`}>
            <header className="mb-2 flex items-baseline justify-between gap-2 text-[13px]">
              <b className="text-[14.5px]">{r.productCode}</b>
              <span className="text-ink-soft">{r.label}</span>
            </header>
            <button type="button" className="grid w-full grid-cols-2 gap-2" onClick={() => setOpen(i)} aria-label={`Open ${r.productCode} large`}>
              {r.input ? <img src={r.input} alt="Product photo" className="aspect-[3/4] w-full rounded-lg border border-line-soft object-cover" loading="lazy" /> : <span className="aspect-[3/4] rounded-lg bg-surface-2" />}
              <img src={r.output} alt="Made image" className="aspect-[3/4] w-full rounded-lg border border-line-soft object-cover" loading="lazy" />
            </button>
            <Marks verdict={r.verdict} busy={busy} onGood={() => void mark(i, "approved")} onBad={() => void mark(i, "rejected")} />
          </article>
        ))}
      </div>

      {cur && open !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(16,12,10,0.94)] text-white" role="dialog" aria-modal="true" aria-label={`${cur.productCode} large`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
            <span>
              <b className="text-[16px]">{cur.productCode}</b> <span className="opacity-70">· {cur.label} · {open + 1} of {items.length}</span>
            </span>
            <span className="hidden opacity-60 md:inline">← → next · G good · N not good · Esc close</span>
            <button type="button" className="rounded-full px-3 py-1 text-[22px] leading-none hover:bg-white/10" onClick={() => { setOpen(null); router.refresh(); }} aria-label="Close">
              ×
            </button>
          </div>

          {zoom ? (
            <div className="min-h-0 flex-1 overflow-auto" onClick={() => setZoom(null)}>
              <img src={zoom === "input" ? (cur.inputFull ?? cur.input!) : cur.output} alt="" className="mx-auto max-w-none cursor-zoom-out" />
            </div>
          ) : (
            <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-3 px-3 md:px-14">
              {[
                { key: "input" as const, src: cur.inputFull ?? cur.input, title: "Product photo" },
                { key: "output" as const, src: cur.output, title: "Made image" },
              ].map((p) => (
                <figure key={p.key} className="flex min-h-0 flex-col items-center">
                  <figcaption className="mb-1 text-[12px] uppercase tracking-wide opacity-60">{p.title}</figcaption>
                  {p.src ? <img src={p.src} alt={p.title} className="min-h-0 w-full flex-1 cursor-zoom-in object-contain" onClick={() => setZoom(p.key)} /> : <span className="opacity-50">No photo</span>}
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

          <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2">
            <Marks dark verdict={cur.verdict} busy={busy} onGood={() => void mark(open, "approved").then(() => move(1))} onBad={() => void mark(open, "rejected").then(() => move(1))} />
          </div>
        </div>
      )}
    </>
  );
}

function Marks({ verdict, busy, onGood, onBad, dark }: { verdict: ReviewItem["verdict"]; busy: boolean; onGood: () => void; onBad: () => void; dark?: boolean }) {
  const idle = dark ? "border-white/30 hover:border-white" : "border-line";
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
      <button type="button" disabled={busy} onClick={onGood} className={`rounded-lg border px-3 py-2 font-semibold ${verdict === "approved" ? "border-good bg-good text-white" : `${idle} hover:border-good`}`}>
        Good
      </button>
      <button type="button" disabled={busy} onClick={onBad} className={`rounded-lg border px-3 py-2 font-semibold ${verdict === "rejected" ? "border-danger bg-danger text-white" : `${idle} hover:border-danger`}`}>
        Not good
      </button>
    </div>
  );
}
