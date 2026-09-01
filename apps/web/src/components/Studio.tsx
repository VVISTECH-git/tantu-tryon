"use client";

import { useMemo, useRef, useState } from "react";
import {
  DEFAULT_POSE_IDS,
  GARMENTS,
  SCENES,
  SLOTS,
  garment as garmentDef,
  posesFor,
  scene as sceneDef,
  slotsFor,
} from "@tantu/engine/catalog";
import type { GarmentId, ModelBrief, RenderMode, SlotId } from "@tantu/engine/catalog";
import { Lightbox } from "./Lightbox";
import { Results } from "./Results";
import { CheckList, Select, TextArea, TextInput } from "./ui";
import { Disclosure } from "./studio/Disclosure";
import { ReferenceBoard, type RefImage } from "./studio/ReferenceBoard";
import type { RenderCard } from "./types";
import { saveRenders, type StoredRender } from "@/lib/library";
import { thumbnail, type LoadedImage } from "@/lib/image";
import { formatCost } from "@/lib/pricing";
import { explain } from "@/lib/errors";

const MODES: { value: RenderMode; label: string; hint: string }[] = [
  { value: "describe", label: "Describe a model", hint: "No model photo needed" },
  { value: "mannequin", label: "Mannequin → model", hint: "Highest fidelity" },
  { value: "person", label: "Try on a person", hint: "Dress a real photo" },
];

/** References are always sent in this order so the prompt's numbering is stable. */
const SLOT_ORDER = new Map(SLOTS.map((s, index) => [s.id, index]));

let nextId = 0;
const makeId = () => `ref-${++nextId}-${Date.now()}`;

