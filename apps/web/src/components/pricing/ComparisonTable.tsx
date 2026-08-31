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
 * Built for a dark ground — this is the page's mid-point break, so it inverts.
 *
 * A real table where there is room for one, and a stacked comparison on a phone.
 * Three columns of prose at 375px is unreadable, and a horizontally scrolling
 * table hides half the argument behind a gesture nobody makes.
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
          <tr className="border-b border-white/15">
            <th scope="col" className="w-1/4 pb-4 pr-6">
              <span className="sr-only">Measure</span>
            </th>
            <th
              scope="col"
              className="pb-4 pr-6 text-[11px] font-medium uppercase tracking-[0.1em] text-white/45"
            >
              Studio shoot
            </th>
            <th
              scope="col"
              className="rounded-t-lg bg-white/8 px-5 pb-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white"
            >
              Tantu
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, index) => (
            <tr key={row.label} className="border-b border-white/10 last:border-b-0">
              <th
                scope="row"
                className="py-6 pr-6 align-top text-[15px] font-medium text-white/90"
              >
                {row.label}
              </th>
              <td className="py-6 pr-6 align-top text-[15px] leading-relaxed text-white/45">
                {row.studio}
              </td>
              <td
                className={`bg-white/8 px-5 py-6 align-top text-[15px] font-medium leading-relaxed text-white ${
                  index === ROWS.length - 1 ? "rounded-b-lg" : ""
                }`}
              >
                {row.tantu}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-4 md:hidden">
        {ROWS.map((row) => (
          <div key={row.label} className="overflow-hidden rounded-xl border border-white/15">
            <p className="border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-[0.1em] text-white/45">
              {row.label}
            </p>
            <div className="px-5 py-4">
              <p className="text-[12px] uppercase tracking-wide text-white/40">Studio shoot</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/55">{row.studio}</p>
            </div>
            <div className="bg-white/8 px-5 py-4">
              <p className="text-[12px] uppercase tracking-wide text-white/70">Tantu</p>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-white">{row.tantu}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
