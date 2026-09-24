"use client";

import { T } from "./texts";

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
 * The saree tips, as a carousel. The frames are drawn, not photographed:
 * a diagram of where the body and the pallu should sit says the same
 * thing as a sample photo and belongs to nobody else.
 */
export function TipsModal({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const slide = T.upload.slides[index]!;
  return (
    <Modal title={T.upload.tipsTitle} onClose={onClose}>
      <div className="st-media-row">
        <button type="button" className="st-arrow" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={T.gallery.previous}>
          ‹
        </button>
        <div className="st-frame">
          <span className={`st-verdict ${slide.good ? "" : "is-caution"}`} title={slide.good ? T.upload.slideGood : T.upload.slideCaution}>
            {slide.good ? "✓" : "!"}
          </span>
          <TipDiagram index={index} />
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

function TipDiagram({ index }: { index: number }) {
  const body = "repeating-linear-gradient(45deg, rgba(240,141,66,0.35) 0 6px, rgba(240,141,66,0.12) 6px 12px)";
  const pallu = "repeating-radial-gradient(circle at 50% 50%, rgba(107,52,179,0.55) 0 4px, rgba(107,52,179,0.18) 4px 12px)";
  const border = "linear-gradient(180deg, #f0b17e, #db7124)";
  if (index === 4) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.03)" }}>
        <div style={{ width: "42%", height: "78%", borderRadius: "40% 40% 20% 20% / 30% 30% 10% 10%", background: pallu, opacity: 0.8 }} />
        <span style={{ position: "absolute", bottom: 10, fontSize: 11, color: "rgba(244,239,230,0.6)" }}>Mannequin drape</span>
      </div>
    );
  }
  // How much of the frame the saree fills, and how the two halves split.
  const inset = index === 3 ? "22% 30%" : index === 2 ? "3% 6%" : "6% 12%";
  const bodyShare = index === 1 ? "28%" : "50%";
  return (
    <div style={{ position: "absolute", inset, display: "grid", gridTemplateColumns: "6px 1fr 6px", borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.15)" }}>
      <div style={{ background: border }} />
      <div style={{ display: "grid", gridTemplateRows: `${bodyShare} 1fr` }}>
        <div style={{ position: "relative", background: body }}>
          <Label>{T.upload.overlayBody}</Label>
        </div>
        <div style={{ position: "relative", background: pallu }}>
          <Label>{T.upload.overlayPallu}</Label>
        </div>
      </div>
      <div style={{ background: border }} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "absolute", left: 8, top: 8, padding: "3px 8px", borderRadius: 999, background: "rgba(10,10,10,0.7)", fontSize: 11, fontWeight: 600, color: "#f4efe6" }}>
      {children}
    </span>
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
