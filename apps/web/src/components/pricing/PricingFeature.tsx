/**
 * One line in a pack's feature list. The marker is neutral — madder is spent
 * only where it signals a recommendation or a value, and a bullet signals
 * neither.
 */
export function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed text-ink-soft">
      <span aria-hidden className="mt-[9px] h-px w-2.5 shrink-0 bg-line" />
      <span>{children}</span>
    </li>
  );
}
