/**
 * A single argument, marked with a typographic symbol rather than an icon set.
 *
 * The mark is deliberately neutral: madder is reserved for the recommendation
 * and value signals, so spending it here would dilute the one place on the page
 * where it has a job.
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
    <div className="border-t border-line pt-6">
      <span aria-hidden className="numeral block text-[30px] leading-none text-ink-faint">
        {mark}
      </span>
      <h3 className="mt-4 text-[17px] font-medium">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
