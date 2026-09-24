CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'merchant' NOT NULL,
	"phone" text,
	"email" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"accountId" uuid NOT NULL,
	"deltaPaise" integer NOT NULL,
	"reason" text NOT NULL,
	"generationId" uuid,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"source" text NOT NULL,
	"productCode" text,
	"title" text NOT NULL,
	"description" text,
	"design" jsonb,
	"words" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sheetKey" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientKey" text NOT NULL,
	"accountId" uuid NOT NULL,
	"garmentId" uuid NOT NULL,
	"promptId" text NOT NULL,
	"promptVersion" text NOT NULL,
	"promptText" text NOT NULL,
	"look" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"imageKey" text,
	"imageMime" text,
	"error" text,
	"costPaise" integer DEFAULT 0 NOT NULL,
	"ratePaisePerUsd" integer NOT NULL,
	"creditsPaise" integer NOT NULL,
	"ms" integer,
	"verdict" text,
	"note" text DEFAULT '' NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"finishedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"tokenHash" text PRIMARY KEY NOT NULL,
	"accountId" uuid NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garments" ADD CONSTRAINT "garments_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_garmentId_garments_id_fk" FOREIGN KEY ("garmentId") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_account" ON "credit_ledger" USING btree ("accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_generation_reason" ON "credit_ledger" USING btree ("generationId","reason") WHERE "credit_ledger"."generationId" is not null;--> statement-breakpoint
CREATE INDEX "garments_account_created" ON "garments" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "generations_client_key" ON "generations" USING btree ("clientKey");--> statement-breakpoint
CREATE INDEX "generations_garment_started" ON "generations" USING btree ("garmentId","startedAt");--> statement-breakpoint
CREATE INDEX "generations_account_started" ON "generations" USING btree ("accountId","startedAt");--> statement-breakpoint
CREATE INDEX "generations_running" ON "generations" USING btree ("accountId") WHERE "generations"."status" = 'running';--> statement-breakpoint
CREATE INDEX "login_attempts_ip_at" ON "login_attempts" USING btree ("ip","at");