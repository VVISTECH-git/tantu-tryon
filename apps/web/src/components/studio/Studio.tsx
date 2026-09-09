"use client";

import { useMemo, useState } from "react";
import { LAB_MODELS } from "@/components/lab/models";
import { defaultPoseIds, selectablePoses } from "@/registry/poses";
import { formatCost } from "@/lib/pricing";
import { StepModel } from "./StepModel";
import { StepPose } from "./StepPose";
import { StepProduct } from "./StepProduct";
import { Stepper } from "./Stepper";
import { STEPS, missingSlots, type StepId, type StudioDraft } from "./types";

/**
 * The Studio, rebuilt around the order the work actually happens in.
 *
 * The previous one put every control on a single screen — garment, mode,
 * backdrop, prompt wording, quality, model, poses, uploads — and left a
 * first-time visitor to work out which of those mattered before anything could
 * happen. It also predated the pose registry and the product lookup, so it
 * asked for four uploads that, for SLK's own stock, already exist.
 *
 * This asks one question per screen, in the order a person answers them:
 * which saree, who wears it, doing what, is that right, here it is.
 */

/** Poses with a recipe written and tested for them. Marked, not gated. */
const RECIPE_BACKED = new Set(["SAR-P15"]);

export function Studio() {
  const [step, setStep] = useState<StepId>("product");
  const [furthest, setFurthest] = useState(0);

  const [draft, setDraft] = useState<StudioDraft>(() => ({
    product: null,
    modelId: LAB_MODELS[0]!.id,
    modelBrief: LAB_MODELS[0]!.brief,
    poseIds: defaultPoseIds("saree").slice(0, 1),
    backdrop: "studio",
  }));

  const poses = useMemo(() => selectablePoses("saree"), []);
  const index = STEPS.findIndex((s) => s.id === step);
  const gaps = missingSlots(draft.product);

  /** Why the next button is disabled, said rather than implied. */
  const blocker = useMemo(() => {
    if (step === "product") {
      if (!draft.product) return "Find a product, or upload its photographs.";
      if (gaps.length > 0) return `Still missing ${gaps.join(", ")}.`;
    }
    if (step === "pose" && draft.poseIds.length === 0) return "Choose at least one pose.";
    return null;
  }, [step, draft, gaps]);

  function go(id: StepId) {
    const to = STEPS.findIndex((s) => s.id === id);
    setStep(id);
    setFurthest((f) => Math.max(f, to));
  }

  function next() {
    if (blocker) return;
    const to = STEPS[Math.min(index + 1, STEPS.length - 1)]!;
    go(to.id);
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-surface-2">
      <Stepper current={step} furthest={furthest} onGo={go} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6">
          <h1 className="display text-[26px]">{STEPS[index]!.title}</h1>
          <p className="mt-1 text-[15px] text-ink-soft">{STEPS[index]!.hint}</p>
        </header>

        {step === "product" && (
          <StepProduct
            product={draft.product}
            onChange={(product) => setDraft((d) => ({ ...d, product }))}
          />
        )}

        {step === "model" && (
          <StepModel
            modelId={draft.modelId}
            onChange={(modelId, modelBrief) => setDraft((d) => ({ ...d, modelId, modelBrief }))}
          />
        )}

        {step === "pose" && (
          <StepPose
            poses={poses}
            selected={draft.poseIds}
            recipeBacked={RECIPE_BACKED}
            onToggle={(id) =>
              setDraft((d) => ({
                ...d,
                poseIds: d.poseIds.includes(id)
                  ? d.poseIds.filter((p) => p !== id)
                  : [...d.poseIds, id],
              }))
            }
          />
        )}

        {step === "review" && <Review draft={draft} />}

        {step === "result" && (
          <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-[14px] text-ink-faint">
            Generation is not wired into the Studio yet.
          </p>
        )}

        {step !== "result" && (
          <div className="mt-10 flex items-center gap-4 border-t border-line pt-6">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(STEPS[Math.max(index - 1, 0)]!.id)}
              className="rounded-full border border-line px-5 py-2.5 text-[15px] text-ink transition hover:border-ink-faint disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              disabled={blocker !== null}
              onClick={next}
              className="rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-soft"
            >
              Continue
            </button>
            {blocker && <span className="text-[13px] text-ink-faint">{blocker}</span>}
          </div>
        )}
      </main>
    </div>
  );
}

/** What is about to be made, and what it costs, before anything is spent. */
function Review({ draft }: { draft: StudioDraft }) {
  const poses = selectablePoses("saree");
  const chosen = poses.filter((p) => draft.poseIds.includes(p.id));
  const model = LAB_MODELS.find((m) => m.id === draft.modelId);

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-line-soft border-y border-line-soft">
        <Row k="Product">
          {draft.product?.title ?? "—"}
          {draft.product?.code && (
            <span className="numeral ml-2 text-ink-faint">{draft.product.code}</span>
          )}
        </Row>
        <Row k="Parts">{draft.product?.parts.length ?? 0} photographs</Row>
        <Row k="Model">
          <span className="numeral">{draft.modelId}</span>
          <span className="ml-2 text-ink-soft">{model?.brief.age}</span>
        </Row>
        <Row k="Poses">
          {chosen.length === 0 ? "none" : chosen.map((p) => p.name).join(", ")}
        </Row>
        <Row k="Images">{chosen.length}</Row>
      </dl>

      <p className="text-[15px]">
        Estimated engine cost{" "}
        <span className="numeral">{formatCost(chosen.length, "standard")}</span>
        <span className="ml-2 text-[13px] text-ink-faint">
          Nothing is charged by this app.
        </span>
      </p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-[14px]">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="m-0 text-ink">{children}</dd>
    </div>
  );
}
