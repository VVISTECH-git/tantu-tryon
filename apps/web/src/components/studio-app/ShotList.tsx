"use client";
/* eslint-disable @next/next/no-img-element -- thumbnails of the merchant's own uploads, shown at tile size. */

import { useState } from "react";
import type { PartQuality } from "@/db";
import { garmentTypeGroups, shotsFor, type Orientation, type Shot } from "@/content/shots";
import { Modal } from "./screens";
import { T } from "./texts";

/**
 * The shot list: one tile per photograph the garment type asks for.
 *
 * Shared by the signed-in studio and the public demo so the two screens stay
 * identical. The tile shows the photograph once it is in, the free quality
 * check's verdict under it, which way to hold the phone, and Camera / Upload.
 */

export interface ShotTile {
  slot: string;
  /** The uploaded photograph, when there is one. */
  url: string | null;
  quality: PartQuality | null;
}

interface ShotListProps {
  type: string;
  tiles: ShotTile[];
  /** The slot an upload is in flight for; its buttons wait. */
  busySlot: string | null;
  /** Only the shots not yet required-and-present: the "additional flats" step. */
  optionalOnly?: boolean;
  /** Hide the blouse tile when the merchant said the blouse is the body fabric. */
  hideBlouse?: boolean;
  onCamera: (shot: Shot) => void;
  onUpload: (shot: Shot) => void;
  onHow: (shot: Shot) => void;
  onClear?: (shot: Shot) => void;
}

