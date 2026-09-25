ALTER TABLE "accounts" ALTER COLUMN "role" SET DEFAULT 'owner';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "platformAdmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- "admin" inside a shop is now "owner"; running the platform is a separate flag.
UPDATE "accounts" SET "role" = 'owner' WHERE "role" = 'admin';--> statement-breakpoint
-- Tantu's own shop (the seeded "shared" account) is the platform admin.
UPDATE "accounts" SET "platformAdmin" = true WHERE "kind" = 'shared' AND "workspaceId" IS NULL;
