"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PartRegion } from "@/db/schema";
import { KindPicker } from "./KindPicker";
import { MarkTrainingPhoto } from "./MarkTrainingPhoto";
import { Photo } from "./Photo";

export interface TrainingPhoto {
  file: string;
  full: string;
  preview: string;
  kind: string | null;
  regions: PartRegion[];
  markedBy: string | null;
}

/**
 * A product's photos: small copies in a grid, each with its kind and marks; a tap opens it
 * large, with Previous / Next (and the arrow keys) through the same product's photos (5 Oct).
 */
export function TrainingPhotos(props: { shop: string; id: string; photos: TrainingPhoto[]; toMark?: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  // Kinds as set here, so the viewer and the grid agree without a reload.
  const [kinds, setKinds] = useState<Record<string, string | null>>(() => Object.fromEntries(props.photos.map((p) => [p.file, p.kind])));
  const touch = useRef<number | null>(null);
  const count = props.photos.length;

  const setKind = useCallback(
    async (file: string, kind: string) => {
      const before = kinds[file] ?? null;
      setKinds((k) => ({ ...k, [file]: kind }));
      const res = await fetch("/api/training/kinds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop: props.shop, id: props.id, file, kind }),
      }).catch(() => null);
      if (!res?.ok) setKinds((k) => ({ ...k, [file]: before }));
    },
    [kinds, props.shop, props.id],
  );
  const step = useCallback((by: number) => setOpen((i) => (i == null ? i : (i + by + count) % count)), [count]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape") setOpen(null);
      else if (e.key === "1" || e.key === "2" || e.key === "3") {
        // 1 full · 2 fabric · 3 poster, then on to the next photo: quick checking.
        void setKind(props.photos[open]!.file, ["full", "fabric", "poster"][Number(e.key) - 1]!);
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, setKind, props.photos]);

  const shown = open != null ? props.photos[open] : null;

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {props.photos.map((p, i) => (
          <figure key={p.file} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
            <button type="button" onClick={() => setOpen(i)} className="block overflow-hidden rounded-lg bg-surface-2" aria-label={`Open ${p.file} large`}>
              <Photo src={p.preview} alt={p.file} className="aspect-[3/4] w-full object-cover" />
            </button>
            <figcaption className="flex items-center justify-between text-[12px] text-ink-faint">
              {p.file}
              {props.toMark?.includes(p.file) && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    p.markedBy === "auto" ? "bg-turmeric-wash text-ink-soft" : p.regions.length ? "bg-good/10 text-good" : "bg-accent-wash text-accent"
                  }`}
                >
                  {p.markedBy === "auto" ? "Check auto marks" : p.regions.length ? "Marked ✓" : "Mark this"}
                </span>
              )}
            </figcaption>
            <KindPicker key={kinds[p.file] ?? "none"} shop={props.shop} id={props.id} file={p.file} kind={kinds[p.file] ?? null} />
            {kinds[p.file] !== "poster" && (
              <>
                <MarkTrainingPhoto shop={props.shop} id={props.id} file={p.file} src={p.full} regions={p.regions} />
                {p.regions.length > 0 && (
                  <p className="text-[11.5px] leading-snug text-ink-faint">
                    {[...new Set(p.regions.map((r) => r.label))].join(", ")}
                    {p.markedBy ? ` · ${p.markedBy === "auto" ? "auto: to check" : p.markedBy}` : ""}
                  </p>
                )}
              </>
            )}
          </figure>
        ))}
      </div>

      {shown && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/90" role="dialog" aria-modal="true" aria-label={`${shown.file}, photo ${open! + 1} of ${count}`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="text-[14px] tabular-nums">
              {shown.file} · {open! + 1} of {count}
            </span>
            <button type="button" onClick={() => setOpen(null)} className="rounded-full border border-white/40 px-3 py-1 text-[14px] hover:bg-white/10">
              Close ✕
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-2"
            onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
            onTouchEnd={(e) => {
              // A swipe left or right on a phone steps through the photos.
              const from = touch.current;
              touch.current = null;
              if (from == null) return;
              const dx = e.changedTouches[0]!.clientX - from;
              if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            }}
          >
            {/* The small copy shows at once; the full photo replaces it when it arrives. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={shown.file} src={shown.full} alt={shown.file} className="max-h-full max-w-full object-contain" style={{ backgroundImage: `url(${shown.preview})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
            <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[24px] text-white hover:bg-white/25">
              ‹
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[24px] text-white hover:bg-white/25">
              ›
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-4">
            {(["full", "fabric", "poster"] as const).map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => void setKind(shown.file, k)}
                className={`rounded-full border px-4 py-1.5 text-[14px] font-semibold ${kinds[shown.file] === k ? "border-white bg-white text-ink" : "border-white/40 text-white hover:bg-white/10"}`}
              >
                <span className="mr-1 text-[12px] opacity-60">{i + 1}</span>
                {k === "full" ? "Full" : k === "fabric" ? "Fabric" : "Poster"}
              </button>
            ))}
            {kinds[shown.file] !== "poster" && (
              <div className="w-40">
                <MarkTrainingPhoto shop={props.shop} id={props.id} file={shown.file} src={shown.full} regions={shown.regions} />
              </div>
            )}
          </div>
          <p className="pb-3 text-center text-[12px] text-white/60">← → or swipe to move · 1 Full · 2 Fabric · 3 Poster (then the next photo) · Esc to close</p>
        </div>
      )}
    </>
  );
}
