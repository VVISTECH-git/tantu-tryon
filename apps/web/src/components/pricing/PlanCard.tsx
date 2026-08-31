import { inr, perImage, valueNote, type Pack } from "@/content/pricing";

/**
 * One pack.
 *
 * The recommended card is marked three ways — a worded badge, a heavier border
 * and a filled button — so it never depends on colour alone to read as the
 * recommendation. It is also only slightly heavier than the others: a card that
 * towers over its neighbours reads as a sales tactic rather than advice.
 */
export function PlanCard({ pack }: { pack: Pack }) {
  const note = valueNote(pack);
  const featured = Boolean(pack.featured);

  return (
    <article
      aria-labelledby={`plan-${pack.id}`}
      className={`group relative flex flex-col rounded-xl border bg-surface transition duration-200 ${
        featured
          ? "border-accent/70 bg-accent-wash/40 shadow-[0_1px_2px_rgba(28,25,23,0.05)] xl:-mt-3 xl:mb-3"
          : "border-line hover:border-ink-faint/60"
      }`}
    >
      {featured && (
        <div className="flex justify-center">
          <span className="-mt-3 rounded-full bg-accent px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
            Most chosen
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-7">
        <h3 id={`plan-${pack.id}`} className="display text-[22px] leading-none">
          {pack.name}
        </h3>
        <p className="mt-2 min-h-10 text-[13.5px] leading-snug text-ink-faint">{pack.audience}</p>

        {/* price — the largest thing in the card */}
        <p className="numeral mt-6 text-[46px] leading-none">{inr(pack.inr)}</p>

        <div className="mt-4 flex items-baseline gap-2.5 border-t border-line-soft pt-4">
          <span className="text-[15px] font-medium">
            {pack.images.toLocaleString("en-IN")} images
          </span>
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <span className="text-[15px] text-ink-soft">{`₹${perImage(pack).toFixed(1)} / image`}</span>
        </div>

        <p className="mt-3 min-h-6">
          {note && (
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                featured ? "bg-accent/12 text-accent" : "bg-madder-wash text-madder"
              }`}
            >
              {note}
            </span>
          )}
        </p>

        <ul className="mt-6 flex-1 space-y-3">
          {pack.includes.map((item) => (
            <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-ink-soft">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-madder" />
              {item}
            </li>
          ))}
        </ul>

        <a
          href="/contact"
          className={`mt-8 rounded-full px-5 py-3.5 text-center text-[15px] font-medium transition duration-200 ${
            featured
              ? "bg-accent text-white hover:bg-accent-hover"
              : "border border-ink/15 text-ink hover:border-ink/40 hover:bg-surface-2"
          }`}
        >
          {pack.cta}
          <span className="sr-only"> — {inr(pack.inr)} for {pack.images} images</span>
        </a>
        <p className="mt-3 text-center text-[12px] leading-snug text-ink-faint">{pack.microcopy}</p>
      </div>
    </article>
  );
}
