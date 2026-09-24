import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { accounts, db, loginAttempts, sessions, type Account } from "@/db";

/**
 * Who is using the app.
 *
 * A username and a password, checked against `accounts`. Getting them right
 * mints a session — 32 random bytes in an httpOnly cookie, only their
 * SHA-256 kept in the database. Fast hash on purpose: the token is
 * unguessable, so key stretching would only slow every request; the
 * password itself is the slow one, see `hashPassword`/`passwordMatches`.
 *
 * A new merchant signing up on their own is a second path that creates an
 * `accounts` row with `setPassword`, then calls `startSession`. Nothing
 * below changes for that.
 *
 * The phone app cannot hold an httpOnly cookie, so it gets the same token
 * back in the login response and sends it as `Authorization: Bearer …`.
 * One table, one expiry, one revoke for both.
 */

export const COOKIE = "tantu_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

const SCRYPT_KEYLEN = 64;

/** A password, salted and hashed with scrypt. Stored as `salt:hash`, both hex. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Whether a password matches a stored `salt:hash`, in constant time for a given hash. */
export function passwordMatches(offered: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(offered, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The account for a username, or null. Username is matched case-insensitively. */
export async function accountByUsername(username: string): Promise<Account | null> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(sql`lower(${accounts.username}) = lower(${username})`)
    .limit(1);
  return row ?? null;
}

/** Set or change an account's login credentials. */
export async function setPassword(accountId: string, username: string, plain: string): Promise<void> {
  await db.update(accounts).set({ username, passwordHash: hashPassword(plain) }).where(eq(accounts.id, accountId));
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

/** Mint a session; the token is set as the cookie and returned for clients that cannot keep cookies. */
export async function startSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: fingerprint(token),
    accountId,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  (await cookies()).set(COOKIE, token, cookieOptions());
  return token;
}

/** The session token on this request: the bearer header first (the phone), else the cookie (the browser). */
export async function requestToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = await requestToken();
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
  const token = await requestToken();
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
