import type { Metadata } from "next";
import { ComparisonTable } from "@/components/pricing/ComparisonTable";
import { ConciergePanel } from "@/components/pricing/ConciergePanel";
import { FAQAccordion } from "@/components/pricing/FAQAccordion";
import { FinalCTA } from "@/components/pricing/FinalCTA";
import { HowItWorks } from "@/components/pricing/HowItWorks";
import { PlanSelector } from "@/components/pricing/PlanSelector";
import { PricingCard } from "@/components/pricing/PricingCard";
import { ImageSlot } from "@/components/site/art/Ornament";
import { TextileWash } from "@/components/site/art/TextileWash";
import { ValuePoint } from "@/components/site/ValuePoint";
import { FAQ, PACKS, PHILOSOPHY } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One-time image packs for model-worn catalogue imagery. No subscription, no expiry, and no charge for a render that fails.",
};

const TRUST = ["One-time purchase", "Credits never expire", "Commercial use included"];

/**
 * Section rhythm, deliberately alternating so the page does not read as six
 * identical heading-plus-card-grid blocks:
 *
 *   cream hero (with cloth)  →  cream cards  →  cream decision list
 *   → surface value points   →  DARK comparison (with cloth)
 *   → surface steps          →  NAVY concierge  →  cream FAQ  →  surface close
 */
export default function PricingPage() {
  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <section className="relative border-b border-line">
        <TextileWash />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-6 pt-14 pb-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] lg:gap-16 lg:pb-16">
          <div>
            <p className="label mb-4">Pricing</p>
            <h1 className="display max-w-2xl text-[38px] leading-[1.08] sm:text-[54px]">
              Buy images. Use them whenever.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[18px]">
              No subscription. No expiry. No charge for a render that fails.
            </p>

            <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-faint">
              {TRUST.map((item, index) => (
                <li key={item} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden className="text-line">
                      ·
                    </span>
                  )}
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-2xl">
              <ImageSlot tone="madder" seed={1} vine ratio={3 / 4} />
            </div>
            <div className="overflow-hidden rounded-2xl sm:mt-8">
              <ImageSlot tone="indigo" seed={4} ratio={3 / 4} />
            </div>
          </div>
        </div>
      </section>

      {/* ── the packs ────────────────────────────────────────────── */}
      <section aria-labelledby="packs" className="mx-auto max-w-[1280px] px-6 pt-14 sm:pt-16">
        <h2 id="packs" className="sr-only">
          Image packs
        </h2>

        {/* Four across only from 1280 up: at 1024 it squeezed the cards to
            229px, which is where a price stops reading as a price. */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:items-start">
          {PACKS.map((pack) => (
            <PricingCard key={pack.id} pack={pack} />
          ))}
        </div>
      </section>

      {/* ── which one is right for you ───────────────────────────── */}
      <section aria-labelledby="choose" className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
        <h2 id="choose" className="display text-[28px] leading-tight sm:text-[34px]">
          Which one is right for you?
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Find the row that sounds like you. The numbers are on the cards above.
        </p>
        <div className="mt-8">
          <PlanSelector />
        </div>
      </section>

      {/* ── why the pricing works this way ───────────────────────── */}
      <section aria-labelledby="philosophy" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
          <h2 id="philosophy" className="display max-w-2xl text-[30px] leading-tight sm:text-[40px]">
            No subscription. No ticking clock.
          </h2>

          <div className="mt-11 grid gap-10 md:grid-cols-3 md:gap-12">
            {PHILOSOPHY.map((item) => (
              <ValuePoint key={item.title} mark={item.mark} title={item.title}>
                {item.body}
              </ValuePoint>
            ))}
          </div>
        </div>
      </section>

      {/* ── against a studio shoot — the page's dark break ───────── */}
      <section aria-labelledby="comparison" className="bg-ink text-white">
        <div className="mx-auto max-w-[1280px] px-6 py-18 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)] lg:items-center lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                Against a studio shoot
              </p>
              <h2
                id="comparison"
                className="display mt-4 max-w-2xl text-[30px] leading-tight sm:text-[40px]"
              >
                A catalogue shoot, without the catalogue-shoot logistics.
              </h2>
            </div>
            <div className="hidden overflow-hidden rounded-2xl lg:block">
              <ImageSlot tone="madder" seed={7} vine ratio={4 / 3} />
            </div>
          </div>

          <div className="mt-12">
            <ComparisonTable />
          </div>

          <div className="mt-10 max-w-2xl border-l-2 border-white/25 pl-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
              A note on what this is
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-white/80">
              A generated image is not a photograph of your saree. It is a rendering — which is
              exactly why the fidelity check exists, and why every render keeps the fabric it came
              from.
            </p>
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────── */}
      <section aria-labelledby="after" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
          <h2 id="after" className="display text-[28px] leading-tight sm:text-[34px]">
            What happens after you buy
          </h2>
          <div className="mt-11">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* ── the concierge option ─────────────────────────────────── */}
      <section aria-labelledby="service" className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
        <ConciergePanel />
      </section>

      {/* ── questions ────────────────────────────────────────────── */}
      <section aria-labelledby="faq" className="mx-auto max-w-[1280px] px-6 pb-16 sm:pb-20">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 id="faq" className="display text-[28px] leading-tight sm:text-[34px]">
              Questions
            </h2>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-ink-soft">
              If something here is not answered plainly enough, write to us and we will fix the
              wording.
            </p>
          </div>
          <FAQAccordion items={FAQ} />
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
