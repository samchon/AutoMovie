---
name: 3d-modeling
description: Defines the first-principles doctrine for building the parametric human face/head — pure-form beauty, measured proportion, verify-before-claim. Use before any face/head model, parameter, or likeness work.
---

# 3D Face & Head Modeling

We build a parametric human head: named anatomical parameters → validated document → deterministic geometry. The bar is that **pure form alone is beautiful** — skin-colored clay, no texture, no shader tricks, like a marble bust. These are the principles that make that achievable. They are not optional.

## Form is the product

- Beauty lives in **proportion, curvature, and the transition between planes** — not in texture or shading. A skin-colored clay render of a correct face is beautiful (ancient sculpture has no color and loses nothing). If the flat-clay render is not beautiful, the **form** is wrong; fix the form.
- Never use texture, ambient occlusion, lighting, or material tricks to rescue a bad shape. They hide the defect from you and it returns. Audit form with **flat shading and normal maps**, where only geometry speaks.
- Lighting for judgment must REVEAL form (a directional key that casts the planes), not a soft even wash that flattens it. A wash can make a monster look passable and a good form look dull — both lies.

## Measure before you conclude (선측정 후평가)

- Order is fixed: **measure → evaluate → decide**. Never assert a cause, a verdict, or a fix before you have measured the geometry and looked at a render. Reasoning from one number or an assumption produces confident wrong fixes (e.g. blaming "low-poly clay" for what is actually a mis-seated eyeball).
- Measure numerically (landmark distances, Farkas indices, profile depth) AND look (multi-angle renders). When attributing a change, render an **A/B** (with vs without) — do not guess which edit helped.

## Verify, then report — never the reverse

- The loop: **change → render → review it yourself → critique honestly → change again → repeat**, unbounded, until it is genuinely good or you hit a real, named ceiling. Only then report, **image first**, stating plainly what is still wrong.
- Stating "it's beautiful / fixed now" before showing a verified render is the cried-wolf failure — it destroys trust and is forbidden. Let the verified image carry the claim; describe the remaining flaws yourself.
- "Less bad than before" is not "good." Keep going.

## Don't patch a broken foundation

- If the base mesh is fundamentally wrong — a monster — **rebuild it from scratch**. Patching correctives onto a broken base yields a patched monster, and each corrective fights the last. A correct, well-proportioned base is cheaper than an endless stack of fixes.
- A corrective is only legitimate when the base is sound and the change is small, measured, and render-verified.

## Beauty is measured proportion

- Attractiveness is driven by **averageness, symmetry, and youthful sexual dimorphism** — NOT the golden ratio (φ / Marquardt mask is folklore, not empirically supported; do not wire it in).
- The **neutral (all parameters zero) is the balanced average — the most beautiful baseline.** Parameters deviate from it toward individuality. A specific character is offsets from the ideal average, never beauty built up from an ugly base.
- Calibrate to real human variation (Farkas anthropometry, cephalic index, vertical thirds with the lower third largest, the fifths, fissure ≈ intercanthal): a parameter's ±1 should be ≈ ±1 SD of the population, ±2 the believable edge. The full study lives in `.wiki/04-domain-research/`; read it before setting ranges.
- Feminine cues raise attractiveness and are deliberate axes: softer jaw and gonial angle, smaller nose, fuller lips, a smooth (not bossed) brow ridge, larger eyes relative to the face, a higher arched brow, a smaller chin. Study how MakeHuman (CC0) decomposes these.
- Reference real exemplars and name archetypes (e.g. cute / beauty / plain) as concrete targets to carve toward, rather than tuning in the abstract.

## The whole head, every angle

- A head is not a frontal mask. Cephalic proportions (breadth/length), occiput projection, the side-profile S-curve, and the ear sitting on the brow→nose-base line behind the head's midline all matter. **Always verify front, ¾, and side** — a face that reads frontally can be a flat slab in profile.
- Features must sit correctly in 3D: the eyeball recesses so only the cornea peeks through the lid aperture (never a sphere bulging proud of the lids); lids, lips, and alae carry real depth. A mis-seated feature reads as a monster regardless of proportion.

## The parameter system

- Anatomy-nested types, one morph per nameable trait, documented with sign semantics and typia range/default tags so the structured-output schema binds the model. Neutral = 0 = the average.
- Paired features (eyes, brows, cheeks) carry left/right with an explicit rule, so asymmetry is data, not baked in.
- Derived data embeds its basis: any identity residual or fitted preset is `subject − base`, so **regenerate every derivative whenever the base changes**, or the fix double-applies.

## Pipeline discipline

- Verification (measure → render → review) is mandatory before any claim of quality.
- **One PR per arc, many commits; never merge until the mission is genuinely complete and verified.** A green build is not done; a good-looking front is not done.
- Keep 100% test coverage. Keep scratch in gitignored dirs (`.models/*/work`, `.shots/`); promote only stabilized logic into packages. The render harness drives the deployed editor headless (playwright), multi-angle, with form-revealing lighting and normal-map modes.
