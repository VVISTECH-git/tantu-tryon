import { endSession, requireAccount, startSession, unauthorised } from "@/lib/session";

export const runtime = "nodejs";

/**
 * A fresh bearer token for the caller's own account, and the one that made
 * this request revoked (8 Oct): how a laptop or GPU worker's token is rotated
 * without anyone typing a password. Only a signed-in caller can ask.
 */
export async function POST() {
  try {
    const account = await requireAccount();
    const token = await startSession(account.id);
    await endSession();
    return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not issue a token." }, { status: 500 });
  }
}
