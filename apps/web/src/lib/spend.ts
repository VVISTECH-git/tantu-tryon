import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { creditLedger, db, generations, settings, type GenerationLook } from "@/db";
import { CREDIT_PAISE, rupees } from "@/content/credits";
import { savedPrices, usdFor, type ImageSize } from "@/lib/imageModels";

export { CREDIT_PAISE, rupees };

/**
 * The brake.
 *
 * Every call to the image engine costs real money and there is no way to
 * take it back, so everything that could stop one is checked here, in one
 * function, inside one transaction, before the call is made:
 *
 *   1. the kill switch in the environment, then the pause flag in the database
 *   2. today's and this month's spend, including calls still in flight,
 *      against the caps
 *   3. how many calls this account and the whole app have running
 *   4. the account's credit balance
 *
 * Then the generation row is written as `running`, carrying the list price,
 * and the credits are debited — so the very next request's check already
 * counts this one. Only after the commit is Google called. The lock is a
 * transaction-scoped advisory lock: Neon's pooler is PgBouncer in transaction
 * mode, so a session-level lock could be released against the wrong backend.
 *
 * `finishGeneration` closes the row afterwards. Anything that never gets
 * closed is found by `sweepStale` and refunded.
 */

// ── Prices ────────────────────────────────────────────────────────────────────

/** Input tokens for a prompt and a sheet: small, but not nothing. */
const INPUT_USD = 0.002;

export function imageSizeFor(quality: GenerationLook["quality"]): "1K" | "2K" {
  return quality === "high" ? "2K" : "1K";
}

/**
 * Our estimated cost for one call, in paise: the last price read from
 * Google's page (see lib/imageModels.ts), or Pro's price for a model it does
 * not know, so an unknown model is over- rather than under-counted.
 */
export async function listCostPaise(model: string, size: ImageSize, ratePaisePerUsd: number): Promise<number> {
  const usd = (usdFor(await savedPrices(), model, size) ?? 0.134) + INPUT_USD;
  return Math.round(usd * ratePaisePerUsd);
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function setting(key: string): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface Limits {
  dailyCapPaise: number;
  monthlyCapPaise: number;
  ratePaisePerUsd: number;
  paused: boolean;
  perAccountRunning: number;
  globalRunning: number;
}

/** Caps and rates: the database row wins over the environment, the environment over the default. */
export async function limits(): Promise<Limits> {
  const [daily, monthly, rate, paused] = await Promise.all([
    setting("spend_cap_daily_paise"),
    setting("spend_cap_monthly_paise"),
    setting("usd_inr_paise"),
    setting("generation_paused"),
  ]);
  return {
    dailyCapPaise: daily ? Number(daily) : envNumber("SPEND_CAP_DAILY_INR", 500) * 100,
    monthlyCapPaise: monthly ? Number(monthly) : envNumber("SPEND_CAP_MONTHLY_INR", 5000) * 100,
    ratePaisePerUsd: rate ? Number(rate) : envNumber("USD_INR", 96) * 100,
    paused: paused === "true",
    perAccountRunning: 3,
    globalRunning: 6,
  };
}

export function killSwitchOn(): boolean {
  return process.env.GENERATION_DISABLED === "true";
}

// ── Reservation ───────────────────────────────────────────────────────────────

export interface ReserveInput {
  accountId: string;
  garmentId: string;
  clientKey: string;
  promptId: string;
  promptVersion: string;
  promptText: string;
  look: GenerationLook;
  model: string;
  size: ImageSize;
}

export type ReserveResult =
  | { ok: true; id: string; costPaise: number; creditsPaise: number; existing: boolean }
  | { ok: false; status: 402 | 409 | 429 | 503; message: string };

/** Spend so far in a window, including in-flight rows, in paise. */
function spentSince(column: "day" | "month") {
  const start =
    column === "day"
      ? sql`date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`
      : sql`date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;
  return sql<number>`coalesce((select sum(${generations.costPaise}) from ${generations} where ${generations.startedAt} >= ${start} and ${generations.status} in ('running','done','failed','refused')), 0)::int`;
}

export async function reserveGeneration(input: ReserveInput): Promise<ReserveResult> {
  if (killSwitchOn()) {
    return { ok: false, status: 503, message: "Generation is switched off on this deployment." };
  }

  const lim = await limits();
  const costPaise = await listCostPaise(input.model, input.size, lim.ratePaisePerUsd);
  const creditsPaise = CREDIT_PAISE[input.look.quality];

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tantu:spend'))`);

    // The same attempt sent twice (a retried POST) gets the same row back.
    const [dup] = await tx
      .select({ id: generations.id, costPaise: generations.costPaise, creditsPaise: generations.creditsPaise })
      .from(generations)
      .where(eq(generations.clientKey, input.clientKey))
      .limit(1);
    if (dup) return { ok: true, id: dup.id, costPaise: dup.costPaise, creditsPaise: dup.creditsPaise, existing: true };

    if (lim.paused) {
      return { ok: false, status: 503, message: "Generation is paused. Try again later." };
    }

    const [totals] = await tx.select({ day: spentSince("day"), month: spentSince("month") }).from(sql`(select 1) as one`);
    if ((totals?.day ?? 0) + costPaise > lim.dailyCapPaise) {
      return { ok: false, status: 503, message: "Today's generation budget is used up. It resets at midnight." };
    }
    if ((totals?.month ?? 0) + costPaise > lim.monthlyCapPaise) {
      return { ok: false, status: 503, message: "This month's generation budget is used up." };
    }

    const running = await tx
      .select({ accountId: generations.accountId })
      .from(generations)
      .where(and(eq(generations.status, "running"), gte(generations.startedAt, sql`now() - interval '6 minutes'`)));
    if (running.length >= lim.globalRunning) {
      return { ok: false, status: 429, message: "The studio is busy. Try again in a minute." };
    }
    if (running.filter((r) => r.accountId === input.accountId).length >= lim.perAccountRunning) {
      return { ok: false, status: 429, message: "Wait for your current images to finish first." };
    }

    const [bal] = await tx
      .select({ paise: sql<number>`coalesce(sum(${creditLedger.deltaPaise}), 0)::int` })
      .from(creditLedger)
      .where(eq(creditLedger.accountId, input.accountId));
    if ((bal?.paise ?? 0) < creditsPaise) {
      return { ok: false, status: 402, message: "Not enough credits for this image." };
    }

    const [row] = await tx
      .insert(generations)
      .values({
        clientKey: input.clientKey,
        accountId: input.accountId,
        garmentId: input.garmentId,
        promptId: input.promptId,
        promptVersion: input.promptVersion,
        promptText: input.promptText,
        look: input.look,
        provider: "gemini",
        model: input.model,
        status: "running",
        costPaise,
        ratePaisePerUsd: lim.ratePaisePerUsd,
        creditsPaise,
      })
      .returning({ id: generations.id });

    await tx.insert(creditLedger).values({
      accountId: input.accountId,
      deltaPaise: -creditsPaise,
      reason: "debit",
      generationId: row!.id,
    });

    return { ok: true, id: row!.id, costPaise, creditsPaise, existing: false };
  });
}