export function ShotList({ type, tiles, busySlot, optionalOnly, hideBlouse, onCamera, onUpload, onHow, onClear }: ShotListProps) {
  // Optional shots start folded into a row of chips so the required ones
  // get the screen; a chip opens its tile, and a tile with a photo stays open.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  let shots = shotsFor(type);
  if (optionalOnly) shots = shots.filter((s) => !s.required);
  if (hideBlouse) shots = shots.filter((s) => s.slot !== "blouse");
  const hasPhoto = (slot: string) => Boolean(tiles.find((t) => t.slot === slot)?.url);
  const visible = shots.filter((s) => s.required || hasPhoto(s.slot) || opened.has(s.slot));
  const folded = shots.filter((s) => !visible.includes(s));
  const open = (slot: string) => setOpened((prev) => new Set(prev).add(slot));
  const fold = (slot: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
  return (
    <div className="st-shots">
      {visible.map((shot) => {
        const tile = tiles.find((t) => t.slot === shot.slot);
        const quality = tile?.quality ?? null;
        const state = quality?.status ?? (tile?.url ? "ok" : null);
        const busy = busySlot === shot.slot;
        // The chip carries the first reason's headline; the line under it only
        // repeats the full text when there is more to say than the headline.
        const headline = quality?.reasons[0]?.message.split(".")[0] ?? "";
        const fullText = quality?.reasons.map((r) => r.message).join(" ") ?? "";
        const showCopy = state !== null && state !== "ok" && fullText !== `${headline}.`;
        return (
          <div key={shot.slot} className={`st-shot ${state === "block" ? "st-shot--blocked" : state === "warn" ? "st-shot--warned" : ""}`}>
            <button type="button" className="st-shot-thumb" onClick={() => (tile?.url ? onUpload(shot) : onCamera(shot))} aria-label={`${shot.label} photo`}>
              {tile?.url ? (
                <img src={tile.url} alt="" />
              ) : (
                <>
                  <img src={shot.sample} alt="" className="st-shot-sample" />
                  <span className="st-shot-plus" aria-hidden>+</span>
                </>
              )}
              {busy && <span className="st-shot-busy" aria-hidden />}
            </button>
            <div className="st-shot-body">
              <div className="st-shot-name">
                <span>{shot.label}</span>
                <span className={`st-tag ${shot.required ? "st-tag--required" : "st-tag--optional"}`}>{shot.required ? T.shots.required : T.shots.optional}</span>
              </div>
              {state ? (
                <div className={`st-check st-check--${state}`}>
                  <span className="st-check-dot" aria-hidden />
                  <span>{state === "ok" ? T.shots.good : headline}</span>
                </div>
              ) : (
                <div className="st-shot-how">
                  <OrientationMark orientation={shot.orientation} />
                  <span>{shot.where}</span>
                </div>
              )}
              {showCopy && <p className="st-check-copy">{fullText}</p>}
              <div className="st-shot-actions">
                {tile?.url ? (
                  <>
                    <button type="button" className={`st-chip ${state === "block" ? "st-chip--accent" : ""}`} disabled={busy} onClick={() => onCamera(shot)}>
                      {T.shots.retake}
                    </button>
                    <button type="button" className="st-chip" disabled={busy} onClick={() => onUpload(shot)}>
                      {T.shots.upload}
                    </button>
                    {onClear && (
                      <button type="button" className="st-chip" disabled={busy} onClick={() => onClear(shot)}>
                        {T.shots.clear}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" className="st-chip st-chip--accent" disabled={busy} onClick={() => onCamera(shot)}>
                      {T.shots.camera}
                    </button>
                    <button type="button" className="st-chip" disabled={busy} onClick={() => onUpload(shot)}>
                      {T.shots.upload}
                    </button>
                  </>
                )}
                <button type="button" className="st-link st-shot-how-link" onClick={() => onHow(shot)}>
                  {T.shots.how}
                </button>
                {!shot.required && !tile?.url && opened.has(shot.slot) && (
                  <button type="button" className="st-link st-shot-how-link" onClick={() => fold(shot.slot)}>
                    {T.shots.hide}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {folded.length > 0 && (
        <div className="st-shot-more">
          <span className="st-shot-more-label">{T.shots.moreLabel}</span>
          <div className="st-shot-more-chips">
            {folded.map((shot) => (
              <button type="button" key={shot.slot} className="st-chip st-shot-more-chip" onClick={() => open(shot.slot)}>
                <span aria-hidden>+</span> {shot.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A small phone outline, upright or on its side, before the words. */
export function OrientationMark({ orientation, large }: { orientation: Orientation; large?: boolean }) {
  return (
    <span className={`st-ori st-ori--${orientation} ${large ? "st-ori--large" : ""}`}>
      <i aria-hidden />
      <span>{orientation === "upright" ? T.shots.upright : T.shots.sideways}</span>
    </span>
  );
}

/** The "How" for one shot: where to stand, how high, which way to hold the phone. Text only until the rod photos arrive. */
export function ShotHowModal({ shot, onClose }: { shot: Shot; onClose: () => void }) {
  return (
    <Modal title={`${T.shots.howTitle} ${shot.label.toLowerCase()}`} onClose={onClose}>
      <div className="st-how">
        <div className={`st-how-photo st-how-photo--${shot.orientation}`}>
          <img src={shot.sample} alt="" />
        </div>
        <OrientationMark orientation={shot.orientation} large />
        <p className="st-how-where">{shot.where}</p>
        <p className="st-how-copy">{shot.how}</p>
        {shot.required ? <p className="st-how-note">{T.shots.requiredNote}</p> : <p className="st-how-note">{T.shots.optionalNote}</p>}
      </div>
      <button type="button" className="st-action st-action--compact" onClick={onClose}>
        {T.common.ok}
      </button>
    </Modal>
  );
}

/**
 * The garment-type picker: a real native <select>, styled to match the
 * shell but rendered by the browser's own dropdown so it behaves correctly
 * on every device. Types without a proven prompt are listed but disabled.
 */
export function GarmentTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const groups = garmentTypeGroups();
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select className="st-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={T.upload.typeLabel}>
        {(Object.keys(groups) as (keyof typeof groups)[]).map((group) => (
          <optgroup key={group} label={group}>
            {groups[group].map((o) => (
              <option key={o.value} value={o.value} disabled={!o.enabled}>
                {o.enabled ? o.label : `${o.label} · ${T.confirm.soon}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="st-select-chevron" aria-hidden>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

/**
 * The confirm screen's strip: every photograph that was uploaded, in shot
 * order, each with the check's verdict. A garment from an SLK code has no
 * verdicts, so its photographs show plain. One flat photo shows alone.
 */
export function ShotStrip({ type, tiles, onEdit }: { type: string; tiles: ShotTile[]; onEdit?: () => void }) {
  const flat = tiles.find((t) => t.slot === "saree");
  if (flat?.url) {
    return (
      <div className="st-frame st-frame--contain" style={{ maxHeight: 300 }}>
        <img src={flat.url} alt="" />
      </div>
    );
  }
  const shots = shotsFor(type);
  const order = (slot: string) => {
    const i = shots.findIndex((s) => s.slot === slot);
    return i === -1 ? 99 : i;
  };
  const present = tiles.filter((t) => t.url).sort((a, b) => order(a.slot) - order(b.slot));
  return (
    <div className="st-strip">
      {present.map((tile) => {
        const shot = shots.find((s) => s.slot === tile.slot);
        const state = tile.quality?.status ?? null;
        return (
          <button type="button" key={tile.slot} className="st-strip-item" onClick={onEdit} aria-label={shot?.label ?? tile.slot}>
            <span className={`st-strip-thumb ${state === "block" ? "is-block" : state === "warn" ? "is-warn" : ""}`}>
              <img src={tile.url!} alt="" />
              {state && <span className={`st-strip-dot st-check--${state}`} aria-hidden />}
            </span>
            <span className="st-strip-label">{shot?.label ?? tile.slot}</span>
          </button>
        );
      })}
      {onEdit && (
        <button type="button" className="st-strip-item st-strip-item--add" onClick={onEdit}>
          <span className="st-strip-thumb"><span aria-hidden>+</span></span>
          <span className="st-strip-label">{T.confirm.addMore}</span>
        </button>
      )}
    </div>
  );
}
