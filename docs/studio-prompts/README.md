# The Studio prompts

What the Studio produces. Not images — **prompts**, composed for a product and
ready to paste wherever the generation actually happens.

This is a deliberate narrowing. Tantu had been calling an image API directly,
which costs money on every attempt and put the quality of the output at the
mercy of whichever model answered. Emitting the prompt instead costs nothing,
keeps the proven wording intact, and leaves the choice of engine open.

## Status

Version 2 of the composition, 2026-09-10. Three frozen, two live and awaiting
their test.

| #   | File                                                         | State                                                              |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | [`01-front-symmetrical.md`](01-front-symmetrical.md)         | **frozen v2**, approved 2026-09-10 on 300021                       |
| 2   | [`02-three-quarter.md`](02-three-quarter.md)                 | **frozen v2**, approved 2026-09-10 on 300021 from the Studio, garment words read by Claude |
| 3   | [`03-back-view.md`](03-back-view.md)                         | **frozen v2**, approved 2026-09-10 on 300021; pallu spread full width as a display shot (design upright, a quarter turn from the physical lie, accepted on purpose) |
| 4   | [`04-waist-up.md`](04-waist-up.md)                           | v2 wording, live, not yet tested; the drape changed (see file)      |
| 5   | [`05-relaxed-three-quarter.md`](05-relaxed-three-quarter.md) | v2 wording, live, not yet tested; shares Prompt 2's placement map    |

The files 02 to 05 hold the v1 wordings as received. The v2 wording for every
prompt is the code, in `apps/web/src/content/promptTemplates.ts`; the Studio
shows it composed.

**Frozen** means the composed prompt produced an approved image and its wording
is now fixed. The template carries a `frozen` record and the Studio shows a
badge. The shared blocks — REFERENCE, TASK, HOUSE RULES, the SCENE sentences,
OUTPUT — are frozen along with it, since P1 is built from them. Changing any
of them is a v3 of every frozen prompt that uses them.

## How a v2 prompt is built

Eight labelled blocks, always in this order, separated by blank lines:

| Block           | Varies by                | What it does                                                                 |
| --------------- | ------------------------ | ---------------------------------------------------------------------------- |
| REFERENCE       | attach mode, model source | Which panel is which part. Four fabrics, never mixed.                        |
| TASK            | safety-rule toggles      | Copy, do not design. The six rules are sentences here, up front.             |
| HOUSE RULES     | nothing                  | What a catalogue image never shows: trim on the blouse, bare midriff, pallu on the floor, anything invented. |
| GARMENT         | **the product**          | This saree in words: fibre, craft, and each part's colour and motif.         |
| PLACEMENT MAP   | pose                     | Which print is allowed where, in camera terms, with a transition rule and a "Not allowed" list. |
| POSE            | pose, model              | Stance, drape, pleats, expression, framing.                                  |
| SCENE           | background, model        | Setting, hair, jewellery, light.                                             |
| OUTPUT          | nothing                  | The image only, no commentary.                                               |

The GARMENT block is the only one that changes per saree. Its words come from
SLK's record, laid over by a description of the photographs (the **Garment
words** panel in the Studio, filled by "Describe from photographs" when an
engine key exists, or typed). The placement maps borrow the colour and motif
words from it: "her left breast is blue, never cream".

**Why blocks.** v1 was one paragraph and produced the right saree in the wrong
places: pallu print on the chest, the chest band on the wrong side of its
border, the pallu fused with a sleeve, the saree's scalloped end drawn twice.
Each was a gap the prompt left open and the image model filled from habit. The
placement map names every region; the house rules close the gaps that are the
same for every pose.

**How to attach.** One labelled sheet, downloaded from the Studio, as the only
image. Four separate files did not work: a chat model is not shown filenames.

## Rules

**Proven wordings do not drift.** A frozen prompt's text is fixed. A variation
is a new version, proven again on the same product before it replaces the old.

**The customer does not choose poses.** All are produced, every time. The
pose set is a decision made once, here, not a question asked of a buyer.

**No generation.** Nothing in this flow renders an image or spends money on
one. The single paid call is the optional description of the photographs, a
short text call at flash pricing, made from a button.

## Decided

- The received wordings said "the reference image", singular. The composed
  prompt says "the attached reference sheet" (or "reference images" in files
  mode). Approved by Bhanu before the P1 v1 test.
- v2 drops the "preserve the embroidery" safety clause for a border-width
  clause. Most of these sarees are printed; the word invited invented texture.
- Hair is fixed at a neat low bun so a catalogue of hundreds reads as one
  shoot. It was unspecified in v1 and varied between runs.
- Prompt 4's drape changed in v2: the pallu end is brought over the left
  forearm so the "pallu detail" shot actually shows the pallu. In v1 it stayed
  behind the shoulder and the shot showed almost none of it.