// ── Finishing ─────────────────────────────────────────────────────────────────

export type Outcome =
  | { ok: true; imageKey: string; imageMime: string; ms: number }
  | {
      ok: false;
      /** refused · failed */
      status: "refused" | "failed";
      error: string;
      /** Whether Google charged for the call. Refusals and empty answers are billed; a 4xx is not. */
      billed: boolean;
      ms?: number;
    };

export async function finishGeneration(id: string, outcome: Outcome): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ accountId: generations.accountId, creditsPaise: generations.creditsPaise, status: generations.status })
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);
    if (!row || row.status !== "running") return;

    if (outcome.ok) {
      await tx
        .update(generations)
        .set({ status: "done", imageKey: outcome.imageKey, imageMime: outcome.imageMime, ms: outcome.ms, finishedAt: new Date() })
        .where(eq(generations.id, id));
      return;
    }

    await tx
      .update(generations)
      .set({
        status: outcome.status,
        error: outcome.error,
        ms: outcome.ms ?? null,
        finishedAt: new Date(),
        // Not billed means Google never generated; the estimate comes off the day's total.
        ...(outcome.billed ? {} : { costPaise: 0 }),
      })
      .where(eq(generations.id, id));

    // "Failed renders don't cost you" — the account is made whole either way.
    await tx
      .insert(creditLedger)
      .values({ accountId: row.accountId, deltaPaise: row.creditsPaise, reason: "refund", generationId: id })
      .onConflictDoNothing();
  });
}

/** Rows left `running` past any plausible call: failed, and refunded. Run on the way into any listing. */
export async function sweepStale(): Promise<number> {
  const stale = await db
    .select({ id: generations.id })
    .from(generations)
    .where(and(eq(generations.status, "running"), lt(generations.startedAt, sql`now() - interval '6 minutes'`)));
  for (const { id } of stale) {
    await finishGeneration(id, { ok: false, status: "failed", error: "Timed out before an image came back.", billed: true });
  }
  return stale.length;
}

// ── Reading ───────────────────────────────────────────────────────────────────

export async function balancePaise(accountId: string): Promise<number> {
  const [row] = await db
    .select({ paise: sql<number>`coalesce(sum(${creditLedger.deltaPaise}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.accountId, accountId));
  return row?.paise ?? 0;
}

export async function grantCredits(accountId: string, paise: number, note: string): Promise<void> {
  await db.insert(creditLedger).values({ accountId, deltaPaise: paise, reason: "grant", note });
}

export interface SpendSummary {
  todayPaise: number;
  monthPaise: number;
  running: number;
  limits: Limits;
  byDay: { day: string; paise: number; images: number; failed: number }[];
}

export async function spendSummary(): Promise<SpendSummary> {
  const lim = await limits();
  const [totals] = await db.select({ day: spentSince("day"), month: spentSince("month") }).from(sql`(select 1) as one`);
  const [run] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(generations)
    .where(eq(generations.status, "running"));
  const byDay = await db
    .select({
      day: sql<string>`to_char(${generations.startedAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`,
      paise: sql<number>`sum(${generations.costPaise})::int`,
      images: sql<number>`count(*) filter (where ${generations.status} = 'done')::int`,
      failed: sql<number>`count(*) filter (where ${generations.status} in ('failed','refused'))::int`,
    })
    .from(generations)
    .where(
      and(
        inArray(generations.status, ["running", "done", "failed", "refused"]),
        gte(generations.startedAt, sql`now() - interval '30 days'`),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);
  return { todayPaise: totals?.day ?? 0, monthPaise: totals?.month ?? 0, running: run?.n ?? 0, limits: lim, byDay };
}

