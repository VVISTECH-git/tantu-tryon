/**
 * A single argument for why the pricing works the way it does. The mark is a
 * typographic symbol rather than an icon set — one less dependency, and it sits
 * in the same face as the prices.
 */
export function ValuePoint({
  mark,
  title,
  children,
}: {
  mark: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-madder/25 pt-6">
      <span aria-hidden className="numeral block text-[30px] leading-none text-madder">
        {mark}
      </span>
      <h3 className="mt-4 text-[17px] font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
