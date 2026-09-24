ALTER TABLE "accounts" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "passwordHash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username" ON "accounts" USING btree ("username");