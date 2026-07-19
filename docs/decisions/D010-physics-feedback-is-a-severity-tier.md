# D010. Physics feedback is a severity tier, not a gate

## Decision

Physics results are reported on the severity axis: physical-plausibility findings are `warning`, and only integrity impossibilities (a broken skeleton graph, an out-of-ROM joint, a dangling reference) are `error`. A collision response is a suggestion the caller may accept, not an outcome imposed on the artifact.

## Why

A film may be deliberately unphysical. Blocking a moonwalk, a wire-fu leap, or a cartoon topple would make the engine an obstacle to the thing it exists to serve. The user's standing position: *physics is recommended feedback, not a "absolutely not"*.

But unphysical must still be **visible**. Reporting it as a warning keeps the information in the loop — the agent sees the skate, the interpenetration, the lost balance — while leaving the artistic call where it belongs.

## Where it binds

- `packages/engine/src/physics/collisionResponse.ts` — a response the caller can accept, not an imposed result.
- `packages/engine/src/validation/validateBodyCollision.ts`, `validateFreeFall.ts`, `validateSupport.ts` — advisory, because a film may be deliberately unphysical.
- `test/src/features/validation/test_validation_body_collision.ts`.

## Relations

Refined by [D015](./D015-physical-plausibility-is-a-suppressible-warning.md), which adds the `physicsIntent` suppression channel so an acknowledged warning stops recurring. The hard-`error` side is [D007](./D007-perform-reach-is-unclamped.md).

@author Samchon
