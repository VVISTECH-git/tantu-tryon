import { SCENARIOS, packById } from "@/content/pricing";

/**
 * A decision helper, not a second pricing grid.
 *
 * It used to restate every price and quantity directly under the cards that had
 * just said them. Someone who has already read the cards does not need the
 * numbers again — they need to know which row describes them. So this carries
 * only the situation and the plan it points at.
 */
export function PlanSelector() {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {SCENARIOS.map((scenario) => {
        const pack = packById(scenario.packId);
        const featured = Boolean(pack.featured);

        return (
          <li
            key={scenario.packId}
            className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:gap-8"
          >
            <p className="text-[16px] font-medium sm:w-64 sm:shrink-0">{scenario.situation}</p>
            <p className="flex-1 text-[15px] leading-relaxed text-ink-soft">{scenario.body}</p>
            <p className="flex items-center gap-2.5 sm:w-52 sm:shrink-0 sm:justify-end">
              <span className="display text-[20px] leading-none">{pack.name}</span>
              {featured && (
                <span className="rounded-full bg-madder px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Most chosen
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
