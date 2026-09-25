ALTER TABLE "accounts" ADD COLUMN "role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "workspaceId" uuid;