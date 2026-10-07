"use client";
/* eslint-disable @next/next/no-img-element -- the photo just taken, shown from the browser's own memory */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MAX_ANGLE, MAX_BRIGHTNESS, cleanEdit, editRect, type PhotoEdit } from "@tantu/shared/photoEdit";
import { T } from "./texts";

/**
 * The photo just taken or picked, before it is saved (7 Oct, the phone's
 * review and edit screens brought to the web). Use photo is the quick
 * default; Edit opens crop, a quarter turn, straighten and a light
 * brightness change. No filters: they change the saree's colour.
 *
 * What the screen shows is what is saved: the edit is burned into the photo
 * here, at full resolution and the highest JPEG quality, before it is sent.
 * Brightness, which the browser may not be able to apply, goes to the server
 * with the photo when it cannot.
 */

export interface ReviewOutcome {
  /** The photo to send: the original file, or the edit burned in. */
  file: File;
  /** Brightness still to apply on the server (0 when the browser did it). */
  brightness: number;
}

type Box = { x: number; y: number; w: number; h: number };
type Grip = "move" | "nw" | "ne" | "sw" | "se";
type Tool = "crop" | "straighten" | "light";

const WORK_EDGE = 1200;
const MIN = 0.05;
const MAX_AREA = 16_000_000; // what a phone browser's canvas can hold
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A corner or the whole box dragged, in fractions, kept inside the photo. */
function dragged(start: Box, grip: Grip, dx: number, dy: number): Box {
  if (grip === "move") return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) };
  let { x, y, w, h } = start;
  if (grip === "nw" || grip === "sw") {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w += x - nx;
    x = nx;
  } else w = clamp(w + dx, MIN, 1 - x);
  if (grip === "nw" || grip === "ne") {
    const ny = clamp(y + dy, 0, y + h - MIN);
    h += y - ny;
    y = ny;
  } else h = clamp(h + dy, MIN, 1 - y);
  return { x, y, w, h };
}

/** The bitmap turned by quarter + angle and cut to its largest level rectangle (and the crop, when given). */
function render(bitmap: ImageBitmap | HTMLCanvasElement, edit: PhotoEdit, quality: number, type = "image/jpeg"): Promise<{ blob: Blob; width: number; height: number }> {
  const { canvas: turned, cut } = editRect(bitmap.width, bitmap.height, edit);
  const shrink = Math.min(1, Math.sqrt(MAX_AREA / (cut.width * cut.height)));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cut.width * shrink));
  out.height = Math.max(1, Math.round(cut.height * shrink));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not draw the photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.scale(shrink, shrink);
  ctx.translate(-cut.left, -cut.top);
  ctx.translate(turned.width / 2, turned.height / 2);
  ctx.rotate((((edit.quarter ?? 0) + (edit.angle ?? 0)) * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve({ blob, width: out.width, height: out.height }) : reject(new Error("Could not save the photo."))), type, quality),
  );
}

