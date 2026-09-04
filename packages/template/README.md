# @automovie/template

`@automovie/template` is the public materializer for a new AutoMovie authoring project. Its API renders and writes the bundled `scaffold` and regenerates a project's ignored coding-agent instruction surface from tracked production facts.

## Generated-project contract

Every rendered project is self-contained:

- `docs/{discovery,upstream,obligations,principles}` contains the complete reusable evidence target inventory;
- `docs/contracts` contains production-specific additive targets;
- one typed `lint.config.ts` owns the production shape, population scope, branch stages, local claims, and evidence graph;
- `.agents/skills/{production-lifecycle,evidence-graph,source-authoring,review-verification}` exposes four distinct authoring triggers with conditionally loaded sibling procedures;
- `AGENTS.md` routes those skills, while `CLAUDE.md` only imports the provider-neutral router.

`renderScaffold` hands over authored content only. A `node_modules`, `.git`, or `.cache` directory in the scaffold, and any file carrying a compiler-output shape, are working artifacts of whoever ran a tool in that directory rather than project inputs, and none of them reaches a generated project. That exclusion is load-bearing rather than tidy: the repository ignores the paths a stray type-check emits under the scaffold, so nothing else in the toolchain can see one, and a generated project's loader prefers an emitted `.js` to the `.ts` beside it.

Generated graph evaluation never resolves evidence targets from `node_modules/@automovie/template`. The package ships the scaffold bytes that become project-owned inputs; `@automovie/evidence` supplies the reusable graph mechanics that validate those local inputs.

The scaffold deliberately contains no production content and no provider-specific hook.
Compiler, lint, sync, capture, and verify commands enforce their own ownership and validity boundaries.
Subject inspection retains the capture browser's launch closure, asserts it across page and draw boundaries, and pairs each PNG with the actual page graphics identity instead of publishing runtime-anonymous review evidence.

## Public API

`renderScaffold` returns a deterministic project-relative file map, `writeFiles` materializes it without overwriting resident files, and `writeAutoMovieProductionInstructions` replaces only the ignored generated instruction surface. The package also exports the router renderer and scaffold snapshot helpers used by those operations.
