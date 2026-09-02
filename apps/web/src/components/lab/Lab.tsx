"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import type { PoseRecord, SlotId } from "@tantu/engine/catalog";
import { Dropzone } from "@/components/Dropzone";
import { Select } from "@/components/ui";
import type { LoadedImage } from "@/lib/image";
import { LAB_MODELS, labModel } from "./models";
import { EMPTY_SHEET, QC_CHECKS, loadRuns, saveRuns, type LabRun, type QcSheet } from "./qc";

/**
 * Tantu Lab — the internal bench for the SAR-P15 end-to-end experiment.
 *
 * Deliberately not the Studio. This page exists to be run twenty times in a row
 * on one saree, so it shows the things a customer should never have to see:
 * the pose id, both reference assets, the prompt wording, the raw failure
 * message, and a QC sheet against each uploaded part.
 *
 * The pose is hard-coded. That is the point — with pose fixed, anything that
 * comes out wrong is the garment pipeline, not the pose.
 */

/** The four parts of a saree the experiment is about, plus optional context. */
const INPUTS: { slot: SlotId; label: string; hint: string; required: boolean }[] = [
  { slot: "body", label: "Body", hint: "A flat section of the main field, square to camera, motif in focus.", required: true },
  { slot: "pallu", label: "Pallu", hint: "Fill the frame with the pallu end.", required: true },
  { slot: "border", label: "Border", hint: "A straight run of border, edge parallel to the frame.", required: true },
  { slot: "blouse", label: "Blouse piece", hint: "The blouse piece flat and whole.", required: true },
  { slot: "full-drape", label: "Full saree reference", hint: "Optional. The whole saree flat or on a stand.", required: false },
  { slot: "weave", label: "Weave detail", hint: "Optional. Close enough to read the brush or block work.", required: false },
];

type Uploads = Partial<Record<SlotId, LoadedImage>>;

