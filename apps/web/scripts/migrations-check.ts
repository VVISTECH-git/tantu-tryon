import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Checks the migration journal before anything trusts it.
 *
 *   pnpm db:migrate         runs this, then drizzle-kit migrate
 *   pnpm db:generate        drizzle-kit generate, then this with --fix
 *
 * drizzle-orm applies a migration only when its journal `when` is greater
 * than the highest already recorded (pg-core/dialect.js compares
 * created_at < folderMillis). One entry out of order and everything after it
 * is skipped silently — not applied, not recorded, no error. So the invariant
 * checked here is simply that `when` increases with `idx`, and that every
 * journal entry has its SQL file and every SQL file its entry.
 */

const DIR = resolve(process.cwd(), "drizzle");
const JOURNAL = resolve(DIR, "meta/_journal.json");

interface Entry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: Entry[];
}

const fix = process.argv.includes("--fix");

if (!existsSync(JOURNAL)) {
  console.log("[migrations] no journal yet; nothing to check.");
  process.exit(0);
}

const journal: Journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
const problems: string[] = [];
const notes: string[] = [];

if (fix) {
  for (let i = 1; i < entries.length; i++) {
    const previous = entries[i - 1]!;
    const entry = entries[i]!;
    if (entry.when <= previous.when) {
      const was = entry.when;
      entry.when = previous.when + 1000;
      notes.push(`moved ${entry.tag} from ${was} to ${entry.when}, past ${previous.tag}`);
    }
  }
}

for (let i = 1; i < entries.length; i++) {
  const previous = entries[i - 1]!;
  const entry = entries[i]!;
  if (entry.when <= previous.when) {
    problems.push(`${entry.tag} (when ${entry.when}) is not after ${previous.tag} (when ${previous.when}); it would be skipped.`);
  }
}

const files = new Set(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, "")),
);
for (const entry of entries) {
  if (!files.has(entry.tag)) problems.push(`journal names ${entry.tag}.sql, which does not exist.`);
}
for (const file of files) {
  if (!entries.some((e) => e.tag === file)) problems.push(`${file}.sql has no journal entry and will never run.`);
}

if (fix && notes.length) {
  writeFileSync(JOURNAL, `${JSON.stringify({ ...journal, entries }, null, 2)}\n`);
  for (const note of notes) console.log(`[migrations] ${note}`);
}

if (problems.length) {
  for (const problem of problems) console.error(`[migrations] ${problem}`);
  process.exit(1);
}

console.log(`[migrations] journal sound: ${entries.length} migration(s).`);
