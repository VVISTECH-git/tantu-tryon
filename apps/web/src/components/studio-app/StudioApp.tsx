"use client";
/* eslint-disable @next/next/no-img-element -- the shell shows uploads, local dev renders and R2 objects at their own size; next/image would resample them. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CREDIT_PAISE, rupees, type Quality } from "@/content/credits";
import { DESCRIBED_FIELDS } from "@/content/garmentWords";
import { PACKS, inr } from "@/content/pricing";
import { ADULT_AGES, BACKGROUNDS, CHILD_AGES, TEMPLATES, type ModelType } from "@/content/promptTemplates";
import type { GenerationLook } from "@/db";
import * as api from "./api";
import { ConfirmModal, Copy, DownloadIcon, Modal, Question, RefreshIcon, Spinner, TipsModal, Title, YesNo } from "./screens";
import { T } from "./texts";
import { POSE_TILES, PRIMARY_PROMPT, type GarmentView, type RunView, type Screen } from "./types";

/**
 * The studio, as one screen that changes.
 *
 * Upload a saree, confirm what was seen, choose the model, the setting and
 * the size, get the first photograph, then more poses from the same saree.
 * Every step is a screen in this component; the record of what was made is
 * on the server, so a reload lands back where you were.
 */

interface Props {
  account: { id: string; name: string; kind: string };
  balancePaise: number;
  canDescribe: boolean;
}

interface Pending {
  file: File;
  preview: string;
}

type ModalKind = null | "tips" | "restart" | "regenerate" | "regeneratePose" | "tooLarge" | "limit" | "viewer";

const KIDS: ModelType[] = ["girl", "boy"];

