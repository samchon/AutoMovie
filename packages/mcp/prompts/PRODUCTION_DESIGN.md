# Production Design

`setProductionDesign` stores global invariants, not screenplay prose. Read this before setting it.

Choose one stable id, title, logline, target runtime, frame clock, primitive-3D art grammar, and deliverable inventory. Runtime is the intended finished duration, not the duration of the current sample. Width, height, and fps become one clock-and-raster contract reused by compile, preview, review, captions, and render.

The art direction must make primitive geometry readable: a small palette, explicit silhouette priorities, and a scale grammar for hero, near, and far units. Put historical research, treatment, screenplay, dialogue, and shot implementation in `docs` and `src`; do not hide them in design strings.

Use one-artifact corrections. A production edit deliberately stales every dependent shot, visual review, and render. Inspect consequences, recompile, capture current frames, and review again.

A one-artifact migration may temporarily invalidate a dependent artifact that cannot be updated first. The setter accepts the upstream change but returns `design-downstream-invalidated` warnings for each newly broken dependent; update those next. `compileProject` remains blocked, so the warning is an ordered migration path, not permission to ship an inconsistent graph.

Required order:

1. `setProductionDesign`
2. `setModelRecipe` for referenced primitives
3. `setWorldDesign`
4. formations and shot contracts
5. acceptance scenarios
6. `compileProject({scope:"source"})`

Do not declare a deliverable required unless the repository has or will have a deterministic command that materializes and proves it.
