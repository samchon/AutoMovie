---
name: 3d-modeling
description: Working rules for parametric head/face modeling — verification discipline, anthropometric fitting, derived-data cascades, texture/morph craft. Read before doing any 3D model, likeness, or pipeline work.
---

# 3D Modeling

Rules earned through real failures in the hero head pipeline. Each one cost a correction; follow them before the work, not after the review.

## Verify Every Artifact

- Never claim a visual result without rendering and inspecting it yourself. Screenshot the deployed playground editor through headless Chrome/Playwright — intermediate files and green builds prove nothing about how it looks. Harness: `.shots/_render` scripts plus the playground hooks `__setPreset` / `__setFace` / `__setPhotoHead` / `__cam.set` / `__scene`.
- Inspect from multiple angles — front, ¾, side, back — before declaring success. A head that reads well frontally can be broken in profile or have atlas smears only the side view shows.
- Show the images in the report. An unverified "fixed it" is worthless to review.
- Pixel-diff before declaring "no change" — and know when no change is expected (hair edits don't move face pixels, so identical face metrics are correct, not suspicious).
- Trust detector-free analytic overlays (project the data into the photo frame) as ground truth. Re-running a landmark detector on CG renders is biased 10–38px on mouth/chin; human perception is dominated by composition (hair, outline) and shading. Measure before trusting eyes.
- When a visual change mysteriously fails to appear, probe the deployed scene programmatically (`__scene` traversal of materials/geometry). A material swap once silently dropped `vertexColors`/`transparent` — the pipeline, not the data, was eating the change.

## Proportions Are the Product

Beauty in faces and heads is measured, not eyeballed. The full study with sources and numbers is `.wiki/04-domain-research/face-head-anthropometry.md` — read it before tuning ranges. The load-bearing rules:

- Fit the subject's own measured indices (Farkas-style), not idealized canons. Calibrate a slider so ±1 ≈ ±1 SD of real human variation for that measure and ±2 ≈ the edge of believable (Farkas norms: face height 111/102 mm M/F SD~6, bizygomatic 131/124, bigonial 97/91, facial index 85±5). Clamp there; beyond is stylization, never gain>1 extrapolation — add a target instead.
- The neoclassical canons mostly fail in real faces — treat them as weak attractors, not constraints. Default the lower face slightly largest (equal vertical thirds is the canon people violate most); let the eye fissure run wider than the intercanthal and the nose wider than the intercanthal. Only the horizontal canons (nose ≈ face/4, interorbital ≈ nose) roughly hold.
- The golden ratio does NOT drive beauty — averageness, symmetry, and sexual dimorphism do. Build the neutral default toward the population average + bilateral symmetry; expose dimorphism (brow-ridge bossing, jaw width/angle, face length, chin, lip fullness) and age as the strong axes. The empirically preferred placements are eyes-to-mouth ≈ 36% of face length, interocular ≈ 46% of face width — these coincide with the average face, not φ.
- Model the WHOLE head, not the frontal face. The cephalic index (breadth/length×100, mean ~76 SD~5: dolicho <75 / meso 75–80 / brachy 80–85) is the master head-shape axis; in profile the head fills ~a square (depth ≈ height), demanding real occiput projection; the ear spans brow→nose-base vertically and sits behind the head's vertical midline. A flattened-sphere cranium + jaw block dropped ~⅓ radius below (Loomis) is the rig model.
- Constrain or regularize every visually-salient dimension the optimizer can move. An unmeasured dimension rails to its bound and produces a villain face.
- Distrust depth from a single frontal detection: FaceMesh z is ~1.7× exaggerated, systematically across subjects. Calibrate absolute depth against a profile view by whole-curve fit — point anchors break per chin shape.
- Two-view triangulation needs pose↔depth alternation over several rounds; a single pass has a bas-relief ambiguity that squashes lateral relief.

## Parameter Taxonomy (MakeHuman conventions, CC0)

MakeHuman exposes 146 head/face sliders to autofilm's ~25; the gap is systematic axis decomposition, not exotic features. Adopt:

- Bipolar parameters resolve to TWO independently-authored targets (`…-decr`/`-incr`), each blended one-sided on a signed [-1,1] axis — a hump nose is not the negative of a saddle nose, so never force one delta through ±gain.
- Per region, separate size from placement: a `scale-{depth,horiz,vert}` + `trans-{in/out,down/up,backward/forward}` kit (our faceWidth/faceLength currently conflate these). Decompose features into bands (eye height = lid/aperture/lid; nose width = root/bridge/base) and per-part lips.
- Whole-head coverage means these specific DOFs: mixable (not exclusive) silhouette presets (oval/round/square/rectangular/triangular/inverted-triangular/diamond as independent [0,1] morphs), `head-back-scale-depth` (occiput/parietal), `forehead-nubian` (cranial-vault slope), `forehead-temple`, brow-ridge projection, and jaw-as-chin-region (`chin-bones`=gonial, `chin-prognathism`, `chin-jaw-drop`).
- Global macros (gender/age/weight) are scalar variables expanded by piecewise-linear tents into a simplex blend of a few whole-head extreme sculpts, weighted by the product of filename-declared factors — not one morph per slider. Keep detail morphs macro-independent and additive.
- Symmetry is a naming convention (`l-`/`r-` + mechanical mirror name), asymmetry comes free; matches our side rule. Tie a slider to a real measurement via a landmark polyline + numeric inversion (bisection / Gauss-Newton), so morph gain only needs to bracket the human range.

## Derived Data and Cascades

- Derived data embeds its basis. An identity residual exported as (aligned − parameter-face) bakes in any morph-basis bug; after changing the basis, regenerate every derivative or the fix double-applies.
- The same symmetric artifact at the same ratio across different subjects is a shared-component bug, not subject data. Isolate by toggling components: neutral, params-only, identity-only, single sliders.
- Segmentation must survive gradient backgrounds (per-row border refs, not a single corner ref) — and region-growing through soft hair edges eats the figure unless local growth is gated by absolute color bounds.

## Texture and Morph Craft

- glTF morph targets are deltas: set `morphTargetsRelative = true` in three.js or any nonzero weight collapses the mesh.
- Never put a person's photo texture on the neutral rig — geometry/texture mismatch reads monstrous. Identity is an exact delta morph; the texture belongs to that identity.
- Render photographed pixels unlit (`MeshBasicMaterial` in photo modes). Re-shading captured pixels shifts how every feature reads.
- In multi-view texture bakes, blend views by surface confidence (facing and distance to that view's silhouette edge) and never clamp-and-replicate edge samples — clamping streaks the edge color across yaw. Square the weights to sharpen crossovers and limit parallax double-exposure.
- Bind each vertex of a symmetric feature pair (eyes) to its nearest feature center. Gaussian falloffs overlap further than intuition says; a first-match threshold once bound the entire left eye to the right eye's center.
- This repo's files are CRLF: multi-line plain-string `.replace()` silently no-ops. Match with `/\r?\n/` regexes.

## Iteration Workflow

- Iterate small: one change → rebuild → render → inspect → next. Propagate to other subjects only after the first subject passes, since per-subject tuning hides shared bugs.
- Keep scratch in gitignored work dirs (`.models/*/work`, `.shots/`); promote only stabilized logic into packages. One PR per work arc, multiple commits inside it.
- Treat parameters as hypotheses, not absolutes. Keep alternative representations open (e.g. photo-head morphing alongside pure params) and experiment before locking one in.
