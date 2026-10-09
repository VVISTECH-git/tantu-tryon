import { Forbidden, requireAccount, unauthorised } from "@/lib/session";
import { limits, setSetting, spendSummary } from "@/lib/spend";

export const runtime = "nodejs";

/**
 * Google's spending limits and what has been spent (9 Oct): the same numbers and controls as the
 * Platform page, reachable with the admin token (the owner now signs in on tantu-two).
 *
 *   GET                           → { dailyCapPaise, monthlyCapPaise, paused, summary }
 *   POST { dailyInr?, monthlyInr? } → the new caps
 */
export async function GET() {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const [lim, summary] = await Promise.all([limits(), spendSummary()]);
    return Response.json({ dailyCapPaise: lim.dailyCapPaise, monthlyCapPaise: lim.monthlyCapPaise, paused: lim.paused, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not read the limits." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    if (!account.platformAdmin) throw new Forbidden();
    const body = (await request.json().catch(() => ({}))) as { dailyInr?: unknown; monthlyInr?: unknown };
    const daily = Math.round(Number(body.dailyInr) * 100);
    const monthly = Math.round(Number(body.monthlyInr) * 100);
    if (Number.isFinite(daily) && daily > 0) await setSetting("spend_cap_daily_paise", String(daily));
    if (Number.isFinite(monthly) && monthly > 0) await setSetting("spend_cap_monthly_paise", String(monthly));
    const lim = await limits();
    return Response.json({ dailyCapPaise: lim.dailyCapPaise, monthlyCapPaise: lim.monthlyCapPaise });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not set the limits." }, { status: 500 });
  }
}
