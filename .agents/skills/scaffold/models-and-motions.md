# Models and motions

Read the repository [3D modeling skill](../3d-modeling/SKILL.md) as well as this document before changing geometry, rigs, or derived assets.

## Model decisions

`docs/models` records the deterministic blocking representation of a settings subject: coordinate frame, dimensions, hierarchy, joints or degrees of freedom, geometry allocation, materials, level of abstraction, and visible limitations. It answers what is built, not what the fictional subject is and not how it moves over time.

Each exported model class cites exactly one model document. Properties and helpers collectively cover the model-source principles, while the class-level exact edge prevents undocumented or multiply owned models. Derived design records and meshes do not substitute for this authored source edge.

## Motion decisions

`docs/motions` records a named transition over time: subject and starting state, endpoint, duration or timing domain, interpolation, invariants, collision or range limits, composition behavior, and observable acceptance. It must cite the model it is allowed to move and the settings facts it preserves.

Each exported motion function and each exported motion property cites exactly one motion document. Motion implementation lives under `src/motions`; a subject method may delegate to it. Do not hide reusable motion math inside a shot or claim an incidental render callback as a motion.

## Boundary cases

- A semantic scale or clearance required regardless of representation is a settings fact; proxy dimensions, occupied bounds, and primitive decomposition are model decisions derived from it.
- Settings authorize a state change and any semantic limit; a model names the joint, pivot, and construction-safe interface that realizes it; a motion owns the timed path within both contracts.
- A storyline states why a movement matters; a scenario stages the physical event; a script states the final audiovisual beat; a shot composes the implemented motions.
- A model or motion library stops at source. A film or brief may consume the same source through shots.
