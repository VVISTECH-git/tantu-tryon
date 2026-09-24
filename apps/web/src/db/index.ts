import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The database, opened lazily and once per process.
 *
 * Lazy, so `next build` and pages that never touch the database work without
 * a DATABASE_URL. Once, so dev hot-reloads do not open a new pool each time
 * this module is re-evaluated — the connection is cached on globalThis.
 *
 * postgres-js rather than Neon's HTTP driver: the spend reservation is an
 * interactive transaction (read the day's total, decide, write), and the
 * HTTP driver cannot hold one open. Through Neon's `-pooler` host prepared
 * statements do not survive, so they are off, and a warm serverless instance
 * keeps a single connection.
 */

function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to apps/web/.env.local (see .env.example) or the host's environment.",
    );
  }
  return url;
}

function pooled(url: string): boolean {
  return url.includes("-pooler.") || url.includes(":6543") || url.includes("pgbouncer=true");
}

function open() {
  const url = connectionString();
  const serverless = Boolean(process.env.VERCEL);

  // Off Vercel, say which database this is and refuse to be quiet about a
  // local process pointed at production.
  if (!serverless) {
    let host = "unknown-host";
    try {
      host = new URL(url).host;
    } catch {
      // Not a URL we can parse; the driver will say so.
    }
    const env = process.env.APP_DB_ENV ?? "unset";
    console.log(`[db] env=${env} host=${host}`);
    if (env !== "dev") {
      console.warn(
        `[db] APP_DB_ENV is "${env}", not "dev": this local process may be writing to ${host}. Set APP_DB_ENV=dev in .env.local.`,
      );
    }
  }

  const client = postgres(url, {
    max: serverless || pooled(url) ? 1 : 10,
    prepare: !pooled(url),
    idle_timeout: serverless ? 20 : undefined,
  });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof open>;

const cache = globalThis as unknown as { __tantuDb?: Db };

export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    cache.__tantuDb ??= open();
    const value = Reflect.get(cache.__tantuDb, property) as unknown;
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(cache.__tantuDb) : value;
  },
});

export * from "./schema";
