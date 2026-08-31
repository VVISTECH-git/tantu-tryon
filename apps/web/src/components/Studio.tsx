"use client";

import { useMemo, useRef, useState } from "react";
import {
  DEFAULT_POSE_IDS,
  GARMENTS,
  SCENES,
  SLOTS,
  garment as garmentDef,
  posesFor,
  slotsFor,
} from "@tantu/engine/catalog";
import type { GarmentId, ModelBrief, RenderMode, SlotId } from "@tantu/engine/catalog";
import { Dropzone } from "./Dropzone";
import { Lightbox } from "./Lightbox";
import { Results } from "./Results";
import { Chip, Section, Segmented, TextArea, TextInput } from "./ui";
import type { RenderCard } from "./types";
import { saveRenders, type StoredRender } from "@/lib/library";
import { thumbnail, type LoadedImage } from "@/lib/image";
import { formatCost } from "@/lib/pricing";
import { explain } from "@/lib/errors";

interface RefImage extends LoadedImage {
  slot: SlotId;
  key: string;
}

const MODES: { value: RenderMode; label: string; hint: string }[] = [
  { value: "describe", label: "Describe a model", hint: "No model photo needed" },
  { value: "mannequin", label: "Mannequin → model", hint: "Highest fidelity" },
  { value: "person", label: "Try on a person", hint: "Dress a real photo" },
];

/** Slots are always sent in this order so the prompt's numbering is stable. */
const SLOT_ORDER = new Map(SLOTS.map((s, index) => [s.id, index]));

