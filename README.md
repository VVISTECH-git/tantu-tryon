# tantu-tryon

The try-on and catalogue engine VVIS sells. Turns real garment photographs into
model-worn imagery, and — later — lets a shopper see a garment on themselves.

**This repo must never import from `slk-core`.** It reaches SLK's Inventory API
through a scoped key exactly like any other tenant would. The day it has an SLK
import, it stops being a product and becomes a feature of someone else's system.

## Layout

```
tantu-tryon/
├── apps/web            Next.js — the Studio UI, the tenant console, the REST API
└── packages/engine     Providers, prompts and types. Zero Next imports.
```

`packages/engine` is deliberately framework-free so the same engine can later run
behind a long-lived worker (Railway / Fly) without being rewritten.

## What makes it different

The market's tools take one flat garment photo plus a mandatory model photo and
hand back an orphan image they promise to delete. This one takes **labelled
reference photographs** of a single garment — full drape, pallu, body, border,
blouse — invents the model from a description when you don't have one, and keeps
every render attached to the design it came from so it can be re-rendered,
compared against the original fabric, and pushed to a storefront.

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill in the values below
pnpm --filter @tantu/web dev:db                 # local Postgres on :5434, keeps running
pnpm --filter @tantu/web db:migrate
pnpm --filter @tantu/web db:seed 500            # ₹500 of trial credits for the shared account
pnpm dev                                        # http://localhost:3000/app
```

Requires Node >= 20.9 and pnpm 11.

What `.env.local` needs, and why (see `apps/web/.env.example` for the full list):

| Variable | For |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `APP_DB_ENV=dev` | Neon Postgres in production; the embedded dev database locally |
| `STUDIO_PASSCODE` | The one door in version one |
| `GEMINI_API_KEY` | Generating images. Billing must be on; set a budget alert and a quota on the project |
| `GENERATION_DISABLED`, `SPEND_CAP_DAILY_INR`, `SPEND_CAP_MONTHLY_INR`, `USD_INR` | The brakes. Caps can also be changed at `/admin/spend` |
| `R2_*` | Cloudflare R2 for uploads, sheets and renders. Without it, renders go to `public/dev-renders` locally |
| `SLK_API_BASE`, `SLK_READ_SECRET` | Product lookup by code |
| `ANTHROPIC_API_KEY` (or OpenAI / Gemini) | Reading the photographs into words |

## Where things are

| Path | What |
| --- | --- |
| `/app` | The guided flow: sign in → saree → look → photographs → results. What a merchant uses |
| `/app/library`, `/app/account` | Everything photographed; credits and movements |
| `/admin/spend` | Spend today and this month against the caps, pause switch, recent generations |
| `/studio` | The prompt bench: compose a frozen prompt and its sheet for Gemini chat, file the answer |
| `/admin/lab` | The SAR-P15 recipe bench (API-driven experiments) |
| `apps/web/src/lib/spend.ts` | The reservation that every paid call goes through |
| `apps/web/src/content/promptTemplates.ts` | The frozen prompts. Wording changes are a new version; `pnpm --filter @tantu/web test` holds them still |
