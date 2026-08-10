# Production Design

The tracked production design record stores global invariants, not screenplay prose. Read this before editing it.

Choose one stable id, title, logline, target runtime, visual delivery, frame clock, primitive-3D art grammar, and deliverable inventory. `visualDelivery` is exactly `deterministic` or `repainted`: deterministic delivery ships compiler/render output directly, while repainted delivery keeps it as technical truth and additionally requires at least one required feature plus a receipt-bound rendition and separate visual review for every delivered shot. Runtime is the intended finished duration, not the duration of the current sample, and must equal an integer frame count divided by fps. Declare the whole film's runtime up front and leave it there: while the edit is still short of it, `source` scope reports `film-runtime-mismatch` as a warning naming the gap, and it becomes an error at `review` and `final`, where the assembled film must fill its declared clock exactly. Do not track the target down to whatever is built so far; that turns a stated intent into a derived number and hides how much film is left. Width, height, and fps become one clock-and-raster contract reused by compile, preview, review, captions, and render. Width and height are each bounded to 16,384 and their product must not exceed 16,777,216 pixels, because every required review frame must be capturable at the exact production raster.

`storyClock` is optional and declares a second timeline: when the film says things happened, as distinct from the order it shows them. It carries only a unit and a non-blank statement of what story time zero denotes. Declaring it is what makes a shot's `storyTime` pin and a `story-sync` acceptance criterion legal; a production that asserts nothing about story time omits it and is unaffected. The frame clock stays the delivery clock — the story clock never changes a duration, a frame index, or the edit.

The art direction must make primitive geometry readable: a small palette, explicit silhouette priorities, and a scale grammar for hero, near, and far units. Put historical research, treatment, screenplay, dialogue, and shot implementation in `docs` and `src`; do not hide them in design strings.

Use one-artifact corrections. A production edit deliberately stales every dependent shot, visual review, and render. Inspect consequences, recompile, capture current frames, and review again.

A one-artifact migration may temporarily invalidate a dependent artifact that cannot be updated first. Design lint reports `design-downstream-invalidated` warnings for each newly broken dependent; update those next. Source compilation remains blocked, so the warning is an ordered migration path, not permission to ship an inconsistent graph.

Required order:

1. Edit the production design record.
2. Edit model recipe records for referenced primitives.
3. Edit the world design record.
4. Edit formation and shot-contract records.
5. Edit acceptance records.
6. Run the scaffold source compile command or `compileAutoMovieProduction({ scope: "source" })`.

Do not declare a deliverable required unless the repository has or will have a deterministic command that materializes and proves it.
