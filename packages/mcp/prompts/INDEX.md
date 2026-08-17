# AutoMovie Production Constitution

AutoMovie produces a deterministic prototype: a blocking pass whose staging, motion, and timing are correct and reproducible. It is not a finished photoreal shot, and its ceiling is what an authoring agent can actually drive. Ordinary tracked screenplay, design, TypeScript, and configuration files remain the source. The coding agent authors them; the compiler and engine decide structural truth; the MCP tools deliver knowledge, host-produced pixels, subject inspection, optional repaint, and evidence-bound review. A filename, a confident explanation, or remembered chat is never proof.

## Flow

1. Start with this constitution, then choose the next guide from Guide selection. Whenever a named guide is required, retrieve only that guide by calling `getGuideDocument` with its exact stem, for example `getGuideDocument({ name: "SCREENPLAY_WRITING" })`.
2. Author the screenplay ladder: logline, treatment sequences and beats, then scene prose and its typed index. Read `EVIDENCE_GRAPH` for which folder each stage owns and what it must cite, then `SCREENPLAY_WRITING` for the craft. Every stage cites the stage above it, and the graph refuses a stage that nothing below elaborates, so fill the ladder downward before deepening any one branch.
3. Author production, models, world, built environments, formations, shot contracts, acceptance scenarios, and TypeScript shot/film source in their tracked owners. Read the matching contract guide and handbook before editing. Once shots begin to repeat, read `SOURCE_COMPOSITION`: a feature-length production is written as a program that emits shots, not as one hand-authored module per shot.
4. When deterministic work is too expensive for the one-second source sandbox, read `DERIVED_ARTIFACTS` and run its explicit generation command before compiling. Compilation verifies a derived artifact and never generates or repairs one, so a `derived-artifact-*` refusal is cleared by rerunning that command, not by compiling again.
5. Run the scaffold compiler or lint command. Compilation, project-state loading, geometry, status, migration, rendering, and verification are ordinary package or CLI APIs, never MCP tools.
6. Ask the structural questions before asking for pixels. Read `SUBJECT_INSPECTION`. An extent, a placement, or a missing member is a number there and only an impression in a frame, and reaching for a render first is how "the roof field is empty" gets reported about a roof that is full. Those queries are ordinary package APIs rather than MCP tools, and that guide says which run in a project script and which need a live renderer.
7. Then open what you built, one thing at a time, before anything downstream consumes it. Nothing in this stage is optional: an oriel that compiled to a single box, a polearm with no head, and an armoury holding no weapons all survived a whole production because no one opened them alone.
   - `captureTurntable({ asset })` commits the complete view set one asset review is judged from, in one call.
   - `captureFrame` with a `part` on an asset target narrows the camera onto one compiled part when a whole-model view cannot resolve it.
   - `inspectSubject({ shot, subject })` draws one compiled subject from an inspection-owned turntable and sections a named space automatically, because the outside of a room is what hides its inside. It refuses until this session has read `SUBJECT_INSPECTION`, and refuses outright any subject it cannot frame.
   - Inspection images sit outside the render root and carry `deliveryEvidence: false`. They are how you decide what to fix and never what a shot review accepts. What a sweep does publish is a viewpoint plan and one revision-bearing receipt per observation, which the review surface reads back, so a subject review reports a real coverage state rather than an absence. Read `REVIEW_SUBJECT` for what each state means and what completing one takes.
8. Read `CAPTURE_FRAME`, then capture the delivery evidence a review will ask for: `captureTurntable` for an asset's complete required set, `captureFrame` for one exact shot or asset view. `captured:false` is a refusal, not evidence. Read `VISUAL_CHANGE_REPORT` before comparing two existing digest catalogs; that comparison is neither a structural diff nor review evidence.
9. Review deterministic assets and shots before anything downstream of them, and review a compiled subject whenever one authored thing has to be judged on its own. `REVIEW_SUBJECT` owns that target: its verdict neither discharges nor is discharged by a shot that shows the subject, and the compiler's review queue does not enumerate subjects, so asking for one is a decision you make rather than a gate that stops you. When production design declares visual delivery `repainted`, complete the current `shot` review, read `REPAINT_SHOT` and `DIFFUSION_ENHANCE`, call `repaintShot`, then complete the separate `rendition` review. Deterministic delivery does not route through diffusion.
10. Read the exact target guide before both `prepareReview` and `submitReview`: `REVIEW_ASSET`, `REVIEW_SUBJECT`, `REVIEW_SHOT` (for `shot` and `rendition`), `REVIEW_SEQUENCE`, `REVIEW_FILM`, or `REVIEW_DEPENDENCY` (for `design` and `source`). Inspect every returned current evidence item yourself. Put the final boolean last.
11. Render through the scaffold CLI only after current review gates pass. Verify receipts and media facts; never infer completion from an output path.

The host fixes project root and default production at startup. No tool payload may activate another filesystem root. Registry identity is `production / artifact id / time-or-angle-and-pass / fingerprint`; all evidence must reopen through that identity.

## The corpus

