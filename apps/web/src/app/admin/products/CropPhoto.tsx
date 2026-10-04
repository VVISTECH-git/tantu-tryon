"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Box = { x: number; y: number; w: number; h: number };
type Grip = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const MIN = 5; // smallest crop side, percent
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Drag a box from a grip, kept inside the photo. Pure, so the maths stays apart from the events. */
function dragged(start: Box, grip: Grip, dx: number, dy: number): Box {
  if (grip === "move") {
    return { ...start, x: clamp(start.x + dx, 0, 100 - start.w), y: clamp(start.y + dy, 0, 100 - start.h) };
  }
  let { x, y, w, h } = start;
  if (grip.includes("w")) {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w += x - nx;
    x = nx;
  }
  if (grip.includes("e")) w = clamp(w + dx, MIN, 100 - x);
  if (grip.includes("n")) {
    const ny = clamp(y + dy, 0, y + h - MIN);
    h += y - ny;
    y = ny;
  }
  if (grip.includes("s")) h = clamp(h + dy, MIN, 100 - y);
  return { x, y, w, h };
}

const GRIPS: { grip: Grip; style: React.CSSProperties; cursor: string }[] = [
  { grip: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { grip: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { grip: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { grip: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { grip: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { grip: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { grip: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
  { grip: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
];

/**
 * Crop a product photo from the website (4 Oct). The photo is cut on the
 * server at full resolution; marked parts move with it.
 */
export function CropPhoto(props: { garmentId: string; slot: string; src: string; width: number; height: number; marked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 100, h: 100 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grip: Grip; px: number; py: number; start: Box } | null>(null);
  const ratio = props.width / props.height;

  function down(e: ReactPointerEvent, grip: Grip) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { grip, px: e.clientX, py: e.clientY, start: box };
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const r = frame.current?.getBoundingClientRect();
    if (!d || !r) return;
    setBox(dragged(d.start, d.grip, ((e.clientX - d.px) / r.width) * 100, ((e.clientY - d.py) / r.height) * 100));
  }
  function up() {
    drag.current = null;
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/garments/${props.garmentId}/crop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot: props.slot, ...box }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError("No internet. Try again.");
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not crop.");
    setOpen(false);
    router.refresh();
  }

  const untouched = box.x === 0 && box.y === 0 && box.w === 100 && box.h === 100;
  const px = (v: number, of: number) => Math.round((v / 100) * of);

  return (
    <>
      <button type="button" onClick={() => { setBox({ x: 0, y: 0, w: 100, h: 100 }); setError(null); setOpen(true); }} className="underline">
        crop
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label={`Crop the ${props.slot} photo`}>
          <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-auto rounded-xl bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[16px] font-semibold capitalize">Crop · {props.slot}</h2>
              <span className="text-[12.5px] tabular-nums text-ink-faint">
                {px(box.w, props.width)} × {px(box.h, props.height)} px kept of {props.width} × {props.height}
              </span>
            </div>
            <p className="text-[13px] text-ink-soft">
              Drag the corners or edges; drag inside the box to move it. The photo is cut at full size and quality.
              {props.marked ? " Its marked parts move with it and go back to To check." : ""}
            </p>
            {/* The photo and its dimming are clipped to the frame; the box and its grips sit above, unclipped, so a grip at the edge stays whole. */}
            <div
              ref={frame}
              className="relative mx-auto my-2 touch-none select-none"
              style={{ width: `min(100%, calc(62vh * ${ratio}))`, aspectRatio: `${props.width} / ${props.height}` }}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <div className="absolute inset-0 overflow-hidden rounded-lg bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={props.src} alt="" draggable={false} className="absolute inset-0 size-full object-fill" />
                <div
                  className="absolute"
                  style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, boxShadow: "0 0 0 9999px rgba(28,25,23,.55)" }}
                />
              </div>
              <div
                className="absolute cursor-move border-2 border-white"
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                onPointerDown={(e) => down(e, "move")}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className="border border-white/30" />
                  ))}
                </div>
                {GRIPS.map((g) => (
                  <span
                    key={g.grip}
                    onPointerDown={(e) => down(e, g.grip)}
                    className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white shadow"
                    style={{ ...g.style, cursor: g.cursor }}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setBox({ x: 0, y: 0, w: 100, h: 100 })} className="mr-auto rounded-lg px-3 py-2 text-[14px] text-ink-soft underline">
                Reset
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-[14px]">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || untouched}
                onClick={() => void save()}
                className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? "Cropping…" : "Save crop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
