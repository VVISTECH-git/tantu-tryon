import Link from "next/link";
import { DONE_FOR_YOU, inr } from "@/content/pricing";

/**
 * The done-for-you option. Deliberately not shaped like a fifth pricing card —
 * it is a different kind of offer, and a manufacturer who wants it is usually
 * the one who did not want to open the tool in the first place.
 */
export function ConciergePanel() {
  return (
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
          <p className="numeral mt-2 text-[40px] leading-none">{inr(DONE_FOR_YOU.fromInr)}</p>
          <p className="mt-2 text-[15px] text-white/75">per design, all colourways</p>
          <p className="mt-4 text-[15px] text-white/75">Back in {DONE_FOR_YOU.turnaround}.</p>
          <Link
            href="/contact"
            className="mt-7 block rounded-full bg-white px-6 py-3.5 text-center text-[15px] font-medium text-accent transition duration-200 ease-out hover:bg-white/90 motion-safe:active:scale-[0.985]"
          >
            Send us a design
          </Link>
        </div>
      </div>
    </div>
  );
}
