// Gives the shared account its starting credits: `pnpm db:seed [rupees]`.
// Reads .env.local for DATABASE_URL. Safe to run again; it adds, never resets.
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { sharedAccount } = await import("../src/lib/session");
  const { balancePaise, grantCredits, rupees } = await import("../src/lib/spend");
  const amount = Number(process.argv[2] ?? 1000);
  const account = await sharedAccount();
  await grantCredits(account.id, Math.round(amount * 100), "seed");
  console.log(`[seed] ${account.name} (${account.id}) now has ${rupees(await balancePaise(account.id))}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
