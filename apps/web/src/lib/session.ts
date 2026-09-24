import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { accounts, db, loginAttempts, sessions, type Account } from "@/db";

/**
 * Who is using the app.
 *
 * Version one has one door: a shared passcode. Getting it right mints a
 * session for the shared account — 32 random bytes in an httpOnly cookie,
 * only their SHA-256 kept in the database. Fast hash on purpose: the token
 * is unguessable, so key stretching would only slow every request.
 *
 * Per-merchant sign-in later is a second login route that finds or creates
 * an `accounts` row and calls `startSession` with it. Nothing below changes.
 */

export const COOKIE = "tantu_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SHARED_ACCOUNT_NAME = "house";

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_MS / 1000,
  } as const;
}

/** The shared account, created on first use so the database needs no seed to work. */
export async function sharedAccount(): Promise<Account> {
  const [existing] = await db.select().from(accounts).where(eq(accounts.kind, "shared")).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(accounts).values({ name: SHARED_ACCOUNT_NAME, kind: "shared" }).returning();
  return created!;
}

/**
 * Whether the passcode is right, without leaking how wrong it was.
 *
 * Both sides are hashed first so the comparison is constant-time whatever
 * the lengths. An empty configured passcode never matches: a deployment that
 * forgot to set one is closed, not open.
 */
export function passcodeMatches(offered: string): boolean {
  const expected = process.env.STUDIO_PASSCODE ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(offered).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 10;

/** Too many wrong passcodes from this address lately. */
export async function throttled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gt(loginAttempts.at, since)));
  return (row?.n ?? 0) >= ATTEMPT_LIMIT;
}

export async function recordFailure(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({ ip });
}

export async function startSession(accountId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: fingerprint(token),
    accountId,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  (await cookies()).set(COOKIE, token, cookieOptions());
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, fingerprint(token)), isNull(sessions.revokedAt)));
  }
  jar.delete(COOKIE);
}

/**
 * The account behind this request, or null.
 *
 * Every condition — exists, not revoked, not expired — is checked in the
 * query, so a stale token cannot become an account through a missing `if`.
 */
export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ account: accounts })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(
      and(
        eq(sessions.tokenHash, fingerprint(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.account ?? null;
}

export class NotSignedIn extends Error {
  constructor() {
    super("Sign in to do that.");
    this.name = "NotSignedIn";
  }
}

/**
 * The account, or nothing runs.
 *
 * Called at the top of every route handler and page that needs one, not
 * left to the proxy: the proxy only sees that a cookie exists, and a POST to
 * an API route is not a navigation.
 */
export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) throw new NotSignedIn();
  return account;
}

/** For route handlers: the 401 to return when `requireAccount` threw. */
export function unauthorised(error: unknown): Response | null {
  if (error instanceof NotSignedIn) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  return null;
}

/** The caller's address, for rate limiting; Vercel puts it in x-forwarded-for. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
