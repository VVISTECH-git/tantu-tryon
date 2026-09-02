# Pose registry

The permanent source of truth for every approved pose. A pose is **structured
configuration**, not a picture — the picture is one field on the record.

One registry for all garments, namespaced by garment type. Not one repository
per garment.

## Where things live

```
apps/web/data/poses/<garment>/<ID>.json      the records
apps/web/public/poses/<garment>/<ID>/        the assets
    silhouette.png        shown in the picker
    master-reference.png  steers generation geometry  (not built yet)
    thumbnail.png                                     (not built yet)
packages/engine/src/registry/                schema + queries, framework-free
apps/web/src/registry/poses.ts               loads records, serves the Studio
```

`data/` sits inside the web app so the records can be imported and a bad file
is a build error. The logical schema is what matters: it moves to database rows
unchanged.

## Pose ids

`SAR-P01` · `KUR-P01` · `LEH-P01` · `SUT-P01`

Garment-specific by design, so `P01` never means two different things. Once a
pose is **locked**, its id permanently means that pose. A substantially
different pose gets a **new id**, never a redefinition of an old one.

`SAR-P30`–`SAR-P35` are numbered clear of `P14`–`P24`, which the pose plan has
already assigned.

## Naming

**The icon is the source of truth for a pose's name.** Whatever is printed on
the generated silhouette is the name — `record.name` follows it, never the
other way round.

The 24-pose plan is a **backlog**, not a specification. It says roughly what
still needs drawing; it does not decide what a drawn pose is called. Every one
of the five poses added after the first batch came back with a different name
from the plan, and P13 came back as a different *pose* entirely — an over-head
drape where the plan said "pallu flowing naturally".

So: read the label off the image, then write the record. Never pre-name a code
from the plan and assume the icon will match it. A code with no icon yet has no
name yet.

## Status

| status | meaning | shown to customers |
| --- | --- | --- |
| `draft` | still being designed | no |
| `review` | being tested | no — dev only |
| `locked` | approved for production | **yes** |
| `deprecated` | historical, never offered again | no |

Production shows `locked` only. Outside production, `draft` and `review` appear
too, so the next pose can be worked on without the Studio looking broken.
Enforced in one place: `productionPoses` in the engine.

## Current state

19 saree records. **9 locked** — exactly the nine poses the Studio generated
before the registry existed, so making the registry the source of truth removed
nothing.

- `SAR-P01`–`SAR-P13` — the approved silhouette library. P01, P04 and P08 are
  locked because they map to live engine poses; the rest are `review` until
  they have a recipe.
- `SAR-P30`–`SAR-P35` — waist-up, relaxed, walking, seated, border macro, pallu
  macro. Proven in production, no silhouette yet, so the picker draws them.

**All 9 locked poses lack both a master reference and a recipe.** They generate
from the legacy engine text. `posesWithoutControl()` reports them; that gap is
what the reference layer and per-pose recipes exist to close.

## Adding a pose

1. Write `apps/web/data/poses/saree/SAR-Pnn.json`.
2. Put `silhouette.png` in `apps/web/public/poses/saree/SAR-Pnn/`.
3. Add the import and array entry in `apps/web/src/registry/poses.ts`.
4. Leave it `review` until it has been tested. Lock it deliberately.

## Rules the code enforces

- The UI never branches on pose meaning. `PosePicker` receives a name, a
  picture and an id; it reads no behaviour. Behaviour is resolved from the
  registry by whatever is generating.
- Pose, model and garment are separate. No record names a model.
- Garment behaviour is not one shared shape — a saree has a pallu, a kurti has
  a side slit. `SareeBehaviour`, `KurtiBehaviour` and `LehengaBehaviour` are
  distinct, joined by a discriminated union on `garmentType`.
- A pose that cannot be generated is shown disabled and labelled, never sent.

## Not built yet

Master references · per-pose recipes · model registry · admin UI · database.
The schema anticipates all of them; none is implemented.
