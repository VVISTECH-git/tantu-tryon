import { SCENARIOS, inr, packById } from "@/content/pricing";

/**
 * Self-selection by situation rather than by feature list. Someone who knows
 * they run a boutique should be able to stop reading here.
 */
export function PlanSelector() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {SCENARIOS.map((scenario) => {
        const pack = packById(scenario.packId);
        const featured = Boolean(pack.featured);

        return (
          <li
            key={scenario.packId}
            className={`flex flex-col p-7 transition-colors duration-200 ${
              featured ? "bg-accent-wash" : "bg-surface"
            }`}
          >
            <p className="label">{scenario.situation}</p>

            <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className="display text-[24px] leading-none">{pack.name}</span>
              {featured && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Recommended
                </span>
              )}
            </p>

            <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">{scenario.body}</p>

            <p className="mt-5 border-t border-line-soft pt-4 text-[14px] text-ink-faint">
              {inr(pack.inr)} · {pack.images.toLocaleString("en-IN")} images ·{" "}
              {`₹${(pack.inr / pack.images).toFixed(1)}/image`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
