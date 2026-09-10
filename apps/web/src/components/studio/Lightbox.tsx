"use client";

import { useEffect } from "react";
import type { Quarter, Rotations } from "@/lib/rotation";
import { rotationQuery } from "@/lib/rotation";
import type { GarmentPart } from "./types";

/**
 * One photograph, as large as the screen allows.
 *
 * Shows the original, not the thumbnail — the point of looking closely is to
 * see what the model will see. Arrow keys and buttons move through the
 * parts; R turns the photograph a quarter; Esc closes. A turn is not a
 * viewing preference: it is remembered for the product and applied to the
 * download and the sheet, so what is upright here is upright everywhere.
 */
export function Lightbox({
  code,
  parts,
  index,
  rotations,
  onIndex,
  onRotate,
  onClose,
}: {
  code: string;
  parts: GarmentPart[];
  index: number;
  rotations: Rotations;
  onIndex: (next: number) => void;
  onRotate: (slot: string) => void;
  onClose: () => void;
}) {
  const part = parts[index]!;
  const deg: Quarter = rotations[part.slot] ?? 0;
  const sideways = deg === 90 || deg === 270;
  const prev = () => onIndex((index - 1 + parts.length) % parts.length);
  const next = () => onIndex((index + 1) % parts.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "r" || e.key === "R") onRotate(part.slot);
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  // The original through our own proxy, turned server-side if a turn is set.
  const src = `/api/products/${code}/image/${part.slot}${rotationQuery({ [part.slot]: deg })}`;

  function save() {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${code}-${part.slot}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${part.label} photograph`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-[#111]/95 text-white"
    >
      <header
        onClick={(e) => e.stopPropagation()}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-[13.5px]"
      >
        <span className="font-semibold capitalize">{part.slot}</span>
        <span className="tabular-nums text-white/60">
          {index + 1} / {parts.length}
        </span>
        {part.width && part.height && (
          <span className="tabular-nums text-white/60">
            {sideways ? `${part.height} × ${part.width}` : `${part.width} × ${part.height}`}
          </span>
        )}
        {deg !== 0 && <span className="text-white/60">turned {deg}°</span>}
        <div className="ml-auto flex items-center gap-2">
          <Control onClick={() => onRotate(part.slot)} title="Rotate a quarter turn (R)">
            Rotate
          </Control>
          <Control onClick={save} title="Save this photograph, turned as shown">
            Save
          </Control>
          <Control onClick={onClose} title="Close (Esc)">
            Close
          </Control>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-6">
        {/* Untouched pixels at full size; next/image would resample them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={part.alt}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "calc(100vw - 160px)", maxHeight: "calc(100vh - 120px)" }}
          className="select-none object-contain shadow-2xl"
          draggable={false}
        />

        {parts.length > 1 && (
          <>
            <Arrow side="left" onClick={prev} label="Previous (←)" />
            <Arrow side="right" onClick={next} label="Next (→)" />
          </>
        )}
      </div>
    </div>
  );
}

function Control({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-full border border-white/25 px-3.5 py-1.5 text-[13px] text-white/90 transition hover:border-white hover:text-white"
    >
      {children}
    </button>
  );
}

function Arrow({ side, onClick, label }: { side: "left" | "right"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/40 px-4 py-3 text-[20px] leading-none text-white/90 transition hover:border-white hover:bg-black/60 ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
