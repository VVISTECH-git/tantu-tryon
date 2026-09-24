// A local Postgres for development, no Docker: `pnpm dev:db`.
// Data persists in apps/web/.devdb/ (git-ignored). Keeps running until killed.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), ".devdb");
const PORT = 5434;
const DB = "tantu";

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "devpass",
  port: PORT,
  persistent: true,
});

async function main() {
  if (!existsSync(dir)) {
    console.log("[dev-db] initialising data dir…");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DB);
    console.log(`[dev-db] created database ${DB}`);
  } catch {
    console.log(`[dev-db] database ${DB} already exists`);
  }
  console.log(`DEV_PG_READY postgresql://postgres:devpass@localhost:${PORT}/${DB}`);
  console.log("[dev-db] put that in .env.local as DATABASE_URL, with APP_DB_ENV=dev");
  await new Promise<void>(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
