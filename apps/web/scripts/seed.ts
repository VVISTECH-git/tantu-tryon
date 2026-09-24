// Gives an account its starting credits: `pnpm db:seed <username> [rupees]`.
// Reads .env.local for DATABASE_URL. Safe to run again; it adds, never resets.
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const username = process.argv[2];
  const amount = Number(process.argv[3] ?? 1000);
  if (!username) {
    console.error('Usage: pnpm db:seed <username> [rupees]');
    process.exit(1);
  }

  const { accountByUsername } = await import("../src/lib/session");
  const { balancePaise, grantCredits, rupees } = await import("../src/lib/spend");

  const account = await accountByUsername(username);
  if (!account) {
    console.error(`No account signs in as "${username}". Set one up first with set-account-password.`);
    process.exit(1);
  }

  await grantCredits(account.id, Math.round(amount * 100), "seed");
  console.log(`[seed] ${account.name} (${account.id}) now has ${rupees(await balancePaise(account.id))}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
