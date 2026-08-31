"use client";

import { useState } from "react";
import { downloadDataUrl } from "@/lib/image";
import { explain } from "@/lib/errors";
import type { RenderCard } from "./types";

export function Results({
  cards,
  filenameStem,
  onOpen,
  onRetry,
}: {
  cards: RenderCard[];
  filenameStem: string;
  onOpen: (index: number) => void;
  onRetry: (poseId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {cards.map((card, index) => {
        if (card.state === "pending") {
          return (
            <div
              key={card.poseId}
              className="working flex aspect-4/5 flex-col items-center justify-center rounded-2xl border border-line"
            >
              <span className="text-[14px] text-ink-soft">{card.poseName}</span>
              <span className="label mt-1.5">rendering</span>
            </div>
          );
        }

        if (card.state === "cancelled") {
          return (
            <div
              key={card.poseId}
              className="flex aspect-4/5 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface"
            >
              <span className="text-[14px] text-ink-soft">{card.poseName}</span>
              <span className="label">stopped</span>
              <button
                type="button"
                onClick={() => onRetry(card.poseId)}
                className="rounded-full border border-line px-4 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
              >
                Render it
              </button>
            </div>
          );
        }

        if (card.state === "failed") {
          return <FailedCard key={card.poseId} card={card} onRetry={onRetry} />;
        }

        return (
          <figure
            key={card.id}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface"
          >
            <button type="button" onClick={() => onOpen(index)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.dataUrl}
                alt={card.poseName}
                className="aspect-4/5 w-full object-cover transition group-hover:opacity-95"
              />
            </button>

            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
              <span className="text-[14px] font-medium text-white">{card.poseName}</span>
              <span className="ml-auto text-[11px] text-white/70">
                {(card.ms / 1000).toFixed(1)}s
              </span>
            </figcaption>

            <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                title="Download"
                aria-label={`Download ${card.poseName}`}
                onClick={() => downloadDataUrl(card.dataUrl, `${filenameStem}-${card.poseId}.png`)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[14px] text-ink-soft shadow-sm transition hover:text-ink"
              >
                ↓
              </button>
              <button
                type="button"
                title="Render this pose again"
                aria-label={`Render ${card.poseName} again`}
                onClick={() => onRetry(card.poseId)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[14px] text-ink-soft shadow-sm transition hover:text-ink"
              >
                ↻
              </button>
            </div>
          </figure>
        );
      })}
    </div>
  );
}

function FailedCard({
  card,
  onRetry,
}: {
  card: Extract<RenderCard, { state: "failed" }>;
  onRetry: (poseId: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const problem = explain(card.error);

  return (
    <div className="flex aspect-4/5 flex-col rounded-2xl border border-danger/30 bg-danger-wash p-5">
      <span className="text-[14px] font-medium">{card.poseName}</span>
      <span className="label mt-1 !text-danger">did not render</span>

      <p className="mt-4 text-[14px] font-medium leading-snug text-ink">{problem.headline}</p>
      {problem.advice && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{problem.advice}</p>
      )}

      {showDetail && (
        <p className="mt-3 max-h-24 overflow-auto rounded-lg bg-surface/70 p-2 font-mono text-[11px] leading-relaxed break-all text-ink-faint">
          {problem.detail}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={() => onRetry(card.poseId)}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => setShowDetail((value) => !value)}
          className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
        >
          {showDetail ? "hide detail" : "detail"}
        </button>
      </div>
    </div>
  );
}
