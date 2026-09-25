import { requireAccount, unauthorised } from "@/lib/session";
import { balancePaise } from "@/lib/spend";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await requireAccount();
    return Response.json(
      { account: { id: account.id, name: account.name, username: account.username, kind: account.kind, role: account.role, platformAdmin: account.platformAdmin }, balancePaise: await balancePaise(account.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unauthorised(error) ?? Response.json({ error: "Could not load the account." }, { status: 500 });
  }
}
