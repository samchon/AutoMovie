# Production Design

The tracked production design record stores global invariants, not screenplay prose. Read this before editing it.

Choose one stable id, title, logline, target runtime, visual delivery, frame clock, primitive-3D art grammar, and deliverable inventory.

`visualDelivery` is exactly `deterministic` or `repainted`. Deterministic delivery ships compiler/render output directly. Repainted delivery keeps that output as technical truth and adds obligations at both ends of the ladder: the design gate refuses the selection itself unless the inventory carries a `feature` deliverable marked required, because a repaint selection that ships only previews, guide passes, captions, audio, or optional features is nominal, and that refusal lands at `design` scope before a single shot compiles. The review gate then adds a receipt-bound rendition and its own visual review for every delivered shot.

Runtime is the intended finished duration, not the duration of the current sample, and must equal an integer frame count divided by fps. Declare the whole film's runtime up front and leave it there: while the edit is still short of it, `source` scope reports `film-runtime-mismatch` as a warning naming the gap, and it becomes an error at `review` and `final`, where the assembled film must fill its declared clock exactly. Do not track the target down to whatever is built so far; that turns a stated intent into a derived number and hides how much film is left. Width, height, and fps become one clock-and-raster contract reused by compile, preview, review, captions, and render. Width and height are each bounded to 16,384 and their product must not exceed 16,777,216 pixels, because every required review frame must be capturable at the exact production raster.

The deliverable inventory must not be empty, and each entry declares a `kind` over a closed vocabulary: `preview`, `feature`, `guide-pass`, `captions`, `audio-mix`. Only a `guide-pass` entry may own a `pass`, and that pass is a structural pass other than beauty; any other kind carrying one is refused at design scope. Declaring a guide pass here states what the production intends to output, and it is not what makes review capture one. The shot's own review frames decide that, so a production that wants a mask judged edits both records. Read `SHOT_CONTRACT`.

A film or brief whose timed deliverable is a set of held views (an exterior, a cut-away, one room) obeys the same clock as any other audiovisual result. There is no still-image compile scope and no survey exemption for that timed delivery: each view is a shot with a duration on the production clock, every shot is placed in the edit or explicitly omitted there, and the declared runtime must equal the frame the assembled timeline ends on before `review` will pass. Declare a runtime you intend to fill rather than one the edit will chase, and give each held view enough frames that its review frames have somewhere to land. A `library` instead ends at reviewed design/source branches; its neutral model, space, material, instance, motion, and system samples are design evidence rather than shots on a film clock. Read `EDITING` for the edit that places film or brief views.

`storyClock` is optional and declares a second timeline: when the film says things happened, as distinct from the order it shows them. It carries only a unit and a non-blank statement of what story time zero denotes. Declaring it is what makes a shot's `storyTime` pin and a `story-sync` acceptance criterion legal; a production that asserts nothing about story time omits it and is unaffected. The frame clock stays the delivery clock. The story clock never changes a duration, a frame index, or the edit.

`lighting` is optional and rides on that clock: the production's own light sources and their motion in STORY seconds. A shot carrying a `storyTime` pin compiles under the state those sources are in at its own story moment. A source whose id a scene already stages replaces that light in place, and a source no scene declares is appended. This is what lets a film state its light once instead of every scene restaging the same sun with nothing relating the first shot to the last. What a shot inherits is the light's STATE at its opening moment, not the source's curve; a light that has to change during the shot is the shot's own `lightMotions`, which runs on top of what it inherited. A production declaring no `lighting`, or a shot carrying no pin, compiles exactly the lights it staged.

`renderBudgets` is optional and states the render cost this production will stay inside, by tier. Each entry names its own `tier`, such as `review` or `delivery`, and an inclusive maximum per metric over a closed vocabulary: `triangles`, `vertices`, `drawCalls`, `materials`, `textures`, `textureBytes`, `geometryBytes`, `lights`, `shadowMaps`, `nodes`, `instanceSets`, `instanceSlots`, `instanceChunks`, `fluidCells`, and `fluidParticles`. A measurement exactly equal to its limit is inside.

