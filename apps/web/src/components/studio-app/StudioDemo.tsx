"use client";
/* eslint-disable @next/next/no-img-element -- demo shots at their own size */

import { useEffect, useRef, useState } from "react";
import { CREDIT_PAISE, QUALITY_LABEL, rupees, type Quality } from "@/content/credits";
import { ADULT_AGES, BACKGROUNDS, CHILD_AGES, MODEL_TYPES, TEMPLATES, type ModelType } from "@/content/promptTemplates";
import { DEFAULT_GARMENT_TYPE, garmentType as typeOf, requiredSlots, shotFor, type Shot } from "@/content/shots";
import type { PartQuality } from "@/db";
import { ConfirmModal, TipsModal } from "./screens";
import { GarmentTypeSelect, ShotHowModal, ShotList, ShotStrip, type ShotTile } from "./ShotList";
import { T } from "./texts";
import { POSE_TILES } from "./types";

/**
 * The new studio's whole look, click-through — every screen the reference
 * app has, built with our own photographs and our own frozen poses.
 *
 * Nothing here calls a server. "Generate" is a timer and a photograph we
 * already own, not a render, and the result screen says so plainly: this
 * page is public with no sign-in, and nobody visiting it should mistake a
 * mock-up for something the studio actually produced. The working studio,
 * which does call Gemini and does charge credits, is at /app.
 */

type Screen =
  | "splash"
  | "upload"
  | "shots"
  | "analyzing"
  | "confirm"
  | "flats"
  | "model"
  | "background"
  | "backgroundCategory"
  | "output"
  | "generating"
  | "result"
  | "poses"
  | "posesGenerating"
  | "gallery";

type ModalKind = null | "tips" | "how" | "restart" | "regenerate" | "regeneratePose" | "viewer";

/** The demo has no server, so a picked photo is simply "looks good". */
const DEMO_OK: PartQuality = { status: "ok", reasons: [], metrics: { sharpness: 0, brightness: 0, dark: 0, bright: 0, width: 0, height: 0 } };

interface Look {
  modelType: ModelType;
  age: string;
  background: string;
  quality: Quality;
}

/** Backgrounds grouped the way the reference groups them, using only what we can honestly show: our three real settings. */
const BACKGROUND_CATEGORIES = [{ id: "heritage", title: "Heritage", count: BACKGROUNDS.length, items: BACKGROUNDS }];

/** Model choices shown as real faces: crops of our own approved photographs, not stock headshots. */
const MODEL_SHOTS: Record<string, string> = {
  woman: "/splash/b_2.jpg",
  man: "/splash/b_3.jpg",
  girl: "/splash/b_4.jpg",
  boy: "/splash/b_5.jpg",
};

const KIDS: ModelType[] = ["girl", "boy"];
const POSE_GROUPS = ["front", "side", "back", "garment"] as const;
const RESULT_PHOTO = "/splash/b_3.jpg";
const POSE_PHOTOS = ["/splash/b_1.jpg", "/splash/b_2.jpg", "/splash/b_3.jpg", "/splash/b_4.jpg", "/splash/b_5.jpg"];

