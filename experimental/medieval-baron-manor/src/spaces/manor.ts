import type { IAutoMovieLibraryDerivedSourceOwner } from "@automovie/interface";

/**
 * Selects the current manor environment produced from the authored geometry.
 *
 * The builder verifies environment-v24-critical.json and its generator inputs.
 * The refreshed source build succeeded with 1,727 models, 223 elements,
 * 1,823 populations, 9,965 instances, 20 spaces and 41 openings.
 *
 * Current observations are the 39 PNGs under artifacts/finish-20260911.
 * They were directly opened after the successful build in one visible Chromium
 * source preview, at 1440 by 900 pixels on AMD Radeon 8060S / ANGLE D3D11.
 * These are working-scene observations, not a delivery or capture receipt.
 *
 * Exterior, north-west, roof and frame views show the one U-shaped two-storey
 * house, timber infill walls, stone base, pitched roof and chimney. Ground and
 * upper plans show the floor allocations and the central turning stair;
 * stair-section-west exposes its two runs and landing with surrounding parts
 * hidden. The three gallery views show their connected covered garden edges.
 *
 * Hall corner-b/d show the table, benches, crockery, rug, chest and hearth.
 * Kitchen corner-b/d separately expose the workbench and suspended-pot hearth.
 * Pantry corner-a/c show the shelves, sacks and jars. Ledger corner-a/b expose
 * the desk, open ledger, quill, chair, chest and books. Service corner-a/b show
 * the basin stand, jug, pails, cabinet and drying rack. Entrance corner-a and
 * understair-storage together reveal the stair, bench, shelving and chest.
 *
 * Master inside-entry and corner-a/b show the bed, bedding, chair, wardrobe
 * and chest. Both small bedrooms were opened independently: west corner-b/d
 * has green bedding and east corner-a/c has pale bedding and its own desk.
 * Washroom basin-workspace shows basin, jug, towel and lower pail;
 * south-working-detail shows the tub and screen-back the open latrine lid.
 * Storage corner-a/c show the linen shelves and chest. Corridor and landing
 * views show the timber floor, runner, lights and direct room-door frames.
 *
 * Courtyard and reverse views show the apple tree, herbs, paths and galleries;
 * the roof view locates the pond in that garden and pond--oblique-a exposes
 * its water, submerged stones and reeds. Pond stones and water are more regular
 * and brighter than the reference; foliage and bedding have simpler forms.
 * These observations support the bounded 3D prototype, not photoreal equivalence.
 *
 * @evidence spaces/001-manor.md#manor-space Selects the current-model environment whose room polygons, shared walls and openings, floor surfaces and placed furniture realize the single manor-space design. The current exterior, both floor plans, stair section, garden and every room were opened in the existing source preview; the builder separately admitted the refreshed environment. The observations above state visible contents and reference simplifications without claiming a delivery receipt.
 * @evidenceReview spaces/001-manor.md#manor-space #b6f87cb Compared the complete manor-space design with the refreshed environment and directly opened the 39 current views listed above. Both plans retain the U-shaped house and one turning stair; separate room views show their specified furniture, three gallery views show the covered edges, and roof plus pond views establish garden placement and water detail. The current build succeeds. The regular pond edging and simplified foliage and bedding remain prototype limits, rather than an unobserved promise of reference-level realism.
 * @evidence spaces/001-manor.md The design field names this file's manor-space H2, and the file itself assigns manorSpaceSource the consumption of the current manor model and instance-derived environment. No second design file is registered by this export.
 * @evidenceReview spaces/001-manor.md #3c6010e Read the complete design file and the sole selected manorSpaceSource export: the exact design address and environment-v24-critical.json bind this one file to the authored manor producer and its instance-derived environment. The successful current build publishes that environment under the manor namespace; no second house or design-file owner is introduced. The separate manor-space review records the actual visual comparison.
 * @evidence principles/core/source-units.md#source-scope-preservation The value binds docs/spaces/001-manor.md#manor-space to the named environment artifact. Its initializer adds no room, transform or opening; deriveManorEnvironment.mjs and manorSpatialState.ts remain the explicit implementation of the file's current-model carrier decision. The current build and working-scene observations are stated separately above.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 Reading manorSpaceSource and its selected artifact generator together found one design registration and the current source meshes, room polygons and instance transforms carried into that environment. The repaired door-endpoint rejection adds no spatial fact to normal input: both generated payloads stayed byte-identical. This verifies the registration and derivation responsibility; its rendered-realization relationships are supported by the current working-scene observations described above, without a delivery-receipt claim.
 * @evidence principles/core/source-units.md#source-substantive-completion This is a usable IAutoMovieLibraryDerivedSourceOwner value: the installed library owner reader selects the named UTF-8 artifact, refuses an absent artifact or a simultaneous build function, parses its environment contribution and passes it to library contribution validation. A consumer need not invent a build body for this registration; admission of its current payload remains separate.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f Compared the two-field typed value with the installed library source-owner reader and contribution consumer: derivedArtifact selects a verified UTF-8 payload, the reader rejects an absent selection or a simultaneous build function, and the parsed environment reaches validation. The exported value requires no invented build implementation; the normal generator produced its complete current payload.
 * @evidenceExclude upstream/design/space-sources.md#design-revision-from-space-source-work docs/spaces/001-manor.md#manor-space supplies the current-model carrier, two floor datums and direct-door layout. Reading the current artifact found hall and service joined to their side galleries, kitchen/pantry/ledger/entrance to gallery-rear, all five upper rooms to corridor, central-stair/access from entrance to landing, and landing/corridor to the same corridor. The helper consumes the model's room polygons and shared openings at 0.45 and 3.33, and serializes the declared turning stair. These implementation decisions required no parent change; this exclusion addresses design sufficiency, not the incomplete rendered realization or the separate invalid-input refusal obligation.
 * @evidenceExcludeReview upstream/design/space-sources.md#design-revision-from-space-source-work #d9ad066 Compared the exact manor-space parent with current helper and artifact connections: hall/service reach their side galleries, kitchen/pantry/ledger/entrance reach gallery-rear, and the upper rooms reach corridor through their named doors. The floor datums and turning stair remain those of the parent. Missing-endpoint refusal was repaired in the adapter without changing those design decisions, so this implementation exposed no parent decision that required revision.
 * @evidence obligations/design/space-sources.md#space-source-design-ownership The sole exported space owner and its design field allocate the derived medieval-baron-manor environment to manor-space. The generator consumes the authored manor entries and instance placements instead of replacing them with room boxes. The current artifact's ground-storey/upper-storey room parents, eleven named door passages, central stair and gallery/corridor joins match the document's floor and direct-door allocation; the registration introduces no alternative space design.
 * @evidenceReview obligations/design/space-sources.md#space-source-design-ownership #c0afa1f Traced the sole manorSpaceSource export through its manor-space design field, environment artifact and current-model generator. The helper consumes the parent's room allocation, shared boundaries, openings and retained instance placements; its ground-storey and upper-storey parents and named direct-door passages stay inside that one authored house. No alternative design is selected by this source population.
 * @evidence obligations/design/space-sources.md#space-source-stable-identities manorSpatialState retains room and boundary IDs, derives cell IDs from polygon triangulation order and passage IDs from opening IDs, and uses the fixed meter frame with ground-storey and upper-storey parents. manorInstanceDefinitions assigns prototypes by deterministic entry/part order and explicit member transforms with seed 1902; those IDs are stable for equal ordered inputs, not promised to survive an edited mesh or reordered input.
 * @evidenceReview obligations/design/space-sources.md#space-source-stable-identities #8f4bb4a Compared the current generator ordering, retained source IDs, cell and passage ID construction, fixed meter frame and instance seed with the regenerated artifacts. Normal instances and environment retained their complete output bytes after the diagnostic-only edit, including space parents, declared dimensions and transforms. Stability here applies to identical ordered source inputs.
 * @evidence obligations/design/space-sources.md#space-source-invalid-topology manorSpatialState refuses missing source transforms, missing or multiply owned opening panels and unbound explicit populations. Door passage generation now refuses either unresolved room endpoint and endpoints resolving to the same room, naming the opening and boundary instead of silently omitting the connector. test/manorDoorConnections.test.mjs reproduces each missing side, both missing sides and the same-room case, and checks the unchanged normal passage values. The existing library compiler attributes validateBuiltEnvironment findings, including hierarchy and spatial-reference defects, to this registered design and source.
 * @evidenceReview obligations/design/space-sources.md#space-source-invalid-topology #030592d Read the adapter refusals and library validation attribution, then reproduced its silent door omission with the pure public derivation input. After repair, tests for missing from, missing to, both missing and a same-room endpoint all throw the exact opening/boundary diagnosis, while the normal passage keeps its values. The full current derivation also preserves both output byte strings; invalid endpoints are refused instead of repaired or dropped.
 */
export const manorSpaceSource: IAutoMovieLibraryDerivedSourceOwner = {
  design: "docs/spaces/001-manor.md#manor-space",
  derivedArtifact: "automovie/derived/manor/environment-v24-critical.json",
};
