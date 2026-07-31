# Issue 1427 implementation record

Issue #1427 replaces a generic visual checklist with four evidence surfaces and moves the asset gate to the first compiled consumer.

## Decisions

- `asset`, `shot`, `sequence`, and `film` are the human-review surfaces. Legacy `design` and `source` targets remain temporarily available until the MCP surface migration removes them.
- An asset obligation is derived from compiler-owned shot payloads, not from the shared model catalog. Unused scratch recipes therefore create no queue noise.
- An asset review is production-local even though its recipe is shared. Its fingerprint binds the production namespace, current recipe, compiled model, exact required PNG inventory, and compiler identity.
- Asset evidence is server-prescribed: four rest-pose beauty azimuths, one elevated outline, and one ROM-extremes beauty view when the compiled model is rigged.
- Sequence membership is derived from exact treatment-beat coverage, active screenplay scenes, and shot scene evidence. Sequence evidence composes the current shot bundles for those realized scenes.
- The reflected `submitReview` order is pinned as target, prepared fingerprint, observations, checks, corrections, completion basis, then `complete`. The verdict remains last.
- `complete:false` remains a valid stored review state. Storage records work performed; the compiler gate independently decides whether that state can be consumed.
- Every refusal and review diagnostic states that correction feedback does not authorize artifact deletion.

## Enforcement

Review lint emits `asset-review-missing`, `asset-review-stale`, `asset-review-revise`, or `asset-review-incomplete` for a consumed model. Editing a recipe changes its asset fingerprint and returns the production-local review to stale. A current full-raster render digest is mandatory because preparation refuses completion until every prescribed asset view is present and verified.

The isolated viewer accepts asset id, elevation, and pose in its page identity while azimuth is driven by deterministic seek time. This allows the four compass views to reuse one resident capture page without confusing rest and ROM evidence. Compile fingerprint is part of that resident-page identity so a long-lived MCP host cannot label a stale scene with a new compiler fingerprint.

Capture requests also carry the active production id through the Oracle and CLI adapter. The resident browser session, generated-shot plugin, and page cache are therefore production-local even when one process opens multiple productions from the same project root.

## Verification contract

Tests cover reflected schema order, current six-view rigged-asset preparation, completed asset queue state, stale state after recipe mutation, restoration after rebuilding the original revision, and production-id propagation through separate projects. Existing incomplete-review coverage continues to prove that a stored false verdict remains queued.

Per campaign instruction, this implementation cycle does not run local tests or typechecks; CI owns executable validation.
