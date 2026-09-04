# Source and geometry authoring

Read `AGENTS.md`, `lint.config.ts`, `docs/README.md`, the reviewed design owner, and its active source branch before writing source. Source implements reviewed decisions; it does not invent a missing model, space, material, motion, subject, or delivery contract. Return a newly exposed decision to its earliest document owner first.

Keep time in seconds, space in right-handed Y-up metres, and randomness in explicit seeds. Shot and film build functions use no clock, network, process, filesystem, or unseeded randomness. `src/examples` is reading material: adapt a technique into its owning branch and never import examples into delivered source.

## Core routes

Read each applicable sibling in full before acting:

- [Design branches](design-branches.md) separates map, model, space, material, instance, motion, and system ownership.
- [Models and motions](models-and-motions.md) covers bounded representation, articulation, and deterministic change.
- [Ownership](ownership.md) separates author-, compiler-, and renderer-owned bytes.
- [TypeScript](typescript.md) defines deterministic module shape and typed registration.
- [Composition](composition.md) arranges repeated production source as a program that emits shots and records.
- [Compilation](compilation.md) owns design, source, and final scopes plus atomic publication.

## Craft routes

Read only the craft that the current source change reaches:

- [Cinematography](cinematography.md) for shot size, lens, continuity, camera motion, light, and coverage.
- [Editing](editing.md) for selection, source-time mapping, rhythm, transitions, and cut review.
- [Motion](motion.md) for actions, poses, timing, contact, expression, and continuity.
- [Rigging](rigging.md) for silhouettes, hierarchy, pivots, skeletons, controls, and operable openings.
- [Sound](sound.md) for events, dialogue, ambience, spatialization, and mix hierarchy.
- [Spatial design](spatial-design.md) for plan, circulation, openings, daylight, proportion, exterior/interior agreement, and distinct plan/section/elevation/perspective/traversal judgments.

## Derived records and verification

`scripts/emitDesign.ts` initially refuses. After reviewed design and source exist, extend only its marked block with explicit imports and `emit` calls for exactly the records this production owns. Preserve its unchanged-record behavior and orphan refusal. It writes and never deletes.

Never edit generated output or renders. Correct authored source, regenerate, and renew stale reviews. Run `npm run lint:source` while authoring, `npm run design` when reviewed design records are ready, and `npm run compile` as the only command allowed to update compiler-owned output. A clean compile proves structure, not appearance; hand rendered claims to [Review verification](../review-verification/SKILL.md).
