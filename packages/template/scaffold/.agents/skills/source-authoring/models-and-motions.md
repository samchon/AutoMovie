# Models and motions

Read [Rigging](rigging.md) alongside this document before changing geometry, rigs, or derived assets.

## Model decisions

`docs/models` records the deterministic blocking representation of a settings subject: coordinate frame, dimensions, hierarchy, joints or degrees of freedom, geometry allocation, stable surface partitions, level of abstraction, and visible limitations. Structural validity and semantic completion are separate: a parseable mesh recipe or hierarchy still fails when the promised scale relation, representation layer, stable boundary, proxy limit, observable style consequence, or review observation has no owner. It answers what is built, not what the fictional subject is, how its surfaces respond, or how it moves over time.

Each model-source file contains a concrete named exported class, and every exported type in the branch cites exactly one model document. Properties and helpers collectively cover the model-source obligations, while the exact type edge prevents undocumented or multiply owned model contracts. Derived design records and meshes do not substitute for this authored source edge.

Before drafting, complete `discovery/core/common.md`, `discovery/design/designs.md`, and `discovery/design/models.md` against the actual represented subjects, source assets, downstream consumers, and review promise, then settle every retained rule or truthful no-result through [Design branches](design-branches.md#discovery-and-draft-procedure). Inventory independent representation owners and apply `docs/obligations/design/models.md#addressable-model-decisions`. Separate geometry or hierarchy, articulation interfaces, surface partitions, fidelity limits, and neutral observations when they have different consumers or change paths. Material construction and response belong in `docs/materials`. After drafting, reverse-outline each H2 under the model information-structure principle and compare every dimension, pivot, surface, and review view with settings and the population obligations.

## Motion decisions

`docs/motions` records a named transition over time: subject and starting state, endpoint, duration or timing domain, interpolation, invariants, collision or range limits, composition behavior, and observable acceptance. It cites the settings facts it preserves and every reviewed map, model, space, material, instance, or system interface whose state it changes; a motion that changes no model cites no model merely to fill the graph.

Each exported motion function and each exported motion property cites exactly one motion document. Motion implementation lives under `src/motions`; a subject method may delegate to it. Do not hide reusable motion math inside a shot or claim an incidental render callback as a motion.

Before drafting, complete `discovery/core/common.md`, `discovery/design/designs.md`, and `discovery/design/motions.md` against the actual changing subjects, consumed interfaces, compositions, contacts, and review promise, then settle every retained rule or truthful no-result through [Design branches](design-branches.md#discovery-and-draft-procedure). Inventory independently callable or reviewable transitions and apply `docs/obligations/design/motions.md#addressable-motion-decisions`. Each transition settles entry, exit, allowed change, time domain, phases, spatial relations, invariants, limits, parameters, composition, interruption, and observable acceptance where applicable. Reverse-outline the H2 afterward and return a missing capability to settings or a missing target interface to its map, model, space, material, instance, or system owner before continuing.

## Gates

Start an applicable branch at `models: "draft"` or `motions: "draft"`. Both begin after settings review. A motion may target a map, model, space, material, instance, or system interface. Design branches may proceed in parallel, but each newly active reviewed branch adds its foundation targets and reopens affected motion evidence; final motion review cites every active design branch it consumes and truthfully excludes only an unused permitted foundation target. Before `evidence`, require stable H2 owners, no placeholders, a complete first version, an omission and proportionality audit, and neutral review observations. Read every common and branch principle against each H2 in turn, then confirm that the H2 population supplies every common and branch-obligation owner.

Model source begins at `modelSources: "draft"` only after model review. Motion source begins at `motionSources: "draft"` only after motion review. Every exported owner implements reviewed design rather than making a new visual, structural, temporal, or parameter decision in code. Follow [Evidence staging](../evidence-graph/staging.md) for citations and reviews and this skill's geometry verification routes.

## Boundary cases

- A semantic scale or clearance required regardless of representation is a settings fact; proxy dimensions, occupied bounds, and primitive decomposition are model decisions derived from it.
- Settings authorize a state change and any semantic limit; a model names the joint, pivot, and construction-safe interface that realizes it; a motion owns the timed path within both contracts.
- A treatment states why a movement matters; a script stages the physical event; a screenplay states the final audiovisual beat; a shot composes the implemented motions.
- A library stops at its reviewed source branches. A film or brief may consume the same model or motion source through shots.
