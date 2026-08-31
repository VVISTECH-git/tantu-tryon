import { STUDIO_COST_INR } from "@/content/pricing";

const ROWS = [
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

/**
 * A real table where there is room for one, and a stacked comparison on a
 * phone. Three columns of prose at 375px is unreadable, and a horizontally
 * scrolling table hides half the argument behind a gesture nobody makes.
 */
export function ComparisonTable() {
  return (
    <>
      <table className="hidden w-full border-collapse text-left md:table">
        <caption className="sr-only">
          A traditional studio shoot compared with Tantu, by cost per image, turnaround, logistics
          and re-shooting a colourway.
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-1/4 pb-4 pr-6">
              <span className="sr-only">Measure</span>
            </th>
            <th scope="col" className="label pb-4 pr-6 font-medium">
              Studio shoot
            </th>
            <th
              scope="col"
              className="pb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-madder"
            >
              Tantu
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-line-soft last:border-b-0">
              <th scope="row" className="py-6 pr-6 align-top text-[15px] font-medium">
                {row.label}
              </th>
              <td className="py-6 pr-6 align-top text-[15px] leading-relaxed text-ink-faint">
                {row.studio}
              </td>
              <td className="bg-madder-wash/40 px-5 py-6 align-top text-[15px] font-medium leading-relaxed text-ink">
                {row.tantu}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-4 md:hidden">
        {ROWS.map((row) => (
          <div key={row.label} className="overflow-hidden rounded-xl border border-line bg-surface">
            <p className="label border-b border-line-soft px-5 py-3">{row.label}</p>
            <div className="px-5 py-4">
              <p className="text-[12px] uppercase tracking-wide text-ink-faint">Studio shoot</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-faint">{row.studio}</p>
            </div>
            <div className="bg-madder-wash/50 px-5 py-4">
              <p className="text-[12px] uppercase tracking-wide text-madder">Tantu</p>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink">{row.tantu}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
