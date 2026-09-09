"use client";

import type { ModelBrief } from "@tantu/engine/catalog";
import { LAB_MODELS } from "@/components/lab/models";

/**
 * Who wears it.
 *
 * Chosen independently of pose and of garment: the same model is expected to
 * work with every pose, and nothing in a pose record names a model. Keeping
 * them apart here is what makes that true in the UI as well as the schema.
 *
 * The presets are the Model Registry's stand-in. They already carry its
 * intended ids, so building the registry becomes a promotion rather than a
 * rename.
 */
export function StepModel({
  modelId,
  onChange,
}: {
  modelId: string;
  onChange: (id: string, brief: ModelBrief) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">
        The same model can wear any pose. Choosing here does not restrict what
        you can choose next.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {LAB_MODELS.map((model) => {
          const on = model.id === modelId;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id, model.brief)}
              className={`rounded-xl border p-4 text-left transition ${
                on
                  ? "border-accent bg-accent-wash"
                  : "border-line bg-surface hover:border-ink-faint"
              }`}
            >
              <span className="numeral block text-[12px] text-ink-faint">{model.id}</span>
              <span className="mt-1 block text-[14px] leading-snug text-ink">
                {[model.brief.age, model.brief.build, model.brief.complexion]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <span className="mt-2 block text-[12px] text-ink-faint">
                {model.brief.hair}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
