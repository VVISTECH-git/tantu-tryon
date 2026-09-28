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
    return Response.json({ error: !username ? "Enter your username." : "Enter your password." }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await throttled(ip)) {
    return Response.json({ error: "Too many wrong tries. Wait 15 minutes, then try again." }, { status: 429 });
  }

  const account = await accountByUsername(username);
  // Said plainly which one is wrong (28 Sep, asked for by the shop). It does
  // tell a stranger which usernames exist; the throttle above still stops guessing.
  if (!account) {
    await recordFailure(ip);
    return Response.json({ error: `Username "${username}" not found. Check the spelling.` }, { status: 401 });
  }
  if (!passwordMatches(password, account.passwordHash)) {
    await recordFailure(ip);
    return Response.json({ error: "Wrong password. Try again." }, { status: 401 });
  }

  const token = await startSession(account.id);
  // Only a client that cannot keep the cookie gets the token in the body.
  const mobile = request.headers.get("x-tantu-client") === "mobile";
  const role = account.role;
  return Response.json({ ok: true, account: { id: account.id, name: account.name, role }, ...(mobile ? { token } : {}) });
}
