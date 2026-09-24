// Sets or changes an account's sign-in credentials.
// Usage: pnpm tsx scripts/set-account-password.ts <username> <password> ["Display Name"]
// Reads .env.local for DATABASE_URL. Reuses the account if the username
// already exists; otherwise reuses a legacy `kind: shared` account if one
// exists (keeps its credit history), else creates a fresh one.
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  const displayName = process.argv[4] ?? username;
  if (!username || !password) {
    console.error("Usage: pnpm tsx scripts/set-account-password.ts <username> <password> [\"Display Name\"]");
    process.exit(1);
  }

  const { accountByUsername, setPassword } = await import("../src/lib/session");
  const { db, accounts } = await import("../src/db");
  const { eq } = await import("drizzle-orm");

  let account = await accountByUsername(username);
  if (!account) {
    const [legacy] = await db.select().from(accounts).where(eq(accounts.kind, "shared")).limit(1);
    account = legacy ?? null;
  }
  if (!account) {
    const [created] = await db.insert(accounts).values({ name: displayName, kind: "shared" }).returning();
    account = created!;
  }

  await setPassword(account.id, username, password);
  console.log(`[set-account-password] "${username}" now signs in to "${account.name}" (${account.id})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
