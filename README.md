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
cp apps/web/.env.example apps/web/.env.local   # add GEMINI_API_KEY
pnpm dev
```

Requires Node >= 20.9 and pnpm 11.
