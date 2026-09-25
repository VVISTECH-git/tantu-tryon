import { desc, eq } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { requirePage } from "@/lib/page-auth";
import { IMAGE_OPTIONS, chosenImageOption, livePrices, liveRate } from "@/lib/imageModels";
import { balancePaise, rupees, spendSummary, sweepStale } from "@/lib/spend";
import { grantAction, setCapsAction, setImageModelAction, togglePauseAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Where the money is watched.
 *
 * Today and this month against their caps, the last thirty days by day, what
 * is running right now, and the switch that stops everything without a
 * deploy. Every generation row is listed with its cost so a surprise on the
 * Google bill can be traced to the image that caused it.
 */
export default async function SpendPage() {
  const account = await requirePage("/admin/spend");
  await sweepStale();
  // Read fresh on every visit: Google's price page and today's dollar rate.
  const [prices, rate, chosen] = await Promise.all([livePrices(), liveRate(), chosenImageOption()]);
  const summary = await spendSummary();
  const balance = await balancePaise(account.id);
  const recent = await db
    .select({
      id: generations.id,
      startedAt: generations.startedAt,
      status: generations.status,
      promptId: generations.promptId,
      model: generations.model,
      costPaise: generations.costPaise,
      creditsPaise: generations.creditsPaise,
      ms: generations.ms,
      error: generations.error,
      title: garments.title,
      code: garments.productCode,
    })
    .from(generations)
    .innerJoin(garments, eq(generations.garmentId, garments.id))
    .orderBy(desc(generations.startedAt))
    .limit(50);

  const killed = process.env.GENERATION_DISABLED === "true";
  const { limits } = summary;
  const pct = (spent: number, cap: number) => Math.min(100, Math.round((spent / Math.max(cap, 1)) * 100));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="label">Admin</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Settings</h1>

      <form action={setImageModelAction} className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Image model</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Every everyday image is made with the model you pick here. Prices are Google&apos;s, per image, converted at ${"1"} = ₹{rate.value.toFixed(2)}.
        </p>
        <p className="mt-1 text-[12.5px] text-ink-faint">
          <Freshness label="Prices" reading={prices} /> · <Freshness label="Dollar rate" reading={rate} />
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="py-1.5 pr-2">Use</th>
                <th>Model</th>
                <th className="text-right">Normal</th>
                <th className="text-right">Batch</th>
              </tr>
            </thead>
            <tbody>
              {IMAGE_OPTIONS.map((o) => {
                const p = prices.value[o.id];
                const inr = (usd: number | null | undefined) => (usd == null ? "–" : `₹${(usd * rate.value).toFixed(2)}`);
                const usd = (v: number | null | undefined) => (v == null ? "" : `$${v}`);
                return (
                  <tr key={o.id} className={`border-t border-line-soft ${o.selectable ? "" : "text-ink-faint"}`}>
                    <td className="py-2 pr-2">
                      <input type="radio" name="option" value={o.id} defaultChecked={o.id === chosen.id} disabled={!o.selectable} aria-label={`${o.name} ${o.detail}`} />
                    </td>
                    <td>
                      <b className={o.id === chosen.id ? "text-accent" : ""}>{o.name}</b> <span className="text-ink-soft">· {o.detail}</span>
                      {o.id === chosen.id && <span className="ml-2 text-[12px] text-good">in use</span>}
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">{inr(p?.normal)} <span className="text-[11.5px] text-ink-faint">{usd(p?.normal)}</span></td>
                    <td className="text-right tabular-nums whitespace-nowrap">{inr(p?.batch)} <span className="text-[11.5px] text-ink-faint">{usd(p?.batch)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-faint">Batch is half price but Google returns the image within 24 hours, so the app uses Normal.</p>
        <button type="submit" className="mt-3 rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
          Save model
        </button>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Today" value={rupees(summary.todayPaise)} sub={`of ${rupees(limits.dailyCapPaise)} cap`} pct={pct(summary.todayPaise, limits.dailyCapPaise)} />
        <Card label="This month" value={rupees(summary.monthPaise)} sub={`of ${rupees(limits.monthlyCapPaise)} cap`} pct={pct(summary.monthPaise, limits.monthlyCapPaise)} />
        <Card label="Running now" value={String(summary.running)} sub={`limit ${limits.globalRunning} · rate ₹${limits.ratePaisePerUsd / 100}/$`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Switches</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Kill switch (env GENERATION_DISABLED): <b className={killed ? "text-danger" : "text-good"}>{killed ? "ON — nothing generates" : "off"}</b>
          </p>
          <form action={togglePauseAction} className="mt-3">
            <input type="hidden" name="paused" value={limits.paused ? "false" : "true"} />
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-[14px] font-medium text-white ${limits.paused ? "bg-good" : "bg-danger"}`}
            >
              {limits.paused ? "Resume generation" : "Pause generation"}
            </button>
            <p className="mt-2 text-[12.5px] text-ink-faint">
              {limits.paused ? "Paused: every request is refused until resumed." : "Running. Pausing takes effect on the next request, no deploy."}
            </p>
          </form>
        </div>

        <form action={setCapsAction} className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Caps (₹)</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field name="daily" label="Per day" value={limits.dailyCapPaise / 100} />
            <Field name="monthly" label="Per month" value={limits.monthlyCapPaise / 100} />
          </div>
          <button type="submit" className="mt-3 rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
            Save caps
          </button>
        </form>

        <form action={grantAction} className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Credits</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            House balance <b className="tabular-nums text-ink">{rupees(balance)}</b>
          </p>
          <div className="mt-3 flex gap-2">
            <input name="rupees" type="number" min={1} defaultValue={500} className="w-28 rounded-lg border border-line bg-ground px-3 py-2 text-[14px] tabular-nums outline-none focus:border-accent" />
            <button type="submit" className="rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
              Grant
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Last 30 days</h2>
        <table className="mt-2 w-full text-[13.5px]">
          <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
            <tr><th className="py-1.5">Day</th><th>Images</th><th>Failed</th><th className="text-right">Cost</th></tr>
          </thead>
          <tbody>
            {summary.byDay.length === 0 && <tr><td colSpan={4} className="py-3 text-ink-faint">Nothing yet.</td></tr>}
            {summary.byDay.map((d) => (
              <tr key={d.day} className="border-t border-line-soft">
                <td className="py-1.5 tabular-nums">{d.day}</td>
                <td className="tabular-nums">{d.images}</td>
                <td className="tabular-nums">{d.failed}</td>
                <td className="text-right tabular-nums">{rupees(d.paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Recent generations</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-1.5">When</th><th>Product</th><th>Prompt</th><th>Model</th><th>Status</th><th className="text-right">Cost</th><th className="text-right">Charged</th><th className="text-right">s</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={8} className="py-3 text-ink-faint">Nothing yet.</td></tr>}
              {recent.map((g) => (
                <tr key={g.id} className="border-t border-line-soft align-top" title={g.error ?? ""}>
                  <td className="py-1.5 tabular-nums whitespace-nowrap">{g.startedAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{g.code ? `${g.code} ` : ""}<span className="text-ink-soft">{g.title}</span></td>
                  <td>{g.promptId}</td>
                  <td className="text-ink-soft">{g.model.replace("gemini-", "")}</td>
                  <td>
                    <span className={g.status === "done" ? "text-good" : g.status === "running" ? "text-turmeric" : "text-danger"}>{g.status}</span>
                    {g.error && <span className="ml-1 text-ink-faint" aria-label={g.error}>· {g.error.slice(0, 60)}</span>}
                  </td>
                  <td className="text-right tabular-nums">{rupees(g.costPaise)}</td>
                  <td className="text-right tabular-nums">{rupees(g.creditsPaise)}</td>
                  <td className="text-right tabular-nums">{g.ms ? (g.ms / 1000).toFixed(0) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Freshness({ label, reading }: { label: string; reading: { source: "live" | "saved" | "hand"; at: string; problem?: string } }) {
  const when = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(+d) ? iso : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  if (reading.source === "live") return <span>{label} read live at {when(reading.at)}</span>;
  return (
    <span className="text-turmeric" title={reading.problem}>
      {label}: could not be read just now ({reading.problem}); showing {reading.source === "saved" ? `the reading from ${when(reading.at)}` : `the list checked on ${reading.at}`}
    </span>
  );
}

function Card({ label, value, sub, pct }: { label: string; value: string; sub: string; pct?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="label">{label}</p>
      <p className="numeral mt-1 text-[28px]">{value}</p>
      <p className="text-[12.5px] text-ink-faint">{sub}</p>
      {pct !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className={`h-full ${pct >= 90 ? "bg-danger" : pct >= 60 ? "bg-turmeric" : "bg-good"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Field({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-faint">{label}</span>
      <input name={name} type="number" min={0} step="any" defaultValue={value} className="mt-1 w-full rounded-lg border border-line bg-ground px-3 py-1.5 text-[14px] tabular-nums outline-none focus:border-accent" />
    </label>
  );
}
