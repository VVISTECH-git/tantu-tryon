# Pose icons

The pose thumbnails in the Studio's pose picker are **generated images**, not
hand-authored SVG.

## Why not SVG

A parametric SVG croquis was built first (`apps/web/src/components/studio/PoseFigure.tsx`,
and a 24-pose sheet). It was rejected, correctly: hand-authored vector cannot
produce readable hands, feet, a true diagonal pallu crossing the torso, or
credible croquis proportions at thumbnail size. Those are exactly the things the
icon exists to communicate.

Generated icons are a **one-time build cost**, paid once per pose and then
committed as static assets. They are not part of the per-render cost. Nothing
here is generated at runtime.

## Layout

```
docs/pose-icons/
  README.md            this file
  P01-front-hero.md    the verbatim prompt that produced the accepted P01
  ...
apps/web/public/poses/saree/SAR-P01/
  silhouette.png       the accepted output, committed
```

The image and the prompt live apart on purpose: the image is an asset the app
serves and belongs to a registry record, the prompt is how that image can be
made again and belongs with the other prompts.

One markdown file per pose, holding the prompt **verbatim**. Do not edit a
proven prompt to improve it — that destroys the only thing that makes a result
reproducible. Variations go in a new file.

## Prompt structure

P01 is the template. Its sections split into two groups.

**Invariant across all 24 poses** — copy unchanged:

- `PURPOSE` (apart from the one quoted sentence naming the pose)
- `HEAD`, `HAIR`
- `SAREE` (the five things the garment must communicate)
- `NO TEXTILE DECORATION`, `VISUAL STYLE`, `NO REALISM`, `NO ACCESSORIES`
- `COMPOSITION` (figure at 65–75% of image height, pure white, centred)
- `LABEL` typography
- `FINAL RESULT` and the `PRIORITY` line

Holding these constant is what makes 24 icons look like one set — the same
scale, the same viewpoint, the same weight of line.

**Pose-specific** — rewritten per pose:

- the quoted pose sentence in `PURPOSE`
- `POSE`, `ARMS`, `HANDS`, `LEGS AND STANCE`, `FEET`
- `SAREE BODY`, `PALLU`, `FRONT PLEATS`, `BORDER`, `BLOUSE`
  (mostly stable, but the pallu section changes a great deal for P09–P14)
- the label text
- `MANDATORY QUALITY CHECK` items 3–18 and item 30

## The two techniques worth keeping

Both are why P01 came out clean, and both should survive into the render prompts:

1. **Every instruction is paired with its failure mode.** Not "feet close
   together" but a `Do not create` list naming overlapping, merged, rectangular,
   block-like. The negative is more specific than the positive.

2. **A numbered check list at the end.** Thirty verifiable statements, each one
   a thing that can be looked at in the output and marked pass or fail. It is
   also the acceptance test for the icon — a human can grade a result against it
   without re-reading the prompt.

## The poses themselves

Not listed here. **The pose registry is the source of truth** —
`apps/web/data/poses/saree/` holds one record per pose, and
[`docs/pose-registry.md`](../pose-registry.md) explains it. This directory holds
only the prompts that made the pictures.

Two rules that matter when writing a new prompt:

- **The name comes from the icon, not from the plan.** Whatever the prompt tells
  the generator to print is what the pose is then called, and the registry
  record follows the image. The 24-pose plan is a backlog of what still needs
  drawing, not a naming decision.
- **A prompt file is only useful if it is verbatim.** A prompt that has been
  tidied up no longer explains the image sitting next to it.

A pose whose prompt was never supplied is still a valid registry record — the
image is approved, it simply cannot be re-run or varied until the prompt exists.