export function Studio() {
  const [garment, setGarment] = useState<GarmentId>("saree");
  const [mode, setMode] = useState<RenderMode>("describe");
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [person, setPerson] = useState<LoadedImage | null>(null);
  const [brief, setBrief] = useState<ModelBrief>({});
  const [freeformModel, setFreeformModel] = useState(false);
  const [sceneId, setSceneId] = useState<string>("courtyard");
  const [customScene, setCustomScene] = useState("");
  const [poses, setPoses] = useState<string[]>(DEFAULT_POSE_IDS);
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [extraInstruction, setExtraInstruction] = useState("");

  const [cards, setCards] = useState<RenderCard[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [view, setView] = useState<"photos" | "results">("photos");

  const batchRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const availablePoses = useMemo(() => posesFor(garment), [garment]);

  const ordered = useMemo(
    () => [...refs].sort((a, b) => (SLOT_ORDER.get(a.slot) ?? 99) - (SLOT_ORDER.get(b.slot) ?? 99)),
    [refs],
  );

  /** The image a render gets judged against — the motif, wherever it lives. */
  const compareSource = useMemo(() => {
    const preferred: SlotId[] = ["body", "pallu", "weave", "full-drape", "mannequin"];
    for (const slot of preferred) {
      const found = refs.find((ref) => ref.slot === slot);
      if (found) return found.dataUrl;
    }
    return ordered[0]?.dataUrl;
  }, [refs, ordered]);

  /**
   * Downloads and library entries are named after the garment and the day.
   * There is no SKU field: this is a tool for anyone with product photographs,
   * not only for someone working from a catalogue with codes in it.
   */
  const garmentLabel = useMemo(() => garmentDef(garment).label, [garment]);
  const stem = garment;

  const problems = useMemo(() => {
    const list: string[] = [];
    if (refs.length === 0) list.push("Add at least one photograph of the garment.");
    if (poses.length === 0) list.push("Choose at least one pose.");
    if (mode === "person" && !person) list.push("Add the photograph of the person.");
    if (mode === "mannequin" && !refs.some((r) => r.slot === "mannequin")) {
      list.push("Add the mannequin photograph.");
    }
    return list;
  }, [refs, poses, mode, person]);

  // ── reference handling ──────────────────────────────────────────
  const setSlot = (slot: SlotId, image: LoadedImage) =>
    setRefs((current) => [
      ...current.filter((ref) => ref.slot !== slot || slot === "extra"),
      { ...image, id: makeId(), slot },
    ]);

  /**
   * A batch of photographs fills the empty slots this garment actually wants,
   * in order, and anything left over becomes an extra. Labels are corrected
   * afterwards on the tile, which is faster than picking a slot per file.
   */
  const addMany = (images: LoadedImage[]) =>
    setRefs((current) => {
      const wanted = slotsFor(garment)
        .filter((s) => s.id !== "extra" && s.id !== "mannequin")
        .map((s) => s.id);
      const next = [...current];
      for (const image of images) {
        const free = wanted.find((slot) => !next.some((ref) => ref.slot === slot));
        next.push({ ...image, id: makeId(), slot: free ?? "extra" });
      }
      return next;
    });

  const reassign = (id: string, slot: SlotId) =>
    setRefs((current) => {
      const moving = current.find((ref) => ref.id === id);
      if (!moving) return current;
      const occupant = slot !== "extra" ? current.find((ref) => ref.slot === slot) : undefined;
      return current.map((ref) => {
        if (ref.id === id) return { ...ref, slot };
        if (occupant && ref.id === occupant.id) return { ...ref, slot: moving.slot };
        return ref;
      });
    });

  const replace = (id: string, image: LoadedImage) =>
    setRefs((current) =>
      current.map((ref) => (ref.id === id ? { ...image, id: ref.id, slot: ref.slot } : ref)),
    );

  const remove = (id: string) => setRefs((current) => current.filter((ref) => ref.id !== id));

  // ── rendering ───────────────────────────────────────────────────
  function stop() {
    abortRef.current?.abort();
  }

  async function run(poseIds: string[]) {
    if (poseIds.length === 0) return;
    setError(null);
    setRunning(true);
    setView("results");

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
      references: ordered.map((ref) => ({ slot: ref.slot, data: ref.dataUrl })),
      person: person ? { slot: "extra" as SlotId, data: person.dataUrl } : undefined,
      model: freeformModel ? { freeform: brief.freeform, styling: brief.styling } : brief,
      scene: sceneId === "custom" ? customScene : sceneId,
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
            | { type: "start" }
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
                title: `${garmentLabel} · ${new Date(Date.now()).toLocaleDateString()}`,
                garment,
                mode,
                poseId: card.poseId,
                poseName: card.poseName,
                scene: sceneId === "custom" ? customScene : sceneId,
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
              : {
                  state: "failed",
                  poseId: card.poseId,
                  poseName: card.poseName,
                  error: "Interrupted.",
                  ms: 0,
                }
            : card,
        ),
      );
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  // ── summaries for the collapsed rows ────────────────────────────
  const modelSummary = brief.freeform?.trim()
    ? brief.freeform.trim()
    : [brief.age?.trim() || "a woman in her mid-20s", brief.styling?.trim() || "gold jhumkas"].join(
        " · ",
      );
  const sceneSummary = sceneId === "custom" ? customScene || "Describe it" : sceneDef(sceneId).name;
  const poseSummary =
    poses.length === 0
      ? "None chosen"
      : `${poses.length} pose${poses.length === 1 ? "" : "s"} · ${availablePoses
          .filter((p) => poses.includes(p.id))
          .map((p) => p.name)
          .join(", ")}`;
  const qualitySummary = `${quality === "high" ? "High" : "Standard"}${
    extraInstruction.trim() ? " · with notes" : ""
  }`;

  const finished = cards.filter((c) => c.state !== "pending").length;
  const okCards = cards.filter((c) => c.state === "ok").length;
  const banner = error ? explain(error) : null;

  return (
    <main className="mx-auto grid max-w-[1680px] grid-cols-1 lg:grid-cols-[380px_1fr]">
      {/* ── the shoot ─────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-line bg-surface lg:h-[calc(100vh-4rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-line-soft px-6 py-6">
            <Select
              label="What are you shooting?"
              value={garment}
              onChange={(value) => setGarment(value as GarmentId)}
              options={GARMENTS.map((g) => ({ value: g.id, label: g.label }))}
            />
          </div>

          <div className="border-b border-line-soft px-6 py-6">
            <span className="label mb-3 block">How it should be worn</span>
            <div className="grid gap-2">
              {MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${
                    mode === option.value
                      ? "border-accent bg-accent-wash"
                      : "border-line bg-surface hover:border-ink-faint"
                  }`}
                >
                  <span
                    className={`block text-[14px] font-medium ${
                      mode === option.value ? "text-accent" : "text-ink"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-faint">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* everything below has a working default */}
          {mode !== "person" && (
            <Disclosure title="The model" summary={modelSummary}>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFreeformModel((value) => !value)}
                  className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
                >
                  {freeformModel ? "use fields" : "write it out"}
                </button>
              </div>
              {freeformModel ? (
                <TextArea
                  value={brief.freeform ?? ""}
                  onChange={(value) => setBrief({ ...brief, freeform: value })}
                  placeholder="a woman in her early 30s, tall, warm complexion, hair in a low bun"
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
                    placeholder="average height"
                  />
                  <TextInput
                    label="Complexion"
                    value={brief.complexion ?? ""}
                    onChange={(value) => setBrief({ ...brief, complexion: value })}
                    placeholder="warm Indian"
                  />
                  <TextInput
                    label="Hair"
                    value={brief.hair ?? ""}
                    onChange={(value) => setBrief({ ...brief, hair: value })}
                    placeholder="worn down"
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
            </Disclosure>
          )}

          <Disclosure title="Scene" summary={sceneSummary}>
            <Select
              label="Backdrop"
              value={sceneId}
              onChange={setSceneId}
              options={[
                ...SCENES.map((s) => ({ value: s.id, label: s.name })),
                { value: "custom", label: "Custom — describe it" },
              ]}
            />
            {sceneId === "custom" && (
              <div className="mt-3">
                <TextArea
                  value={customScene}
                  onChange={setCustomScene}
                  rows={2}
                  placeholder="Describe the backdrop and the light."
                />
              </div>
            )}
          </Disclosure>

          <Disclosure title="Poses" summary={poseSummary}>
            <div className="mb-3 flex gap-3">
              <button
                type="button"
                onClick={() => setPoses(availablePoses.map((p) => p.id))}
                className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
              >
                all
              </button>
              <button
                type="button"
                onClick={() => setPoses(DEFAULT_POSE_IDS)}
                className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink"
              >
                reset
              </button>
            </div>
            <CheckList
              options={availablePoses.map((p) => ({ value: p.id, label: p.name }))}
              selected={poses}
              onToggle={(id) =>
                setPoses((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
            />
          </Disclosure>

          <Disclosure title="Quality" summary={qualitySummary}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "standard", label: "Standard", hint: "Fast and cheap" },
                  { value: "high", label: "High", hint: "A hero shot" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={quality === option.value}
                  onClick={() => setQuality(option.value)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${
                    quality === option.value
                      ? "border-accent bg-accent-wash"
                      : "border-line bg-surface hover:border-ink-faint"
                  }`}
                >
                  <span className="block text-[14px] font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-faint">{option.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <TextArea
                value={extraInstruction}
                onChange={setExtraInstruction}
                rows={2}
                placeholder="'the zari is gold, not yellow'"
              />
            </div>
          </Disclosure>
        </div>

        <div className="border-t border-line bg-surface px-6 py-4">
          {running ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={stop}
                className="rounded-full border border-danger px-5 py-3 text-[14px] font-medium text-danger transition hover:bg-danger-wash"
              >
                Stop
              </button>
              <span className="text-[14px] text-ink-soft">
                Rendering {finished} of {cards.length}…
              </span>
            </div>
          ) : (
            <>
              {problems.length > 0 && (
                <p className="mb-2.5 text-[13px] leading-relaxed text-ink-faint">{problems[0]}</p>
              )}
              <button
                type="button"
                disabled={problems.length > 0}
                onClick={() => void run(poses)}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-accent px-5 py-3.5 text-[16px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
              >
                <span>
                  Generate {poses.length} image{poses.length === 1 ? "" : "s"}
                </span>
                {poses.length > 0 && problems.length === 0 && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[13px]">
                    {formatCost(poses.length, quality)}
                  </span>
                )}
              </button>
              <p className="mt-2 text-center text-[13px] text-ink-faint">
                Estimated engine cost. Nothing is charged by this app.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── the canvas ────────────────────────────────────────────── */}
      <div className="p-6 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        {banner && (
          <div className="mb-5 rounded-xl border border-danger/30 bg-danger-wash px-5 py-4">
            <p className="text-[14px] font-medium">{banner.headline}</p>
            {banner.advice && (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{banner.advice}</p>
            )}
          </div>
        )}

        {cards.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="display text-[22px]">{garmentLabel}</h1>
            <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
              {(["photos", "results"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={view === tab}
                  onClick={() => setView(tab)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${
                    view === tab ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab === "photos" ? "Photographs" : "Renders"}
                </button>
              ))}
            </div>
            <span className="label">
              {okCards} of {cards.length} rendered
            </span>
          </div>
        )}

        {view === "results" && cards.length > 0 ? (
          <Results
            cards={cards}
            filenameStem={stem}
            onOpen={setOpenIndex}
            onRetry={(poseId) => void run([poseId])}
          />
        ) : (
          <ReferenceBoard
            garment={garment}
            mode={mode}
            refs={refs}
            person={person}
            onSet={setSlot}
            onAddMany={addMany}
            onReassign={reassign}
            onReplace={replace}
            onRemove={remove}
            onSetPerson={setPerson}
          />
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
