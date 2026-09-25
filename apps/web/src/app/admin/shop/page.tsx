import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, garments, generations } from "@/db";
import { requirePage } from "@/lib/page-auth";
import { usersOf } from "@/lib/session";
import { balancePaise, rupees } from "@/lib/spend";
import { saveUserAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * A shop's own page, for its owner: what is left to spend, who can sign in,
 * and what the shop has made. Nothing here reaches another shop or the
 * platform's settings.
 */
export default async function ShopPage() {
  const account = await requirePage("/admin/shop", { roles: ["owner"] });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [balance, people, [products], [month], recent] = await Promise.all([
    balancePaise(account.id),
    usersOf(account.id),
    db.select({ n: sql<number>`count(*)::int` }).from(garments).where(eq(garments.accountId, account.id)),
    db
      .select({ n: sql<number>`count(*)::int`, paise: sql<number>`coalesce(sum(${generations.creditsPaise}), 0)::int` })
      .from(generations)
      .where(and(eq(generations.accountId, account.id), eq(generations.status, "done"), gte(generations.startedAt, monthStart))),
    db
      .select({ id: generations.id, startedAt: generations.startedAt, status: generations.status, promptId: generations.promptId, creditsPaise: generations.creditsPaise, code: garments.productCode, title: garments.title })
      .from(generations)
      .innerJoin(garments, eq(generations.garmentId, garments.id))
      .where(eq(generations.accountId, account.id))
      .orderBy(desc(generations.startedAt))
      .limit(20),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="label">Shop</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{account.name}</h1>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Balance" value={rupees(balance)} sub="left to spend on images" />
        <Card label="This month" value={String(month?.n ?? 0)} sub={`images · ${rupees(month?.paise ?? 0)}`} />
        <Card label="Products" value={String(products?.n ?? 0)} sub="with photos saved" />
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold">People</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Everyone signs in with their own name and works on this shop&apos;s products. A photographer can only open products and take photos; studio can also generate images; an owner can also manage people here.
        </p>
        <table className="mt-3 w-full text-[13.5px]">
          <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
            <tr><th className="py-1.5">Username</th><th>Role</th></tr>
          </thead>
          <tbody>
            {people.map((u) => (
              <tr key={u.username ?? "shop"} className="border-t border-line-soft">
                <td className="py-1.5">{u.username ?? "—"}</td>
                <td className="capitalize">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={saveUserAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[12px] text-ink-faint">Username</span>
            <input name="username" required pattern="[a-zA-Z0-9._-]{3,32}" className="mt-1 w-40 rounded-lg border border-line bg-ground px-3 py-1.5 text-[14px] outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-faint">Password</span>
            <input name="password" type="password" required minLength={6} className="mt-1 w-40 rounded-lg border border-line bg-ground px-3 py-1.5 text-[14px] outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-faint">Role</span>
            <select name="role" defaultValue="photographer" className="mt-1 rounded-lg border border-line bg-ground px-3 py-1.5 text-[14px] outline-none focus:border-accent">
              <option value="photographer">Photographer</option>
              <option value="studio">Studio</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-line px-4 py-2 text-[14px] hover:border-ink-faint">
            Save person
          </button>
        </form>
        <p className="mt-2 text-[12.5px] text-ink-faint">Saving an existing username changes its password and role.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold">Recent images</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-1.5">When</th><th>Product</th><th>Pose</th><th>Status</th><th className="text-right">Charged</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="py-3 text-ink-faint">Nothing yet.</td></tr>}
              {recent.map((g) => (
                <tr key={g.id} className="border-t border-line-soft">
                  <td className="py-1.5 tabular-nums whitespace-nowrap">{g.startedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{g.code ?? g.title}</td>
                  <td>{g.promptId}</td>
                  <td className={g.status === "done" ? "text-good" : g.status === "running" ? "text-turmeric" : "text-danger"}>{g.status}</td>
                  <td className="text-right tabular-nums">{rupees(g.creditsPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="label">{label}</p>
      <p className="numeral mt-1 text-[28px]">{value}</p>
      <p className="text-[12.5px] text-ink-faint">{sub}</p>
    </div>
  );
}