/** Where the saree is, from the server's free finder, as fractions of the upright photo. */
async function findFabric(bitmap: ImageBitmap): Promise<Box | null> {
  try {
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const small = document.createElement("canvas");
    small.width = Math.round(bitmap.width * scale);
    small.height = Math.round(bitmap.height * scale);
    small.getContext("2d")?.drawImage(bitmap, 0, 0, small.width, small.height);
    const blob = await new Promise<Blob | null>((r) => small.toBlob(r, "image/jpeg", 0.8));
    if (!blob) return null;
    const res = await fetch("/api/detect-fabric", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    const { box } = (await res.json()) as { box: Box | null };
    return box && box.w > 0.1 && box.h > 0.1 ? box : null;
  } catch {
    return null;
  }
}

export function PhotoReview({ file, slotLabel, onUse, onRetake, onBack }: { file: File; slotLabel: string; onUse: (out: ReviewOutcome) => void; onRetake: () => void; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  if (editing) return <PhotoEditor file={file} slotLabel={slotLabel} onUse={onUse} onBack={() => setEditing(false)} />;
  return (
    <div className="st-review" role="dialog" aria-modal="true" aria-label={T.review.title(slotLabel)}>
      <div className="st-review-photo">
        <img src={url} alt="" />
      </div>
      <div className="st-review-bar">
        <div className="st-review-row">
          <button type="button" className="st-secondary" onClick={onBack}>{T.common.cancel}</button>
          <button type="button" className="st-secondary" onClick={onRetake}>{T.shots.retake}</button>
          <button type="button" className="st-secondary" onClick={() => setEditing(true)}>{T.review.edit}</button>
        </div>
        <button type="button" className="st-action" onClick={() => onUse({ file, brightness: 0 })}>{T.review.use}</button>
      </div>
    </div>
  );
}

function PhotoEditor({ file, slotLabel, onUse, onBack }: { file: File; slotLabel: string; onUse: (out: ReviewOutcome) => void; onBack: () => void }) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [work, setWork] = useState<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<{ url: string; w: number; h: number } | null>(null);
  const [quarter, setQuarter] = useState<0 | 90 | 180 | 270>(0);
  const [angle, setAngle] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [crop, setCrop] = useState<Box>({ x: 0, y: 0, w: 1, h: 1 });
  const [found, setFound] = useState<Box | null>(null);
  const [tool, setTool] = useState<Tool>("crop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grip: Grip; px: number; py: number; start: Box } | null>(null);

  // The photo upright (the browser applies its orientation tag), a small working copy, and the saree's box.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const bm = await createImageBitmap(file);
        if (!live) return;
        setBitmap(bm);
        const scale = Math.min(1, WORK_EDGE / Math.max(bm.width, bm.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bm.width * scale);
        c.height = Math.round(bm.height * scale);
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bm, 0, 0, c.width, c.height);
        }
        setWork(c);
        const box = await findFabric(bm);
        if (!live) return;
        if (box) {
          setFound(box);
          setCrop(box);
        }
      } catch {
        if (live) setError(T.review.cannotRead);
      }
    })();
    return () => {
      live = false;
    };
  }, [file]);

  // What is shown: the working copy turned and straightened, cut to its largest level rectangle.
  useEffect(() => {
    if (!work) return;
    let live = true;
    let made: string | null = null;
    void render(work, { quarter, angle }, 0.85)
      .then(({ blob, width, height }) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setView({ url: made, w: width, h: height });
      })
      .catch(() => live && setError(T.review.cannotRead));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [work, quarter, angle]);

  function down(e: ReactPointerEvent, grip: Grip) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { grip, px: e.clientX, py: e.clientY, start: crop };
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const r = frame.current?.getBoundingClientRect();
    if (!d || !r) return;
    setCrop(dragged(d.start, d.grip, (e.clientX - d.px) / r.width, (e.clientY - d.py) / r.height));
  }
  function up() {
    drag.current = null;
  }

  const whole = crop.x < 0.005 && crop.y < 0.005 && crop.w > 0.99 && crop.h > 0.99;
  const changed = !whole || quarter !== 0 || angle !== 0 || brightness !== 0;

  function turn() {
    setQuarter((q) => ((q + 90) % 360) as 0 | 90 | 180 | 270);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
  }
  function reset() {
    setQuarter(0);
    setAngle(0);
    setBrightness(0);
    setCrop(found ?? { x: 0, y: 0, w: 1, h: 1 });
  }

  async function use() {
    if (!bitmap) return;
    if (!changed) return onUse({ file, brightness: 0 });
    setBusy(true);
    setError(null);
    try {
      const edit = cleanEdit({ quarter, angle, crop: whole ? undefined : crop }) ?? {};
      // Brightness in the browser where the canvas can do it; otherwise the server applies it.
      const probe = document.createElement("canvas").getContext("2d");
      const canFilter = Boolean(probe && "filter" in probe);
      let source: ImageBitmap | HTMLCanvasElement = bitmap;
      if (brightness && canFilter) {
        const lit = document.createElement("canvas");
        lit.width = bitmap.width;
        lit.height = bitmap.height;
        const ctx = lit.getContext("2d")!;
        ctx.filter = `brightness(${1 + brightness})`;
        ctx.drawImage(bitmap, 0, 0);
        source = lit;
      }
      const { blob } = await render(source, edit, 1);
      onUse({ file: new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }), brightness: brightness && !canFilter ? brightness : 0 });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : T.review.cannotRead);
      setBusy(false);
    }
  }

  const veil = brightness > 0 ? `rgba(255,255,255,${(brightness * 0.9).toFixed(3)})` : `rgba(0,0,0,${(-brightness * 1.2).toFixed(3)})`;
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

  return (
    <div className="st-review" role="dialog" aria-modal="true" aria-label={T.review.editTitle(slotLabel)}>
      <div className="st-review-photo">
        {view ? (
          <div
            ref={frame}
            className="st-edit-frame"
            style={{ aspectRatio: `${view.w} / ${view.h}`, ...(view.w >= view.h ? { width: "100%" } : { height: "100%" }) }}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <img src={view.url} alt="" draggable={false} />
            {brightness !== 0 && <div className="st-edit-veil" style={{ background: veil }} />}
            {tool === "crop" ? (
              <>
                <div className="st-edit-dim" style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }} />
                <div className="st-edit-box" style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }} onPointerDown={(e) => down(e, "move")}>
                  {(["nw", "ne", "sw", "se"] as Grip[]).map((g) => (
                    <span key={g} className={`st-edit-grip st-edit-grip--${g}`} onPointerDown={(e) => down(e, g)} />
                  ))}
                </div>
              </>
            ) : (
              // Outside Crop, only the kept part shows, as on the phone.
              <div className="st-edit-dim st-edit-dim--solid" style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }} />
            )}
            {tool === "straighten" && <div className="st-edit-grid" />}
          </div>
        ) : (
          <p className="st-support" style={{ color: "#ddd" }}>{T.common.wait}</p>
        )}
      </div>
      <div className="st-review-bar">
        {error && <p className="st-error">{error}</p>}
        <div className="st-toggle st-edit-tools">
          {(["crop", "straighten", "light"] as Tool[]).map((t) => (
            <button key={t} type="button" className={tool === t ? "is-selected" : ""} onClick={() => setTool(t)}>{T.review.tools[t]}</button>
          ))}
        </div>
        {tool === "crop" && (
          <div className="st-review-row">
            <button type="button" className="st-chip" onClick={turn}>{T.review.turn}</button>
            <button type="button" className="st-chip" onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })} disabled={whole}>{T.review.fullPhoto}</button>
            {found && <button type="button" className="st-chip" onClick={() => setCrop(found)}>{T.review.sareeOnly}</button>}
          </div>
        )}
        {tool === "straighten" && (
          <label className="st-edit-slider">
            <span>{angle > 0 ? "+" : ""}{angle.toFixed(1)}°</span>
            <input type="range" min={-MAX_ANGLE} max={MAX_ANGLE} step={0.1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label={T.review.tools.straighten} />
          </label>
        )}
        {tool === "light" && (
          <label className="st-edit-slider">
            <span>{brightness > 0 ? "+" : ""}{Math.round(brightness * 100)}%</span>
            <input type="range" min={-MAX_BRIGHTNESS} max={MAX_BRIGHTNESS} step={0.01} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} aria-label={T.review.tools.light} />
          </label>
        )}
        <div className="st-review-row">
          <button type="button" className="st-secondary" onClick={onBack} disabled={busy}>{T.header.back}</button>
          <button type="button" className="st-secondary" onClick={reset} disabled={busy || !changed}>{T.review.reset}</button>
          <button type="button" className="st-action" onClick={() => void use()} disabled={busy || !view}>{busy ? T.review.saving : T.review.use}</button>
        </div>
      </div>
    </div>
  );
}
