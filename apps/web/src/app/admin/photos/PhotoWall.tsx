"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; code: string; photos: { slot: string; thumbUrl: string; bigUrl: string }[] };

const PER_PAGE = 20;

/** Product ID, then its photos. Search by ID, pages of 20, tap a photo to see it large. */
export function PhotoWall({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ item: Item; i: number } | null>(null);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter((it) => it.code.toLowerCase().includes(n)) : items;
  }, [items, q]);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const at = Math.min(page, pages);
  const rows = shown.slice((at - 1) * PER_PAGE, at * PER_PAGE);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      const n = open.item.photos.length;
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen({ ...open, i: (open.i + 1) % n });
      if (e.key === "ArrowLeft") setOpen({ ...open, i: (open.i - 1 + n) % n });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Find a product ID"
          className="w-64 rounded-lg border border-line bg-surface px-3 py-2"
        />
        <span className="text-ink-soft">{shown.length} product{shown.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-5 grid gap-6">
        {rows.map((it) => (
          <section key={it.id}>
            <h2 className="font-mono text-[15px] font-semibold">{it.code}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {it.photos.map((p, i) => (
                <button key={p.slot + i} type="button" onClick={() => setOpen({ item: it, i })} className="block" title={p.slot}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.slot} loading="lazy" className="h-40 w-32 rounded-lg border border-line-soft bg-surface object-cover" />
                </button>
              ))}
            </div>
          </section>
        ))}
        {rows.length === 0 && <p className="text-ink-soft">No products match.</p>}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px]">
          <button type="button" disabled={at === 1} onClick={() => setPage(at - 1)} className="rounded border border-line px-3 py-1 disabled:opacity-40">‹</button>
          <span className="text-ink-soft">Page {at} of {pages}</span>
          <button type="button" disabled={at === pages} onClick={() => setPage(at + 1)} className="rounded border border-line px-3 py-1 disabled:opacity-40">›</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog">
          <p className="mb-3 font-mono text-[14px] text-white">
            {open.item.code} · {open.i + 1} of {open.item.photos.length}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.item.photos[open.i]!.bigUrl} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          {open.item.photos.length > 1 && (
            <div className="mt-3 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-white" onClick={() => setOpen({ ...open, i: (open.i - 1 + open.item.photos.length) % open.item.photos.length })}>‹</button>
              <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-white" onClick={() => setOpen({ ...open, i: (open.i + 1) % open.item.photos.length })}>›</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
