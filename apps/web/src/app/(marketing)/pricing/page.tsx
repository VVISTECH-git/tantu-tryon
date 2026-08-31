import type { Metadata } from "next";
import { ComparisonTable } from "@/components/pricing/ComparisonTable";
import { ConciergePanel } from "@/components/pricing/ConciergePanel";
import { FAQAccordion } from "@/components/pricing/FAQAccordion";
import { FinalCTA } from "@/components/pricing/FinalCTA";
import { HowItWorks } from "@/components/pricing/HowItWorks";
import { PlanSelector } from "@/components/pricing/PlanSelector";
import { PricingCard } from "@/components/pricing/PricingCard";
import { ValuePoint } from "@/components/pricing/ValuePoint";
import { TextileWash } from "@/components/site/art/TextileWash";
import { FAQ, PACKS, PHILOSOPHY } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One-time image packs for model-worn catalogue imagery. No subscription, no expiry, and no charge for a render that fails.",
};

const TRUST = ["One-time purchase", "Credits never expire", "Commercial use included"];

export default function PricingPage() {
  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <section className="relative border-b border-line">
        <TextileWash />
        <div className="relative mx-auto max-w-[1280px] px-6 pt-14 pb-12 sm:pt-20 sm:pb-14">
          <p className="label mb-4">Pricing</p>
          <h1 className="display max-w-3xl text-[38px] leading-[1.08] sm:text-[56px]">
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

        <p className="mt-8 text-center text-[13px] text-ink-faint">
          Checkout isn&rsquo;t automated yet — we&rsquo;ll help you get your pack set up.
        </p>
      </section>

      {/* ── which one is right for you ───────────────────────────── */}
      <section aria-labelledby="choose" className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
        <h2 id="choose" className="display text-[28px] leading-tight sm:text-[36px]">
          Which one is right for you?
        </h2>
        <div className="mt-9">
          <PlanSelector />
        </div>
      </section>

      {/* ── why the pricing works this way ───────────────────────── */}
      <section aria-labelledby="philosophy" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
          <h2 id="philosophy" className="display max-w-2xl text-[30px] leading-tight sm:text-[40px]">
            No subscription. No ticking clock.
          </h2>

          <div className="mt-11 grid gap-10 md:grid-cols-3 md:gap-8">
            {PHILOSOPHY.map((item) => (
              <ValuePoint key={item.title} mark={item.mark} title={item.title}>
                {item.body}
              </ValuePoint>
            ))}
          </div>
        </div>
      </section>

      {/* ── against a studio shoot ───────────────────────────────── */}
      <section aria-labelledby="comparison" className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
        <h2 id="comparison" className="display max-w-3xl text-[30px] leading-tight sm:text-[40px]">
          A catalogue shoot, without the catalogue-shoot logistics.
        </h2>

        <div className="mt-11">
          <ComparisonTable />
        </div>

        <div className="mt-10 max-w-2xl rounded-xl border-l-2 border-madder bg-madder-wash/60 px-6 py-5">
          <p className="label !text-madder">A note on what this is</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            A generated image is not a photograph of your saree. It is a rendering — which is exactly
            why the fidelity check exists, and why every render keeps the fabric it came from.
          </p>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────── */}
      <section aria-labelledby="after" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-16 sm:py-20">
          <h2 id="after" className="display text-[28px] leading-tight sm:text-[36px]">
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
            <h2 id="faq" className="display text-[28px] leading-tight sm:text-[36px]">
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
