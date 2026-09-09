# Prompt 1 — front, symmetrical, pallu over the left shoulder

**Status: FROZEN, v1 — approved 2026-09-09.**

Tested on product 300021 (Beige Kalamkari Cotton Saree) in Google Gemini with
the Studio's labelled contact sheet attached as the only image. The output
reproduced the body print, the pallu, the narrow floral border and the blouse
fabric as photographed, in the courtyard, in the pose. Bhanu's verdict:
"the output is as expected".

From here the wording below does not change. Neither does the sheet legend it
opens with, nor the shared sentences it draws on (expression, framing,
background, styling, lighting, the six safety rules). An improvement is v2,
proven again on the same product before it replaces this.

## As sent — the composed prompt, v1

Selections: woman · mid-20s · courtyard · one labelled sheet · all six rules on.

---

The attached image is a sheet of 4 labelled photographs of ONE saree. The panel labelled BODY is the saree body — the main field and its repeating motif. The panel labelled PALLU is the pallu — the decorated end that is draped over the shoulder. The panel labelled BORDER is the border — the narrow decorated strip that runs along the long edges and the hem. The panel labelled BLOUSE is the blouse piece — the fabric for the fitted top. Read the label printed above each panel to know which part it is. The panels keep their own proportions: the BORDER panel shows a narrow strip, and the border on the finished garment must stay that narrow. Your task is to photograph THIS saree on a model — not to design a saree in this style. Reproduce each part exactly as photographed: the same motifs, the same colours, the same motif scale and spacing, the same border design and width. Where the body is visible it must show the body print. Where the pallu is visible it must show the pallu print. The border on the finished saree must be the border shown, at its real width. The blouse must be made of the blouse fabric. Do not invent motifs, do not substitute a generic print in the same style, and do not swap one part's design onto another. A professional fashion catalog photo of a woman in her mid-20s wearing the cotton saree shown in the attached reference sheet. She stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at her waist. The saree pallu is pleated neatly and thrown up and over the left shoulder from front to back, forming a distinct peaked, pointed shape of fabric rising at the shoulder edge before going over and down her back. Only the front portion of the pallu near the collarbone and shoulder point is visible; the majority of the pallu length falls behind her shoulder and down her back, out of view from the front. The pleats must be clean, straight, and evenly spaced — like neatly pressed fabric folds, not bunched or crumpled. She has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around her. She is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind her head, with pillars on either side, background softly blurred. Styled with gold jhumka earrings, a gold choker-style necklace, and bangles. Warm, golden directional lighting. Preserve the original fabric colours exactly as photographed; do not shift them warmer, cooler, brighter or more saturated. Maintain the scale, spacing and layout of the design exactly as in the reference. Preserve the embroidery and border details, including the border's width. Do not invent motifs that are not present in the reference image. Keep the pattern placement realistic to how this garment is actually draped. Use realistic draping, with natural folds and shadows.

---

## What was learned on the way

- **Four separate files, with a legend naming the filenames, failed.** Gemini
  chat never shows the model an attachment's name. It copied the style and
  invented the prints.
- **The labelled sheet worked on the first attempt.** One PNG, BODY / PALLU /
  BORDER / BLOUSE printed above each panel, panels letterboxed so the border
  stays a narrow strip. The fidelity mandate — photograph THIS saree, do not
  design one in its style — goes before the catalog-photo sentence.
- **Labels must be drawn, not typeset.** The server has no fonts; SVG text
  came out as empty boxes. The letters are 5×7 bitmap glyphs.

## Original wording, as received

Kept for the record. The composed prompt above differs only in "the cotton
saree shown in the attached reference sheet" for "a cotton saree as per the
reference image", which Bhanu approved before the test.

A professional fashion catalog photo of a woman in her mid-20s wearing a cotton saree as per the reference image. She stands facing the camera directly in a symmetrical, centered pose, with both hands clasped together at her waist. The saree pallu is pleated neatly and thrown up and over the left shoulder from front to back, forming a distinct peaked, pointed shape of fabric rising at the shoulder edge before going over and down her back. Only the front portion of the pallu near the collarbone and shoulder point is visible; the majority of the pallu length falls behind her shoulder and down her back, out of view from the front. The pleats must be clean, straight, and evenly spaced — like neatly pressed fabric folds, not bunched or crumpled. She has a direct, confident gaze and a neutral-to-soft expression. Full-length portrait, tightly framed so her figure fills most of the vertical frame from head to feet, shot straight-on at eye level with minimal headroom and minimal space around her. She is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind her head, with pillars on either side, background softly blurred. Styled with gold jhumka earrings, a gold choker-style necklace, and bangles. Warm, golden directional lighting.
