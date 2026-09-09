# The four Studio prompts

What the Studio produces. Not images — **prompts**, composed for a product and
ready to paste wherever the generation actually happens.

This is a deliberate narrowing. Tantu had been calling an image API directly,
which costs money on every attempt and put the quality of the output at the
mercy of whichever model answered. Emitting the prompt instead costs nothing,
keeps the proven wording intact, and leaves the choice of engine open.

## Status

Five received. One frozen, four awaiting their test.

| # | File | State |
| --- | --- | --- |
| 1 | [`01-front-symmetrical.md`](01-front-symmetrical.md) | **frozen v1**, approved 2026-09-09 on 300021 |
| 2 | [`02-three-quarter.md`](02-three-quarter.md) | received, live, not yet tested with the sheet |
| 3 | [`03-back-view.md`](03-back-view.md) | received 2026-09-09, live, not yet tested |
| 4 | [`04-waist-up.md`](04-waist-up.md) | received 2026-09-09, live, not yet tested |
| 5 | [`05-relaxed-three-quarter.md`](05-relaxed-three-quarter.md) | received 2026-09-09, live, not yet tested |

**Frozen** means the composed prompt produced an approved image and its wording
is now fixed. The template carries a `frozen` record in
`apps/web/src/content/promptTemplates.ts` and the Studio shows a badge. The
shared slots — expression, framing, backgrounds, styling, the safety rules,
the sheet legend — are frozen along with it, since P1 is built from them.
Changing any of them is a v2 of every frozen prompt that uses them.

**How to attach.** One labelled sheet, downloaded from the Studio, as the only
image. Four separate files did not work: a chat model is not shown filenames.

## Rules

**Stored verbatim.** These are proven wordings. They are not tidied, merged,
deduplicated or "improved" — the whole reason to keep them is that they can be
reproduced exactly. A variation goes in a new file with a new number.

**The customer does not choose poses.** All four are produced, every time. The
pose set is a decision made once, here, not a question asked of a buyer.

**No generation.** Nothing in this flow calls a provider or spends money.

## Decided

The received wordings said "the reference image", singular. The composed
prompt says "the attached reference sheet" (or "reference images" in files
mode) and takes the fibre and garment type from SLK — "cotton saree" — but not
the full product title. Approved by Bhanu before the P1 test, and frozen with
it.
