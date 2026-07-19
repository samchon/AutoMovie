# D007. Reach in `perform` is unclamped; the ROM gate rejects it

## Decision

`perform` does not silently clamp an over-reaching pose into range. It emits what the authored intent produces, and the ROM validator rejects the result with a located violation. Validation **reports**; it does not quietly repair.

## Why

A clamp hides the fault. If the engine bends an out-of-range elbow back to its limit and returns success, the agent never learns that its staging was impossible, the shot silently means something other than what was authored, and the same bad reach recurs every beat. A rejection names the joint and the excess, so the correction lands on the artifact that is actually wrong — usually the staging distance, not the arm.

`clampPose` / `clampJointRom` still exist as explicit tools for a caller that wants a clamp. The difference is that clamping is a caller's request, never `perform`'s silent side effect.

## Where it binds

- `packages/engine/src/perform/blendPoses.ts` — "the engine does not hide it".
- `packages/engine/src/rom/` — the ROM gate that rejects.
- `test/src/features/perform/test_perform_blend_rom.ts` — pins that the additive path passes an out-of-range result through to the gate.

## Relations

The severity split this rejection sits on is [D010](./D010-physics-feedback-is-a-severity-tier.md), refined by [D015](./D015-physical-plausibility-is-a-suppressible-warning.md): ROM is impossibility, so it stays a hard `error`.

@author Samchon
