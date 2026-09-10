"use client";

import { useEffect, useMemo, useState } from "react";
import type { Run, Verdict } from "@/lib/runs";

/**
 * Where Gemini's answers come back to, and get judged.
 *
 * Drop the image, or copy it in Gemini and paste anywhere on this page. It
 * becomes a run: filed under the prompt and version that made it, with the
 * choices that were set, kept on this machine. Then one of two buttons —
 * Approve or Reject — and a line saying why. A prompt earns its freeze from
 * the approvals here; a rejected run's note is the brief for the next
 * version. The chat window stops being the record.
 */
export function ReviewBoard({
  code,
  promptId,
  runs,
  prompt,
  onAdd,
  onVerdict,
  onNote,
  onRemove,
}: {
  code: string;
  promptId: string;
  /** Runs for this product and prompt, oldest first. */
  runs: Run[];
  /** The prompt chooser and card, laid beside the runs on a wide screen. */
  prompt: React.ReactNode;
  onAdd: (file: File) => void;
  onVerdict: (id: string, verdict: Verdict) => void;
  onNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [over, setOver] = useState(false);

  // A paste anywhere on the page, when it carries an image, is a run.
  // Gemini's right-click → Copy image puts one on the clipboard.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        onAdd(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onAdd]);

  const approved = runs.filter((r) => r.verdict === "approved").length;
  const rejected = runs.filter((r) => r.verdict === "rejected").length;
  const pending = runs.length - approved - rejected;

  /*
    Two columns on a wide screen: the prompt and the drop zone on the left,
    the runs three across on the right. Reviewing is comparing, and a single
    column under the prompt could only ever show one output at a time.
  */
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-4">
        {prompt}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            for (const file of Array.from(e.dataTransfer.files)) {
              if (file.type.startsWith("image/")) onAdd(file);
            }
          }}
          className={`rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
            over ? "border-accent bg-accent-wash" : "border-line bg-surface"
          }`}
        >
          <p className="text-[14px] text-ink">Drop Gemini&rsquo;s output here</p>
          <p className="mt-1 text-[12.5px] text-ink-faint">
            Or copy the image in Gemini and paste anywhere on this page. Kept on this computer, with
            the prompt that made it.
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold text-ink">Runs</h3>
          <span className="text-[13px] tabular-nums text-ink-faint">
            {runs.length === 0
              ? "None yet for this prompt."
              : [
                  approved > 0 && `${approved} approved`,
                  rejected > 0 && `${rejected} rejected`,
                  pending > 0 && `${pending} to judge`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>

        {runs.length > 0 ? (
          <ul className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[...runs].reverse().map((run, i) => (
              <RunCard
                key={run.id}
                run={run}
                index={runs.length - i}
                code={code}
                promptId={promptId}
                onVerdict={onVerdict}
                onNote={onNote}
                onRemove={onRemove}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-line px-5 py-10 text-center text-[13px] text-ink-faint">
            Outputs you drop or paste appear here, newest first, with Approve and Reject.
          </p>
        )}
      </div>
    </section>
  );
}

function RunCard({
  run,
  index,
  code,
  promptId,
  onVerdict,
  onNote,
  onRemove,
}: {
  run: Run;
  index: number;
  code: string;
  promptId: string;
  onVerdict: (id: string, verdict: Verdict) => void;
  onNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  // One object URL per card, made as the card renders and released when it
  // goes. Not set from a frame callback: a background tab never gets one,
  // and a card that waits for it shows nothing.
  const url = useMemo(() => URL.createObjectURL(run.image), [run.image]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [note, setNote] = useState(run.note);
  const dirty = note !== run.note;

  function save() {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${code}-${promptId}-${index}.${run.image.type === "image/jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const tone =
    run.verdict === "approved"
      ? "border-good/50"
      : run.verdict === "rejected"
        ? "border-danger/50"
        : "border-line";

  return (
    <li className={`m-0 list-none overflow-hidden rounded-xl border bg-surface ${tone}`}>
      <a href={url} target="_blank" rel="noopener" title="Open full size" className="block">
        <div className="relative aspect-[4/5] w-full bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${promptId} run ${index}`} className="h-full w-full object-cover" />
        </div>
      </a>

      <div className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-soft">
          <span className="font-semibold tabular-nums text-ink">
            {promptId} · run {index}
          </span>
          <span className="rounded-full border border-line px-1.5 py-0 text-[11px] tabular-nums">{run.version}</span>
          <span className="text-ink-faint">
            {new Date(run.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-[12px] text-ink-faint">{run.selections}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onVerdict(run.id, run.verdict === "approved" ? null : "approved")}
            aria-pressed={run.verdict === "approved"}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              run.verdict === "approved"
                ? "border-good bg-good text-white"
                : "border-line text-ink-soft hover:border-good hover:text-good"
            }`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onVerdict(run.id, run.verdict === "rejected" ? null : "rejected")}
            aria-pressed={run.verdict === "rejected"}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              run.verdict === "rejected"
                ? "border-danger bg-danger text-white"
                : "border-line text-ink-soft hover:border-danger hover:text-danger"
            }`}
          >
            Reject
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => dirty && onNote(run.id, note)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder={run.verdict === "rejected" ? "What went wrong" : "Note"}
            aria-label="Note on this run"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={save}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onRemove(run.id)}
            aria-label="Remove this run"
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:border-danger hover:text-danger"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
