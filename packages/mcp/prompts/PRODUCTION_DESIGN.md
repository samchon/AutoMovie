# Production Design

The tracked production design record stores global invariants, not screenplay prose. Read this before editing it.

Choose one stable id, title, logline, target runtime, frame clock, primitive-3D art grammar, and deliverable inventory. Runtime is the intended finished duration, not the duration of the current sample, and must equal an integer frame count divided by fps. Width, height, and fps become one clock-and-raster contract reused by compile, preview, review, captions, and render. Width and height are each bounded to 16,384 and their product must not exceed 16,777,216 pixels, because every required review frame must be capturable at the exact production raster.

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
