"use client";
/* eslint-disable @next/next/no-img-element -- tip photographs at their own size */

import { T } from "./texts";
import { OrientationMark } from "./ShotList";

/*
  The small parts every screen is built from. Presentational only: what to
  show and what to call when pressed. The state lives in StudioApp.
*/

export function Title({ children, hero }: { children: React.ReactNode; hero?: boolean }) {
  return <h1 className={`st-title ${hero ? "st-title--hero" : ""}`}>{children}</h1>;
}

export function Copy({ children }: { children: React.ReactNode }) {
  return <p className="st-copy">{children}</p>;
}

export function Spinner({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="st-grow">
      <div className="st-spinner" aria-hidden />
      <p className="st-copy" style={{ maxWidth: 280 }}>
        {text}
      </p>
      {sub && <p className="st-support">{sub}</p>}
    </div>
  );
}

export function YesNo({ value, onChange, disabled }: { value: boolean | undefined; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="st-toggle" role="radiogroup">
      {[true, false].map((v) => (
        <button key={String(v)} type="button" disabled={disabled} className={value === v ? "is-selected" : ""} aria-checked={value === v} role="radio" onClick={() => onChange(v)}>
          {v ? T.common.yes : T.common.no}
        </button>
      ))}
    </div>
  );
}

export function Question({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="st-question">
      <div className="st-question-label">{label}</div>
      <div className="st-question-hint">{help}</div>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose, wide }: { title?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="st-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`st-modal ${wide ? "st-modal--wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="st-modal-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  icon,
  title,
  message,
  confirm,
  onConfirm,
  onClose,
}: {
  icon: string;
  title: string;
  message: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="st-modal-icon" aria-hidden>
        {icon}
      </div>
      <h2 className="st-modal-title">{title}</h2>
      <p className="st-modal-message">{message}</p>
      <div className="st-stack">
        <button type="button" className="st-action st-action--compact" onClick={onConfirm}>
          {confirm}
        </button>
        <button type="button" className="st-secondary" style={{ minHeight: 36, fontSize: 12 }} onClick={onClose}>
          {T.common.cancel}
        </button>
      </div>
    </Modal>
  );
}

/**
 * The saree tips, as a carousel: a photograph per slide with the body and
 * pallu labelled on it, a tick or a warning badge, arrows and dots.
 */
export function TipsModal({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const slide = T.upload.slides[index]!;
  return (
    <Modal title={T.upload.tipsTitle} onClose={onClose}>
      <div className="st-media-row">
        <button type="button" className="st-arrow" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={T.gallery.previous}>
          ‹
        </button>
        <div className="st-frame st-frame--contain">
          <span className={`st-verdict ${slide.good ? "" : "is-caution"}`} title={slide.good ? T.upload.slideGood : T.upload.slideCaution}>
            {slide.good ? "✓" : "!"}
          </span>
          <img src={slide.photo} alt="" />
          {slide.orientation && (
            <span style={{ position: "absolute", left: 12, bottom: 12 }}>
              <OrientationMark orientation={slide.orientation} />
            </span>
          )}
        </div>
        <button type="button" className="st-arrow" disabled={index === T.upload.slides.length - 1} onClick={() => onIndex(index + 1)} aria-label={T.gallery.next}>
          ›
        </button>
      </div>
      <div className="st-dots">
        {T.upload.slides.map((_, i) => (
          <span key={i} className={`st-dot ${i === index ? "is-active" : ""}`} />
        ))}
      </div>
      <p className="st-caption" style={{ fontWeight: 600, color: slide.good ? "#9fe0b8" : "#ffb4b4" }}>
        {slide.good ? T.upload.slideGood : T.upload.slideCaution} · {slide.title}
      </p>
      <div className="st-tip-box">{slide.copy}</div>
      <button type="button" className="st-secondary" onClick={onClose}>
        {T.common.close}
      </button>
    </Modal>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}
