# SAR-P15 — master reference

Status: **prompt written, not yet run.**

This produces `master-reference.png` — the photorealistic pose-control asset. It
is **not** a replacement for `silhouette.png`, which is the human-approved
definition of the pose and must never be overwritten.

## Geometry, taken from the registry record

Every line below is read off `apps/web/data/poses/saree/SAR-P15.json`. If the
record changes, this prompt changes with it.

| Record field | Value | In the prompt |
| --- | --- | --- |
| `body.orientation` | `front` | exact frontal view |
| `body.torsoAngle` | `0` | no torso rotation |
| `body.headDirection` | `camera` | head facing directly forward |
| `body.weightDistribution` | `left` | weight carried on her left leg |
| `body.leftLeg` | `neutral` | left leg straight, supporting |
| `body.rightLeg` | `crossed` | right ankle softly crossed over the left |
| `hands.left/right.position` | `relaxed beside body` | both arms hanging |
| `hands.*.interaction` | `none` | neither hand touches the garment |
| `garmentBehaviour.pallu.position` | `over the left shoulder` | pallu on her left shoulder |
| `garmentBehaviour.pallu.displayMode` | `natural fall down the front` | falling down the front, uncontrolled |
| `garmentBehaviour.pleats.visibility` | `full` | front pleats fully visible |
| `garmentBehaviour.border.visibility` | `front edge and lower hem` | hem line readable |
| `showcasePurpose` | hem line, lower border, slim silhouette | framing keeps the hem and feet in shot |

---

Create a single photorealistic full-body fashion photograph of one woman wearing a saree, to be used as a pose reference for an AI product-photography studio.

PURPOSE

This is a POSE CONTROL REFERENCE, not a finished catalogue image and not an advertisement.

Its only job is to define, in a real human body, one precise repeatable pose:

“Front-facing full-body saree catalogue stance with a soft crossed-ankle.”

The garment is deliberately plain. Body geometry is the thing being defined. Prioritize anatomical accuracy, pose repeatability, clean framing, and neutral presentation.

POSE

Show exactly one adult woman standing and facing the viewer.

Body orientation:
- Exact frontal view
- Zero torso rotation, shoulders square to the camera
- Head facing directly forward, eyes to the camera
- Hips square to the camera
- Torso upright and elongated
- Shoulders relaxed and level
- Spine straight but natural

Do not create:
- torso twist
- body lean
- exaggerated hip thrust
- runway or editorial posing
- walking motion
- over-the-shoulder look

ARMS

Both arms hang naturally beside the body.

- Relaxed, with a slight natural bend at the elbows
- Close to the body but clearly separated from the torso
- Both arms fully visible from shoulder to hand

Do not use:
- hand on waist or hip
- crossed arms
- raised arms
- arms behind the back
- any gesture

HANDS

Both hands visible beside the upper thighs, relaxed, fingers naturally together.

CRITICAL: neither hand touches, holds, lifts, gathers or rests on the saree. No hand-to-garment interaction of any kind.

Do not create:
- a hand holding the pallu
- a hand gathering pleats
- a hand lifting the hem
- fingers hooked into the fabric

LEGS AND STANCE — THE DEFINING FEATURE

The stance is a SOFT CROSSED ANKLE.

- Weight carried on the LEFT leg, which is straight and supporting
- The RIGHT leg crosses gently in front, right ankle resting near the left
- The cross is soft and natural, the kind of relaxed standing rest a person falls into — not a dancer's pose and not a deliberate leg-cross
- Hips stay square despite the crossed ankle
- Both legs remain close together, producing a narrow silhouette

Do not create:
- a wide stance
- a deep or theatrical leg cross
- knees crossed rather than ankles
- one leg thrown far across the other
- a walking or mid-step position
- weight shifted onto the right leg

FEET

Both feet must be visible below the hem and clearly readable.

- Left foot flat and forward-facing, carrying the weight
- Right foot crossed softly in front, resting lightly, toe or ball of the foot to the ground
- Feet close together
- Natural bare or plain flat-sandal feet