export function Studio() {
  const [title, setTitle] = useState("");
  const [garment, setGarment] = useState<GarmentId>("saree");
  const [mode, setMode] = useState<RenderMode>("describe");
  const [refs, setRefs] = useState<Record<string, RefImage>>({});
  const [extras, setExtras] = useState<RefImage[]>([]);
  const [person, setPerson] = useState<LoadedImage | null>(null);
  const [brief, setBrief] = useState<ModelBrief>({});
  const [freeformModel, setFreeformModel] = useState(false);
  const [scene, setScene] = useState<string>("courtyard");
  const [customScene, setCustomScene] = useState("");
  const [poses, setPoses] = useState<string[]>(DEFAULT_POSE_IDS);
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [extraInstruction, setExtraInstruction] = useState("");

  const [cards, setCards] = useState<RenderCard[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const batchRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const recommended = useMemo(
    () => new Set(garmentDef(garment).recommendedSlots),
    [garment],
  );
  const availableSlots = useMemo(
    () => slotsFor(garment).filter((s) => s.id !== "extra" && s.id !== "mannequin"),
    [garment],
  );
  const availablePoses = useMemo(() => posesFor(garment), [garment]);

  const referenceList = useMemo(() => {
    const chosen = Object.values(refs).concat(extras);
    return chosen.sort((a, b) => (SLOT_ORDER.get(a.slot) ?? 99) - (SLOT_ORDER.get(b.slot) ?? 99));
  }, [refs, extras]);

  /** The image the render gets judged against — the motif, wherever it lives. */
  const compareSource = useMemo(() => {
    const preferred = ["body", "pallu", "weave", "full-drape", "mannequin"] as const;
    for (const slot of preferred) if (refs[slot]) return refs[slot].dataUrl;
    return referenceList[0]?.dataUrl;
  }, [refs, referenceList]);

  const stem = useMemo(() => {
    const base = title.trim() ? title.trim().replace(/[^\w-]+/g, "-").toLowerCase() : garment;
    return base.replace(/^-+|-+$/g, "") || "render";
  }, [title, garment]);

  const readyProblems = useMemo(() => {
    const problems: string[] = [];
    if (referenceList.length === 0) problems.push("Add at least one photograph of the garment.");
    if (poses.length === 0) problems.push("Choose at least one pose.");
    if (mode === "person" && !person) problems.push("Add the photograph of the person.");
    if (mode === "mannequin" && !refs.mannequin) problems.push("Add the mannequin photograph.");
    return problems;
  }, [referenceList, poses, mode, person, refs.mannequin]);

  function setRef(slot: SlotId, image: LoadedImage | null) {
    setRefs((current) => {
      const next = { ...current };
      if (image) next[slot] = { ...image, slot, key: slot };
      else delete next[slot];
      return next;
    });
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function run(poseIds: string[]) {
    if (poseIds.length === 0) return;
    setError(null);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const isRetry = cards.length > 0 && poseIds.length < poses.length;
    const nameOf = (id: string) => availablePoses.find((p) => p.id === id)?.name ?? id;

    if (!isRetry) {
      batchRef.current = `batch-${Date.now()}`;
      setCards(poseIds.map((id) => ({ state: "pending", poseId: id, poseName: nameOf(id) })));
    } else {
      setCards((current) =>
        current.map((card) =>
          poseIds.includes(card.poseId)
            ? { state: "pending", poseId: card.poseId, poseName: card.poseName }
            : card,
        ),
      );
    }

    const payload = {
      garment,
      mode,
      references: referenceList.map((ref) => ({ slot: ref.slot, data: ref.dataUrl })),
      person: person ? { slot: "extra" as SlotId, data: person.dataUrl } : undefined,
      model: freeformModel ? { freeform: brief.freeform, styling: brief.styling } : brief,
      scene: scene === "custom" ? customScene : scene,
      poses: poseIds,
      quality,
      extraInstruction: extraInstruction.trim() || undefined,
    };

    const refThumb = compareSource ? await thumbnail(compareSource, 640) : undefined;

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const problem = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(problem?.error ?? `The render service returned ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const saved: StoredRender[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          const event = JSON.parse(line) as
            | { type: "start"; poses: number }
            | { type: "outcome"; outcome: OutcomeWire }
            | { type: "done" }
            | { type: "error"; message: string };

          if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "outcome") {
            const card = toCard(event.outcome);
            setCards((current) =>
              current.map((existing) => (existing.poseId === card.poseId ? card : existing)),
            );
            if (card.state === "ok") {
              saved.push({
                id: card.id,
                createdAt: Date.now(),
                batchId: batchRef.current,
                title: title.trim() || "Untitled",
                garment,
                mode,
                poseId: card.poseId,
                poseName: card.poseName,
                scene: scene === "custom" ? customScene : scene,
                provider: card.provider,
                model: card.model,
                prompt: card.prompt,
                ms: card.ms,
                image: card.dataUrl,
                referenceThumb: refThumb,
              });
            }
          }
        }
      }

      if (saved.length) await saveRenders(saved).catch(() => undefined);
    } catch (problem) {
      const aborted = controller.signal.aborted;
      if (!aborted) {
        setError(problem instanceof Error ? problem.message : "The render failed.");
      }
      setCards((current) =>
        current.map((card) =>
          card.state === "pending"
            ? aborted
              ? { state: "cancelled", poseId: card.poseId, poseName: card.poseName }
              : { state: "failed", poseId: card.poseId, poseName: card.poseName, error: "Interrupted.", ms: 0 }
            : card,
        ),
      );
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  const finished = cards.filter((c) => c.state !== "pending").length;
  const okCards = cards.filter((c) => c.state === "ok").length;
  const banner = error ? explain(error) : null;

  return (
    <main className="mx-auto grid max-w-[1680px] grid-cols-1 lg:grid-cols-[440px_1fr]">
      {/* ── controls ─────────────────────────────────────────────── */}
      <div className="border-r border-line bg-surface lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <Section step={1} title="What are we shooting?">
          <TextInput
            label="Design or SKU"
            value={title}
            onChange={setTitle}
            placeholder="SLK-CTN-1774 · Red"
          />
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Every render is filed under this, so you can find it again and know which piece of stock
            it belongs to.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {GARMENTS.map((g) => (
              <Chip key={g.id} active={garment === g.id} onClick={() => setGarment(g.id)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section
          step={2}
          title="How should it be worn?"
          hint={
            mode === "mannequin"
              ? "Drape it on a mannequin for real and photograph it. The AI then replaces only the mannequin — the pleats, border and motif stay physically real."
              : mode === "person"
                ? "The garment goes onto the person in the photograph, and their face is preserved."
                : "No model photograph needed — the model is described in words and invented."
          }
        >
          <Segmented options={MODES} value={mode} onChange={setMode} />
        </Section>

        <Section
          step={3}
          title="Reference photographs"
          hint="Label each shot and the engine never has to guess which part is which. This is what keeps the motif yours."
          right={
            <span className="label">
              {referenceList.length} image{referenceList.length === 1 ? "" : "s"}
            </span>
          }
        >
          {mode === "mannequin" && (
            <div className="mb-4 w-44">
              <Dropzone
                label="On a mannequin"
                hint="Head to hem, draped as it should sell."
                required
                value={refs.mannequin}
                onPick={(image) => setRef("mannequin", image)}
                onClear={() => setRef("mannequin", null)}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {availableSlots.map((slot) => (
              <Dropzone
                key={slot.id}
                compact
                label={slot.label}
                value={refs[slot.id]}
                recommended={recommended.has(slot.id)}
                onPick={(image) => setRef(slot.id, image)}
                onClear={() => setRef(slot.id, null)}
              />
            ))}
            <Dropzone
              compact
              label="Extra"
              onPick={(image) =>
                setExtras((current) => [
                  ...current,
                  { ...image, slot: "extra", key: `extra-${current.length}-${Date.now()}` },
                ])
              }
            />
          </div>

          {extras.length > 0 && (
            <p className="mt-3 text-[13px] text-ink-faint">
              {extras.length} extra view{extras.length === 1 ? "" : "s"} attached ·{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-ink"
                onClick={() => setExtras([])}
              >
                clear
              </button>
            </p>
          )}

          {mode === "person" && (
            <div className="mt-5">
              <span className="label mb-2 block">The person wearing it</span>
              <div className="w-44">
                <Dropzone
                  compact
                  required
                  label="Person"
                  value={person ?? undefined}
                  onPick={setPerson}
                  onClear={() => setPerson(null)}
                />
              </div>
            </div>
          )}
        </Section>

        {mode !== "person" && (
          <Section
            step={4}
            title="The model"
            right={
              <button
                type="button"
                onClick={() => setFreeformModel((value) => !value)}
                className="text-[13px] text-ink-faint underline underline-offset-2 transition hover:text-ink"
              >
                {freeformModel ? "use fields" : "write it out"}
              </button>
            }
          >
            {freeformModel ? (
              <TextArea
                value={brief.freeform ?? ""}
                onChange={(value) => setBrief({ ...brief, freeform: value })}
                placeholder="a woman in her early 30s, tall, warm complexion, hair in a low bun, calm expression"
                rows={3}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Age"
                  value={brief.age ?? ""}
                  onChange={(value) => setBrief({ ...brief, age: value })}
                  placeholder="in her mid-20s"
                />
                <TextInput
                  label="Build"
                  value={brief.build ?? ""}
                  onChange={(value) => setBrief({ ...brief, build: value })}
                  placeholder="average height and build"
                />
                <TextInput
                  label="Complexion"
                  value={brief.complexion ?? ""}
                  onChange={(value) => setBrief({ ...brief, complexion: value })}
                  placeholder="warm Indian complexion"
                />
                <TextInput
                  label="Hair"
                  value={brief.hair ?? ""}
                  onChange={(value) => setBrief({ ...brief, hair: value })}
                  placeholder="dark hair worn down"
                />
              </div>
            )}
            <div className="mt-3">
              <TextInput
                label="Jewellery and styling"
                value={brief.styling ?? ""}
                onChange={(value) => setBrief({ ...brief, styling: value })}
                placeholder="gold jhumkas, choker, bangles"
              />
            </div>
          </Section>
        )}

        <Section step={mode === "person" ? 4 : 5} title="Scene">
          <div className="flex flex-wrap gap-2">
            {SCENES.map((s) => (
              <Chip key={s.id} active={scene === s.id} onClick={() => setScene(s.id)}>
                {s.name}
              </Chip>
            ))}
            <Chip active={scene === "custom"} onClick={() => setScene("custom")}>
              Custom
            </Chip>
          </div>
          {scene === "custom" && (
            <div className="mt-3">
              <TextArea
                value={customScene}
                onChange={setCustomScene}
                rows={2}
                placeholder="Describe the backdrop and the light."
              />
            </div>
          )}
        </Section>

        <Section
          step={mode === "person" ? 5 : 6}
          title="Poses"
          hint="One image per pose, all from the same photographs."
          right={
            <>
              <button
                type="button"
                onClick={() => setPoses(availablePoses.map((p) => p.id))}
                className="text-[13px] text-ink-faint underline underline-offset-2 transition hover:text-ink"
              >
                all
              </button>
              <button
                type="button"
                onClick={() => setPoses(DEFAULT_POSE_IDS)}
                className="text-[13px] text-ink-faint underline underline-offset-2 transition hover:text-ink"
              >
                reset
              </button>
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            {availablePoses.map((p) => (
              <Chip
                key={p.id}
                active={poses.includes(p.id)}
                onClick={() =>
                  setPoses((current) =>
                    current.includes(p.id) ? current.filter((id) => id !== p.id) : [...current, p.id],
                  )
                }
              >
                {p.name}
              </Chip>
            ))}
          </div>
        </Section>

        <Section step={mode === "person" ? 6 : 7} title="Quality and notes">
          <Segmented
            cols={2}
            options={[
              { value: "standard", label: "Standard", hint: "Fast and cheap. The usual choice." },
              { value: "high", label: "High", hint: "A hero shot, or a stubborn motif." },
            ]}
            value={quality}
            onChange={setQuality}
          />
          <div className="mt-4">
            <TextArea
              value={extraInstruction}
              onChange={setExtraInstruction}
              rows={2}
              placeholder="Anything else — 'the zari is gold, not yellow', 'keep the blouse sleeves short'."
            />
          </div>
        </Section>

        <div className="sticky bottom-0 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur">
          {running ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={stop}
                className="rounded-full border border-danger px-5 py-3 text-[15px] font-medium text-danger transition hover:bg-danger-wash"
              >
                Stop
              </button>
              <span className="text-[14px] text-ink-soft">
                Rendering {finished} of {cards.length}…
              </span>
            </div>
          ) : (
            <>
              {readyProblems.length > 0 && (
                <p className="mb-2.5 text-[13px] leading-relaxed text-ink-faint">
                  {readyProblems[0]}
                </p>
              )}
              <button
                type="button"
                disabled={readyProblems.length > 0}
                onClick={() => void run(poses)}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-accent px-5 py-3.5 text-[16px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
              >
                <span>
                  Generate {poses.length} image{poses.length === 1 ? "" : "s"}
                </span>
                {poses.length > 0 && readyProblems.length === 0 && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[13px]">
                    {formatCost(poses.length, quality)}
                  </span>
                )}
              </button>
              <p className="mt-2 text-center text-[12px] text-ink-faint">
                Estimated engine cost. Nothing is charged by this app.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── canvas ───────────────────────────────────────────────── */}
      <div className="p-6 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        {banner && (
          <div className="mb-5 rounded-2xl border border-danger/30 bg-danger-wash px-5 py-4">
            <p className="text-[15px] font-medium">{banner.headline}</p>
            {banner.advice && (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{banner.advice}</p>
            )}
          </div>
        )}

        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="display text-[24px]">{title.trim() || "Untitled design"}</h1>
              <span className="label">
                {okCards} of {cards.length} rendered
              </span>
            </div>
            <Results
              cards={cards}
              filenameStem={stem}
              onOpen={setOpenIndex}
              onRetry={(poseId) => void run([poseId])}
            />
          </>
        )}
      </div>

      {openIndex !== null && cards[openIndex]?.state === "ok" && (
        <Lightbox
          item={cards[openIndex] as Extract<RenderCard, { state: "ok" }>}
          reference={compareSource}
          filenameStem={`${stem}-${cards[openIndex].poseId}`}
          onClose={() => setOpenIndex(null)}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={openIndex < cards.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
        />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      <div className="max-w-xl">
        <h1 className="display text-[38px] leading-[1.15]">
          Photograph the garment.
          <br />
          <span className="text-madder">Not a guess at it.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-ink-soft">
          Load the pallu, the body, the border and the blouse as separate labelled shots. The engine
          is told what each one is, so it reproduces your motif instead of inventing something that
          merely rhymes with it.
        </p>

        <dl className="mx-auto mt-10 grid max-w-lg gap-x-8 gap-y-5 text-left sm:grid-cols-3">
          {[
            ["No model needed", "Describe who should wear it and the model is invented."],
            ["Or use a mannequin", "Drape it for real; only the mannequin gets replaced."],
            ["Nothing is thrown away", "Every render is kept, compared and re-runnable."],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-[14px] font-medium">{term}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-ink-faint">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

interface OutcomeWire {
  ok: boolean;
  poseId: string;
  poseName: string;
  prompt: string;
  provider: string;
  ms: number;
  data?: string;
  mime?: string;
  model?: string;
  error?: string;
}

function toCard(outcome: OutcomeWire): RenderCard {
  if (outcome.ok && outcome.data) {
    return {
      state: "ok",
      id: `${outcome.poseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      poseId: outcome.poseId,
      poseName: outcome.poseName,
      dataUrl: `data:${outcome.mime ?? "image/png"};base64,${outcome.data}`,
      prompt: outcome.prompt,
      provider: outcome.provider,
      model: outcome.model ?? "",
      ms: outcome.ms,
    };
  }
  return {
    state: "failed",
    poseId: outcome.poseId,
    poseName: outcome.poseName,
    error: outcome.error ?? "The engine returned no image.",
    ms: outcome.ms,
  };
}
