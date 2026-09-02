# Tantu build order

Agreed sequence. The ordering is the point — several stages exist to stop us
building a large amount of work on top of an unproven assumption.

```
core pose library
  → lock the pose specification
  → build the P01 realistic reference
  → prove ONE real saree end to end on P01
  → solve textile fidelity
  → expand across locked poses
  → customer selector
  → pricing and payment
  → launch
```

## The decision that governs everything before it

**Prove P01 end to end on one real saree before generating more silhouettes.**

Take one saree with body, border, pallu and blouse inputs and produce a
genuinely commercial photograph that preserves the textile. Then run the same
saree through P02, P03, P04.

If that works, the pose library is extremely valuable. If it does not, another
thirty silhouettes will not fix the underlying problem — and the underlying
problem is textile fidelity, which has **never been tested on a real kalamkari
saree**. One render has ever been produced, and its fabric was synthetic.

---

## 1. Freeze the pose library

Every pose gets a permanent record: id, name, category, thumbnail, orientation,
pallu behaviour, hand behaviour, and **what product detail it exists to show**.

A locked pose is never silently changed. If it must change, it gets a new code.

Current home: `apps/web/src/content/poseIcons.ts`. That file holds id, label,
name, category and generation state today. Orientation, pallu behaviour, hand
behaviour and the product detail each pose sells are **not yet fields** — they
are the difference between a folder of images and a specification, and they get
added when the set is locked.

## 2. A photographic master reference per pose

The silhouettes are for the customer's selection UI. They are not what the
generator should be steered by.

Final output must not be driven by vague text like "woman standing with hand on
waist". Each pose needs a realistic reference image with the same body geometry
as its silhouette. That becomes the **pose-control / reference layer**.

This does not exist in the engine today. Today a pose is a paragraph of English
in `packages/engine/src/poses.ts`, and that is exactly the vagueness this stage
removes.

## 3. Model library, chosen independently of pose

Model, skin tone, body type, face, hair are the customer's choice and are
**orthogonal to pose**. The same model must be able to hold P01, P02, P03.

Today `ModelBrief` is a set of text fragments composed into one sentence. It is
a description, not an identity, so it cannot hold a model steady across poses.
Model identity consistency is one of the failures stage 7 tests for.

## 4. Standardise the saree input system

Merchants upload body, pallu, border and blouse separately. Define exactly how:
flat, straight, sufficient resolution, no hand obstruction, neutral lighting,
enough repeated textile area to read the motif.

**Validate uploads before charging or generating.** A bad input that is caught
before payment costs nothing; one caught after is a refund and a lost customer.

The capture vocabulary exists (`packages/engine/src/slots.ts`) and the guidance
text exists. The automatic validation does not.

## 5. Garment reconstruction

The hardest and most valuable part.

Four uploads are **not four independent textures — they are one saree**. The
system must preserve motif identity, motif scale, border width, colours, pallu
placement and blouse material, and drape them correctly on the body.

The component legend (`componentLegend` in `compose.ts`) is a first attempt at
telling the model this in words. Whether words are enough is unproven.

## 6. Per-pose generation recipes

Not one giant universal prompt. `P01_recipe`, `P02_recipe`, and so on.

P10's recipe knows one hand holds the pallu. P12's knows the pallu must be fully
displayed. Each recipe is a controlled structure into which the customer's
textile information is injected.

This replaces today's single `composePrompt` fragment assembly.

## 7. Consistency testing before selling

Roughly 20 deliberately different sarees — plain, silk, Banarasi, Kanjivaram,
printed, large motifs, tiny motifs, contrast borders, complex pallus — run
across every important pose.

Looking for: changed motifs, invented borders, wrong pallu, wrong blouse, extra
limbs, altered colours, wrong pattern scale, inconsistent model identity.

This stage costs real money and must be budgeted before it starts.

## 8. Connect to the paid studio flow

```
upload saree → choose model → choose pose(s) → choose background
  → preview order → pay → generate → QC → download
```

Package size determines pose count: 1 image is one pose, 4 is four, 8 is eight.
This is why the pose picker must show what each pose produces — the customer is
spending a pose, not a click.

---

## Open items blocking the next stage

- ~~P13 specified twice~~ — settled by the generated icon: **over-head pallu
  drape**. "Pallu flowing naturally" is now an unassigned idea with no code; it
  needs one if it is still wanted.
- **P01 icon vs `front` pose text disagree**: the icon shows arms hanging, the
  engine says "both hands clasped together at her waist".
- **Labels P13–P24 are unconfirmed proposals**; P01–P12 are read off the icons.
- **No icon PNGs are committed yet**, so the picker still shows fallback SVG.
- **Textile fidelity on real kalamkari is untested.** This is the risk the whole
  ordering above exists to retire early.