export function Lab({ pose }: { pose: PoseRecord }) {
  const [modelId, setModelId] = useState(LAB_MODELS[0]!.id);
  const [uploads, setUploads] = useState<Uploads>({});
  const [quality, setQuality] = useState<"standard" | "high">("standard");

  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<LabRun | null>(null);
  const [qc, setQc] = useState<QcSheet>(EMPTY_SHEET);
  const [notes, setNotes] = useState("");
  /**
   * Starts empty on both server and client. Reading localStorage during render
   * makes the server emit an empty log and the client a populated one, which is
   * a hydration mismatch — earlier runs are fetched on request instead.
   */
  const [history, setHistory] = useState<LabRun[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const missing = INPUTS.filter((i) => i.required && !uploads[i.slot]).map((i) => i.label);
  const canRun = missing.length === 0 && !running;

  /** Named by role, not by slot — the recipe decides the order images go in. */
  const assets = useMemo(
    () => ({
      body: uploads.body?.dataUrl,
      pallu: uploads.pallu?.dataUrl,
      border: uploads.border?.dataUrl,
      blouse: uploads.blouse?.dataUrl,
      fullDrape: uploads["full-drape"]?.dataUrl,
      weave: uploads.weave?.dataUrl,
    }),
    [uploads],
  );

  async function generate(dryRun = false) {
    setRunning(true);
    setQc(EMPTY_SHEET);
    setNotes("");
    const controller = new AbortController();
    abortRef.current = controller;

    const entry: LabRun = {
      id: `run-${Date.now()}`,
      at: new Date().toISOString(),
      poseId: pose.id,
      modelId,
      recipeId: pose.recipe ?? undefined,
      qc: EMPTY_SHEET,
      notes: "",
      decision: null,
    };

    try {
      const response = await fetch("/api/lab/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          poseId: pose.id,
          model: labModel(modelId).brief,
          quality,
          assets,
          dryRun,
        }),
      });

      const payload = (await response.json()) as {
        image?: string;
        error?: string;
        prompt?: string;
        recipeId?: string;
        warnings?: string[];
        model?: string;
        ms?: number;
      };

      entry.prompt = payload.prompt;
      entry.recipeId = payload.recipeId;
      entry.warnings = payload.warnings;
      entry.engineModel = payload.model;
      entry.ms = payload.ms;

      if (dryRun) return;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error ?? `The lab endpoint returned ${response.status}.`);
      }
      entry.image = payload.image;
    } catch (problem) {
      entry.error = problem instanceof Error ? problem.message : "The run failed.";
    } finally {
      setRun(entry);
      setHistory((current) => {
        const next = [entry, ...current];
        saveRuns(next);
        return next.slice(0, 12);
      });
      setRunning(false);
      abortRef.current = null;
    }
  }

  function decide(decision: "approved" | "rejected") {
    if (!run) return;
    const updated: LabRun = { ...run, qc, notes, decision };
    setRun(updated);
    setHistory((current) => {
      const next = current.map((r) => (r.id === updated.id ? updated : r));
      saveRuns(next);
      return next;
    });
  }

  const failed = QC_CHECKS.filter((c) => qc[c.key] === "fail").length;
  const marked = QC_CHECKS.filter((c) => qc[c.key] !== null).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="border-b border-line pb-5">
        <p className="label !text-madder">Internal · not the customer studio</p>
        <h1 className="display mt-1 text-[26px]">Tantu Lab — saree generation test</h1>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-soft">
          One pose, fixed, so that anything wrong in the output is the garment
          pipeline rather than the pose. Runs are logged in this browser only.
        </p>
      </header>

      <Block title="Pose" note={`${pose.id} · ${pose.status} · v${pose.version}`}>
        <p className="mb-4 text-[15px]">
          <span className="numeral">{pose.id}</span> — {pose.name}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <AssetPanel
            caption="Locked silhouette"
            sub="The approved definition of the pose"
            src={pose.assets.silhouette}
            missing="No silhouette on this record."
          />
          <AssetPanel
            caption="Photorealistic master"
            sub="The pose-control reference"
            src={pose.assets.masterReference}
            missing="No master reference approved yet. Nothing steers pose geometry."
          />
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
          <Fact k="Stance">
            {pose.body.orientation}, weight {pose.body.weightDistribution}, right leg {pose.body.rightLeg}
          </Fact>
          <Fact k="Hands">
            {pose.hands.left.interaction === "none" && pose.hands.right.interaction === "none"
              ? "both relaxed, no garment contact"
              : `${pose.hands.left.interaction} / ${pose.hands.right.interaction}`}
          </Fact>
          <Fact k="Shows">{pose.showcasePurpose.join(", ")}</Fact>
          <Fact k="Recipe">{pose.recipe ?? "none"}</Fact>
        </dl>
      </Block>

      <Block title="Model" note="Chosen independently of pose">
        <Select
          id="lab-model"
          value={modelId}
          onChange={setModelId}
          options={LAB_MODELS.map((m) => ({ value: m.id, label: m.label }))}
        />
      </Block>

      <Block title="Saree inputs" note="Four parts of one saree">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INPUTS.map((input) => (
            <Dropzone
              key={input.slot}
              label={input.label}
              hint={input.hint}
              required={input.required}
              value={uploads[input.slot]}
              onPick={(image) => setUploads((c) => ({ ...c, [input.slot]: image }))}
              onClear={() =>
                setUploads((c) => {
                  const next = { ...c };
                  delete next[input.slot];
                  return next;
                })
              }
            />
          ))}
        </div>
      </Block>

      <Block title="Generation" note="Technical controls, deliberately exposed">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink-soft">
            Recipe <span className="numeral text-ink">{pose.recipe ?? "none"}</span>
          </span>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-ink-soft">Quality</span>
            <Select
              id="lab-quality"
              value={quality}
              onChange={(v) => setQuality(v as typeof quality)}
              options={[
                { value: "standard", label: "Standard" },
                { value: "high", label: "High" },
              ]}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canRun}
          onClick={() => void generate(true)}
          className="rounded-full border border-line px-5 py-3 text-[15px] text-ink transition hover:border-ink-faint"
        >
          Preview prompt — free
        </button>
        <button
          type="button"
          disabled={!canRun}
          onClick={() => void generate(false)}
          className="rounded-full bg-accent px-6 py-3 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
        >
          {running ? "Working…" : "Generate test image"}
        </button>
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-faint">Still needed: {missing.join(", ")}.</p>
        )}
        <p className="mt-2 text-[13px] text-ink-faint">This spends money on the image engine.</p>
      </Block>

      <Block title="Result" note={run ? new Date(run.at).toLocaleTimeString() : "No run yet"}>
        {!run && <Empty>Nothing generated yet.</Empty>}
        {run?.error && (
          <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
            <p className="text-[14px] font-medium text-danger">The run produced no image.</p>
            <p className="mt-1 break-words text-[13px] text-ink-soft">{run.error}</p>
          </div>
        )}
        {run?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={run.image}
            alt="Generated test image"
            className="w-full max-w-md rounded-xl border border-line"
          />
        )}

        {run && (
          <div className="mt-3 space-y-2 text-[12px] text-ink-faint">
            <p>
              {[run.recipeId, run.engineModel, run.ms ? `${(run.ms / 1000).toFixed(1)}s` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {run.warnings?.map((w) => (
              <p key={w} className="text-madder">
                {w}
              </p>
            ))}
            {run.prompt && (
              <details>
                <summary className="cursor-pointer text-ink-soft">
                  Prompt sent ({run.prompt.length} characters)
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-[12px] leading-relaxed text-ink-soft">
                  {run.prompt}
                </pre>
              </details>
            )}
          </div>
        )}
      </Block>

      <Block
        title="QC"
        note={run?.image ? `${marked}/${QC_CHECKS.length} marked · ${failed} failing` : "Needs a result"}
      >
        <div className="divide-y divide-line-soft border-y border-line-soft">
          {QC_CHECKS.map((check) => (
            <div key={check.key} className="flex items-center gap-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">{check.label}</p>
                <p className="text-[12px] text-ink-faint">against {check.against}</p>
              </div>
              <div className="flex gap-1.5">
                {(["pass", "fail"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={!run?.image}
                    onClick={() => setQc((c) => ({ ...c, [check.key]: c[check.key] === v ? null : v }))}
                    className={`rounded-full border px-3 py-1 text-[12px] uppercase tracking-wide transition disabled:opacity-40 ${
                      qc[check.key] === v
                        ? v === "pass"
                          ? "border-accent bg-accent text-white"
                          : "border-danger bg-danger text-white"
                        : "border-line text-ink-soft hover:border-ink-faint"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What went wrong, in words. This is the part that tells you what to change."
          rows={3}
          className="mt-4 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!run?.image}
            onClick={() => decide("approved")}
            className="rounded-full border border-accent px-5 py-2 text-[14px] text-accent transition hover:bg-accent-wash disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={!run?.image}
            onClick={() => decide("rejected")}
            className="rounded-full border border-danger px-5 py-2 text-[14px] text-danger transition hover:bg-danger/5 disabled:opacity-40"
          >
            Reject
          </button>
          {run?.decision && (
            <span className="text-[13px] text-ink-soft">Recorded as {run.decision}.</span>
          )}
        </div>
      </Block>

      <Block title="Run log" note={history.length ? `${history.length} shown` : "kept in this browser"}>
        <button
          type="button"
          onClick={() => setHistory(loadRuns())}
          className="mb-3 text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
        >
          Load earlier runs
        </button>
        {history.length > 0 && (
          <ul className="divide-y divide-line-soft border-y border-line-soft text-[13px]">
            {history.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="numeral text-ink-faint">
                  {new Date(r.at).toLocaleTimeString()}
                </span>
                <span>{r.poseId}</span>
                <span className="text-ink-faint">{r.modelId}</span>
                <span className="text-ink-faint">{r.recipeId ?? "no recipe"}</span>
                <span className="ml-auto">
                  {r.error ? (
                    <span className="text-danger">failed</span>
                  ) : (
                    <span className="text-ink-soft">{r.decision ?? "unreviewed"}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft py-6 last:border-b-0">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="label">{title}</h2>
        {note && <span className="text-[12px] text-ink-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function AssetPanel({
  caption,
  sub,
  src,
  missing,
}: {
  caption: string;
  sub: string;
  src: string | null;
  missing: string;
}) {
  return (
    <figure className="m-0">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-line bg-surface">
        {src ? (
          <Image src={src} alt={caption} fill sizes="400px" className="object-contain" />
        ) : (
          <p className="grid h-full place-items-center px-6 text-center text-[13px] text-ink-faint">
            {missing}
          </p>
        )}
      </div>
      <figcaption className="mt-1.5 text-[13px]">
        {caption}
        <span className="block text-[12px] text-ink-faint">{sub}</span>
      </figcaption>
    </figure>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-faint">{k}</dt>
      <dd className="m-0 text-ink-soft">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-faint">
      {children}
    </p>
  );
}
