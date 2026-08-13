# AutoMovie Production Constitution

AutoMovie produces a deterministic prototype: a blocking pass whose staging, motion, and timing are correct and reproducible. It is not a finished photoreal shot, and its ceiling is what an authoring agent can actually drive. Ordinary tracked screenplay, design, TypeScript, and configuration files remain the source. The coding agent authors them; the compiler and engine decide structural truth; the MCP tools deliver knowledge, host-produced pixels, optional repaint, and evidence-bound review. A filename, a confident explanation, or remembered chat is never proof.

## Flow

1. Start with this constitution, then choose the next guide from Guide selection. Whenever a named guide is required, retrieve only that guide by calling `getGuideDocument` with its exact stem, for example `getGuideDocument({ name: "SCREENPLAY_WRITING" })`.
2. Author the screenplay ladder: logline, treatment sequences and beats, then scene prose and its typed index. Read `EVIDENCE_GRAPH` for which folder each stage owns and what it must cite, then `SCREENPLAY_WRITING` for the craft. Every stage cites the stage above it, and the graph refuses a stage that nothing below elaborates, so fill the ladder downward before deepening any one branch.
3. Author production, models, world, built environments, formations, shot contracts, acceptance scenarios, and TypeScript shot/film source in their tracked owners. Read the matching contract guide and handbook before editing. Once shots begin to repeat, read `SOURCE_COMPOSITION`: a feature-length production is written as a program that emits shots, not as one hand-authored module per shot.
4. When deterministic work is too expensive for the one-second source sandbox, read `DERIVED_ARTIFACTS` and run its explicit generation command before compiling. Compilation verifies a derived artifact and never generates or repairs one, so a `derived-artifact-*` refusal is cleared by rerunning that command, not by compiling again.
5. Run the scaffold compiler or lint command. Compilation, project-state loading, geometry, status, migration, rendering, and verification are ordinary package or CLI APIs, never MCP tools.
6. Ask the structural questions before asking for pixels. Read `SUBJECT_INSPECTION`: it describes what actually compiled, diffs one compiled artifact against another, and cuts section planes through a building whose outside hides its inside. These are ordinary package APIs rather than MCP tools, and that guide says which run in a project script and which need a live renderer. An extent, a placement, or a missing member is a number there and only an impression in a frame.
7. Read `CAPTURE_FRAME`, then call `captureFrame` for current asset turntables or current shot pixels. `captured:false` is a refusal, not evidence. Read `VISUAL_CHANGE_REPORT` before comparing two existing digest catalogs; that comparison is neither a structural diff nor review evidence.
8. Review deterministic assets and shots before anything downstream of them, and review a compiled subject whenever one authored thing has to be judged on its own. `REVIEW_SUBJECT` owns that target: its verdict neither discharges nor is discharged by a shot that shows the subject, and the compiler's review queue does not enumerate subjects, so asking for one is a decision you make rather than a gate that stops you. When production design declares visual delivery `repainted`, complete the current `shot` review, read `REPAINT_SHOT` and `DIFFUSION_ENHANCE`, call `repaintShot`, then complete the separate `rendition` review. Deterministic delivery does not route through diffusion.
9. Read the exact target guide before both `prepareReview` and `submitReview`: `REVIEW_ASSET`, `REVIEW_SUBJECT`, `REVIEW_SHOT` (for `shot` and `rendition`), `REVIEW_SEQUENCE`, `REVIEW_FILM`, or `REVIEW_DEPENDENCY` (for `design` and `source`). Inspect every returned current evidence item yourself. Put the final boolean last.
10. Render through the scaffold CLI only after current review gates pass. Verify receipts and media facts; never infer completion from an output path.

The host fixes project root and default production at startup. No tool payload may activate another filesystem root. Registry identity is `production / artifact id / time-or-angle-and-pass / fingerprint`; all evidence must reopen through that identity.

## Guide selection

Read only the route that matches the next owned decision. Contract guides define records and gates; handbooks provide recipes and judgment.

### Contracts and deterministic boundaries

