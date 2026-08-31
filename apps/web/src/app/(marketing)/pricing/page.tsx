import type { Metadata } from "next";
import { Accordion } from "@/components/pricing/Accordion";
import { PlanCard } from "@/components/pricing/PlanCard";
import { TextileWash } from "@/components/site/art/TextileWash";
import {
  DONE_FOR_YOU,
  FAQ,
  PACKS,
  PHILOSOPHY,
  SCENARIOS,
  STEPS,
  STUDIO_COST_INR,
  inr,
  packById,
  perImage,
} from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One-time image packs for model-worn catalogue imagery. No subscription, no expiry, and no charge for a render that fails.",
};

const COMPARISON = [
  {
    label: "Cost per image",
    studio: `₹${STUDIO_COST_INR.low}–${STUDIO_COST_INR.high} plus model fees`,
    tantu: "₹6–12",
  },
  { label: "Turnaround", studio: "3–7 days", tantu: "About a minute" },
  {
    label: "Logistics",
    studio: "Ship, iron, book, schedule",
    tantu: "Photograph the cloth where it is",
  },
  {
    label: "Re-shoot a colourway",
    studio: "Book it all again",
    tantu: "Change the colour, press Generate",
  },
];

export default function PricingPage() {
  const cheapest = PACKS.reduce((best, pack) => (perImage(pack) < perImage(best) ? pack : best));
  const trial = packById("trial");

  return (
    <>
      {/* ── 1 · hero ─────────────────────────────────────────────── */}
      <section className="relative border-b border-line">
        <TextileWash />
        <div className="relative mx-auto max-w-[1280px] px-6 pt-16 pb-14 sm:pt-20">
          <p className="label mb-4">Pricing</p>
          <h1 className="display max-w-3xl text-[42px] leading-[1.08] sm:text-[56px]">
            Buy images. Use them whenever.
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink-soft">
            No subscription. No expiry. No charge for a render that fails.
          </p>

          <ul className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-faint">
            {["One-time purchase", "Credits never expire", "Commercial use included"].map(
              (item, index) => (
                <li key={item} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden className="text-line">
                      ·
                    </span>
                  )}
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      {/* ── 2 · the packs ────────────────────────────────────────── */}
      <section aria-labelledby="packs" className="mx-auto max-w-[1280px] px-6 pt-16 pb-4">
        <h2 id="packs" className="sr-only">
          Image packs
        </h2>
        {/* Four across only from 1280 up: at 1024 it squeezed the cards to
            229px, which is where a price stops reading as a price. */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:items-start">
          {PACKS.map((pack) => (
            <PlanCard key={pack.id} pack={pack} />
          ))}
        </div>
        <p className="mt-8 text-center text-[13px] text-ink-faint">
          Checkout is not wired up yet — packs are arranged by talking to us.
        </p>
      </section>

      {/* ── 4 · which one is right for you ───────────────────────── */}
      <section aria-labelledby="choose" className="mx-auto max-w-[1280px] px-6 py-16">
        <h2 id="choose" className="display text-[30px] leading-tight sm:text-[36px]">
          Which one is right for you?
        </h2>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((scenario) => {
            const pack = packById(scenario.packId);
            const featured = Boolean(pack.featured);
            return (
              <li
                key={scenario.packId}
                className={`flex flex-col p-7 ${featured ? "bg-accent-wash" : "bg-surface"}`}
              >
                <p className="label">{scenario.situation}</p>
                <p className="display mt-3 flex items-center gap-2.5 text-[24px] leading-none">
                  {pack.name}
                  {featured && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                      Recommended
                    </span>
                  )}
                </p>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">
                  {scenario.body}
                </p>
                <p className="mt-5 text-[14px] text-ink-faint">
                  {inr(pack.inr)} · {pack.images.toLocaleString("en-IN")} images
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── 5 · why the pricing works this way ───────────────────── */}
      <section aria-labelledby="philosophy" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <h2 id="philosophy" className="display max-w-2xl text-[32px] leading-tight sm:text-[40px]">
            No subscription. No ticking clock.
          </h2>

          <dl className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {PHILOSOPHY.map((item) => (
              <div key={item.title} className="border-t border-madder/25 pt-6">
                <span aria-hidden className="numeral block text-[30px] leading-none text-madder">
                  {item.mark}
                </span>
                <dt className="mt-4 text-[17px] font-medium">{item.title}</dt>
                <dd className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 6 · against a studio shoot ───────────────────────────── */}
      <section aria-labelledby="comparison" className="mx-auto max-w-[1280px] px-6 py-20">
        <h2 id="comparison" className="display max-w-3xl text-[32px] leading-tight sm:text-[40px]">
          A catalogue shoot, without the catalogue-shoot logistics.
        </h2>

        {/* table on anything with room for one */}
        <table className="mt-12 hidden w-full border-collapse text-left md:table">
          <caption className="sr-only">
            A traditional studio shoot compared with Tantu, by cost, turnaround, logistics and
            re-shooting a colourway.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="label w-1/4 pb-4 pr-6 font-medium">
                <span className="sr-only">Measure</span>
              </th>
              <th scope="col" className="label pb-4 pr-6 font-medium">
                Studio shoot
              </th>
              <th scope="col" className="pb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-madder">
                Tantu
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-line-soft last:border-b-0">
                <th scope="row" className="py-6 pr-6 align-top text-[15px] font-medium">
                  {row.label}
                </th>
                <td className="py-6 pr-6 align-top text-[15px] leading-relaxed text-ink-faint">
                  {row.studio}
                </td>
                <td className="py-6 align-top text-[15px] leading-relaxed text-ink">{row.tantu}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* stacked on phones, where a three-column table is unreadable */}
        <div className="mt-10 space-y-4 md:hidden">
          {COMPARISON.map((row) => (
            <div key={row.label} className="rounded-xl border border-line bg-surface p-5">
              <p className="label">{row.label}</p>
              <div className="mt-3 space-y-2.5">
                <p className="text-[14px] leading-relaxed text-ink-faint">
                  <span className="mr-2 text-[12px] uppercase tracking-wide">Studio</span>
                  {row.studio}
                </p>
                <p className="text-[14px] leading-relaxed text-ink">
                  <span className="mr-2 text-[12px] uppercase tracking-wide text-madder">Tantu</span>
                  {row.tantu}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-2xl rounded-xl border-l-2 border-madder bg-madder-wash/60 px-6 py-5">
          <p className="label !text-madder">A note on what this is</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            A generated image is not a photograph of your saree. It is a rendering — which is exactly
            why the fidelity check exists, and why every render keeps the fabric it came from.
          </p>
        </div>
      </section>

      {/* ── 7 · what happens after you buy ───────────────────────── */}
      <section aria-labelledby="after" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <h2 id="after" className="display text-[30px] leading-tight sm:text-[36px]">
            What happens after you buy
          </h2>

          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-line pt-6">
                <span className="numeral text-[15px] tracking-[0.1em] text-madder">{step.n}</span>
                <h3 className="mt-3 text-[19px] font-medium">{step.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 8 · the concierge option ─────────────────────────────── */}
      <section aria-labelledby="service" className="mx-auto max-w-[1280px] px-6 py-20">
        <div className="overflow-hidden rounded-2xl bg-accent text-white">
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/60">
                Rather not touch it yourself?
              </p>
              <h2 id="service" className="display mt-4 text-[30px] leading-tight sm:text-[38px]">
                We will shoot the first one for you.
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/80">
                {DONE_FOR_YOU.what}
              </p>
            </div>

            <div className="border-t border-white/20 pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
              <p className="text-[12px] uppercase tracking-[0.14em] text-white/60">From</p>
              <p className="numeral mt-2 text-[40px] leading-none">
                {inr(DONE_FOR_YOU.fromInr)}
              </p>
              <p className="mt-2 text-[15px] text-white/75">per design, all colourways</p>
              <p className="mt-4 text-[15px] text-white/75">Back in {DONE_FOR_YOU.turnaround}.</p>
              <a
                href="/contact"
                className="mt-7 block rounded-full bg-white px-6 py-3.5 text-center text-[15px] font-medium text-accent transition duration-200 hover:bg-white/90"
              >
                Send us a design
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9 · questions ────────────────────────────────────────── */}
      <section aria-labelledby="faq" className="mx-auto max-w-[1280px] px-6 pb-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 id="faq" className="display text-[30px] leading-tight sm:text-[36px]">
              Questions
            </h2>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-ink-soft">
              If something here is not answered plainly enough, write to us and we will fix the
              wording.
            </p>
          </div>
          <Accordion items={FAQ} />
        </div>
      </section>

      {/* ── 10 · close ───────────────────────────────────────────── */}
      <section className="relative border-t border-line bg-surface">
        <TextileWash />
        <div className="relative mx-auto max-w-[1280px] px-6 py-20 text-center">
          <h2 className="display mx-auto max-w-2xl text-[32px] leading-tight sm:text-[42px]">
            Ready to turn your fabric into a catalogue?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-soft">
            Start with {trial.images} images. No subscription. No expiry.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/contact"
              className="rounded-full bg-accent px-7 py-3.5 text-[16px] font-medium text-white transition duration-200 hover:bg-accent-hover"
            >
              Start with Trial — {inr(trial.inr)}
            </a>
            <a
              href="/contact"
              className="rounded-full border border-ink/15 px-7 py-3.5 text-[16px] text-ink transition duration-200 hover:border-ink/40 hover:bg-surface-2"
            >
              Talk to us
            </a>
          </div>

          <p className="mt-6 text-[13px] text-ink-faint">
            Buying at volume instead? {cheapest.name} is {inr(cheapest.inr)} for{" "}
            {cheapest.images.toLocaleString("en-IN")} images.
          </p>
        </div>
      </section>
    </>
  );
}
