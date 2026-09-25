import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * What the guided flow remembers.
 *
 * Six tables. Everything a merchant does — the saree they described, the
 * images made from it, what they paid and what we paid — is a row here, so a
 * render is never an orphan: it can be re-run, compared, refunded and counted
 * against the day's spend from one place.
 *
 * Money is in paise, as integers. Rupees as floats are how a ledger ends up
 * ₹0.01 off and nobody can say why.
 */

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/**
 * Who owns garments and credits.
 *
 * Version one has a single shared account behind a passcode. The table exists
 * anyway so that switching on per-merchant sign-in later is a new login route
 * that creates rows here, and nothing downstream changes.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** `shared` for the first seeded account; `merchant` once people sign up on their own. */
    kind: text().notNull().default("merchant"),
    /** Login name. Null on an account nobody can sign into directly (kept for later API-only use). */
    username: text(),
    /** scrypt, salted, `salt:hash` — see `lib/session.ts` hashPassword/passwordMatches. Null until set. */
    passwordHash: text(),
    /**
     * What this login may do. `admin`: everything, settings included.
     * `studio`: capture and generate. `photographer`: open products and
     * take photos, nothing that spends.
     */
    role: text().notNull().default("admin"),
    /**
     * The shop this login works in. Null for the shop's own account; a
     * photographer or studio login points at it, so everyone sees the same
     * products and spends from the same balance.
     */
    workspaceId: uuid(),
    phone: text(),
    email: text(),
    createdAt: now(),
  },
  (t) => [uniqueIndex("accounts_username").on(t.username)],
);

/**
 * A sign-in. The browser holds 32 random bytes in a cookie; only their hash is
 * kept. Revoked rather than deleted, so the history stays readable.
 */
export const sessions = pgTable("sessions", {
  tokenHash: text().primaryKey(),
  accountId: uuid()
    .notNull()
    .references(() => accounts.id),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: now(),
});

/** Failed passcode entries, so a shared passcode cannot be guessed at speed. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    ip: text().notNull(),
    at: now(),
  },
  (t) => [index("login_attempts_ip_at").on(t.ip, t.at)],
);

/**
 * Credits, as movements. Balance is the sum; nothing stores a running total
 * that can drift from its own history.
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    deltaPaise: integer().notNull(),
    /** grant · debit · refund · adjust */
    reason: text().notNull(),
    generationId: uuid(),
    note: text(),
    createdAt: now(),
  },
  (t) => [
    index("credit_ledger_account").on(t.accountId),
    // One debit and at most one refund per generation: the route and the
    // stale-row sweeper cannot both give the money back.
    uniqueIndex("credit_ledger_generation_reason")
      .on(t.generationId, t.reason)
      .where(sql`${t.generationId} is not null`),
  ],
);

/** What the free check at upload made of one photograph; the shape the phone reads too. */
export type { PartQuality } from "@tantu/shared/views";
import type { PartQuality } from "@tantu/shared/views";

export interface GarmentPartRow {
  /** body · pallu · border · blouse · body_motif · pallu_motif · whole · saree (one flat photo) · full-drape · weave */
  slot: string;
  /** Our R2 key when uploaded here; null when the photograph is SLK's. */
  key: string | null;
  /** Where the photograph is served from. */
  url: string;
  width: number | null;
  height: number | null;
  /** Quarter turns applied before use. */
  rotate: 0 | 90 | 180 | 270;
  /** Set for photographs uploaded here; SLK's photographs carry none. */
  quality?: PartQuality;
  /** The login that took it, and when: the tracking that replaces sending photos on WhatsApp. */
  takenBy?: string;
  takenAt?: string;
}

export interface GarmentAnswers {
  /** The blouse piece is the body fabric, so no separate photograph is needed. */
  blouseSameAsBody?: boolean;
  /** The pallu carries its own design rather than repeating the body's. */
  palluDistinct?: boolean;
  /** Borders along the long edges are visible. */
  borders?: boolean;
  /** Both long borders are the same; false when the hem border is the bigger one. */
  bordersIdentical?: boolean;
}

/**
 * One saree, described well enough to photograph.
 *
 * `words` holds what a person or the describe route said about the fabric,
 * laid over SLK's record at prompt time exactly as the Studio does today.
 * `parts` is the photographs; `sheetKey` the labelled sheet built from them,
 * once, at confirm.
 */
export const garments = pgTable(
  "garments",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    /** slk · upload */
    source: text().notNull(),
    /** saree today; the dropdown's other values once their prompts are proven. */
    garmentType: text().notNull().default("saree"),
    /** unstitched · stitched_top · bottom · set — decides the shot list. */
    family: text().notNull().default("unstitched"),
    productCode: text(),
    title: text().notNull(),
    description: text(),
    /** SLK's design record, by attribute name, when the garment came from SLK. */
    design: jsonb().$type<Record<string, string | null> | null>(),
    /** Described or typed garment words — the overrides, not the merged result. */
    words: jsonb().$type<Record<string, string>>().notNull().default({}),
    answers: jsonb().$type<GarmentAnswers>().notNull().default({}),
    parts: jsonb().$type<GarmentPartRow[]>().notNull().default([]),
    sheetKey: text(),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [index("garments_account_created").on(t.accountId, t.createdAt)],
);

export interface GenerationLook {
  modelType: string;
  age: string;
  background: string;
  /** standard (1K) · high (2K) */
  quality: "standard" | "high";
}

/**
 * One image asked for, whatever became of it.
 *
 * The row is written *before* the provider is called, as `running`, carrying
 * the list price of the call — so the spend check that runs for the next
 * request already sees this one. It is finished afterwards with the real
 * outcome. A row that never gets finished is swept to `failed` and refunded.
 *
 * `costPaise` is what Google charged us and stays on a refusal, because Google
 * charges for those. `creditsPaise` is what the account paid, and is given
 * back through the ledger on any failure.
 */
export const generations = pgTable(
  "generations",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Chosen by the browser per attempt, so a retried POST cannot spend twice. */
    clientKey: text().notNull(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    garmentId: uuid()
      .notNull()
      .references(() => garments.id),
    /** P1 … P5 */
    promptId: text().notNull(),
    /** "v2" or "draft", as the template says. */
    promptVersion: text().notNull(),
    promptText: text().notNull(),
    look: jsonb().$type<GenerationLook>().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    /** running · done · failed · refused */
    status: text().notNull(),
    imageKey: text(),
    imageMime: text(),
    error: text(),
    costPaise: integer().notNull().default(0),
    ratePaisePerUsd: integer().notNull(),
    creditsPaise: integer().notNull(),
    ms: integer(),
    /** approved · rejected · null */
    verdict: text(),
    note: text().notNull().default(""),
    startedAt: now(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("generations_client_key").on(t.clientKey),
    index("generations_garment_started").on(t.garmentId, t.startedAt),
    index("generations_account_started").on(t.accountId, t.startedAt),
    index("generations_running")
      .on(t.accountId)
      .where(sql`${t.status} = 'running'`),
  ],
);

/**
 * Runtime switches and rates: `generation_paused`, `spend_cap_daily_paise`,
 * `spend_cap_monthly_paise`, `usd_inr_paise`. Read on every reservation, so a
 * change here takes effect without a deploy.
 */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: now(),
});

export type Account = typeof accounts.$inferSelect;
export type Garment = typeof garments.$inferSelect;
export type Generation = typeof generations.$inferSelect;
