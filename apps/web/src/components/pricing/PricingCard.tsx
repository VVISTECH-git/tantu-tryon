import Link from "next/link";
import { PricingFeature } from "./PricingFeature";
import { inr, perImage, valueNote, type Pack } from "@/content/pricing";

/**
 * One pack.
 *
 * The recommendation is marked four ways — a worded badge, a heavier border, a
 * tinted ground and a filled button — so it never rests on colour alone. It is
 * only slightly heavier than its neighbours on purpose: a card that towers over
 * the others reads as an advertisement rather than advice.
 */
export function PricingCard({ pack }: { pack: Pack }) {
  const note = valueNote(pack);
  const featured = Boolean(pack.featured);

  return (
    <article
      aria-labelledby={`plan-${pack.id}`}
      // The ground colour lives only in the branches: a `bg-surface` on the
      // base class wins the cascade against the featured tint and quietly
      // strips the recommendation of one of its three signals.
      className={`group relative flex flex-col rounded-xl border transition duration-200 ease-out ${
        featured
          ? "border-accent/70 bg-accent-wash shadow-[0_2px_10px_-4px_rgba(28,25,23,0.14)] hover:shadow-[0_10px_26px_-14px_rgba(28,25,23,0.28)] xl:-mt-3 xl:mb-3"
          : "border-line bg-surface hover:border-ink-faint/50 hover:shadow-[0_8px_22px_-16px_rgba(28,25,23,0.3)]"
      } motion-safe:hover:-translate-y-0.5`}
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
        <p className="mt-2.5 min-h-11 text-[13.5px] leading-snug text-ink-faint">{pack.audience}</p>

        {/* price — the largest thing in the card */}
        <p className="numeral mt-6 text-[46px] leading-none">{inr(pack.inr)}</p>

        <p className="mt-3 text-[15px] font-medium">
          {pack.images.toLocaleString("en-IN")} images
        </p>
        <p
          className={`mt-1 text-[17px] font-semibold ${featured ? "text-accent" : "text-ink-soft"}`}
        >
          {`₹${perImage(pack).toFixed(1)} / image`}
        </p>

        <p className="mt-2 min-h-5 text-[12.5px] leading-snug text-madder">{note}</p>

        <ul className="mt-6 flex-1 space-y-3 border-t border-line-soft pt-6">
          {pack.includes.map((item) => (
            <PricingFeature key={item}>{item}</PricingFeature>
          ))}
        </ul>

        <Link
          href="/contact"
          className={`mt-8 rounded-full px-5 py-3.5 text-center text-[15px] font-medium transition duration-200 ease-out motion-safe:active:scale-[0.985] ${
            featured
              ? "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover"
              : "border border-ink/15 text-ink hover:border-ink/40 hover:bg-surface-2 active:bg-surface-3"
          }`}
        >
          {pack.cta}
          <span className="sr-only">
            {" "}
            — {inr(pack.inr)} for {pack.images.toLocaleString("en-IN")} images
          </span>
        </Link>
        <p className="mt-3 text-center text-[12px] leading-snug text-ink-faint">{pack.microcopy}</p>
      </div>
    </article>
  );
}
