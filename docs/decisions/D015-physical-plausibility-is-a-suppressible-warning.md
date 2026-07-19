# D015. Physical plausibility is a suppressible warning; only impossibility is an error

## Decision

Physical-plausibility findings — a planted foot that skates, a foot through the ground, interpenetrating bodies, a self-intersecting limb, a lost balance, a prop that would topple, an unsupported body that would fall — are `warning`. Validation still **succeeds** and the warnings ride along.

An action may carry a `physicsIntent` marker (`"moonwalk"`, `"wire-fu"`, `"defies-gravity"`, `"superhuman-impact"`) that suppresses the matching warnings on later rounds. Interaction events still surface for downstream consumers.

Only impossibility stays a hard `error`: a joint bent past its ROM, a broken reference, an impossible timing, a malformed annotation.

## Why

Two things had to be true at once. The user's standing philosophy — *physics is recommended feedback, not an absolute prohibition* — and the industry default: **physically plausible by default, artist override always available**. The severity split delivers the first; the `physicsIntent` channel delivers the second.

The suppression channel exists specifically to end the nagging loop. Without it, an intentionally unphysical shot re-reports the same warning every round, and the only way to silence it is to lie about the verdict. Three honest responses remain: accept the engine's suggested response, restage, or acknowledge with a marker.

## Where it binds

- `packages/engine/src/validation/validateFootSkate.ts`, `validateGroundContact.ts`, `validateSelfIntersection.ts`, `validateBalanceSupport.ts` — each a warning with an opt-out marker.
- `packages/engine/src/validation/validateContinuity.ts` — mirrors the advisory tier.
- `packages/engine/src/film/reviewVisualRead.ts` — advisory notes that never fail a gate.
- `packages/mcp/prompts/overall.md`, `packages/mcp/prompts/review.md` — "plausibility versus possibility".
- `test/src/features/internal/predicates.ts` and the `test_validation_*` suites.

## Relations

Refines [D010](./D010-physics-feedback-is-a-severity-tier.md). The impossibility side is [D007](./D007-perform-reach-is-unclamped.md).

@author Samchon
