import { clientIp, passcodeMatches, recordFailure, sharedAccount, startSession, throttled } from "@/lib/session";

export const runtime = "nodejs";

/** The passcode in, a session cookie out. Ten wrong tries in a quarter hour and the address waits. */
export async function POST(request: Request) {
  let passcode = "";
  try {
    passcode = String(((await request.json()) as { passcode?: unknown }).passcode ?? "");
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await throttled(ip)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  }
  if (!passcodeMatches(passcode)) {
    await recordFailure(ip);
    return Response.json({ error: "That passcode is not right." }, { status: 401 });
  }

  const account = await sharedAccount();
  await startSession(account.id);
  return Response.json({ ok: true, account: { id: account.id, name: account.name } });
}
