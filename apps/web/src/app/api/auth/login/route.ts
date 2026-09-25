import { accountByUsername, clientIp, passwordMatches, recordFailure, startSession, throttled } from "@/lib/session";

export const runtime = "nodejs";

/** Username and password in, a session cookie (and for the phone, a token) out. Ten wrong tries in a quarter hour and the address waits. */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return Response.json({ error: "The studio is not connected to its database yet." }, { status: 503 });
  }
  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    username = String(body.username ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!username || !password) {
    return Response.json({ error: "Enter a username and password." }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await throttled(ip)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  }

  const account = await accountByUsername(username);
  if (!account || !passwordMatches(password, account.passwordHash)) {
    await recordFailure(ip);
    return Response.json({ error: "That username or password is not right." }, { status: 401 });
  }

  const token = await startSession(account.id);
  // Only a client that cannot keep the cookie gets the token in the body.
  const mobile = request.headers.get("x-tantu-client") === "mobile";
  const role = account.role;
  return Response.json({ ok: true, account: { id: account.id, name: account.name, role }, ...(mobile ? { token } : {}) });
}
