/** One line in a pack's feature list. The mark is decorative, not a checkmark
 *  claim — every line here is something the pack genuinely includes. */
export function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed text-ink-soft">
      <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-madder" />
      <span>{children}</span>
    </li>
  );
}
