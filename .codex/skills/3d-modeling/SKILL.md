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

- Fit the subject's own measured indices (Farkas-style), not idealized canons. Golden ratios are vocabulary for reporting, not optimization targets.
- Constrain or regularize every visually-salient dimension the optimizer can move. An unmeasured dimension rails to its bound and produces a villain face.
- Distrust depth from a single frontal detection: FaceMesh z is ~1.7× exaggerated, systematically across subjects. Calibrate absolute depth against a profile view by whole-curve fit — point anchors break per chin shape.
- Two-view triangulation needs pose↔depth alternation over several rounds; a single pass has a bas-relief ambiguity that squashes lateral relief.

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