export function StudioApp({ account, balancePaise: initialBalance, canDescribe }: Props) {
  const [screen, setScreen] = useState<Screen>("splash");
  const [stack, setStack] = useState<Screen[]>([]);
  const [garment, setGarment] = useState<GarmentView | null>(null);
  const [words, setWords] = useState<Record<string, string | null>>({});
  const [warnings, setWarnings] = useState<{ title: string; body: string }[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [look, setLook] = useState<GenerationLook>({ modelType: "woman", age: "mid-20s", background: "courtyard", quality: "standard" });
  const [batch, setBatch] = useState<string>(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())));
  const [primary, setPrimary] = useState<RunView | null>(null);
  const [poseRuns, setPoseRuns] = useState<RunView[]>([]);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [poseQuality, setPoseQuality] = useState<Quality>("standard");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [balance, setBalance] = useState(initialBalance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [viewer, setViewer] = useState<RunView | null>(null);
  const [regenTarget, setRegenTarget] = useState<RunView | null>(null);
  const [editingWords, setEditingWords] = useState(false);
  const [myImages, setMyImages] = useState<RunView[] | null>(null);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const restored = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const flatInput = useRef<HTMLInputElement>(null);
  const [flatSlot, setFlatSlot] = useState<string>("blouse");

  // ── Navigation ──────────────────────────────────────────────────────────

  const go = useCallback((next: Screen) => {
    setError(null);
    setStack((s) => [...s, screen]);
    setScreen(next);
  }, [screen]);

  function back() {
    setError(null);
    setStack((s) => {
      const prev = s[s.length - 1];
      if (prev) setScreen(prev);
      return s.slice(0, -1);
    });
  }

  // The URL as it was when the page opened, read once before anything below
  // rewrites it: the sync effect and the restore effect both touch it.
  const opened = useRef<URLSearchParams | null>(typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null);

  useEffect(() => {
    if (typeof window === "undefined" || !restored.current) return;
    const params = new URLSearchParams();
    if (garment) params.set("g", garment.id);
    if (garment && !["analyzing", "generating", "posesGenerating"].includes(screen)) params.set("s", screen);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/app?${query}` : "/app");
  }, [garment, screen]);

  // Reload: pick the garment and its runs back up from the URL.
  useEffect(() => {
    if (restored.current) return;
    const params = opened.current ?? new URLSearchParams();
    const g = params.get("g");
    const s = params.get("s") as Screen | null;
    if (!g) {
      restored.current = true;
      return;
    }
    void (async () => {
      try {
        const { garment: loaded, words: w } = await api.getGarment(g);
        setGarment(loaded);
        setWords(w);
        const runs = await api.listRuns(g);
        const done = runs.filter((r) => r.status === "done");
        const p = [...done].reverse().find((r) => r.promptId === PRIMARY_PROMPT) ?? null;
        setPrimary(p);
        setPoseRuns(runs.filter((r) => r.promptId !== PRIMARY_PROMPT));
        if (p) setLook(p.look);
        const allowed: Screen[] = ["confirm", "details", "flats", "model", "background", "output", "result", "poses", "gallery", "myImages", "profile", "pricing"];
        setScreen(s && allowed.includes(s) ? s : p ? "result" : "confirm");
      } catch {
        // A stale link: start over quietly.
      } finally {
        restored.current = true;
      }
    })();
  }, []);

  // The splash, then the studio. A tap skips the wait. Its own effect, so a
  // re-run in development (which cancels the first timer) simply sets another.
  useEffect(() => {
    if (screen !== "splash") return;
    const timer = setTimeout(() => setScreen((current) => (current === "splash" ? "upload" : current)), 2200);
    return () => clearTimeout(timer);
  }, [screen]);

  async function refreshBalance() {
    try {
      setBalance(await api.balance());
    } catch {
      // The header keeps the last number it knew.
    }
  }

  function resetAll() {
    setGarment(null);
    setWords({});
    setWarnings([]);
    setPending(null);
    setPrimary(null);
    setPoseRuns([]);
    setSelectedPoses(new Set());
    setBatch(crypto.randomUUID());
    setStack([]);
    setScreen("upload");
    setModal(null);
  }

  // ── Upload and analysis ─────────────────────────────────────────────────

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (/\.hei[cf]$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif") {
      setError("This photo is HEIC. Please export it as JPEG and upload again.");
      return;
    }
    if (file.size > 40_000_000) {
      setModal("tooLarge");
      return;
    }
    // Picking a photo goes straight into analysing — the reference has no
    // in-between "here's your photo, press Continue" step.
    setPending({ file, preview: URL.createObjectURL(file) });
    void uploadAndAnalyze(file);
  }

  async function uploadAndAnalyze(file: File) {
    setBusy(true);
    setError(null);
    try {
      const g = await api.uploadPart(file, "saree", garment?.source === "upload" ? garment.id : null);
      setGarment(g);
      setPrimary(null);
      setPoseRuns([]);
      setBatch(crypto.randomUUID());
      go("analyzing");
      const analysis = await api.analyze(g.id);
      setGarment(analysis.garment);
      setWords(analysis.words);
      setWarnings(analysis.warnings);
      if (analysis.readerError && canDescribe) setError(analysis.readerError);
      setScreen("confirm");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : T.confirm.error);
      setScreen("upload");
    } finally {
      setBusy(false);
    }
  }

  async function fromCode() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const g = await api.startFromCode(code.trim());
      setGarment(g);
      setPrimary(null);
      setPoseRuns([]);
      go("analyzing");
      const analysis = await api.analyze(g.id);
      setGarment(analysis.garment);
      setWords(analysis.words);
      setWarnings(analysis.warnings);
      setScreen("confirm");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The lookup failed.");
      setScreen("upload");
    } finally {
      setBusy(false);
    }
  }

  async function pickFlat(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !garment) return;
    setBusy(true);
    setError(null);
    try {
      setGarment(await api.uploadPart(file, flatSlot, garment.id));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearFlat(slot: string) {
    if (!garment) return;
    setGarment(await api.patchGarment(garment.id, { rotations: {}, ...({ removeSlots: [slot] } as object) }));
  }

  async function answer(key: string, value: boolean) {
    if (!garment) return;
    const next = { ...garment.answers, [key]: value } as Record<string, boolean>;
    setGarment({ ...garment, answers: next });
    await api.patchGarment(garment.id, { answers: next });
  }

  async function saveWords(overrides: Record<string, string>) {
    if (!garment) return;
    const g = await api.patchGarment(garment.id, { words: overrides });
    setGarment(g);
    const { words: w } = await api.getGarment(g.id);
    setWords(w);
  }

  async function readAgain() {
    if (!garment) return;
    setBusy(true);
    try {
      const analysis = await api.analyze(garment.id);
      setGarment(analysis.garment);
      setWords(analysis.words);
      if (analysis.readerError) setError(analysis.readerError);
    } finally {
      setBusy(false);
    }
  }

  // ── Generation ──────────────────────────────────────────────────────────

  async function generatePrimary(fresh = false) {
    if (!garment) return;
    const key = fresh ? `again-${crypto.randomUUID()}` : `${batch}-${PRIMARY_PROMPT}`;
    setModal(null);
    go("generating");
    setBusy(true);
    try {
      const run = await api.generate(garment.id, PRIMARY_PROMPT, look, key);
      setPrimary(run);
      setScreen("result");
    } catch (problem) {
      setPrimary({
        id: "",
        status: "failed",
        imageUrl: null,
        error: problem instanceof Error ? problem.message : T.generate.failed,
        ms: null,
        model: "",
        promptId: PRIMARY_PROMPT,
        promptVersion: "",
        look,
        verdict: null,
        note: "",
        startedAt: new Date().toISOString(),
        clientKey: key,
        creditsPaise: 0,
      });
      setScreen("result");
    } finally {
      setBusy(false);
      void refreshBalance();
    }
  }

  async function generatePoses() {
    if (!garment || selectedPoses.size === 0) return;
    const poseLook: GenerationLook = { ...look, quality: poseQuality };
    const cost = selectedPoses.size * CREDIT_PAISE[poseQuality];
    if (cost > balance) {
      setModal("limit");
      return;
    }
    const round = crypto.randomUUID().slice(0, 8);
    go("posesGenerating");
    setBusy(true);
    const queue = [...selectedPoses].sort();
    const results: RunView[] = [];
    const worker = async () => {
      for (;;) {
        const promptId = queue.shift();
        if (!promptId) return;
        try {
          results.push(await api.generate(garment.id, promptId, poseLook, `${batch}-${round}-${promptId}`));
        } catch (problem) {
          results.push({
            id: "",
            status: "failed",
            imageUrl: null,
            error: problem instanceof Error ? problem.message : T.generate.failed,
            ms: null,
            model: "",
            promptId,
            promptVersion: "",
            look: poseLook,
            verdict: null,
            note: "",
            startedAt: new Date().toISOString(),
            clientKey: "",
            creditsPaise: 0,
          });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setPoseRuns((prev) => [...prev, ...results]);
    setGalleryIndex(Math.max(0, poseRuns.length));
    setSelectedPoses(new Set());
    setBusy(false);
    void refreshBalance();
    setScreen("gallery");
  }

  async function regeneratePose(run: RunView) {
    if (!garment) return;
    setModal(null);
    setBusy(true);
    try {
      const fresh = await api.generate(garment.id, run.promptId, run.look, `again-${crypto.randomUUID()}`);
      setPoseRuns((prev) => [...prev, fresh]);
      setGalleryIndex(poseRuns.length);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : T.generate.failed);
    } finally {
      setBusy(false);
      void refreshBalance();
    }
  }

  async function rate(run: RunView, verdict: RunView["verdict"]) {
    if (!run.id) return;
    const next = run.verdict === verdict ? null : verdict;
    setPrimary((p) => (p && p.id === run.id ? { ...p, verdict: next } : p));
    setPoseRuns((rs) => rs.map((r) => (r.id === run.id ? { ...r, verdict: next } : r)));
    await api.setVerdict(run.id, next);
  }

  async function openMyImages() {
    go("myImages");
    setMyImages(null);
    try {
      setMyImages(await api.listAll());
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load your images.");
      setMyImages([]);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────

  const flat = garment?.parts.find((p) => p.slot === "saree") ?? garment?.parts.find((p) => p.slot === "body");
  const livePoses = useMemo(() => TEMPLATES.filter((t) => t.live && t.id !== PRIMARY_PROMPT), []);
  const showBack = stack.length > 0 && !["analyzing", "generating", "posesGenerating"].includes(screen);
  const splash = screen === "splash";
  const gallery = poseRuns;
  const current = gallery[Math.min(galleryIndex, Math.max(0, gallery.length - 1))];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="st">
      <div className="st-shell">
        {splash && (
          <div className="st-splash" onClick={() => setScreen("upload")} role="button" aria-label="Enter the studio">
            <div className="st-splash-brand">
              <TantuMark />
              <h1 className="st-splash-name">{T.splash.name}</h1>
              <p className="st-splash-tagline">{T.splash.tagline}</p>
            </div>
            <div className="st-splash-shots" aria-hidden>
              {SPLASH_SHOTS.map((src, i) => (
                <div key={i} className="st-splash-shot">
                  <img src={src} alt="" />
                </div>
              ))}
            </div>
          </div>
        )}
        {!splash && (
        <header className="st-header">
          <div className="st-header-main">
            {showBack && (
              <button type="button" className="st-icon-button st-icon-button--back" onClick={back} aria-label={T.header.back}>
                <span className="arrow">‹</span>
                <span className="label">{T.header.back}</span>
              </button>
            )}
            {garment && screen !== "upload" && (
              <button type="button" className="st-icon-button st-icon-button--new" onClick={() => setModal("restart")} aria-label={T.header.newGarment} title={T.header.newGarment}>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M8.4 5.2 5 7.4l2 3v8.4h10v-8.4l2-3-3.4-2.2-2.1 1.3a3 3 0 0 1-3 0Z" style={{ stroke: "rgba(244,236,255,0.92)", strokeWidth: 1.9 }} />
                  <circle cx="16.6" cy="16.6" r="4" style={{ fill: "#f08d42", stroke: "rgba(255,225,196,0.65)", strokeWidth: 1.1 }} />
                  <path d="M16.6 14.3v4.6M14.3 16.6h4.6" style={{ stroke: "#1a1110", strokeWidth: 2 }} />
                </svg>
              </button>
            )}
          </div>
          <div className="st-header-center">
            <div className="st-brand" aria-label="Tantu studio home">
              <span className="st-brand-mark">Tantu</span>
              <small>{T.header.appLabel}</small>
            </div>
          </div>
          <div className="st-header-actions">
            <span className="st-status-chip">{T.status.trial}</span>
            <button type="button" className="st-icon-button st-icon-button--profile" onClick={() => go("profile")} aria-label={T.profile.title}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 19.5c1.4-3.4 4-5 7-5s5.6 1.6 7 5" />
              </svg>
            </button>
          </div>
        </header>
        )}

        {!splash && (
        <main className="st-main">
          {error && <p className="st-error">{error}</p>}


          {screen === "upload" && (
            <div className="st-center" style={{ gap: 18 }}>
              <div>
                <Title>{T.upload.title}</Title>
                <p className="st-copy" style={{ marginTop: 6 }}>
                  {T.upload.copy}
                </p>
              </div>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
              <div className="st-grow" style={{ width: "100%" }}>
                <div className="st-callout">
                  {T.upload.calloutPrefix}{" "}
                  <button type="button" className="st-link" onClick={() => setModal("tips")}>
                    {T.upload.seeTips}
                  </button>{" "}
                  {T.upload.calloutSuffix}
                </div>
                <button type="button" className="st-action" style={{ maxWidth: 300 }} onClick={() => fileInput.current?.click()}>
                  {T.upload.dropzone}
                </button>
                <p className="st-support">{T.upload.dropzoneCopy}</p>
              </div>
            </div>
          )}

          {screen === "analyzing" && <Spinner text={T.confirm.analyzing} sub={T.confirm.analyzingMobile} />}

          {screen === "confirm" && garment && (
            <div className="st-stack">
              <Title>{T.confirm.title}</Title>
              <Copy>{T.confirm.copy}</Copy>
              {flat && (
                <div className="st-frame st-frame--contain" style={{ maxHeight: 300 }}>
                  <img src={flat.url} alt="Garment image" style={{ transform: `rotate(${flat.rotate}deg)` }} />
                </div>
              )}
<GarmentTypeSelect />
              {warnings.map((w) => (
                <div key={w.title} className="st-warning">
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="st-chip" onClick={() => setModal("tips")}>
                      {T.confirm.seeTips}
                    </button>
                    <button type="button" className="st-chip st-chip--accent" onClick={() => { setPending(null); setScreen("upload"); }}>
                      {T.confirm.uploadBetter}
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="st-action" onClick={() => go("details")}>
                {T.confirm.continue}
              </button>
            </div>
          )}

          {screen === "details" && garment && (
            <div className="st-stack">
              <Title>{T.details.title}</Title>
              <Copy>{T.details.copy}</Copy>
              <Question label={T.details.borders.label} help={T.details.borders.help}>
                <YesNo value={garment.answers.borders ?? true} onChange={(v) => void answer("borders", v)} />
              </Question>
              <Question label={T.details.bordersIdentical.label} help={T.details.bordersIdentical.help}>
                <YesNo value={garment.answers.bordersIdentical ?? true} onChange={(v) => void answer("bordersIdentical", v)} />
              </Question>
              <Question label={T.details.blouseSame.label} help={T.details.blouseSame.help}>
                <YesNo value={garment.answers.blouseSameAsBody ?? true} onChange={(v) => void answer("blouseSameAsBody", v)} />
              </Question>
              <div className="st-question">
                <div className="st-section-head">
                  <div className="st-question-label">{T.details.words.label}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {canDescribe && (
                      <button type="button" className="st-chip" disabled={busy} onClick={() => void readAgain()}>
                        {busy ? "…" : T.details.words.readAgain}
                      </button>
                    )}
                    <button type="button" className="st-chip st-chip--accent" onClick={() => setEditingWords((e) => !e)}>
                      {editingWords ? T.details.words.done : T.details.words.edit}
                    </button>
                  </div>
                </div>
                <div className="st-question-hint">{T.details.words.help}</div>
                {!editingWords ? (
                  <div className="st-list" style={{ gap: 6 }}>
                    {(["body", "pallu", "border", "blouse"] as const).map((part) => {
                      const colour = words[`${part}Colour`];
                      const desc = words[`${part}Desc`];
                      return (
                        <div key={part} style={{ fontSize: 13, lineHeight: 1.4 }}>
                          <b style={{ textTransform: "capitalize" }}>{part}</b>{" "}
                          {colour ? <span style={{ color: "#f0b17e" }}>{colour}</span> : <span className="st-muted">colour?</span>} <span className="st-soft">{desc}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <WordsEditor garment={garment} words={words} onSave={saveWords} />
                )}
              </div>
              <button type="button" className="st-action" onClick={() => go("flats")}>
                {T.common.continue}
              </button>
            </div>
          )}

          {screen === "flats" && garment && (
            <div className="st-stack">
              <Title>{T.flats.title}</Title>
              <Copy>{T.flats.copy}</Copy>
              <input ref={flatInput} type="file" accept="image/*" hidden onChange={(e) => void pickFlat(e)} />
              {(["blouse", "pallu", "border"] as const).map((slot) => {
                const part = garment.parts.find((p) => p.slot === slot);
                const item = T.flats.items[slot];
                if (slot === "blouse" && garment.answers.blouseSameAsBody) return null;
                return (
                  <div key={slot} className="st-thumb-card">
                    <button type="button" className="st-thumb" onClick={() => { setFlatSlot(slot); flatInput.current?.click(); }}>
                      {part ? <img src={part.url} alt="" /> : <span className="st-thumb-empty">{T.flats.empty}</span>}
                    </button>
                    <div className="st-stack" style={{ gap: 6 }}>
                      <div className="st-tile-top">
                        <span className="st-tile-label" style={{ fontSize: 14 }}>{item.label}</span>
                        <span className="st-badge st-badge--soft">{T.flats.optional}</span>
                      </div>
                      <span className="st-tile-help" style={{ fontSize: 12 }}>{item.help}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="st-chip st-chip--accent" disabled={busy} onClick={() => { setFlatSlot(slot); flatInput.current?.click(); }}>
                          {part ? T.flats.change : T.flats.upload}
                        </button>
                        {part && (
                          <button type="button" className="st-chip" disabled={busy} onClick={() => void clearFlat(slot)}>
                            {T.flats.clear}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="st-action" disabled={busy} onClick={() => go("model")}>
                {T.common.continue}
              </button>
            </div>
          )}

          {screen === "model" && (
            <div className="st-stack">
              <Title>{T.model.title}</Title>
              <Copy>{T.model.copy}</Copy>
              <ModelGroup title={T.model.women} type="woman" ages={ADULT_AGES} look={look} onPick={(modelType, age) => setLook({ ...look, modelType, age })} />
              <ModelGroup title={T.model.men} type="man" ages={ADULT_AGES} look={look} onPick={(modelType, age) => setLook({ ...look, modelType, age })} />
              <div className="st-section-title">{T.model.kids}</div>
              <div className="st-grid-3">
                {KIDS.flatMap((type) =>
                  CHILD_AGES.map((age) => (
                    <ModelCard key={`${type}-${age}`} type={type} age={age} selected={look.modelType === type && look.age === age} onClick={() => setLook({ ...look, modelType: type, age })} />
                  )),
                )}
              </div>
              <p className="st-support">{T.model.fixed}</p>
              <button type="button" className="st-action" onClick={() => go("background")}>
                {T.common.continue}
              </button>
            </div>
          )}

          {screen === "background" && (
            <div className="st-stack">
              <Title>{T.background.title}</Title>
              <Copy>{T.background.copy}</Copy>
              <div className="st-list">
                {BACKGROUNDS.map((b, i) => (
                  <button key={b.id} type="button" className={`st-tile ${look.background === b.id ? "is-selected" : ""}`} onClick={() => setLook({ ...look, background: b.id })}>
                    <div className="st-tile-thumb" style={{ background: swatch(b.id), minHeight: 96 }} />
                    <div className="st-tile-body">
                      <div className="st-tile-top">
                        <span className="st-tile-label">{b.label}</span>
                        {i === 0 && <span className="st-badge">{T.background.best}</span>}
                      </div>
                      <span className="st-tile-help">{b.scene.replaceAll("{her}", "her")}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" className="st-action" onClick={() => go("output")}>
                {T.common.continue}
              </button>
            </div>
          )}

          {screen === "output" && (
            <div className="st-stack">
              <Title>{T.output.title}</Title>
              <Copy>{T.output.copy}</Copy>
              <div className="st-section-title">{T.output.resolution}</div>
              <div className="st-grid-2">
                {(["standard", "high"] as Quality[]).map((q) => (
                  <button key={q} type="button" className={`st-choice ${look.quality === q ? "is-selected" : ""}`} onClick={() => setLook({ ...look, quality: q })}>
                    {q === "standard" && <span className="st-badge" style={{ marginBottom: 2 }}>{T.output.recommended}</span>}
                    <span className="st-choice-label">{q === "standard" ? "1K" : "2K"}</span>
                    <span className="st-choice-help">
                      {q === "standard" ? T.output.help1k : T.output.help2k} · {rupees(CREDIT_PAISE[q])}
                    </span>
                  </button>
                ))}
              </div>
              <div className="st-section-title">{T.output.aspect}</div>
              <div className="st-grid-3">
                <button type="button" className="st-choice is-selected">
                  <span className="st-choice-label">3:4</span>
                  <span className="st-choice-help">{T.output.portrait}</span>
                </button>
                {["1:1", "9:16"].map((ratio) => (
                  <button key={ratio} type="button" className="st-choice" disabled>
                    <span className="st-choice-label">{ratio}</span>
                    <span className="st-choice-help">{T.output.soon}</span>
                  </button>
                ))}
              </div>
              <p className="st-support">{balance < CREDIT_PAISE[look.quality] ? T.output.exhausted : T.output.trialHint}</p>
              <button type="button" className="st-action" disabled={busy || balance < CREDIT_PAISE[look.quality]} onClick={() => void generatePrimary()}>
                {T.generate.action} · {rupees(CREDIT_PAISE[look.quality])}
              </button>
            </div>
          )}

          {screen === "generating" && <Spinner text={T.generate.processing} sub={T.generate.processingMobile} />}

          {screen === "result" && primary && (
            <div className="st-stack">
              {primary.status === "done" ? (
                <>
                  <Title>{T.generate.title}</Title>
                  <Copy>{T.generate.copy}</Copy>
                  <div className="st-frame">
                    {primary.imageUrl && <img src={primary.imageUrl} alt="Generated image" onClick={() => { setViewer(primary); setModal("viewer"); }} />}
                    {primary.imageUrl && (
                      <a className="st-frame-button" href={primary.imageUrl} download target="_blank" rel="noopener" title={T.generate.download}>
                        <DownloadIcon />
                      </a>
                    )}
                    <button type="button" className="st-frame-button st-frame-button--second" title="Regenerate" onClick={() => setModal("regenerate")}>
                      <RefreshIcon />
                    </button>
                  </div>
                  <div className="st-center" style={{ gap: 6 }}>
                    <span className="st-caption">{T.generate.rate}</span>
                    <div className="st-rate" role="group" aria-label={T.generate.rate}>
                      <button type="button" className={primary.verdict === "approved" ? "is-selected" : ""} title={T.generate.up} onClick={() => void rate(primary, "approved")}>👍</button>
                      <button type="button" className={primary.verdict === null ? "is-selected" : ""} title={T.generate.neutral} onClick={() => void rate(primary, null)}>😐</button>
                      <button type="button" className={primary.verdict === "rejected" ? "is-selected" : ""} title={T.generate.down} onClick={() => void rate(primary, "rejected")}>👎</button>
                    </div>
                  </div>
                  <button type="button" className="st-action" onClick={() => go("poses")}>
                    {T.generate.poses}
                  </button>
                  <button type="button" className="st-secondary" onClick={() => setModal("restart")}>
                    {T.generate.restart}
                  </button>
                </>
              ) : (
                <>
                  <Title>{primary.status === "refused" ? T.generate.blockedTitle : T.generate.failedTitle}</Title>
                  <div className="st-warning">
                    <p>{primary.status === "refused" ? T.generate.blocked : primary.error ?? T.generate.failed}</p>
                    <p className="st-muted">{T.generate.notCharged}</p>
                  </div>
                  <button type="button" className="st-action" disabled={busy} onClick={() => void generatePrimary(true)}>
                    {T.generate.tryAgain}
                  </button>
                  <button type="button" className="st-secondary" onClick={() => setModal("restart")}>
                    {T.generate.restart}
                  </button>
                </>
              )}
            </div>
          )}

          {screen === "poses" && (
            <div className="st-stack">
              <div className="st-section-head">
                <span style={{ width: 70 }} />
                <Title>{T.poses.title}</Title>
                <div className="st-toggle" style={{ padding: 2 }}>
                  {(["standard", "high"] as Quality[]).map((q) => (
                    <button key={q} type="button" className={poseQuality === q ? "is-selected" : ""} style={{ minWidth: 34, minHeight: 24, fontSize: 10, fontWeight: 700, padding: "0 8px" }} onClick={() => setPoseQuality(q)}>
                      {q === "standard" ? "1K" : "2K"}
                    </button>
                  ))}
                </div>
              </div>
              <Copy>{T.poses.copy}</Copy>
              {(["front", "side", "back", "garment"] as const).map((group) => {
                const items = livePoses.filter((t) => POSE_TILES[t.id]?.group === group);
                if (!items.length) return null;
                return (
                  <div key={group} className="st-stack" style={{ gap: 8 }}>
                    <div className="st-section-title">{T.poses.groups[group]}</div>
                    {items.map((t) => {
                      const tile = POSE_TILES[t.id]!;
                      const on = selectedPoses.has(t.id);
                      return (
                        <button key={t.id} type="button" className={`st-tile ${on ? "is-selected" : ""}`} onClick={() => setSelectedPoses((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}>
                          <div className="st-tile-thumb st-tile-thumb--pose" style={{ background: "#f4efe6" }}>
                            {tile.silhouette ? <img src={tile.silhouette} alt="" style={{ objectFit: "contain", padding: 4 }} /> : <span className="st-thumb-empty" style={{ color: "#57534e" }}>{t.id}</span>}
                          </div>
                          <div className="st-tile-body">
                            <div className="st-tile-top">
                              <span className="st-tile-label">{t.title}</span>
                              {t.frozen && <span className="st-badge st-badge--violet">v{t.frozen.version}</span>}
                            </div>
                            <span className="st-tile-help">{t.summary}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <p className="st-support">
                {selectedPoses.size} × {rupees(CREDIT_PAISE[poseQuality])} = {rupees(selectedPoses.size * CREDIT_PAISE[poseQuality])}
              </p>
              <button type="button" className="st-action" disabled={busy || selectedPoses.size === 0} onClick={() => void generatePoses()}>
                {T.poses.generate}
              </button>
            </div>
          )}

          {screen === "posesGenerating" && <Spinner text={T.poses.processing} sub={T.generate.processingMobile} />}

          {screen === "gallery" && (
            <div className="st-stack">
              <Title>{T.gallery.title}</Title>
              <Copy>{T.gallery.copy}</Copy>
              {current ? (
                <>
                  <div className="st-frame">
                    {current.status === "done" && current.imageUrl ? (
                      <img src={current.imageUrl} alt={`${current.promptId} photograph`} onClick={() => { setViewer(current); setModal("viewer"); }} />
                    ) : (
                      <div className="st-frame-empty">
                        <div>
                          <b style={{ color: "#ffb4b4" }}>{current.status === "refused" ? T.generate.blockedTitle : T.generate.failedTitle}</b>
                          <div style={{ marginTop: 6 }}>{current.error ?? T.generate.failed}</div>
                          <div className="st-muted" style={{ marginTop: 6 }}>{T.generate.notCharged}</div>
                        </div>
                      </div>
                    )}
                    {current.imageUrl && (
                      <a className="st-frame-button" href={current.imageUrl} download target="_blank" rel="noopener" title={T.gallery.download}>
                        <DownloadIcon />
                      </a>
                    )}
                    <button type="button" className="st-frame-button st-frame-button--second" title="Regenerate" onClick={() => { setRegenTarget(current); setModal("regeneratePose"); }}>
                      <RefreshIcon />
                    </button>
                    {gallery.length > 1 && (
                      <>
                        <button type="button" className="st-arrow st-arrow--left" disabled={galleryIndex === 0} onClick={() => setGalleryIndex((i) => i - 1)} aria-label={T.gallery.previous}>‹</button>
                        <button type="button" className="st-arrow st-arrow--right" disabled={galleryIndex >= gallery.length - 1} onClick={() => setGalleryIndex((i) => i + 1)} aria-label={T.gallery.next}>›</button>
                      </>
                    )}
                  </div>
                  <div className="st-dots">
                    {gallery.map((r, i) => (
                      <span key={r.id || i} className={`st-dot ${i === galleryIndex ? "is-active" : ""}`} />
                    ))}
                  </div>
                  <p className="st-caption">
                    {TEMPLATES.find((t) => t.id === current.promptId)?.title ?? current.promptId} · {current.look.quality === "high" ? "2K" : "1K"}
                  </p>
                  {current.status === "done" && (
                    <div className="st-rate" role="group" aria-label={T.generate.rate}>
                      <button type="button" className={current.verdict === "approved" ? "is-selected" : ""} title={T.generate.up} onClick={() => void rate(current, "approved")}>👍</button>
                      <button type="button" className={current.verdict === null ? "is-selected" : ""} title={T.generate.neutral} onClick={() => void rate(current, null)}>😐</button>
                      <button type="button" className={current.verdict === "rejected" ? "is-selected" : ""} title={T.generate.down} onClick={() => void rate(current, "rejected")}>👎</button>
                    </div>
                  )}
                </>
              ) : (
                <p className="st-copy">{T.poses.empty}</p>
              )}
              <button type="button" className="st-action" onClick={() => go("poses")}>
                {T.gallery.more}
              </button>
              {gallery.some((r) => r.imageUrl) && (
                <button type="button" className="st-secondary" onClick={() => gallery.forEach((r) => r.imageUrl && window.open(r.imageUrl, "_blank", "noopener"))}>
                  {T.gallery.downloadAll}
                </button>
              )}
            </div>
          )}

          {screen === "myImages" && (
            <div className="st-stack">
              <Title>{T.myImages.title}</Title>
              <Copy>{T.myImages.copy}</Copy>
              {myImages === null ? (
                <Spinner text={T.common.loading} />
              ) : myImages.length === 0 ? (
                <p className="st-copy">{T.myImages.empty}</p>
              ) : (
                <div className="st-gallery">
                  {myImages.map((r) => (
                    <button key={r.id} type="button" className="st-frame" style={{ padding: 0 }} onClick={() => { setViewer(r); setModal("viewer"); }}>
                      {r.imageUrl && <img src={r.imageUrl} alt="" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {screen === "profile" && (
            <div className="st-stack">
              <Title>{T.profile.title}</Title>
              <Copy>{T.profile.copy}</Copy>
              <div className="st-card">
                <Row label={T.profile.number} value={account.kind === "shared" ? "Studio passcode" : account.name} />
                <Row label={T.profile.plan} value={<span className="st-badge st-badge--soft">{T.profile.trial}</span>} />
                <Row label={T.profile.remaining} value={rupees(balance)} />
                <div className="st-question-hint">{T.profile.possible}</div>
                <div className="st-grid-2">
                  <div className="st-row" style={{ display: "grid", gap: 4 }}>
                    <span className="st-soft" style={{ fontSize: 12 }}>1K</span>
                    <b style={{ fontSize: 20 }}>{Math.floor(balance / CREDIT_PAISE.standard)}</b>
                  </div>
                  <div className="st-row" style={{ display: "grid", gap: 4 }}>
                    <span className="st-soft" style={{ fontSize: 12 }}>2K</span>
                    <b style={{ fontSize: 20 }}>{Math.floor(balance / CREDIT_PAISE.high)}</b>
                  </div>
                </div>
              </div>
              <div className="st-section-title">{T.profile.links}</div>
              <div className="st-list">
                <button type="button" className="st-row" onClick={() => void openMyImages()}>
                  <b>{T.profile.gallery}</b>
                  <span className="st-muted">›</span>
                </button>
                <button type="button" className="st-row" onClick={() => go("pricing")}>
                  <b>{T.pricing.title}</b>
                  <span className="st-muted">›</span>
                </button>
                {account.kind === "shared" && (
                  <a className="st-row" href="/admin/spend" style={{ textDecoration: "none", color: "inherit" }}>
                    <b>{T.profile.spend}</b>
                    <span className="st-muted">↗</span>
                  </a>
                )}
              </div>
              <button type="button" className="st-secondary" onClick={async () => { await api.logout(); /* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload clears every piece of studio state after sign-out */ window.location.href = "/app"; }}>
                {T.profile.logout}
              </button>
            </div>
          )}

          {screen === "pricing" && (
            <div className="st-stack">
              <Title>{T.pricing.title}</Title>
              <Copy>{T.pricing.copy}</Copy>
              {PACKS.map((pack) => (
                <div key={pack.id} className="st-card" style={{ borderColor: pack.featured ? "rgba(240,141,66,0.5)" : undefined }}>
                  <div className="st-tile-top">
                    <div>
                      <div className="st-tile-label">{pack.name}</div>
                      <div className="st-tile-help">{pack.images} images · {pack.microcopy}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{inr(pack.inr)}</div>
                  </div>
                  <a className="st-secondary" style={{ display: "grid", placeItems: "center", textDecoration: "none" }} href={`/contact?pack=${pack.id}`}>
                    {T.pricing.ask}
                  </a>
                </div>
              ))}
              <p className="st-support">{T.pricing.note}</p>
            </div>
          )}
        </main>
        )}

        {!splash && (
        <footer className="st-footer">
          <div className="st-footer-row">
            <button type="button" className="st-footer-chip st-footer-chip--balance" onClick={() => go("profile")}>
              {T.footer.balance(rupees(balance))}
            </button>
            <button type="button" className="st-footer-chip st-footer-chip--recharge" onClick={() => go("pricing")}>
              {T.footer.recharge}
            </button>
          </div>
          <button type="button" className="st-buy" onClick={() => go("pricing")}>
            {T.footer.buy}
          </button>
        </footer>
        )}
      </div>

      {modal === "tips" && <TipsModal index={tipIndex} onIndex={setTipIndex} onClose={() => setModal(null)} />}
      {modal === "restart" && (
        <ConfirmModal icon="👗" title={T.generate.restartTitle} message={T.generate.restartMessage} confirm={T.generate.restartButton} onConfirm={resetAll} onClose={() => setModal(null)} />
      )}
      {modal === "regenerate" && (
        <ConfirmModal icon="↻" title={T.generate.regenerateTitle} message={`${T.generate.regenerateMessage} (${rupees(CREDIT_PAISE[look.quality])})`} confirm={T.generate.action} onConfirm={() => void generatePrimary(true)} onClose={() => setModal(null)} />
      )}
      {modal === "regeneratePose" && regenTarget && (
        <ConfirmModal icon="↻" title={T.gallery.regenerateTitle} message={`${T.gallery.regenerateMessage} (${rupees(CREDIT_PAISE[regenTarget.look.quality])})`} confirm={T.generate.action} onConfirm={() => void regeneratePose(regenTarget)} onClose={() => setModal(null)} />
      )}
      {modal === "tooLarge" && (
        <Modal title={T.upload.tooLargeTitle} onClose={() => setModal(null)}>
          <p className="st-modal-message">{T.upload.tooLarge}</p>
          <button type="button" className="st-action st-action--compact" onClick={() => { setModal(null); fileInput.current?.click(); }}>
            {T.upload.tooLargeButton}
          </button>
        </Modal>
      )}
      {modal === "limit" && (
        <Modal title={T.poses.limitTitle} onClose={() => setModal(null)}>
          <p className="st-modal-message">{T.poses.limit(Math.floor(balance / CREDIT_PAISE[poseQuality]))}</p>
          <div className="st-stack">
            <button type="button" className="st-action st-action--compact" onClick={() => { setModal(null); go("pricing"); }}>
              {T.poses.recharge}
            </button>
            <button type="button" className="st-secondary" onClick={() => setModal(null)}>
              {T.common.ok}
            </button>
          </div>
        </Modal>
      )}
      {modal === "viewer" && viewer?.imageUrl && (
        <div className="st-modal-backdrop" onClick={() => setModal(null)} role="dialog" aria-modal="true">
          <img src={viewer.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "92vh", borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,0.6)" }} />
        </div>
      )}
    </div>
  );
}

// ── Pieces used above ─────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="st-row" style={{ background: "transparent", border: 0, padding: "4px 0" }}>
      <span className="st-muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ModelGroup({
  title,
  type,
  ages,
  look,
  onPick,
}: {
  title: string;
  type: ModelType;
  ages: readonly string[];
  look: GenerationLook;
  onPick: (type: ModelType, age: string) => void;
}) {
  return (
    <>
      <div className="st-section-title">{title}</div>
      <div className="st-grid-3">
        {ages.map((age) => (
          <ModelCard key={age} type={type} age={age} selected={look.modelType === type && look.age === age} onClick={() => onPick(type, age)} />
        ))}
      </div>
    </>
  );
}

function ModelCard({ type, age, selected, onClick }: { type: ModelType; age: string; selected: boolean; onClick: () => void }) {
  const noun = type === "woman" ? "Woman" : type === "man" ? "Man" : type === "girl" ? "Girl" : "Boy";
  return (
    <button type="button" className={`st-model ${selected ? "is-selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <div className="st-model-face" aria-hidden>
        {noun.charAt(0)}
      </div>
      <span className="st-model-label">{noun}</span>
      <span className="st-model-help">{age}</span>
    </button>
  );
}

function WordsEditor({
  garment,
  words,
  onSave,
}: {
  garment: GarmentView;
  words: Record<string, string | null>;
  onSave: (overrides: Record<string, string>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...garment.words });
  function set(key: string, value: string) {
    const next = { ...draft };
    if (value.trim()) next[key] = value;
    else delete next[key];
    setDraft(next);
  }
  return (
    <div className="st-stack" style={{ gap: 8 }}>
      {DESCRIBED_FIELDS.filter((f) => !["fibre", "craft", "borderWidth"].includes(f.key)).map((f) => (
        <label key={f.key} style={{ display: "grid", gap: 4, textAlign: "left" }}>
          <span className="st-muted" style={{ fontSize: 11 }}>{f.label}</span>
          <input className="st-input" value={draft[f.key] ?? words[f.key] ?? ""} placeholder={f.hint} onChange={(e) => set(f.key, e.target.value)} onBlur={() => void onSave(draft)} />
        </label>
      ))}
    </div>
  );
}

function swatch(id: string): string {
  switch (id) {
    case "courtyard":
      return "linear-gradient(180deg, #e7c9a0 0%, #b07a4a 100%)";
    case "studio":
      return "linear-gradient(180deg, #f2f2f2 0%, #c9c9c9 100%)";
    default:
      return "linear-gradient(180deg, #c9d8b5 0%, #6f7d5c 100%)";
  }
}


/**
 * The five shots on the splash. Until the first approved renders exist they
 * are the pose reference and SLK's own photographs of 300010; swap in real
 * catalogue images here as they are approved.
 */
const SPLASH_SHOTS = [
  "/splash/b_1.jpg",
  "/splash/b_2.jpg",
  "/splash/b_3.jpg",
  "/splash/b_4.jpg",
  "/splash/b_5.jpg",
];

/** Tantu's mark: a thread looping into a T, in the studio's orange, with a spark. */
function TantuMark() {
  return (
    <svg className="st-splash-mark" viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id="tantu-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6a15a" />
          <stop offset="1" stopColor="#db7124" />
        </linearGradient>
      </defs>
      <path
        d="M22 30 H74 a6 6 0 0 1 0 12 H56 V64 a10 10 0 0 1 -20 0 V54 a6 6 0 0 1 12 0 v8 a2 2 0 0 0 4 0 V42 H22 a6 6 0 0 1 0 -12 Z"
        fill="url(#tantu-mark)"
      />
      <path d="M78 12 l2.6 6.4 L87 21 l-6.4 2.6 L78 30 l-2.6 -6.4 L69 21 l6.4 -2.6 Z" fill="#f4efe6" />
    </svg>
  );
}

/** Every garment type the reference lists, grouped. Only Saree works today. */
const GARMENT_TYPES = {
  Women: [
    { value: "saree", label: "Saree", enabled: true },
    { value: "stitched_kurta", label: "Women's Stitched Kurta", enabled: false },
    { value: "unstitched_kurta", label: "Women's Unstitched Kurta", enabled: false },
    { value: "womens_dress", label: "Women's Western Dress", enabled: false },
    { value: "womens_top", label: "Women's Top", enabled: false },
    { value: "womens_tee", label: "Women's Tee", enabled: false },
    { value: "womens_bra", label: "Women's Bra", enabled: false },
    { value: "womens_briefs", label: "Women's Briefs", enabled: false },
    { value: "womens_sleepwear", label: "Women's Sleepwear", enabled: false },
    { value: "womens_lehenga", label: "Women's Lehenga / Indian Bridal", enabled: false },
  ],
  Men: [
    { value: "mens_tee", label: "Men's Tee", enabled: false },
    { value: "mens_shirt", label: "Men's Shirt", enabled: false },
    { value: "mens_kurta", label: "Men's Kurta", enabled: false },
  ],
  Kids: [
    { value: "kids_western_wear", label: "Kids Western Wear", enabled: false },
    { value: "kids_indian_ethnic", label: "Kids Indian Ethnic", enabled: false },
  ],
} as const;

function GarmentTypeSelect() {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select className="st-select" defaultValue="saree" onChange={(e) => { if (e.target.value !== "saree") e.target.value = "saree"; }}>
        {Object.entries(GARMENT_TYPES).map(([group, options]) => (
          <optgroup key={group} label={group}>
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={!o.enabled}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="st-select-chevron" aria-hidden>
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </div>
  );
}
