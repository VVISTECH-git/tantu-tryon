import { and, eq, isNull, sql } from "drizzle-orm";
import { accounts, db } from "@/db";
import { clientIp, recordFailure, startSession, throttled } from "@/lib/session";
import { grantCredits } from "@/lib/spend";

export const runtime = "nodejs";

/**
 * Sign in with Google (9 Oct, tantu-two; user: "anything that is free"). The page gets an ID token
 * from Google's own button; Google checks it here (signature, expiry, our client ID, a verified
 * email). The first sign-in makes the seller's own shop account.
 *
 *   { credential }  → { ok, token, account, created }
 */
const CLIENT_IDS = (process.env.GOOGLE_CLIENT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// No welcome gift for now (user, 9 Oct: "there is no welcome gift from us"); WELCOME_CREDIT_PAISE can switch one on later.
const WELCOME_PAISE = Number(process.env.WELCOME_CREDIT_PAISE ?? 0);

export async function POST(request: Request) {
  if (CLIENT_IDS.length === 0) return Response.json({ error: "Google sign-in is not switched on yet." }, { status: 503 });
  const ip = clientIp(request);
  if (await throttled(ip)) return Response.json({ error: "Too many tries. Wait 15 minutes, then try again." }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as { credential?: unknown; accessToken?: unknown; phone?: unknown };
  const credential = typeof body.credential === "string" ? body.credential : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  if ((!credential && !accessToken) || credential.length > 4096 || accessToken.length > 4096) return Response.json({ error: "Malformed request." }, { status: 400 });

  // Google's own check of the token: the claims come back only if it is genuine and unexpired.
  // An ID token (Google's button) or an access token (Tantu's own styled buttons, 9 Oct).
  const check = await fetch(
    credential ? `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}` : `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  ).catch(() => null);
  const info = (check?.ok ? await check.json().catch(() => null) : null) as
    | { aud?: string; azp?: string; iss?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string; expires_in?: string }
    | null;
  const issuerOk = accessToken ? true : info?.iss === "accounts.google.com" || info?.iss === "https://accounts.google.com";
  const verified = info?.email_verified === true || info?.email_verified === "true";
  const ours = Boolean(info && ((info.aud && CLIENT_IDS.includes(info.aud)) || (info.azp && CLIENT_IDS.includes(info.azp))));
  const live = accessToken ? Number(info?.expires_in ?? 0) > 0 : Number(info?.exp ?? 0) * 1000 > Date.now();
  if (!info || !issuerOk || !ours || !verified || !info.email || !live) {
    await recordFailure(ip);
    return Response.json({ error: "Google could not confirm this sign-in. Try again." }, { status: 401 });
  }

  const email = info.email.toLowerCase();
  // The name for a new account: in the ID token, or from Google's profile for an access token.
  if (accessToken && !info.name) {
    const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null);
    const profile = (who?.ok ? await who.json().catch(() => null) : null) as { name?: string } | null;
    if (profile?.name) info.name = profile.name;
  }
  // The mobile number typed before "Continue with phone" (not verified by SMS yet).
  const phone = String(body.phone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
  let [account] = await db
    .select()
    .from(accounts)
    .where(and(sql`lower(${accounts.email}) = ${email}`, isNull(accounts.workspaceId)))
    .limit(1);
  let created = false;
  if (!account) {
    [account] = await db
      .insert(accounts)
      .values({ name: (info.name || email.split("@")[0] || "Seller").slice(0, 80), email, kind: "merchant", role: "owner", ...(phone.replace(/\D/g, "").length >= 7 ? { phone } : {}) })
      .returning();
    if (WELCOME_PAISE > 0) await grantCredits(account!.id, WELCOME_PAISE, "Welcome gift (Google sign-up)");
    created = true;
  } else if (phone.replace(/\D/g, "").length >= 7 && phone !== account.phone) {
    await db.update(accounts).set({ phone }).where(eq(accounts.id, account.id));
    account = { ...account, phone };
  }
  const token = await startSession(account!.id);
  return Response.json({ ok: true, token, created, account: { id: account!.id, name: account!.name, email: account!.email, phone: account!.phone } });
}

/** The phone number the seller types after signing in (not verified by SMS yet). */
export async function PATCH(request: Request) {
  const { requireAccount, unauthorised } = await import("@/lib/session");
  try {
    const account = await requireAccount();
    const body = (await request.json().catch(() => ({}))) as { phone?: unknown };
    const phone = String(body.phone ?? "").replace(/[^\d+ ]/g, "").trim().slice(0, 20);
    if (phone.replace(/\D/g, "").length < 7) return Response.json({ error: "Enter a valid mobile number." }, { status: 400 });
    await db.update(accounts).set({ phone }).where(eq(accounts.id, account.id));
    return Response.json({ ok: true });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not save the number." }, { status: 500 });
  }
}
