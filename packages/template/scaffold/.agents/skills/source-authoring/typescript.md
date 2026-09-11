# TypeScript Authoring Handbook

AutoMovie source is ordinary tracked TypeScript compiled by `ttsc` and executed by `ttsx` in Node. Types and JSDoc are the primary payload textbook. Let the builder reject invalid structure early; do not defeat it with casts, `any`, ignored diagnostics, or copied generated JSON.

## Evidence carried by each export

Every TypeScript owner exposed through a public export and selected by an active source population answers both H2 checklists in `principles/core/source-units.md` in its own JSDoc. A top-level exported type, property, or function is one owner; each selected public member of an exported type is another. Read the declaration, initializer or body, source-local callees, graph claim, target, callers, tests, and generated consequence together. State how that owner preserves the exact scope it claims and constitutes a complete type, value, or behavior at its declared granularity. Review every evidence statement through [Independent semantic review](../review-verification/semantic-review.md); semantic truth is a procedure, not a third self-citation.

Source-family obligations are different. They allocate the map, model, space, material, instance, motion, system, shot, production, or film roles one or more times across the selected source-owner population; one strong owner cannot answer a source-unit principle for a weak sibling. Do not cite `obligations/core/common.md#proportionate-development` from source: code length, export count, and file size do not prove completeness or a sound allocation of implementation effort.

Do not add a principle acknowledgement to silence a diagnostic. When an export omits or exceeds cited scope, is a placeholder or partial implementation, or gives a generic, copied, bundled, or false evidence reason, repair the earliest actual owner and every downstream consequence first. Renew a review only after rereading the complete behavior against the changed target.

Keep every public source declaration addressable by the evidence graph's `type`, `function`, or `property` selector. Export a named interface, type alias, class, function, or variable from the module that declares it, either directly or through a local named export. Do not export an enum, namespace, barrel or cross-module re-export, default alias or expression, anonymous default declaration, public getter, setter, auto-accessor, computed public member, or empty or whitespace-containing literal public name. Use a closed string-literal union instead of an enum, direct or local named ES-module exports instead of a namespace or cross-module re-export, a plain readonly property or named method instead of an accessor, and a stable non-empty identifier instead of a computed or whitespace-containing public name.

## Module shape

Use `defineShot(id, { scene, contract, build })` as the named export selected by the design record. Import runtime APIs directly from their packages and types with `import type`. Keep shot and film build functions reproducible from their explicit input and seed. Perform file and network acquisition in the project scripts that prepare those inputs.

This minimal helper is a real compile-checked example:

```ts
import type { IAutoMovieShotSource } from "@automovie/interface";

export const registeredShotId = (source: IAutoMovieShotSource): string =>
  source.id;
```

Implement each scaffold placeholder before claiming that its source is complete.

Prefer small deterministic functions named for domain decisions: frame conversion, camera placement, event construction, motion selection, formation state, or EDL interval. Validate meaning through engine contracts rather than duplicating math and accepting divergent behavior.

These rules govern any module you write. How a production's source is arranged once its shots repeat is a separate decision with its own document: read [Composition](composition.md).

## Package APIs

Use the installed package exports through ordinary TypeScript imports. Node and `ttsx` own module loading; AutoMovie does not maintain a second import whitelist. The following examples route common authoring questions to their owners. Consult the package API for other exports.

Browser code, such as a viewer page or `viewer/preview.ts`, runs without Node built-ins. Take its calculations from `@automovie/engine`, `@automovie/viewer` and `@automovie/interface`, whose entry points reach no Node module. `@automovie/production`, `@automovie/render` and the project scripts serve Node: a browser import of any of them, directly or through a helper module, reaches Node modules the browser does not have, and Vite does not polyfill them. A type-only import is erased and stays safe.

