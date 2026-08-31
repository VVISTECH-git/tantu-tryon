import Link from "next/link";
import { TextileWash } from "@/components/site/art/TextileWash";
import { inr, packById } from "@/content/pricing";

export function FinalCTA() {
  const trial = packById("trial");

  return (
    <section className="relative border-t border-line bg-surface">
      <TextileWash />
      <div className="relative mx-auto max-w-[1280px] px-6 py-20 text-center sm:py-24">
        <h2 className="display mx-auto max-w-2xl text-[32px] leading-tight sm:text-[42px]">
          Ready to turn your fabric into a catalogue?
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-soft">
          Start with {trial.images} images. No subscription. No expiry.
        </p>

        <div className="mx-auto mt-9 flex max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/contact"
            className="rounded-full bg-accent px-7 py-3.5 text-[16px] font-medium text-white transition duration-200 ease-out hover:bg-accent-hover motion-safe:active:scale-[0.985]"
          >
            Start with Trial — {inr(trial.inr)}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-ink/15 px-7 py-3.5 text-[16px] text-ink transition duration-200 ease-out hover:border-ink/40 hover:bg-surface-2 motion-safe:active:scale-[0.985]"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
