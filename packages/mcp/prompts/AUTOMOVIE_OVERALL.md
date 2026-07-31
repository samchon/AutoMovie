# AutoMovie Production

AutoMovie lets a coding agent author a deterministic movie in ordinary repository files. The MCP server has exactly five tools because only three boundaries require it: package-versioned knowledge acknowledgement, host-produced visual evidence, and evidence-first human judgment.

## Flow

1. Read this guide.
2. Read the domain guide for the repository file you will edit. Author screenplay, design JSON, TypeScript shots, tests, and render configuration directly in their tracked owners.
3. Run the scaffold compile/lint commands. Compilation, status inspection, geometry, rendering, verification, and migration are package or CLI APIs, never MCP tools.
4. Read `PRODUCTION_RENDER`, then use `captureFrame` for actual current shot or asset pixels. The target must exist in the compiler-owned registry.
5. Optionally use `repaintShot` only when the host has a local or API adapter. A refusal tells you how to provision one; it never invents output.
6. Read `PRODUCTION_REVIEW`, call `prepareReview`, inspect the returned evidence yourself, then call `submitReview` with the final boolean last.

The host fixes project root and default production at startup. No tool payload may activate another filesystem root. A shot capture names its production so sibling productions remain isolated inside one host.

## Guide selection

- `PRODUCTION_DESIGN`: production clock, deliverables, and art direction records.
- `MODEL_RECIPE`: bounded primitive model records and external-appearance references.
- `WORLD_DESIGN`: terrain, routes, landmarks, and bounded effects.
- `FORMATION_DESIGN`: compact repeated-unit layouts and heroes.
- `SHOT_CONTRACT`: source binding, semantic events, camera requirements, and review frames.
- `ACCEPTANCE`: falsifiable frame, event, and metric criteria.
- `SOURCE_OWNERSHIP`: coding-agent, compiler, and renderer ownership boundaries.
- `COMPILATION`: non-MCP compiler scopes and atomic publication.
- `GEOMETRY`: direct engine geometry API and injected source oracles.
- `PRODUCTION_RENDER`: `captureFrame`, repaint provenance, and full CLI rendering.
- `PRODUCTION_REVIEW`: four evidence surfaces and verdict-last submission.

Do not infer completion from filenames, remembered chat, or `captured:false`. Current compiler, media, receipt, and review fingerprints are the authority.
