# Source and geometry authoring

Read `AGENTS.md`, `src/lint.config.ts`, `docs/README.md`, the reviewed design owner, and its active source branch before writing source. Source implements reviewed decisions; it does not invent a missing model, space, material, motion, subject, or delivery contract. Return a newly exposed decision to its earliest document owner first.

Keep time in seconds, space in right-handed Y-up metres, and randomness in explicit seeds. Shot and film build functions use no clock, network, process, filesystem, or unseeded randomness. Derive production content from its reviewed owners rather than importing demonstration content.

## Core routes

Read each applicable sibling in full before acting:

- [Design branches](design-branches.md) separates map, model, space, material, instance, motion, and system ownership.
- [Models and motions](models-and-motions.md) covers bounded representation, articulation, and deterministic change.
- [Geometry](geometry.md) owns operation selection, topology and attribute consequences, deterministic explicit meshes, and geometry verification.
- [Ownership](ownership.md) separates author-, builder-, and renderer-owned bytes.
- [TypeScript](typescript.md) defines deterministic module shape and typed registration.
- [Composition](composition.md) arranges repeated production source as a program that emits shots and records.
- [Compilation](compilation.md) owns deterministic source execution and its verification boundary.

## Craft routes

Read only the craft that the current source change reaches:

- [Cinematography](cinematography.md) for shot size, lens, continuity, camera motion, light, and coverage.
- [Editing](editing.md) for selection, source-time mapping, rhythm, transitions, and cut review.
- [Motion](motion.md) for actions, poses, timing, contact, expression, and continuity.
- [Rigging](rigging.md) for silhouettes, hierarchy, pivots, skeletons, controls, and operable openings; pair it with [Geometry](geometry.md) when triangles or derived attributes change.
- [Sound](sound.md) for events, dialogue, ambience, spatialization, and mix hierarchy.
- [Spatial design](spatial-design.md) for plan, circulation, openings, daylight, proportion, exterior/interior agreement, and distinct plan/section/elevation/perspective/traversal judgments.

## Source execution and verification

Implement reviewed design decisions as typed values and functions in their source owners. Follow [Ownership](ownership.md) for the boundary between authoring inputs and outputs, and [Compilation](compilation.md) for execution.

Correct authored source, rerun its consumers, and renew stale reviews. Run the declared source lint while authoring and the applicable execution command when its inputs are ready. A clean compile proves structure, not appearance; hand rendered claims to [Review verification](../review-verification/SKILL.md).
