"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PartRegion } from "@/db/schema";

const COLOURS: Record<string, string> = {
  Body: "#2e86de",
  Pallu: "#e84393",
  "Bottom border": "#e67e22",
  "Top border": "#f1c40f",
  Blouse: "#27ae60",
};
const PARTS = Object.keys(COLOURS);

type Pt = [number, number];
type Drag =
  | { kind: "point"; r: number; i: number }
  | { kind: "draw"; label: string; from: Pt; to: Pt };

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Fix the parts marked on a photo (4 Oct): tap a part to select it, drag its
 * points, tap a + between two points to add one, rename or delete it, or draw
 * a new part as a box and shape it. Undo steps back one change at a time.
 */
export function MarkEditor(props: {
  title: string;
  src: string;
  width: number;
  height: number;
  regions: PartRegion[];
  onSave: (regions: PartRegion[]) => Promise<string | null>;
  onClose: () => void;
}) {
  const [regions, setRegions] = useState<PartRegion[]>(props.regions.map((r) => ({ label: r.label, points: r.points.map((p) => [...p] as Pt) })));
  const [past, setPast] = useState<PartRegion[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [point, setPoint] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const ratio = props.width / props.height;

  const remember = () => setPast((p) => [...p.slice(-49), regions]);
  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = frame.current!.getBoundingClientRect();
    return [clamp(((e.clientX - r.left) / r.width) * 100), clamp(((e.clientY - r.top) / r.height) * 100)];
  };

  function grabPoint(e: ReactPointerEvent, r: number, i: number) {
    e.stopPropagation();
    e.preventDefault();
    frame.current?.setPointerCapture(e.pointerId);
    remember();
    setPoint(i);
    setDrag({ kind: "point", r, i });
  }
  function addPoint(e: ReactPointerEvent, r: number, i: number) {
    e.stopPropagation();
    e.preventDefault();
    frame.current?.setPointerCapture(e.pointerId);
    remember();
    const pts = regions[r]!.points;
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    setRegions(regions.map((reg, k) => (k === r ? { ...reg, points: [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)] } : reg)));
    setPoint(i + 1);
    setDrag({ kind: "point", r, i: i + 1 });
  }
  function down(e: ReactPointerEvent) {
    if (drawing) {
      e.preventDefault();
      frame.current?.setPointerCapture(e.pointerId);
      const p = at(e);
      setDrag({ kind: "draw", label: drawing, from: p, to: p });
      return;
    }
    setSelected(null);
    setPoint(null);
  }
  function move(e: ReactPointerEvent) {
    if (!drag) return;
    const p = at(e);
    if (drag.kind === "point") {
      setRegions((rs) => rs.map((reg, k) => (k === drag.r ? { ...reg, points: reg.points.map((q, j) => (j === drag.i ? p : q)) } : reg)));
    } else {
      setDrag({ ...drag, to: p });
    }
  }
  function up() {
    if (drag?.kind === "draw") {
      const [x0, y0] = drag.from;
      const [x1, y1] = drag.to;
      if (Math.abs(x1 - x0) > 1 && Math.abs(y1 - y0) > 1) {
        remember();
        const box: Pt[] = [
          [Math.min(x0, x1), Math.min(y0, y1)],
          [Math.max(x0, x1), Math.min(y0, y1)],
          [Math.max(x0, x1), Math.max(y0, y1)],
          [Math.min(x0, x1), Math.max(y0, y1)],
        ];
        setRegions([...regions, { label: drag.label, points: box }]);
        setSelected(regions.length);
      }
      setDrawing(null);
    }
    setDrag(null);
  }

  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setRegions(prev);
    setPast(past.slice(0, -1));
    setSelected(null);
    setPoint(null);
  }
  function rename(label: string) {
    if (selected == null) return;
    remember();
    setRegions(regions.map((r, k) => (k === selected ? { ...r, label } : r)));
  }
  function removePart() {
    if (selected == null) return;
    remember();
    setRegions(regions.filter((_, k) => k !== selected));
    setSelected(null);
    setPoint(null);
  }
  function removePoint() {
    if (selected == null || point == null || regions[selected]!.points.length <= 3) return;
    remember();
    setRegions(regions.map((r, k) => (k === selected ? { ...r, points: r.points.filter((_, j) => j !== point) } : r)));
    setPoint(null);
  }
  async function save() {
    setBusy(true);
    setError(await props.onSave(regions));
    setBusy(false);
  }

  const order = regions.map((_, i) => i).filter((i) => i !== selected).concat(selected != null ? [selected] : []);
  const sel = selected != null ? regions[selected] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={`Fix the marks on the ${props.title} photo`}>
      <div className="flex max-h-full w-full max-w-5xl flex-col gap-3 overflow-auto rounded-xl bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Fix marks · <span className="capitalize">{props.title}</span></h2>
          <span className="text-[12.5px] text-ink-faint">
            {drawing ? `Drag on the photo to draw the ${drawing}` : sel ? "Drag the white points · tap + to add one" : "Tap a part to change it"}
          </span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div
            ref={frame}
            className={`relative mx-auto touch-none select-none ${drawing ? "cursor-crosshair" : ""}`}
            style={{ width: `min(100%, calc(70vh * ${ratio}))`, aspectRatio: `${props.width} / ${props.height}` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.src} alt="" draggable={false} className="absolute inset-0 size-full rounded-lg object-fill" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {order.map((i) => {
                const r = regions[i]!;
                const on = i === selected;
                return (
                  <polygon
                    key={i}
                    points={r.points.map((p) => p.join(",")).join(" ")}
                    fill={COLOURS[r.label]}
                    fillOpacity={on ? 0.25 : selected != null ? 0.12 : 0.32}
                    stroke={COLOURS[r.label]}
                    strokeWidth={on ? 3 : 2}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    className={drawing ? "" : "cursor-pointer"}
                    onPointerDown={(e) => {
                      if (drawing) return;
                      e.stopPropagation();
                      setSelected(i);
                      setPoint(null);
                    }}
                  />
                );
              })}
              {drag?.kind === "draw" && (
                <rect
                  x={Math.min(drag.from[0], drag.to[0])}
                  y={Math.min(drag.from[1], drag.to[1])}
                  width={Math.abs(drag.to[0] - drag.from[0])}
                  height={Math.abs(drag.to[1] - drag.from[1])}
                  fill={COLOURS[drag.label]}
                  fillOpacity={0.3}
                  stroke={COLOURS[drag.label]}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {sel &&
              sel.points.map((p, i) => {
                const q = sel.points[(i + 1) % sel.points.length]!;
                return (
                  <span key={i}>
                    <span
                      onPointerDown={(e) => addPoint(e, selected!, i)}
                      title="Add a point here"
                      className="absolute flex size-4 -translate-x-1/2 -translate-y-1/2 cursor-copy items-center justify-center rounded-full bg-white/80 text-[11px] font-bold leading-none text-ink shadow"
                      style={{ left: `${(p[0] + q[0]) / 2}%`, top: `${(p[1] + q[1]) / 2}%` }}
                    >
                      +
                    </span>
                    <span
                      onPointerDown={(e) => grabPoint(e, selected!, i)}
                      className={`absolute size-[18px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] bg-white shadow ${i === point ? "ring-2 ring-ink" : ""}`}
                      style={{ left: `${p[0]}%`, top: `${p[1]}%`, borderColor: COLOURS[sel.label] }}
                    />
                  </span>
                );
              })}
          </div>

          <aside className="flex shrink-0 flex-col gap-3 text-[13.5px] lg:w-56">
            {sel ? (
              <>
                <p className="text-[12px] uppercase tracking-wide text-ink-faint">This part is</p>
                <div className="flex flex-wrap gap-1.5">
                  {PARTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => rename(p)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${sel.label === p ? "border-ink font-semibold" : "border-line"}`}
                    >
                      <i className="inline-block size-2.5 rounded-[3px]" style={{ background: COLOURS[p] }} />
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={removePoint} disabled={point == null || sel.points.length <= 3} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
                    Delete point
                  </button>
                  <button type="button" onClick={removePart} className="rounded-lg border border-line px-3 py-1.5 text-danger hover:border-danger">
                    Delete part
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12px] uppercase tracking-wide text-ink-faint">Add a part</p>
                <div className="flex flex-wrap gap-1.5">
                  {PARTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDrawing(drawing === p ? null : p)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${drawing === p ? "border-ink bg-surface-2 font-semibold" : "border-line"}`}
                    >
                      <i className="inline-block size-2.5 rounded-[3px]" style={{ background: COLOURS[p] }} />
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[12.5px] text-ink-faint">Pick one, then drag a box over it on the photo; shape it after.</p>
              </>
            )}
            <div className="mt-auto flex flex-wrap gap-2 border-t border-line-soft pt-3">
              <button type="button" onClick={undo} disabled={past.length === 0} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
                ↶ Undo
              </button>
            </div>
          </aside>
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-line px-4 py-2 text-[14px]">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || regions.length === 0}
            onClick={() => void save()}
            className="rounded-lg bg-good px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "✓ Save and approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