- **How do I write a subject and a shot at all?** `AutoMovieSubject` and `AutoMovieSubjectGroup` to extend, `defineShot(` to register, `mergeAutoMovieSubjectContributions(` to fold what several subjects each returned into one contribution.
- **How do I turn a profile or a region into geometry?** `extrudeAutoMovieProfile(` and `revolveAutoMovieProfile(` and `sweepAutoMovieProfile(` for a hulled profile, `extrudeAutoMovieRegion(` and `triangulateAutoMovieRegion(` for a free-form region with holes, `buildAutoMovieRegionFace(` for one material-owning side of a region, `loftAutoMovieSections(` to interpolate between sections along a path, `buildAutoMoviePolyhedron(` for a stated solid, `buildAutoMovieWall(` for a wall partitioned around its openings, `tessellateSurface(` for the support surface height queries read.
- **How do I assemble the parts I built into one thing?** `transformAutoMovieMesh(` to place a part, `mergeAutoMovieMeshes(` to join parts, `mergeAutoMovieMeshParts(` to join them and keep the index range each one owns, `matchAutoMovieAssemblyJunction(` for which construction roles survive a corner, `autoMovieAssemblyOpeningReveal(` for the finished size a build-up leaves an opening at.
- **Is the mesh I built well formed?** `inspectAutoMovieMeshTopology(` measures the triangle topology instead of assuming it.
- **How do I cover a surface with an element instead of a repeating texture?** `generateAutoMovieSurfacePattern(` lays the pattern and reports exactly what it laid, `autoMoviePatternInstanceTransforms(` turns that into placements, `autoMoviePatternTextureTransforms(` into texture frames.
- **What is this built out of, and does that build-up hold?** `validateAutoMovieMaterialSubstance(` for one substance, `validateAutoMovieMaterialAssembly(` for the layered build-up, `resolveAutoMovieMaterialAssembly(` to place a validated build-up on its host's measuring line.
- **What does the building I declared actually contain?** `builtEnvironmentContainsPoint(`, `builtEnvironmentAdjacentSpaces(`, `builtEnvironmentSpaceConnectors(`, `builtEnvironmentSpaceBoundaries(`, `builtEnvironmentSpaceSurfaces(`, `builtEnvironmentSpaceNodes(`, `builtEnvironmentSpacePopulations(`, `builtEnvironmentSpaceContentBounds(`, `builtEnvironmentSpaceFidelity(`, `builtEnvironmentBuildingOfSpace(`. That is the whole family, and [Design branches](design-branches.md) says what each one answers; no count is written here, because a count is the thing that drifts.
- **Does this building placement rest, float, sink, or overlap?** `builtEnvironmentPlacementBounds(` resolves one element or compact population without expanding it, `builtEnvironmentSupportStatus(` measures an authored bearing or suspended relation, `builtEnvironmentPlacementOverlap(` measures two named placements, `builtEnvironmentElementBounds(` answers the world box one named element's placed geometry fills, `builtEnvironmentElementPartBounds(` answers that as one box per drawn part, and `builtInstanceSetPlacementBounds(` answers the single box for a compact instance set without expanding the set into members. Each is the engine's own computation of an extent or a relation, so ask it rather than re-deriving a box from a transform chain you walked yourself; that is also how you check that what you authored stands where you meant it to. Reach for the part boxes when the body is mostly air: a shelf's single box spans the floor to the top of its back panel, so a question asked of it is a question about the box rather than about the shelf.
- **How do I turn a declared building into the geometry a frame shows?** `lowerBuiltEnvironment(`, then `mergeAutoMovieSpaces(` when a shot needs one stage space.
- **How do I name a part of something I placed?** `placementChildNode(` gives the scene-graph id of a bone or joint under a placement, which is what an attachment or a motion addresses.
- **How do I derive a placed object's world frame from its relation?** `propAnchorFrame(` resolves the exact world position and rotation for one declared prop-to-building relation.
- **How do I build the site the building stands on?** `worldTerrain(` for a flat terrain primitive over an explicit footprint, `worldRamp(` for a rectangular ramp from a centre line and a rise, `worldBlock(` for a box-proxy wall or building that hands back its primitive recipe, the scene node using it, and the exact volume it occupies, `worldGrid(` and `worldScatter(` and `worldAlongRoute(` for one prototype under a rectangular, seeded-scatter, or route-following layout rule, and `assertWorldPlacements(` to refuse a contradiction between blocks, surfaces, routes, and landmarks before a shot is built. `worldHeightfield` samples an explicit height function to build terrain data.
- **How high is the ground under this point?** `worldSurfaceHeight(` evaluates one production-world height rule at an XZ point.
- **Where does one member of a formation or instance set stand, and what is it?** `compiledFormationSlot(` and `instanceSlot(` regenerate one member from the compiled record a build context or a loaded project state carries, with the terrain snapshot and the prototype table the builder compiled; a design record has neither, so do not regenerate a member from it. `materializeCompiledFormation(` and `materializeCompiledInstanceSet(` compile a population outside the builder by the same laws, so the same design and terrain or routes give the builder's chunks and bounds; the member radius, the tier digests and the record digest follow the recipes and radii you pass, so read the compiled record from a loaded project state when a review needs the builder's own.
- **How far apart are two things, can an actor reach a target, and does a formation stand on its ground in a shot?** `measureAutoMovieGeometry(` answers distance, reach, ground, formation, effect, film-time, pose and camera questions from the records you pass it and nothing else, so pass `state.design`, `state.generated.shots` and `state.generated.film` of a loaded project state you have required current. [Offline measurements](../review-verification/measurements.md#geometry-questions) says how to read each answer.
- **How does viewer code read a film frame and its film effects?** All from `@automovie/engine`: `sampleProductionRenderFrame(` resolves the shot layers of one film frame, `productionRenderLayersForPass(` selects the layers a pass draws, `productionFilmEffectEditFingerprint(` identifies the edit a compiled effect runtime must match, `verifyProductionFilmEffectPopulation(` refuses a runtime population that is stale or incomplete for that edit, and `sampleProductionFilmEffects(` samples it at a timeline frame. The Node builder computes the same identities with the same functions, so a browser check and a build agree.

For another capability, inspect the relevant package exports and their documented inputs before implementing a helper.

## Ownership

Author design and source owners only. Read builder output for diagnostics or offline measurement; never edit it. Renderer output has its own owner, while review observations stay in evidence citations and Git rather than a second project ledger. A source change that should alter runtime but leaves the builder fingerprint unchanged is a boundary defect, not permission to patch generated bytes.

Ordinary project scripts can authenticate current generated state and call pure engine queries:

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import { Vector3 } from "@automovie/engine";

const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({ root: process.cwd() }),
);
const originDistance = Vector3.length(
  state.generated.design.world.landmarks[0]!.position,
);
if (!Number.isFinite(originDistance)) throw new Error("invalid distance");
```

Read generated state after producing it. A shot or film build receives its input context directly.

## Numeric discipline

Use production frame rate and conversion helpers for time/frame boundaries. Keep units explicit in names and types: seconds, frames, meters, degrees, sample frames. Normalize angles and vectors through engine utilities. Avoid equality tests on derived floating-point values unless the function contract guarantees exact arithmetic; use a declared tolerance tied to the domain.

## Error paths

Let typed APIs return or throw their documented diagnostic form. At an authored boundary, add target id, source path, event id, time, expected range, observed value, and correction direction. A swallowed error becomes an expensive visual mystery.

## Review before commit

Trace every changed design/source join and downstream consumer. Check deterministic purity, source binding, stable ids, event time, final state, acceptance coverage, and generated ownership. Format the code. The campaign runs canonical CI later; local ad hoc commands are not a substitute for the repository contract.
