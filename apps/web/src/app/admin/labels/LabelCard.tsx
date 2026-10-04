"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PartRegion } from "@/db/schema";

const COLOURS: Record<string, string> = {
  Body: "#2e86de",
  Pallu: "#e84393",
  "Bottom border": "#e67e22",
  "Top border": "#f1c40f",
  Blouse: "#27ae60",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Where to write a part's name: the middle of its outline. */
function centre(points: [number, number][]): [number, number] {
  const n = points.length || 1;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

/** One training photo: its marks drawn on it, and the staff verdict. */
export function LabelCard(props: {
  /** On a product's page: the photo's slot, in place of the Label Studio number and file name. */
  title?: string;
  id: string;
  no: number | null;
  source: string;
  width: number;
  height: number;
  regions: PartRegion[];
  style: string | null;
  palluKind: string | null;
  status: string;
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState(true);
  const [status, setStatus] = useState(props.status);
  const [note, setNote] = useState(props.note ?? "");
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [by, setBy] = useState({ who: props.reviewedBy, at: props.reviewedAt });
  const ratio = props.width / props.height;
  const parts = [...new Set(props.regions.map((r) => r.label))];

  async function save(next: "approved" | "wrong" | "pending") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/labels/${props.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next, note: next === "wrong" ? note : null }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError("No internet. Try again.");
    const body = (await res.json().catch(() => ({}))) as { error?: string; status?: string; reviewedBy?: string; reviewedAt?: string };
    if (!res.ok) return setError(body.error ?? "Could not save.");
    setStatus(body.status ?? next);
    setBy({ who: body.reviewedBy ?? null, at: body.reviewedAt ?? null });
    setWriting(false);
    router.refresh();
  }

  const ring =
    status === "approved" ? "border-good ring-2 ring-good/15" : status === "wrong" ? "border-danger ring-2 ring-danger/15" : "border-line";

  return (
    <article className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${ring}`}>
      <header className="flex items-baseline gap-2">
        {props.title ? (
          <b className="text-[15px] capitalize">{props.title}</b>
        ) : (
          <>
            <b className="text-[17px] tabular-nums">{props.no != null ? `#${String(props.no).padStart(2, "0")}` : "—"}</b>
            <span className="truncate text-[12.5px] text-ink-faint">{props.source}</span>
          </>
        )}
        <span
          className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
            status === "approved" ? "bg-good/10 text-good" : status === "wrong" ? "bg-danger-wash text-danger" : "bg-turmeric-wash text-ink-soft"
          }`}
        >
          {status === "approved" ? "Approved" : status === "wrong" ? "Wrong" : "To check"}
        </span>
      </header>

      <button
        type="button"
        onClick={() => setMarks((m) => !m)}
        className="relative mx-auto block overflow-hidden rounded-lg bg-surface-2"
        style={{ width: `min(100%, calc(62vh * ${ratio}))`, aspectRatio: `${props.width} / ${props.height}` }}
        aria-label={marks ? "Show the photo without colours" : "Show the colours"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/labels/${props.id}/image?v=${props.version}`}
          alt={`Photo ${props.no ?? ""}`}
          className="absolute inset-0 size-full object-fill"
        />
        {marks && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
              {props.regions.map((r, i) => (
                <polygon
                  key={i}
                  points={r.points.map((p) => p.join(",")).join(" ")}
                  fill={COLOURS[r.label] ?? "#888"}
                  fillOpacity={0.38}
                  stroke={COLOURS[r.label] ?? "#888"}
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            {props.regions.map((r, i) => {
              const [x, y] = centre(r.points);
              return (
                <span
                  key={i}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border-2 bg-white/95 px-1.5 py-0.5 text-[11.5px] font-semibold text-ink shadow-sm"
                  style={{ left: `${x}%`, top: `${y}%`, borderColor: COLOURS[r.label] ?? "#888" }}
                >
                  {r.label}
                </span>
              );
            })}
          </>
        )}
        <span className="absolute bottom-2 left-2 rounded-md bg-ink/70 px-2 py-0.5 text-[11.5px] text-white">
          {marks ? "Tap: without colours" : "Tap: with colours"}
        </span>
      </button>

      <div className="flex flex-wrap gap-1.5 text-[12.5px] text-ink-soft">
        {props.style && <span className="rounded-md bg-surface-2 px-2 py-0.5">{props.style}</span>}
        {props.palluKind && <span className="rounded-md bg-surface-2 px-2 py-0.5">{props.palluKind}</span>}
        {parts.length === 0 && <span className="font-semibold text-danger">Not marked</span>}
        {parts.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5">
            <i className="inline-block size-2.5 rounded-[3px]" style={{ background: COLOURS[p] ?? "#888" }} />
            {p}
          </span>
        ))}
      </div>

      {status === "pending" && props.note && (
        <p className="rounded-lg bg-turmeric-wash px-3 py-2 text-[13px] text-ink-soft">
          Fixed after this note: <span className="text-ink">{props.note}</span>
        </p>
      )}
      {status === "wrong" && !writing && note && <p className="rounded-lg bg-danger-wash px-3 py-2 text-[13px] text-ink">{note}</p>}

      {writing ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is wrong? e.g. the green piece at the top right is the blouse"
            className="min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void save("wrong")}
              className="flex-1 rounded-lg bg-danger px-3 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save: wrong"}
            </button>
            <button type="button" onClick={() => setWriting(false)} className="rounded-lg border border-line px-4 py-2.5 text-[14px]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (status === "approved" ? save("pending") : save("approved"))}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-[14px] font-semibold disabled:opacity-50 ${
              status === "approved" ? "border-good bg-good text-white" : "border-line hover:border-good hover:text-good"
            }`}
          >
            ✓ {status === "approved" ? "Approved" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setWriting(true)}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-[14px] font-semibold disabled:opacity-50 ${
              status === "wrong" ? "border-danger bg-danger text-white" : "border-line hover:border-danger hover:text-danger"
            }`}
          >
            ✗ {status === "wrong" ? "Wrong · edit note" : "Wrong"}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {by.who && by.at && status !== "pending" && (
        <p className="text-[12px] text-ink-faint">
          {status === "approved" ? "Approved" : "Flagged"} by {by.who} · {when(by.at)}
        </p>
      )}
    </article>
  );
}