- `PRODUCTION_DESIGN`: production clock, deliverables, art direction, visual-delivery declaration, render budgets, and site context.
- `MODEL_RECIPE`: bounded primitive and external model recipes, and physically-based surface materials.
- `DERIVED_ARTIFACTS`: explicit deterministic precomputation, tracked dependency and output digests, freshness refusals, and the source-context boundary.
- `WORLD_DESIGN`: terrain, routes, landmarks, bounded effects, and instance sets. The site a work stands on is the world's; the work itself is `WORLD_BUILDING`'s.
- `FORMATION_DESIGN`: repeated-unit layouts, heroes, and formation motion.
- `SHOT_CONTRACT`: source binding, events, camera intent, review times, and rendition policy.
- `ACCEPTANCE`: falsifiable frame, event, and metric criteria.
- `SOURCE_OWNERSHIP`: coding-agent, compiler, renderer, and review ownership.
- `COMPILATION`: design/source/review/final scopes and atomic publication.
- `GEOMETRY`: direct engine geometry and project-state queries outside the compile sandbox, and the mesh constructors source-owned models are built from.
- `SUBJECT_INSPECTION`: render-free descriptions of compiled elements, parts, prototypes, instances, sets, and spaces, bounded structural diffs between two compiled artifacts, and the section planes that open a building whose outside hides its inside.
- `VISUAL_CHANGE_REPORT`: changed, unchanged, new, and gone views across two existing digest catalogs; this is neither structural diff nor review evidence.

### MCP gate contracts

- `CAPTURE_FRAME`: exact `captureFrame` targets, passes, receipts, and refusal recovery.
- `REPAINT_SHOT`: exact `repaintShot` inputs, source-grid requirements, provenance, and refusal recovery.
- `REVIEW_ASSET`: asset turntable worksheet and silhouette, rig, material, and provenance axes.
- `REVIEW_SUBJECT`: one compiled subject's worksheet, its inspection-owned viewpoints, and its coverage states.
- `REVIEW_SHOT`: shot worksheet and composition, performance, continuity, and acceptance axes.
- `REVIEW_SEQUENCE`: sequence coverage, editorial rhythm, transition, and continuity worksheet.
- `REVIEW_FILM`: whole-film story, pacing, audiovisual delivery, and terminal consistency worksheet.
- `REVIEW_DEPENDENCY`: temporary design/source dependency worksheets exposed by the current schema; these are not additional visual surfaces.

### Authoring handbooks

- `SCREENPLAY_WRITING`: logline-to-scene screenplay craft and revision rubric.
- `CINEMATOGRAPHY`: shot-size meaning, 180-degree line, eyeline, screen direction, camera motion, and intentional violations.
- `EDITING`: EDL authorship, coverage, rhythm, transitions, and the Murch priority order.
- `OBJECT_RIGGING`: silhouette-first object design, axes, pivots, skeletons, profiles, traits, and retargeting. A door, shutter, gate, or sash belongs to the building that owns its opening rather than to a prop rigged from scratch, so operable openings are here too: travelling leaves, the named states they stand in, hardware, and the refusals `validateBuiltEnvironment` and the prop gate each raise by name.
- `WORLD_BUILDING`: procedural layout, semantic anchors, scale, traversal, environmental storytelling, and the built environment: building graphs, finishes and patterns, service networks, environmental analysis, drawings and quantities, phasing, cloth/planting/water, and prop placement.
- `MOTION`: action verbs, clip construction, contact, weight, expression, and continuity.
- `SOUND_DESIGN`: event-derived sound, dialogue, ambience, spatialization, and mix hierarchy.
- `ASSET_SOURCING`: license, provenance, digest, conversion, and consumer restrictions.
- `DIFFUSION_ENHANCE`: current-model research, reference locking, structural controls, repaint review, and reroll discipline.
- `EVIDENCE_GRAPH`: which folder an artifact belongs in and what it must cite: the staged prose ladder, the spec library, and the source vocabulary as one obligation graph.
- `SOURCE_COMPOSITION`: how a production's source is arranged once its shots repeat: typed subject vocabulary, seeded variation, shot factories, and one table the modules, design records, and edit all derive from.
- `TYPESCRIPT`: deterministic source-module patterns and typed registration.
- `DEBUGGING`: diagnostics-first correction across ownership, derived artifacts, compile, structural inspection, render, repaint, and review.

If you do not know the next guide, locate the next file or tool you must touch in Flow, then read the one route that owns it. Do not read every handbook as ritual; route deliberately and return here when the stage changes.
