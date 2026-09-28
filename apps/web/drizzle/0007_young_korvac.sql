ALTER TABLE "garments" ADD COLUMN "autoIssued" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Numbers the first automatic version gave out (28 Sep, from 17:29 IST) were not marked; mark them so the lost ones are reused.
UPDATE "garments" g SET "autoIssued" = true
FROM "settings" s
WHERE s."key" = 'autoProductId:' || g."accountId"::text
  AND g."productCode" ~ '^[0-9]+$'
  AND g."productCode"::bigint BETWEEN 9001 AND s."value"::bigint
  AND g."createdAt" >= '2026-09-28T11:50:00Z';
