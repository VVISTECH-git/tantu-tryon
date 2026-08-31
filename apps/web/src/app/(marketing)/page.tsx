import Link from "next/link";
import { BorderRule, ImageSlot } from "@/components/site/art/Ornament";
import { TOOLS } from "@/content/tools";
import { PACKS, perImage, STUDIO_COST_INR } from "@/content/pricing";

const MODES = [
  {
    name: "Describe a model",
    tone: "madder" as const,
    body: "No model photograph at all. Say who should wear it — or say nothing and take the default — and the model is invented around your garment.",
  },
  {
    name: "Mannequin to model",
    tone: "indigo" as const,
    body: "Drape it on a mannequin and photograph it. Only the mannequin is replaced. The pleats, the border placement and the fall stay physically real.",
  },
  {
    name: "Try on a person",
    tone: "turmeric" as const,
    body: "A photograph of a person, and the garment goes onto them with their face, build and skin tone preserved.",
  },
];

const SLOTS = [
  { label: "Pallu", tone: "madder" as const },
  { label: "Body", tone: "indigo" as const },
  { label: "Border", tone: "turmeric" as const },
  { label: "Blouse", tone: "cream" as const },
];

const POSES = ["Front", "Three-quarter", "Back", "Waist-up", "Walking"];

export default function HomePage() {
  const cheapest = PACKS.reduce((best, pack) => (perImage(pack) < perImage(best) ? pack : best));

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 pt-12 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-madder-wash px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-madder" />
            <span className="label !text-madder">For Indian ethnic wear</span>
          </span>

          <h1 className="display mt-7 text-[46px] leading-[1.06] sm:text-[68px]">
            Photograph
            <br />
            the garment.
            <br />
            <span className="text-madder">Not a guess at it.</span>
          </h1>

          <p className="mt-8 max-w-lg text-[18px] leading-relaxed text-ink-soft">
            Load the pallu, the body, the border and the blouse as separate labelled shots. Tantu
            renders a model wearing <em>that</em> saree — your motif, at your scale, not a pattern
            that merely rhymes with it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/studio"
              className="rounded-full bg-accent px-7 py-3.5 text-[16px] font-medium text-white transition hover:bg-accent-hover"
            >
              Open the Studio →
            </Link>
            <Link
              href="/tools"
              className="rounded-full border border-line bg-surface px-7 py-3.5 text-[16px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
            >
              See what it does
            </Link>
          </div>

          <p className="mt-7 max-w-md text-[14px] leading-relaxed text-ink-faint">
            Nine poses from one set of photographs · Every render kept and re-runnable · A failed
            render is not charged
          </p>
        </div>

        {/* the cloth */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          <div className="overflow-hidden rounded-3xl lg:mt-14">
            <ImageSlot tone="madder" seed={0} vine ratio={3 / 4} />
          </div>
          <div className="overflow-hidden rounded-3xl">
            <ImageSlot tone="indigo" seed={1} ratio={3 / 4} />
          </div>
          <div className="overflow-hidden rounded-3xl">
            <ImageSlot tone="cream" seed={2} ratio={4 / 3} />
          </div>
          <div className="overflow-hidden rounded-3xl">
            <ImageSlot tone="turmeric" seed={3} vine ratio={4 / 3} />
          </div>
        </div>
      </section>

      <BorderRule className="h-4 w-full opacity-30" />

      {/* ── in, and out ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1400px] px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="label mb-3">What goes in</p>
            <h2 className="display text-[32px] leading-tight">
              Four shots, each one named.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-soft">
              Every other tool takes one flat photograph and lets the model guess at the rest. The
              pallu, the pleats and the border are folded away in that photograph — so they get
              invented. Name each shot and there is nothing left to invent.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SLOTS.map((slot, index) => (
              <figure key={slot.label}>
                <div className="overflow-hidden rounded-2xl">
                  <ImageSlot tone={slot.tone} seed={index + 4} ratio={1} />
                </div>
                <figcaption className="mt-3">
                  <span className="text-[15px] font-medium">{slot.label}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-faint">named, not guessed</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="label mb-3">What comes out</p>
            <h2 className="display text-[32px] leading-tight">
              A pose set, carrying the same cloth.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-soft">
              One image per pose, all rendered from those same photographs and streamed back as each
              one finishes. The body moves; the garment does not change.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {POSES.map((pose, index) => (
              <figure key={pose}>
                <div className="overflow-hidden rounded-2xl">
                  <ImageSlot tone="madder" seed={index} vine={index % 2 === 0} ratio={4 / 5} />
                </div>
                <figcaption className="mt-3 text-[13px] text-ink-faint">{pose}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── the argument, in madder ──────────────────────────────── */}
      <section className="bg-madder text-[#f7ece4]">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <h2 className="display text-[36px] leading-[1.12] sm:text-[46px]">
            On a hand-painted saree,
            <br />
            the motif <em>is</em> the product.
          </h2>
          <div className="space-y-5 text-[17px] leading-relaxed text-[#f0ded2]">
            <p>
              A saree is not a garment you put on a body. It is five and a half metres of cloth,
              pleated, tucked and thrown in a particular order, and most of it is folded out of sight
              in any photograph of it lying flat.
            </p>
            <p>
              So a model asked to work from one flat photograph invents the pallu, invents the
              pleats, and invents a border that looks roughly like yours. It is convincing until it
              arrives, and in Indian ethnic-wear ecommerce a quarter to two-fifths of everything sold
              already comes back.
            </p>
            <p className="text-white">
              Tantu is built so the print survives the process — and so you can check that it did,
              against the real cloth, before anything goes on a storefront.
            </p>
          </div>
        </div>
      </section>

      {/* ── modes ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1400px] px-6 py-20">
        <p className="label mb-3">Three ways to wear it</p>
        <h2 className="display max-w-2xl text-[32px] leading-tight sm:text-[40px]">
          Whether or not you have a model, a mannequin, or anything but the cloth.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {MODES.map((mode, index) => (
            <div key={mode.name} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <div className="h-52 overflow-hidden">
                <ImageSlot tone={mode.tone} seed={index + 8} vine ratio={16 / 9} />
              </div>
              <div className="p-7">
                <span className="label !text-madder">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="display mt-2 text-[23px]">{mode.name}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{mode.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── tools ────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="label mb-3">AI Tools</p>
              <h2 className="display text-[32px] leading-tight sm:text-[40px]">
                What is actually built
              </h2>
            </div>
            <Link href="/tools" className="ml-auto text-[15px] text-accent hover:underline">
              All tools →
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group rounded-2xl border border-line bg-ground p-7 transition hover:border-accent"
              >
                <div className="flex items-center gap-2">
                  <span className="label">{tool.kicker}</span>
                  {tool.status === "planned" && (
                    <span className="rounded-full bg-turmeric-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-turmeric">
                      planned
                    </span>
                  )}
                </div>
                <h3 className="display mt-2 text-[20px] group-hover:text-accent">{tool.name}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">{tool.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── cost ─────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1400px] gap-14 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="label mb-3">Cost</p>
          <h2 className="display text-[34px] leading-tight sm:text-[42px]">
            ₹{STUDIO_COST_INR.low}–{STUDIO_COST_INR.high} an image, and three days of waiting.
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-soft">
            That is what a studio shoot costs. This is ₹{perImage(cheapest).toFixed(1)} an image at
            volume and about a minute for a full pose set — but the reason to do it is that you can
            re-shoot a colourway on a Tuesday afternoon without booking anybody.
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-block rounded-full bg-accent px-7 py-3.5 text-[16px] font-medium text-white transition hover:bg-accent-hover"
          >
            See pricing
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line">
          {[
            ["Traditional shoot", `₹${STUDIO_COST_INR.low}–${STUDIO_COST_INR.high}`, "per image"],
            ["Tantu, at volume", `₹${perImage(cheapest).toFixed(1)}`, "per image"],
            ["Booking to delivery", "3–7 days", "traditional"],
            ["Upload to images", "a minute", "a full pose set"],
          ].map(([term, value, note]) => (
            <div key={term} className="bg-surface p-7">
              <dt className="label">{term}</dt>
              <dd className="display mt-2 text-[30px]">{value}</dd>
              <dd className="mt-1 text-[13px] text-ink-faint">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── close ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
          <div>
            <h2 className="display max-w-2xl text-[36px] leading-tight sm:text-[46px]">
              Bring one saree and four photographs.
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              You will know inside two minutes whether it holds your motif. That is the only question
              worth asking of any tool in this category, and it is the one nobody else lets you
              answer.
            </p>
            <Link
              href="/studio"
              className="mt-8 inline-block rounded-full bg-accent px-7 py-3.5 text-[16px] font-medium text-white transition hover:bg-accent-hover"
            >
              Open the Studio →
            </Link>
          </div>
          <div className="hidden overflow-hidden rounded-3xl lg:block">
            <ImageSlot tone="indigo" seed={5} vine ratio={5 / 4} />
          </div>
        </div>
      </section>
    </>
  );
}
