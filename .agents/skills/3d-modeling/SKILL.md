---
name: 3d-modeling
description: Defines what automovie models and what it refuses to model, and the verification discipline every geometry, parameter, and derived-data change is held to. Use before any model, geometry, rig, morph, or asset-pipeline work, and before proposing anything that would raise a figure's fidelity.
---

# 3D Modeling

## What is modelled here

A figure is a crude proxy carrying rich meaning: a stickman whose joints obey real range-of-motion limits, whose feet plant on the actual ground function, and whose gait comes from a declared table. A character that looks like someone is not the product, and that ceiling is a decision rather than a milestone. The project skill's [Out of Scope](../project/SKILL.md#out-of-scope) section states it and the condition that reopens it.

`packages/face` is the dormant remnant of the shelved parametric head effort, kept for compatibility. Do not extend it or build on it.

What this skill governs is everything the product does model: procedural geometry, spaces and boundaries, rigs and skeletons, morph and expression channels, gait and motion tables, ingested assets, and every value derived from them.

## Measure before you conclude

The order is fixed: measure, evaluate, decide. Never assert a cause, a verdict, or a fix before measuring the geometry and looking at a render. Reasoning from one number or from an assumption produces confident wrong fixes, twice paid for here: a framing solver mistook a rig's joint-Y range for its declared key and cropped every actor's head, and a hand-copied normalization diverged in the last bit and split a quaternion on a quarter of its samples.

Measure numerically (landmark distances, bounds, angles, byte digests) and look at the result. When attributing a change to a cause, render an A/B with and without it rather than guessing which edit helped.

Lighting used for judgment must reveal form, so use a directional key that casts the planes rather than a soft even wash. A wash makes a broken shape look passable and a good one look dull, and both readings are lies. Flat shading and normal display isolate geometry from material, which is what you want when the question is whether the shape is right.

## Verify, then report: never the reverse

The loop is change, render, review it yourself, critique honestly, change again, repeated until the result is correct or you reach a real, named ceiling. Only then report, evidence first, stating plainly what is still wrong.

Claiming something is fixed before showing the verified render is the cried-wolf failure and it is forbidden. Let the verified image carry the claim and describe the remaining flaws yourself. "Less bad than before" is not "correct". The viewer-verification skill defines how to drive the render for this.

## Don't patch a broken foundation

If a base representation is fundamentally wrong, rebuild it rather than stacking correctives on it. Each corrective fights the last, and the result is a patched version of the original error. A corrective is legitimate only when the base is sound and the change is small, measured, and verified against a render.

The same rule governs a second implementation of one quantity. A hand copy is a second answer that eventually disagrees with the first, so call the one function instead: the code that draws is the code that measures.

## Derived data embeds its basis

A residual, a fitted preset, or a baked artifact is defined against a base (`subject - base`), so regenerate every derivative whenever the base changes or the correction double-applies. State the basis in the artifact rather than leaving it implicit, which is what makes a stale derivative detectable instead of merely wrong.

## Parameters and rigs

- Anatomy-nested or domain-nested types, one channel per nameable trait, with sign semantics and defaults in field JSDoc. Neutral is zero, and a configuration is an offset from neutral.
- Paired features carry left and right with an explicit rule, so asymmetry is authored data rather than something baked into the base.
- Ranges are enforced by `engine` validators, never by `typia` tags in `interface`; the development skill's rough-types rule owns that boundary.
- Record the study behind a numeric range in `.wiki/04-domain-research/`, and read that directory before deriving one again.

## Every angle, every scale

A model is not its most flattering view. Verify front, three-quarter and side, and verify at the distance the shot actually uses: a proxy that reads at fifty metres can be nonsense in a close framing, and a shape tuned in close-up can vanish in a crowd. Silhouette is what survives distance, so judge it there.

## Pipeline discipline

- Verification (measure, render, review) precedes any claim of quality.
- Cover every executable position the change writes at 100%; the development skill owns the exact per-change scope.
- Keep scratch in gitignored directories and promote only stabilized logic into packages. The render harness drives the deployed viewer headless, multi-angle, with form-revealing lighting.
