CREATE TABLE "part_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"taskNo" integer,
	"garmentId" uuid,
	"slot" text,
	"photoKey" text NOT NULL,
	"previewKey" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"style" text,
	"palluKind" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewedBy" text,
	"reviewedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "part_labels" ADD CONSTRAINT "part_labels_garmentId_garments_id_fk" FOREIGN KEY ("garmentId") REFERENCES "public"."garments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "part_labels_source" ON "part_labels" USING btree ("source");