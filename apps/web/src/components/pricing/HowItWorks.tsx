import { STEPS } from "@/content/pricing";

/**
 * A timeline across the page on desktop, a plain vertical list on a phone.
 *
 * The columns fill the row evenly — an earlier version capped each paragraph at
 * `max-w-sm`, which crammed all three steps to the left and left a wide empty
 * band down the right of the section.
 */
export function HowItWorks() {
  return (
    <ol className="relative grid gap-10 md:grid-cols-3 md:gap-12">
      <span
        aria-hidden
        className="absolute left-0 right-0 top-[7px] hidden h-px bg-line md:block"
      />

      {STEPS.map((step) => (
        <li key={step.n} className="relative md:pt-10">
          <span
            aria-hidden
            className="absolute left-0 top-[3px] hidden h-2.5 w-2.5 rounded-full border-2 border-accent bg-ground md:block"
          />
          <span className="numeral text-[15px] tracking-[0.1em] text-ink-faint md:absolute md:left-6 md:top-0">
            {step.n}
          </span>
          <h3 className="mt-3 text-[19px] font-medium md:mt-0">{step.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