export function StudioDemo() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [stack, setStack] = useState<Screen[]>([]);
  const [garmentType, setGarmentType] = useState<string>(DEFAULT_GARMENT_TYPE);
  const [tiles, setTiles] = useState<ShotTile[]>([]);
  const [howShot, setHowShot] = useState<Shot | null>(null);
  const activeSlot = useRef<string>("body");
  const [look, setLook] = useState<Look>({ modelType: "woman", age: "late 20s", background: BACKGROUNDS[0]!.id, quality: "standard" });
  const [balance, setBalance] = useState(4000);
  const [primaryDone, setPrimaryDone] = useState(false);
  const [primaryRating, setPrimaryRating] = useState<"up" | "neutral" | "down" | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [poseQuality, setPoseQuality] = useState<Quality>("high");
  const [poseResults, setPoseResults] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function go(next: Screen) {
    setStack((s) => [...s, screen]);
    setScreen(next);
  }
  function back() {
    setStack((s) => {
      const prev = s[s.length - 1];
      if (prev) setScreen(prev);
      return s.slice(0, -1);
    });
  }
  function resetAll() {
    setTiles([]);
    setPrimaryDone(false);
    setPrimaryRating(null);
    setSelectedPoses(new Set());
    setPoseResults([]);
    setStack([]);
    setScreen("upload");
    setModal(null);
  }

  useEffect(() => {
    if (screen !== "splash") return;
    const t = setTimeout(() => setScreen((c) => (c === "splash" ? "upload" : c)), 2200);
    return () => clearTimeout(t);
  }, [screen]);

  function openPicker(shot: Shot, camera: boolean) {
    activeSlot.current = shot.slot;
    (camera ? cameraInput : fileInput).current?.click();
  }

  function pickShot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const slot = activeSlot.current;
    const tile: ShotTile = { slot, url: URL.createObjectURL(file), quality: DEMO_OK };
    setTiles((all) => [...all.filter((t) => t.slot !== slot), tile]);
  }

  function clearShot(slot: string) {
    setTiles((all) => all.filter((t) => t.slot !== slot));
  }

  function analyzeNow() {
    go("analyzing");
    timer.current = setTimeout(() => setScreen("confirm"), 1400);
  }

  const required = requiredSlots(garmentType);
  const missing = required.filter((slot) => !tiles.some((t) => t.slot === slot));
  const label = (slot: string) => shotFor(garmentType, slot)?.label ?? slot;

  function generatePrimary() {
    if (balance < CREDIT_PAISE[look.quality]) return;
    setModal(null);
    go("generating");
    timer.current = setTimeout(() => {
      setBalance((b) => b - CREDIT_PAISE[look.quality]);
      setPrimaryDone(true);
      setPrimaryRating(null);
      setScreen("result");
    }, 1800);
  }

  function generatePoses(count = selectedPoses.size, quality = poseQuality) {
    if (count === 0) return;
    const cost = count * CREDIT_PAISE[quality];
    if (cost > balance) return;
    go("posesGenerating");
    timer.current = setTimeout(() => {
      setBalance((b) => b - cost);
      setPoseResults((prev) => {
        const made = Array.from({ length: count }, (_, i) => POSE_PHOTOS[(prev.length + i) % POSE_PHOTOS.length]!);
        return [...prev, ...made];
      });
      setGalleryIndex((i) => i);
      setSelectedPoses(new Set());
      setScreen("gallery");
    }, 2200);
  }

  const livePoses = TEMPLATES.filter((t) => t.live);
  const category = BACKGROUND_CATEGORIES[0]!;
  const showBack = screen !== "splash" && stack.length > 0 && !["analyzing", "generating", "posesGenerating"].includes(screen);
  const showHeaderFooter = screen !== "splash";
  const currentPose = poseResults[Math.min(galleryIndex, Math.max(0, poseResults.length - 1))];

  return (
    <div className="st">
      <div className="st-shell">
        {screen === "splash" && (
          <div className="st-splash" onClick={() => setScreen("upload")} role="button" aria-label="Enter the studio">
            <div className="st-splash-brand">
              <TantuMark size={84} />
              <h1 className="st-splash-name">{T.splash.name}</h1>
              <p className="st-splash-tagline">{T.splash.tagline}</p>
            </div>
            <div className="st-splash-shots" aria-hidden>
              {POSE_PHOTOS.map((src, i) => (
                <div key={i} className="st-splash-shot">
                  <img src={src} alt="" />
                </div>
              ))}
            </div>
          </div>
        )}

        {showHeaderFooter && (
          <header className="st-header">
            <div className="st-header-main">
              {showBack && (
                <button type="button" className="st-icon-button st-icon-button--back" onClick={back} aria-label={T.header.back}>
                  <span className="arrow">‹</span>
                  <span className="label">{T.header.back}</span>
                </button>
              )}
              {screen !== "upload" && (
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
              <div className="st-brand">
                <TantuMark size={34} />
              </div>
            </div>
            <div className="st-header-actions">
              <span className="st-status-chip">{T.status.trial}</span>
              <button type="button" className="st-icon-button st-icon-button--profile" aria-label={T.profile.title}>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M5 19.5c1.4-3.4 4-5 7-5s5.6 1.6 7 5" />
                </svg>
              </button>
            </div>
          </header>
        )}

        {showHeaderFooter && (
          <main
            className="st-main"
            style={{
              alignContent: ["confirm", "details", "flats", "model", "background", "backgroundCategory", "output", "result", "poses", "gallery"].includes(screen)
                ? "start"
                : "center",
            }}
          >
            {screen === "upload" && (
              <div className="st-center" style={{ gap: 18 }}>
                <div>
                  <h1 className="st-title">{T.upload.title}</h1>
                  <p className="st-copy" style={{ marginTop: 6 }}>{T.upload.copy}</p>
                </div>
                <div className="st-stack" style={{ width: "100%", gap: 8 }}>
                  <span className="st-section-title" style={{ margin: 0 }}>{T.upload.typeLabel}</span>
                  <GarmentTypeSelect value={garmentType} onChange={setGarmentType} />
                  <p className="st-support" style={{ margin: 0 }}>{T.upload.typeHelp}</p>
                </div>
                <div className="st-grow" style={{ width: "100%", minHeight: "30vh" }}>
                  <div className="st-callout">
                    {T.upload.calloutPrefix}{" "}
                    <button
                      type="button"
                      className="st-link"
                      onClick={() => {
                        setTipIndex(0);
                        setModal("tips");
                      }}
                    >
                      {T.upload.seeTips}
                    </button>{" "}
                    {T.upload.calloutSuffix}
                  </div>
                  <button type="button" className="st-action" style={{ maxWidth: 360 }} onClick={() => go("shots")}>{T.upload.dropzone}</button>
                  <p className="st-support">{T.upload.dropzoneCopy}</p>
                </div>
              </div>
            )}

            {screen === "shots" && (
              <div className="st-stack">
                <h1 className="st-title">{T.shots.title(typeOf(garmentType).label)}</h1>
                <p className="st-copy">{T.shots.copy}</p>
                <p className="st-shots-status">{T.shots.progress(required.length - missing.length, required.length)}</p>
                <ShotList
                  type={garmentType}
                  tiles={tiles}
                  busySlot={null}
                  onCamera={(shot) => openPicker(shot, true)}
                  onUpload={(shot) => openPicker(shot, false)}
                  onHow={(shot) => { setHowShot(shot); setModal("how"); }}
                  onClear={(shot) => clearShot(shot.slot)}
                />
                <p className="st-support">{T.shots.support}</p>
                <button type="button" className="st-action" disabled={missing.length > 0} onClick={analyzeNow}>
                  {missing.length > 0 ? T.shots.continueMissing(missing.map(label)) : T.common.continue}
                </button>
              </div>
            )}

            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pickShot} />
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickShot} />
            {screen === "analyzing" && <FullSpinner text={T.confirm.analyzing} sub={T.confirm.analyzingMobile} />}

            {screen === "confirm" && (
              <div className="st-stack">
                <h1 className="st-title">{T.confirm.title}</h1>
                <p className="st-copy">{T.confirm.copy(typeOf(garmentType).label, tiles.length)}</p>
                <ShotStrip type={garmentType} tiles={tiles} onEdit={() => setScreen("shots")} />
                <GarmentTypeSelect value={garmentType} onChange={() => undefined} />
                <button type="button" className="st-action" onClick={() => go("flats")}>{T.confirm.continue}</button>
              </div>
            )}

            {screen === "flats" && (
              <div className="st-stack">
                <h1 className="st-title">{T.flats.title}</h1>
                <p className="st-copy">{T.flats.copy}</p>
                <ShotList
                  type={garmentType}
                  tiles={tiles}
                  busySlot={null}
                  optionalOnly
                  hideBlouse={false}
                  onCamera={(shot) => openPicker(shot, true)}
                  onUpload={(shot) => openPicker(shot, false)}
                  onHow={(shot) => { setHowShot(shot); setModal("how"); }}
                  onClear={(shot) => clearShot(shot.slot)}
                />
                <button type="button" className="st-action" disabled={balance < CREDIT_PAISE[look.quality]} onClick={generatePrimary}>
                  {T.generate.action} · {rupees(CREDIT_PAISE[look.quality])}
                </button>
              </div>
            )}

            {screen === "model" && (
              <div className="st-stack">
                <h1 className="st-title">{T.model.title}</h1>
                <p className="st-copy">{T.model.copy}</p>
                <ModelGroup title={T.model.women} type="woman" ages={ADULT_AGES} look={look} setLook={setLook} />
                <ModelGroup title={T.model.men} type="man" ages={ADULT_AGES} look={look} setLook={setLook} />
                <div className="st-section-title">{T.model.kids}</div>
                <div className="st-grid-3">
                  {KIDS.flatMap((type) =>
                    CHILD_AGES.slice(0, 2).map((age) => (
                      <ModelCard
                        key={`${type}-${age}`}
                        type={type}
                        age={age}
                        selected={look.modelType === type && look.age === age}
                        onClick={() => setLook((l) => ({ ...l, modelType: type, age }))}
                      />
                    )),
                  )}
                </div>
                <p className="st-support">{T.model.fixed}</p>
                <button type="button" className="st-action" onClick={() => go("background")}>{T.common.continue}</button>
              </div>
            )}

            {screen === "background" && (
              <div className="st-stack">
                <h1 className="st-title">{T.background.title}</h1>
                <p className="st-copy">{T.background.copy}</p>
                <div className="st-grid-2">
                  {BACKGROUND_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="st-choice"
                      style={{ minHeight: 168, padding: 0, overflow: "hidden", display: "block", textAlign: "left" }}
                      onClick={() => go("backgroundCategory")}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2, height: 108 }}>
                        <div style={{ gridRow: "1 / 3", background: swatch(c.items[0]!.id) }} />
                        <div style={{ background: swatch(c.items[1]?.id ?? c.items[0]!.id) }} />
                        <div style={{ background: swatch(c.items[2]?.id ?? c.items[0]!.id) }} />
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div className="st-tile-label">{c.title}</div>
                        <div className="st-tile-help">{c.count} backgrounds</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" className="st-action" onClick={() => go("output")}>{T.common.continue}</button>
              </div>
            )}

            {screen === "backgroundCategory" && (
              <div className="st-stack">
                <h1 className="st-title">Choose {category.title} background</h1>
                <p className="st-copy">{T.background.copy}</p>
                <div className="st-list">
                  {category.items.map((b) => {
                    const on = look.background === b.id;
                    return (
                      <button key={b.id} type="button" className={`st-tile ${on ? "is-selected" : ""}`} onClick={() => setLook((l) => ({ ...l, background: b.id }))}>
                        <div className="st-tile-thumb" style={{ background: swatch(b.id), minHeight: 96 }} />
                        <div className="st-tile-body">
                          <div className="st-tile-top">
                            <span className="st-tile-label">{b.label}</span>
                            {on && <span className="st-badge">{T.background.selected}</span>}
                          </div>
                          <span className="st-tile-help">{b.scene.replaceAll("{her}", "her")}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="st-action" onClick={() => go("output")}>{T.common.continue}</button>
              </div>
            )}

            {screen === "output" && (
              <div className="st-stack">
                <h1 className="st-title">{T.output.title}</h1>
                <p className="st-copy">{T.output.copy}</p>
                <div className="st-section-title">{T.output.resolution}</div>
                <div className="st-grid-2">
                  {(["standard", "high"] as Quality[]).map((q) => (
                    <button key={q} type="button" className={`st-choice ${look.quality === q ? "is-selected" : ""}`} onClick={() => setLook((l) => ({ ...l, quality: q }))}>
                      {q === "high" && <span className="st-badge" style={{ marginBottom: 2 }}>{T.output.recommended}</span>}
                      <span className="st-choice-label">{q === "standard" ? "1K" : "2K"}</span>
                      <span className="st-choice-help">{QUALITY_LABEL[q].detail} · {rupees(CREDIT_PAISE[q])}</span>
                    </button>
                  ))}
                </div>
                <p className="st-support" style={{ marginTop: -8 }}>{T.output.trialHint}</p>
                <div className="st-section-title">{T.output.aspect}</div>
                <div className="st-grid-2">
                  <button type="button" className="st-choice is-selected">
                    <span className="st-choice-label">3:4</span>
                    <span className="st-choice-help">{T.output.portrait}</span>
                  </button>
                  {["1:1", "4:5", "9:16"].map((r) => (
                    <button key={r} type="button" className="st-choice" disabled>
                      <span className="st-choice-label">{r}</span>
                      <span className="st-choice-help">{T.output.soon}</span>
                    </button>
                  ))}
                </div>
                <details>
                  <summary style={{ cursor: "pointer", color: "var(--st-text-soft)", fontSize: 13, fontWeight: 500 }}>Quick presets</summary>
                  <div className="st-grid-2" style={{ marginTop: 8 }}>
                    <button type="button" className="st-choice" onClick={() => setLook((l) => ({ ...l, quality: "standard" }))}>
                      <span className="st-choice-label">Catalog</span>
                      <span className="st-choice-help">1K · 3:4</span>
                    </button>
                    <button type="button" className="st-choice" onClick={() => setLook((l) => ({ ...l, quality: "high" }))}>
                      <span className="st-choice-label">Hero shot</span>
                      <span className="st-choice-help">2K · 3:4</span>
                    </button>
                  </div>
                </details>
                <button type="button" className="st-action" disabled={balance < CREDIT_PAISE[look.quality]} onClick={generatePrimary}>
                  {T.generate.action} · {rupees(CREDIT_PAISE[look.quality])}
                </button>
              </div>
            )}

            {screen === "generating" && <ModalSpinner text={T.generate.processing} sub={T.generate.processingMobile} />}

            {screen === "result" && primaryDone && (
              <div className="st-stack">
                <h1 className="st-title">{T.generate.title}</h1>
                <p className="st-copy">{T.generate.copy}</p>
                <div className="st-frame">
                  <img src={RESULT_PHOTO} alt="Preview" onClick={() => setModal("viewer")} />
                  <button type="button" className="st-frame-button" title={T.generate.download} onClick={(e) => e.preventDefault()}>
                    <DownloadIcon />
                  </button>
                  <button type="button" className="st-frame-button st-frame-button--second" title="Regenerate" onClick={() => setModal("regenerate")}>
                    <RefreshIcon />
                  </button>
                </div>
                <p className="st-caption" style={{ color: "var(--st-accent-pale)" }}>Preview shown for design purposes — not a generated image.</p>
                <div className="st-center" style={{ gap: 6 }}>
                  <span className="st-caption">{T.generate.rate}</span>
                  <div className="st-rate">
                    <button type="button" className={primaryRating === "up" ? "is-selected" : ""} onClick={() => setPrimaryRating("up")}>👍</button>
                    <button type="button" className={primaryRating === "neutral" ? "is-selected" : ""} onClick={() => setPrimaryRating("neutral")}>😐</button>
                    <button type="button" className={primaryRating === "down" ? "is-selected" : ""} onClick={() => setPrimaryRating("down")}>👎</button>
                  </div>
                </div>
                <button type="button" className="st-action" onClick={() => go("poses")}>{T.generate.poses}</button>
                <button type="button" className="st-secondary" onClick={() => setModal("restart")}>{T.generate.restart}</button>
              </div>
            )}

            {screen === "poses" && (
              <div className="st-stack">
                <div className="st-section-head">
                  <span style={{ width: 70 }} />
                  <h1 className="st-title">{T.poses.title}</h1>
                  <div className="st-toggle" style={{ padding: 2 }}>
                    {(["high", "standard"] as Quality[]).map((q) => (
                      <button key={q} type="button" className={poseQuality === q ? "is-selected" : ""} style={{ minWidth: 34, minHeight: 24, fontSize: 10, fontWeight: 700, padding: "0 8px" }} onClick={() => setPoseQuality(q)}>
                        {q === "high" ? "2K" : "1K"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="st-copy">{T.poses.copy}</p>
                {POSE_GROUPS.map((group) => {
                  const items = livePoses.filter((t) => POSE_TILES[t.id]?.group === group);
                  if (!items.length) return null;
                  return (
                    <div key={group} className="st-stack" style={{ gap: 8 }}>
                      <div className="st-section-title">{T.poses.groups[group]}</div>
                      {items.map((t) => {
                        const tile = POSE_TILES[t.id]!;
                        const on = selectedPoses.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`st-tile ${on ? "is-selected" : ""}`}
                            onClick={() =>
                              setSelectedPoses((s) => {
                                const n = new Set(s);
                                if (n.has(t.id)) n.delete(t.id);
                                else n.add(t.id);
                                return n;
                              })
                            }
                          >
                            <div className="st-tile-thumb st-tile-thumb--pose" style={{ background: "#f4efe6" }}>
                              {tile.silhouette ? (
                                <img src={tile.silhouette} alt="" style={{ objectFit: "contain", padding: 4 }} />
                              ) : (
                                <span className="st-thumb-empty" style={{ color: "#57534e" }}>{t.id}</span>
                              )}
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
                <button type="button" className="st-action" disabled={selectedPoses.size === 0} onClick={() => generatePoses()}>
                  {T.poses.generate}
                </button>
              </div>
            )}

            {screen === "posesGenerating" && <ModalSpinner text={T.poses.processing} sub={T.generate.processingMobile} />}

            {screen === "gallery" && (
              <div className="st-stack">
                <h1 className="st-title">{T.gallery.title}</h1>
                <p className="st-copy">{T.gallery.copy}</p>
                {currentPose ? (
                  <>
                    <div className="st-frame">
                      <img src={currentPose} alt="Pose result" onClick={() => setModal("viewer")} />
                      <button type="button" className="st-frame-button" title={T.gallery.download} onClick={(e) => e.preventDefault()}>
                        <DownloadIcon />
                      </button>
                      <button type="button" className="st-frame-button st-frame-button--second" title="Regenerate" onClick={() => setModal("regeneratePose")}>
                        <RefreshIcon />
                      </button>
                      {poseResults.length > 1 && (
                        <>
                          <button type="button" className="st-arrow st-arrow--left" disabled={galleryIndex === 0} onClick={() => setGalleryIndex((i) => i - 1)} aria-label={T.gallery.previous}>‹</button>
                          <button type="button" className="st-arrow st-arrow--right" disabled={galleryIndex >= poseResults.length - 1} onClick={() => setGalleryIndex((i) => i + 1)} aria-label={T.gallery.next}>›</button>
                        </>
                      )}
                    </div>
                    <p className="st-caption" style={{ color: "var(--st-accent-pale)" }}>Preview shown for design purposes — not a generated image.</p>
                    <div className="st-dots">
                      {poseResults.map((_, i) => (
                        <span key={i} className={`st-dot ${i === galleryIndex ? "is-active" : ""}`} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="st-copy">{T.poses.empty}</p>
                )}
                <button type="button" className="st-action" onClick={() => go("poses")}>{T.gallery.more}</button>
              </div>
            )}
          </main>
        )}

        {showHeaderFooter && (
          <footer className="st-footer">
            <div className="st-footer-row">
              <span className="st-footer-chip st-footer-chip--balance">{T.footer.balance(rupees(balance))}</span>
              <span className={`st-footer-chip ${balance <= 0 ? "st-footer-chip--recharge" : "st-footer-chip--buy"}`}>
                {balance <= 0 ? T.footer.recharge : T.footer.buy}
              </span>
              <span className="st-footer-chip st-footer-chip--gallery">{T.myImages.title}</span>
            </div>
          </footer>
        )}
      </div>

      {modal === "tips" && <TipsModal index={tipIndex} onIndex={setTipIndex} onClose={() => setModal(null)} />}
      {modal === "how" && howShot && <ShotHowModal shot={howShot} onClose={() => setModal(null)} />}
      {modal === "restart" && (
        <ConfirmModal icon="👗" title={T.generate.restartTitle} message={T.generate.restartMessage} confirm={T.generate.restartButton} onConfirm={resetAll} onClose={() => setModal(null)} />
      )}
      {modal === "regenerate" && (
        <ConfirmModal
          icon="↻"
          title={T.generate.regenerateTitle}
          message={`${T.generate.regenerateMessage} (${rupees(CREDIT_PAISE[look.quality])})`}
          confirm={T.generate.action}
          onConfirm={generatePrimary}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "regeneratePose" && (
        <ConfirmModal
          icon="↻"
          title={T.gallery.regenerateTitle}
          message={`${T.gallery.regenerateMessage} (${rupees(CREDIT_PAISE[poseQuality])})`}
          confirm={T.generate.action}
          onConfirm={() => {
            setModal(null);
            generatePoses(1, poseQuality);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "viewer" && (
        <div className="st-modal-backdrop" onClick={() => setModal(null)} role="dialog" aria-modal="true">
          <img
            src={screen === "gallery" ? currentPose ?? RESULT_PHOTO : RESULT_PHOTO}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "92vh", borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,0.6)" }}
          />
        </div>
      )}
    </div>
  );
}

function FullSpinner({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="st-grow" style={{ minHeight: "70vh" }}>
      <div className="st-spinner" aria-hidden />
      <p className="st-copy" style={{ maxWidth: 280 }}>{text}</p>
      <p className="st-support">{sub}</p>
    </div>
  );
}

/** The reference shows this as a modal floating over a blurred, dimmed page — not a full-screen swap. */
function ModalSpinner({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="st-modal-backdrop" style={{ backdropFilter: "blur(6px)" }}>
      <div className="st-modal" style={{ textAlign: "center" }}>
        <div className="st-spinner" style={{ margin: "0 auto" }} aria-hidden />
        <p className="st-modal-message">{text}</p>
        <p className="st-support" style={{ margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

function ModelGroup({
  title,
  type,
  ages,
  look,
  setLook,
}: {
  title: string;
  type: ModelType;
  ages: readonly string[];
  look: Look;
  setLook: (fn: (l: Look) => Look) => void;
}) {
  return (
    <>
      <div className="st-section-title">{title}</div>
      <div className="st-grid-3">
        {ages.map((age) => (
          <ModelCard key={age} type={type} age={age} selected={look.modelType === type && look.age === age} onClick={() => setLook((l) => ({ ...l, modelType: type, age }))} />
        ))}
      </div>
    </>
  );
}

function ModelCard({ type, age, selected, onClick }: { type: ModelType; age: string; selected: boolean; onClick: () => void }) {
  const noun = MODEL_TYPES.find((m) => m.id === type)?.label ?? type;
  return (
    <button type="button" className={`st-model ${selected ? "is-selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <div className="st-model-face" style={{ backgroundImage: `url(${MODEL_SHOTS[type]})`, backgroundSize: "cover", backgroundPosition: "top center" }} aria-hidden />
      <span className="st-model-label">{noun}</span>
      <span className="st-model-help">{age}</span>
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
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

function TantuMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
      <defs>
        <linearGradient id={`tantu-mark-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6a15a" />
          <stop offset="1" stopColor="#db7124" />
        </linearGradient>
      </defs>
      <path
        d="M22 30 H74 a6 6 0 0 1 0 12 H56 V64 a10 10 0 0 1 -20 0 V54 a6 6 0 0 1 12 0 v8 a2 2 0 0 0 4 0 V42 H22 a6 6 0 0 1 0 -12 Z"
        fill={`url(#tantu-mark-${size})`}
      />
      <path d="M78 12 l2.6 6.4 L87 21 l-6.4 2.6 L78 30 l-2.6 -6.4 L69 21 l6.4 -2.6 Z" fill="#f4efe6" />
    </svg>
  );
}