No limit is ever inferred from what the scene currently costs, because a number derived from the present would ratify every regression the moment it lands. A production that declares no budget is reported as unbudgeted rather than quietly given one, and a metric you omit is reported as unbudgeted rather than as passing.

Declaring a tier is not a check running. No compile scope reads `renderBudgets` yet, so it is the production's own code that picks the tier a render targets and evaluates it against the engine's report.

The evidence side is the render inventory, counted from the compiled artifact before any GPU draws it, and the report that compares one against the other. Both read one subject, and so does the semantic palette.

`autoMovieRenderSubjectOfCompiledShot` is that one reading. It takes the compiled shot's scene, models, buildings, and instance sets, and every fluid, cloth, and planting domain the artifact carries beside the bindings that place them, so a pond is priced and coloured from the same record instead of from two readings that can disagree.

Decoded texture dimensions remain yours to pass, because no compiled record holds them, and one you leave out is a cost the report never sees rather than a cost it reports as missing. Pass them.

Reach for the older `autoMovieRenderSubjectOfShot` only when you are stating drawables the artifact does not carry, such as a cell count some solver outside this repository proved.

A curtain, a fern bed, and a pond are drawn by the same renderer as the walls and are held by no scene node, so their triangles, draw calls, and buffers are read from the domain records alone, before any solve runs and while the production can still be refused.

Read the numbers in the direction they are safe in. `materials`, `textures`, `lights`, `shadowMaps`, `nodes`, `instanceSets`, `instanceChunks`, and `fluidCells` are exact counts. `drawCalls` is an upper bound on the submissions one frame can issue, never an observed number. `triangles`, `vertices`, and `instanceSlots` are exact wherever the design fixes the shape and upper bounds wherever runtime state chooses how much of it draws: a slot picks a level of detail by distance, a fern bed grows to at most its recipe's worst case, and a water quad is skipped unless all four of its cells are wet. `fluidParticles` is the declared emitter cap. `textureBytes` and `geometryBytes` are estimated device bytes. Every one of those choices only lowers the number, which is the one direction a budget can be checked in, so do not read a bound as a measurement of the frame you shipped.

Read the report's status vocabulary literally. A metric that produced no number is `unsupported` when this repository has no analysis for the quantity, and `not-run` when the analysis exists but its input was never supplied.

A declared water body carrying neither a bound fluid domain nor a solver-proved cost makes `fluidCells` and `fluidParticles` `unsupported`. A planting cluster whose drawn prototype cost you did not state makes `triangles`, `vertices`, and `geometryBytes` `not-run`. A bound texture whose decoded dimensions you did not supply makes `textureBytes` `not-run`.

Neither status collapses into zero and neither collapses into a pass. A report carrying one is never `within`: it is `incomplete`, or `over` when some other metric already exceeded its limit. A design that declares something nothing can measure reads as unmeasured rather than as cheap.

A report is evidence only while the target it measured is still the target that will be drawn. The renderer identity, its settings, and every asset byte are fingerprinted together, and a consumer that finds a different fingerprint treats the report as stale rather than as a verdict.

`environmentContext` is optional and declares the read-only site an environmental analysis is measured against: the direction the site calls north, a reference ground plane, the environmental instants the production wants answered, and the neighbouring masses that block light. It is context, never design. The compiler refuses a context whose ids collide with a building's own elements, spaces, or boundaries, so a shading neighbour cannot become part of the work by a copy-paste, and no lowering, scene graph, or quantity take-off ever emits it. The repository ships no climates and no places; a production declares its own instants and its own illuminance. Read `BUILDING_STUDIES` before authoring one.

The art direction must make primitive geometry readable: a small palette, explicit silhouette priorities, and a scale grammar for hero, near, and far units. Put historical research, settings, storylines, scenarios, script, dialogue, and shot implementation in `docs` and `src`; do not hide them in design strings.

Use one-artifact corrections. A production edit deliberately stales every dependent shot, visual review, and render. Inspect consequences, recompile, capture current frames, and review again.

A one-artifact migration may temporarily invalidate a dependent artifact that cannot be updated first. Design lint reports `design-downstream-invalidated` warnings for each newly broken dependent; update those next. Source compilation remains blocked, so the warning is an ordered migration path, not permission to ship an inconsistent graph.

