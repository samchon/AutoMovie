# Production Design

The tracked production design record stores global invariants, not screenplay prose. Read this before editing it.

Choose one stable id, title, logline, target runtime, visual delivery, frame clock, primitive-3D art grammar, and deliverable inventory.

`visualDelivery` is exactly `deterministic` or `repainted`. Deterministic delivery ships compiler/render output directly. Repainted delivery keeps that output as technical truth and adds obligations at both ends of the ladder: the design gate refuses the selection itself unless the inventory carries a `feature` deliverable marked required, because a repaint selection that ships only previews, guide passes, captions, audio, or optional features is nominal, and that refusal lands at `design` scope before a single shot compiles. The review gate then adds a receipt-bound rendition and its own visual review for every delivered shot.

Runtime is the intended finished duration, not the duration of the current sample, and must equal an integer frame count divided by fps. Declare the whole film's runtime up front and leave it there: while the edit is still short of it, `source` scope reports `film-runtime-mismatch` as a warning naming the gap, and it becomes an error at `review` and `final`, where the assembled film must fill its declared clock exactly. Do not track the target down to whatever is built so far; that turns a stated intent into a derived number and hides how much film is left. Width, height, and fps become one clock-and-raster contract reused by compile, preview, review, captions, and render. Width and height are each bounded to 16,384 and their product must not exceed 16,777,216 pixels, because every required review frame must be capturable at the exact production raster.

The deliverable inventory must not be empty, and each entry declares a `kind` over a closed vocabulary: `preview`, `feature`, `guide-pass`, `captions`, `audio-mix`. Only a `guide-pass` entry may own a `pass`, and that pass is a structural pass other than beauty; any other kind carrying one is refused at design scope. Declaring a guide pass here states what the production intends to output, and it is not what makes review capture one. The shot's own review frames decide that, so a production that wants a mask judged edits both records. Read `SHOT_CONTRACT`.

A production whose deliverable is a set of held views (an exterior, a cut-away, one room) obeys the same clock as a film. There is no still-image compile scope and no survey exemption: each view is a shot with a duration on the production clock, every shot is placed in the edit or explicitly omitted there, and the declared runtime must equal the frame the assembled timeline ends on before `review` will pass. Declare a runtime you intend to fill rather than one the edit will chase, and give each held view enough frames that its review frames have somewhere to land. Read `EDITING` for the edit that places them.

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

The order above says which records to edit. In a production stamped from the scaffold it does not say to edit them by hand, because `scripts/emitDesign.ts` derives every one of them from the typed sources that own them and `npm run design` stores what it derived. A record and its typed source are two representations of one fact and the compiler refuses the pair when they disagree, so editing the JSON alone produces that refusal rather than the change you wanted.

That script is production-owned code rather than scaffolding to inherit and leave alone. It imports your units, formations, world, and shots by module path, and it states each shot's own `module` and `export`, because a module cannot know the path anything reaches it by and an export cannot read its own name. Sources that move while that script does not leave a design layer still describing the film you deleted.

These properties of the derivation decide how a replacement goes.

- **It writes and never deletes, and it refuses what it no longer derives.** A record you stop deriving stays resident, and a resident shot contract is a live obligation at every scope, `design` included. The script compares the project's inventory against what the run derived and fails naming each unowned record's own path, so the design layer's removal set is that output rather than a hunt. Delete the file it names, or derive it from a source that owns it.
- **An unchanged record is not re-stored.** A design mutation stales every dependent shot, review, and render by design, so re-deriving an identical record is deliberately not a mutation.
- **The screenplay index is not derived at all.** It stays hand-authored and `SCREENPLAY_WRITING` owns it. Why a scene covers a beat is stated in no document, so nothing can generate it.

## Replacing the starter with your own film

The scaffold ships one complete film. Starting your own means replacing all of it, and that is one pass rather than a stage you can close green in the middle.

The evidence graph binds documents, source, and design in both directions, so a partial replacement is red from either side: delete the starter's documents and its classes cite nothing, delete its classes and its documents claim subjects nobody authored. One measured run left the starter's documents standing while it moved everything else and read about forty unresolved evidence targets for it. Expect red from the first deletion until the last authored record lands, and treat it as red you are walking through rather than red you are diagnosing.

1. Author your own documents under `docs/<name>`, and your own screenplay index.
2. Author your own subjects, world, formations, and shots under `src`.
3. Rewrite `scripts/emitDesign.ts` to derive from those modules, then run `npm run design`. It stores what it derived and then fails with the list of records it no longer owns.
4. Delete the records that run named, and the starter modules and documents nothing cites any more. Rerun it until it exits clean.
5. Correct what no claim reaches: `src/film.ts` and `src/production.ts` sit inside `src` and outside both of its evidence claims, and `automovie.config.ts`, `.automovie/assets.json` and `test` are outside the graph entirely. All five carry starter ids and nothing counts them.
6. Compile, and read the diagnostics as the remaining list.

Do not wait for a diagnostic to find the design layer for you. A resident record that references only other resident records is internally consistent, so the compiler has nothing to refuse: measured on a real replacement, four starter model recipes and a formation were restored into a finished production and `compile` returned `success: true` with zero diagnostics while building them into that production's `generated` output. Whether a record still has an owner is a question only the script that derives them can answer, which is why step 3 is the step that finds them.

Do not plan a documents-only milestone that ends on a green build. It cannot exist, and one benchmark run spent two authoring turns discovering that.

## What the design declaration commits you to looking at

Every deliverable this record declares is a review surface somebody owes evidence for, and the declaration decides which one.

`visualDelivery: "deterministic"` completes on the `shot` review of captured frames. `visualDelivery: "repainted"` adds a separate `rendition` review after `repaintShot`, and the deterministic shot review still has to be complete before the handoff. The frame format decides the raster every required view is captured at, so a smaller raster is a downgraded frame that discharges nothing.

Read `REVIEW_SHOT` for what those worksheets ask, and `CAPTURE_FRAME` for how the frames are produced.
