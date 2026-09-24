import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit transpiles this file to CommonJS, where import.meta is
// undefined, so the env file is found from the working directory.
config({ path: resolve(process.cwd(), ".env.local") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Never the pooler for DDL: migrations need a real session, and through
    // PgBouncer in transaction mode they fail in ways that look intermittent.
    // DATABASE_URL_UNPOOLED is what Neon's Vercel integration sets.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "",
  },
  strict: true,
  verbose: true,
});
