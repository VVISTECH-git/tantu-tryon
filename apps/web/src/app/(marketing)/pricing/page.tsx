import type { Metadata } from "next";
import { DONE_FOR_YOU, PACKS, STUDIO_COST_INR, perImage } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Image packs that do not expire. A failed render is not charged.",
};

const FAQ = [
  {
    q: "Do credits expire?",
    a: "No. Not after thirty days, not at the end of a month, not at all. If that ever changes it will change here first and you will be told before it applies to anything you have already bought.",
  },
  {
    q: "Am I charged for a render that fails?",
    a: "No. Failures are tracked per pose rather than per batch, so one refused image never costs you the other four. If you press Stop, poses that had not started never start.",
  },
  {
    q: "Can I sell the images?",
    a: "Yes. Every pack includes commercial use — your website, your Shopify store, marketplace listings, advertising, print.",
  },
  {
    q: "What happens to the photographs I upload?",
    a: "They are sent to the image engine to make your render and are not used to train anything. Your renders are kept so you can find and re-run them, and you can delete any of them at any time.",
  },
  {
    q: "How many images is a saree?",
    a: "A standard catalogue set is five poses. Nine if you want the walking, seated and macro detail shots as well. Most people settle on five per colourway.",
  },
  {
    q: "Is there a subscription?",
    a: "No. You buy a pack of images and use them when you use them.",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16">
      <div className="text-center">
        <p className="label mb-3">Pricing</p>
        <h1 className="display mx-auto max-w-3xl text-[38px] leading-tight sm:text-[48px]">
          Buy images. Use them whenever.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
          No subscription, no expiry, and no charge for a render that fails.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`flex flex-col rounded-2xl border p-7 ${
              pack.featured ? "border-accent bg-surface shadow-sm" : "border-line bg-surface"
            }`}
          >
            {pack.featured && (
              <span className="mb-3 self-start rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                most chosen
              </span>
            )}
            <h2 className="display text-[24px]">{pack.name}</h2>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-faint">{pack.audience}</p>

            <p className="display mt-6 text-[36px]">₹{pack.inr.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[14px] text-ink-soft">
              {pack.images} images · ₹{perImage(pack).toFixed(1)} each
            </p>

            <ul className="mt-6 space-y-2.5">
              {pack.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
                  <span className="text-madder">·</span>
                  {item}
                </li>
              ))}
            </ul>

            <a
              href="/contact"
              className={`mt-7 rounded-full px-5 py-3 text-center text-[15px] font-medium transition ${
                pack.featured
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "border border-line text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              Talk to us
            </a>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[14px] text-ink-faint">
        Checkout is not wired up yet — packs are arranged by talking to us.
      </p>

      {/* ── done for you ─────────────────────────────────────────── */}
      <section className="mt-20 rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="label mb-3">Rather not touch it yourself?</p>
            <h2 className="display text-[30px] leading-tight">We will shoot the first one for you.</h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-soft">
              {DONE_FOR_YOU.what}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-ground p-7">
            <p className="label">From</p>
            <p className="display mt-1 text-[34px]">
              ₹{DONE_FOR_YOU.fromInr.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[14px] text-ink-soft">per design, all colourways</p>
            <p className="mt-4 text-[14px] text-ink-soft">
              Back in {DONE_FOR_YOU.turnaround}.
            </p>
            <a
              href="/contact"
              className="mt-6 block rounded-full bg-accent px-5 py-3 text-center text-[15px] font-medium text-white transition hover:bg-accent-hover"
            >
              Send us a design
            </a>
          </div>
        </div>
      </section>

      {/* ── against a studio ─────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="display text-[30px]">Against a studio shoot</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] border-collapse bg-surface text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-6 py-4">&nbsp;</th>
                <th className="label px-6 py-4">Studio shoot</th>
                <th className="label px-6 py-4">Tantu</th>
              </tr>
            </thead>
            <tbody className="text-[15px]">
              {[
                [
                  "Cost per image",
                  `₹${STUDIO_COST_INR.low}–${STUDIO_COST_INR.high} plus model fees`,
                  `₹${perImage(PACKS[PACKS.length - 1]!).toFixed(1)}–${perImage(PACKS[0]!).toFixed(1)}`,
                ],
                ["Turnaround", "3–7 days", "About a minute for a pose set"],
                ["Logistics", "Ship, iron, book, schedule", "Photograph the cloth where it is"],
                ["Re-shoot a colourway", "Book it all again", "Change the colour, press Generate"],
                ["What it cannot do", "Nothing — it is a real photograph", "It is generated; check it against the fabric"],
              ].map(([label, studio, tantu]) => (
                <tr key={label} className="border-b border-line-soft last:border-b-0">
                  <td className="px-6 py-4 font-medium">{label}</td>
                  <td className="px-6 py-4 text-ink-soft">{studio}</td>
                  <td className="px-6 py-4 text-ink-soft">{tantu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-ink-faint">
          The last row is there on purpose. A generated image is not a photograph of your saree, it
          is a rendering of it — which is exactly why the fidelity check exists.
        </p>
      </section>

      {/* ── faq ──────────────────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="display text-[30px]">Questions</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-line bg-surface p-7">
              <h3 className="text-[16px] font-medium">{item.q}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