Required order:

1. Edit the production design record.
2. Edit model recipe records for referenced primitives.
3. Edit the world design record.
4. Edit the screenplay index. Every shot and acceptance citation joins to it, and a resident shot contract with no index is refused at every scope, `design` included.
5. Edit formation and shot-contract records.
6. Edit acceptance records.
7. Run the scaffold source compile command or `compileAutoMovieProduction({ scope: "source" })`.

Do not declare a deliverable required unless the repository has or will have a deterministic command that materializes and proves it.

## Where these records come from in a scaffold production

The generated scaffold is an empty authoring harness. Its checked-in `scripts/emitDesign.ts` refuses to invent records because no generic script can know which production modules own a user's models, spaces, materials, instances, motions, systems, shots, or edit. Author that script only after those owners exist.

Keep each fact in one typed owner and derive the tracked record from it. Model owners live under `src/models`, spatial topology under `src/spaces`, surface construction and response under `src/materials`, repeated populations under `src/instances`, time-varying behavior under `src/motions`, and coupled processes under `src/systems`. A timed film or brief additionally owns `src/shots`, `src/production.ts`, and `src/film.ts`. The matching design documents live under the same-named branches of `docs`; the exact film narrative ladder is `docs/settings -> docs/storylines -> docs/scenarios -> docs/script`.

Extend the marked block in `scripts/emitDesign.ts` to import the production's real owners and call its `emit` wrapper explicitly. Preserve the generic setter wrapper and final inventory comparison. A module cannot discover the path by which another module imports it, and an export cannot read its own export name, so the script states every shot's `module` and `export`. The compiler compares each tracked record with its typed owner; editing only the JSON is therefore a disagreement, not a shortcut.

The derivation obeys four rules.

- **It writes and never deletes.** A record that the script stops deriving remains a live obligation. Compare the project inventory with the records derived in the current run and fail with every unowned path; remove each named record deliberately or restore its owner.
- **It skips an unchanged record.** Re-storing equal bytes would stale dependent shots and reviews without changing the production.
- **It never invents narrative intent.** The screenplay index stays hand-authored because no table can prove why a scene realizes a beat.
- **It covers every resident record.** A mutually consistent orphan can still compile. The emitter's exact derived inventory is the ownership check that finds it.

## Authoring the first production

Select exactly one production kind in `lint.config.ts`, then advance only the branches that kind permits. `film` owns the complete narrative ladder and film source. `brief` owns one bounded `docs/briefs` contract and no screenplay hierarchy. `library` owns reusable design branches and no shots or edit. Runtime and aspect ratio do not change that classification.

1. Research uncertain external facts under `docs/research`, interpret every adopted result in a citing settings H2, then author the needed design branches under `docs`.
2. For a film, author settings first, then preserve exact filename and H2/H3/H4 identity through storylines, scenarios, and script. For a brief or library, keep the film-only narrative branches absent.
3. Author typed owners only in their declared `src` branches. Every named export carries the exact evidence citation required by `lint.config.ts`.
4. Implement `scripts/emitDesign.ts` from those owners and publish the tracked design records. Keep `.automovie/design` empty until this step; generated output is never an authoring surface.
5. Compile at the narrowest truthful scope, resolve every graph and compiler diagnostic, and advance a stage only after its review is complete.

A documents-only milestone may be a truthful draft, but it is not a completed production. A source-only milestone with no reviewed design claim is equally incomplete. The staged graph exists so incomplete work can be represented without weakening or disabling the final obligations.

## What the design declaration commits you to looking at

Every deliverable this record declares is a review surface somebody owes evidence for, and the declaration decides which one.

`visualDelivery: "deterministic"` completes on the `shot` review of captured frames. `visualDelivery: "repainted"` adds a separate `rendition` review after `repaintShot`, and the deterministic shot review still has to be complete before the handoff. The frame format decides the raster every required view is captured at, so a smaller raster is a downgraded frame that discharges nothing.

Read `REVIEW_SHOT` for what those worksheets ask, and `CAPTURE_FRAME` for how the frames are produced.