Do not crop the feet. Do not hide either foot behind the hem.

HEAD AND FACE

A real, natural adult Indian woman.

- Direct, calm gaze to the camera
- Neutral to softly pleasant expression
- Natural skin with real texture
- Minimal, natural makeup

HAIR

Dark hair worn simply — down or loosely gathered — and kept clear of the shoulder the pallu falls over, so the pallu line stays readable.

SAREE — DELIBERATELY PLAIN

Dress her in a simple, unpatterned saree in a single mid-tone neutral colour.

The saree must clearly show its construction:

1. Saree body wrapped and pleated at the waist
2. Front pleats fully visible, hanging straight to the ankles
3. Pallu draped OVER THE LEFT SHOULDER, falling naturally down the front
4. A short-sleeved blouse
5. A plain hem line at the bottom

Do not include:
- prints, motifs, paisley, florals
- embroidery, zari, brocade, sequins
- contrast borders or decorative edging
- any woven pattern or textile detail

The fabric should read as plain cotton or plain silk with natural drape and natural folds only.

NO ACCESSORIES

No earrings, necklace, bangles, rings, bindi, watch, handbag, belt, flowers or props of any kind.

FRAMING AND CAMERA

- Full body, head to feet, nothing cropped
- Figure centred horizontally
- Figure occupies approximately 85% of the image height
- Straight-on, eye-level camera, no tilt, no perspective distortion
- Shot as if on an 85mm lens at a moderate aperture — the whole body sharp
- Portrait orientation, 4:5

BACKGROUND AND LIGHT

- Plain seamless studio background in a light neutral grey
- Even, soft, diffused frontal light
- Soft, minimal contact shadow at the feet only
- No environment, no furniture, no set dressing, no visible light sources

VISUAL STYLE

PHOTOREALISTIC. A real photograph of a real person.

Do not produce:
- illustration, vector, silhouette or flat art
- 3D render or CGI look
- painting, sketch or stylisation
- heavy retouching or plastic skin
- beauty-campaign lighting or drama

MANDATORY QUALITY CHECK

Before finalizing, verify:

1. Exactly one woman
2. Photorealistic, not illustrated
3. Full body visible, head to feet, nothing cropped
4. Perfect frontal orientation, zero torso rotation
5. Shoulders square and level
6. Head facing directly forward
7. Both arms hanging relaxed beside the body
8. Both hands visible
9. Neither hand touching the garment
10. Weight on the LEFT leg
11. Right ankle softly crossed in front
12. Ankles crossed, not knees
13. Hips square despite the cross
14. Narrow silhouette, legs close together
15. Both feet visible below the hem
16. Pallu over the LEFT shoulder
17. Pallu falling naturally down the front, untouched by any hand
18. Front pleats fully visible
19. Hem line clearly readable
20. Saree completely plain, no motifs or border
21. No jewellery or accessories
22. Plain neutral studio background
23. Even light, no dramatic shadow
24. Figure centred, about 85% of image height
25. 4:5 portrait

FINAL RESULT

A clean, neutral, photorealistic full-body reference photograph defining the SAR-P15 stance: front-facing, arms relaxed, hands off the garment, soft crossed ankle with weight on the left leg.

PRIORITY:

Pose geometry > anatomical realism > garment construction clarity > neutral presentation.

---

## After it is generated

1. Save it as `apps/web/public/poses/saree/SAR-P15/master-reference.png`.
   **Do not overwrite `silhouette.png`.** Different purpose: the silhouette is
   the approved definition, the master reference is the control asset.
2. Set `assets.masterReference` in `SAR-P15.json` to
   `/poses/saree/SAR-P15/master-reference.png`.
3. Check it against the 25 items above before accepting it. Items 10–13 are the
   ones a generator gets wrong: crossed knees instead of ankles, or the weight
   on the wrong leg, both of which change the pose.
