# Geometry authoring

Use this procedure whenever source creates, transforms, combines, imports, or validates triangle geometry. The reviewed model, space, map, material, and motion owners define the result; an operation is only a means of realizing those decisions.

## Result contract before operation

Write down the geometry result before selecting a helper: local frame and metric extents, intended open and closed boundaries, negative spaces, component and surface ownership, silhouette-critical sections, material partitions, UV need, normal behavior, skin or articulation consumers, stable part ranges, and the observation conditions the representation promises. A model or building may deliberately be open, thin, concave, holed, non-manifold at a named interface, or composed of separate solids. Do not substitute a generic watertightness goal for that authored result.

Settings owns recognizable appearance and world facts. Model, space, map, material, and motion documents turn those facts into constructible geometry, topology, surface, and deformation decisions. Source must return an unowned choice to the earliest design owner before implementation continues.

## Select by postcondition

Read the installed public export and its JSDoc before using an operation. Select it by the postconditions it guarantees for topology, attributes, coordinate frame, ordering, and failure, not by a familiar name. Prefer an existing general public helper whose contract matches the result. Compose ordinary TypeScript functions and explicit loops when no helper does. Do not create a noun-specific geometry DSL or add a public helper merely to shorten one production.

A primitive is a compact parametric recipe. An explicit mesh may be imported, baked, or generated deterministically by a named project function from equations and reviewed inputs. Never hand-transcribe opaque bulk vertex arrays through an agent prompt. Keep formulas, source data, parameter names, and provenance in ordinary reviewable TypeScript, then emit arrays deterministically.

Transforming or merging meshes is not a Boolean union. Concatenating intersecting closed solids can preserve their separate triangles while leaving internal faces and a non-manifold visual result. Use separate parts when that is the reviewed representation. If the result requires a true union, difference, remesh, or another operation AutoMovie does not contract, stop, record the missing capability, and revise the representation or product boundary explicitly.

## Consequence ledger

For each operation, account for all fields it receives and all consumers it affects:

- position and index count, triangle winding, degenerate faces, connected components, open edges, non-manifold edges, and authored holes;
- normals and UVs, including whether they are preserved, transformed, regenerated, deliberately omitted, or refused;
- skin data and any stable vertex, triangle, part, or material range a downstream deformation, picker, material, or review path addresses;
- local frame, occupied bounds, pivot-relative placement, surface identity, and deterministic ordering.

An operation may preserve, drop, regenerate, or reject a field only when its public contract says which and the reviewed result permits that consequence. Never let a helper silently convert a surface, topology, or deformation decision into an implementation default.

## Proving a new operation

Treat an unfamiliar operation as a local hypothesis. Before generalizing it, test representative convex, concave, holed, thin, open-boundary, and near-tolerance fixtures applicable to its stated domain. Record input and output counts, topology diagnostics, attributes, bounds, determinism, runtime, and the exact cases refused. One attractive example proves only that example. A metric threshold, arbitrary quality grade, or lack of diagnostics cannot prove visual correctness.

Keep a production-specific implementation local until its contract and repeated need justify a public engine capability. When promoting one, keep the exported helper, package barrel, source-authoring route, contract statement, tests, and runtime behavior synchronized in both directions: no advertised helper may be absent, and no public helper may be silently undiscoverable.

## Verification

Run the operation's pure tests and `npm run lint`, then use `inspectAutoMovieMeshTopology` and the relevant bounds or measurement helpers against the authored result. Compare the output with the exact model, space, map, material, and motion owners it realizes.

Numeric inspection proves geometric facts, not appearance. Follow [Capture](../review-verification/capture.md) for reproducible views, [Inspection](../review-verification/inspection.md) for observation, and [Measurements](../review-verification/measurements.md) for numeric questions. Use whole-model views for silhouette and targeted part views for joints, openings, thin features, intersections, and surface boundaries. Every accepted view records camera, target, compiled source identity, and the specific contract it tested.