The corpus is grouped by what you are deciding, one folder per group, and this document is its index. Read the group that owns your next decision, then the one document in it that owns your question. Do not read a group as ritual.

Two groups carry their own index, `built-environment/` and `review/`, because their documents share something worth stating once. Ask for those by the area's own name: `BUILT_ENVIRONMENT` and `REVIEW`.

## [`design/`](design/): the tracked records

- `PRODUCTION_DESIGN`: production clock, deliverables, art direction, visual-delivery declaration, render budgets, and site context.
- `MODEL_RECIPE`: bounded primitive and external model recipes, and physically-based surface materials.
- `WORLD_DESIGN`: terrain, routes, landmarks, instance sets, cloth, planting and water, and the site craft that arranges them.
- `FORMATION_DESIGN`: repeated-unit layouts, heroes, and formation motion.
- `SHOT_CONTRACT`: source binding, events, camera intent, review times, and rendition policy.
- `ACCEPTANCE`: falsifiable frame, event, and metric criteria.
- `DERIVED_ARTIFACTS`: explicit deterministic precomputation, tracked dependency and output digests, and freshness refusals.

## [`built-environment/`](built-environment/): one work, as a measured record

- `BUILT_ENVIRONMENT`: this area's `INDEX.md`. Building and space graphs, populations, phasing, room culling, and the queries that read all of it.
- `BUILDING_FINISHES`: what a surface is made of, and the repeated modules that cover it.
- `BUILDING_SERVICES`: water, drainage, power, data, air, fire, control, and wet zones.
- `BUILDING_PROPS`: placing a thing inside a work and proving it stands where you meant.
- `BUILDING_STUDIES`: what a finished work is read back for: environmental analysis, drawings, schedules, and quantities.

## [`craft/`](craft/): the decisions no record can make for you

- `SCREENPLAY_WRITING`: logline-to-scene screenplay craft and revision rubric.
- `CINEMATOGRAPHY`: shot-size meaning, the 180-degree line, eyeline, screen direction, camera motion, and intentional violations.
- `EDITING`: EDL authorship, coverage, rhythm, transitions, and the Murch priority order.
- `MOTION`: action verbs, clip construction, contact, weight, expression, and continuity.
- `SOUND_DESIGN`: event-derived sound, dialogue, ambience, spatialization, and mix hierarchy.
- `OBJECT_RIGGING`: silhouette-first object design, axes, pivots, skeletons, profiles, traits, retargeting, and the operable openings a building owns.

## [`source/`](source/): what you write, and what compiles it

- `TYPESCRIPT`: deterministic source-module patterns and typed registration.
- `SOURCE_COMPOSITION`: how a production's source is arranged once its shots repeat.
- `SOURCE_OWNERSHIP`: coding-agent, compiler, renderer, and review ownership.
- `COMPILATION`: design, source, review, and final scopes, and atomic publication.
- `GEOMETRY`: the mesh constructors source-owned models are built from, their texture coordinates, and the project-state queries outside the compile sandbox.
- `EVIDENCE_GRAPH`: which folder a production document belongs in and what it must cite.

## [`evidence/`](evidence/): producing and reading what is actually there

- `CAPTURE_FRAME`: exact `captureFrame` and `captureTurntable` targets, passes, receipts, and refusal recovery.
- `SUBJECT_INSPECTION`: render-free descriptions of compiled elements, parts, prototypes, instances, sets, and spaces; bounded structural diffs; section planes; and `inspectSubject`, whose observations are inspection-owned and never delivery evidence.
- `VISUAL_CHANGE_REPORT`: changed, unchanged, new, and gone views across two existing digest catalogs. This is neither a structural diff nor review evidence.
- `DEBUGGING`: diagnostics-first correction across ownership, derived artifacts, compile, structural inspection, render, repaint, and review.

## [`review/`](review/): recording a judgment that outlives you

- `REVIEW`: this area's `INDEX.md`, and the discipline every review shares. Both review tools are gated on it.
- `REVIEW_ASSET`: asset turntable worksheet and silhouette, rig, material, and provenance axes.
- `REVIEW_SUBJECT`: one compiled subject's worksheet, its inspection-owned viewpoints, and its coverage states.
- `REVIEW_SHOT`: shot and rendition worksheets, and composition, performance, continuity, and acceptance axes.
- `REVIEW_SEQUENCE`: sequence coverage, editorial rhythm, transition, and continuity worksheet.
- `REVIEW_FILM`: whole-film story, pacing, audiovisual delivery, and terminal consistency worksheet.
- `REVIEW_DEPENDENCY`: design and source dependency worksheets. These are not additional visual surfaces.

## [`external/`](external/): what comes from outside the repository

- `ASSET_SOURCING`: license, provenance, digest, conversion, and consumer restrictions.
- `REPAINT_SHOT`: exact `repaintShot` inputs, source-grid requirements, provenance, and refusal recovery.
- `DIFFUSION_ENHANCE`: current-model research, reference locking, structural controls, repaint review, and reroll discipline.

If you do not know the next guide, locate the next file or tool you must touch in Flow, then read the one group that owns it. Return here when the stage changes.
