# @automovie/template

`@automovie/template` is the public materializer for a new AutoMovie authoring project. Its API renders and writes the bundled `scaffold` and regenerates a project's ignored coding-agent instruction surface from tracked production facts.

## Generated-project contract

Every rendered project is self-contained:

- the scaffold's [contract-target inventory](./scaffold/.agents/skills/evidence-graph/contract-targets.md) is installed inside the generated project's `docs` root;
- `docs/contracts` contains production-specific additive targets;
- one typed `lint.config.ts` owns the production shape, population scope, branch stages, local claims, and evidence graph;
- `.agents/skills/{contract,production-lifecycle,evidence-graph,source-authoring,review-verification}` exposes five distinct contract and authoring triggers with conditionally loaded sibling procedures;
- `AGENTS.md` routes those skills, while `CLAUDE.md` only imports the provider-neutral router.

`renderScaffold` excludes working artifacts from its source population. A `node_modules`, `.git`, or `.cache` directory in the scaffold, and any file carrying a compiler-output shape, belong to whoever ran a tool in that directory rather than to the template, and none reaches a generated project. That exclusion is load-bearing rather than tidy: the repository ignores the paths a stray type-check emits under the scaffold, so nothing else in the toolchain can see one, and a generated project's loader prefers an emitted `.js` to the `.ts` beside it.

The generated scaffold's [static-document policy](./scaffold/README.md#static-document-updates) distinguishes tracked overview snapshots from the ignored instruction surface and migratable contract targets. Package upgrades never overwrite a production's tracked README files.

Generated graph evaluation never resolves evidence targets from `node_modules/@automovie/template`. The package ships the scaffold bytes that become project-owned inputs; `@automovie/evidence` supplies the reusable graph mechanics that validate those local inputs.

The scaffold deliberately contains no production content and no provider-specific hook.

## Public API

`renderScaffold` returns a deterministic project-relative file map. `publishFiles` validates and freezes that complete candidate, then returns a receipt naming every completed file and the first refused or parent-bound partial effect; `writeFiles` preserves the throwing compatibility API. New slots are created through Koffi-backed POSIX `openat` or Windows `NtCreateFile` parent-handle-relative adapters, so neither creation nor verification follows a successor child pathname. `writeAutoMovieProductionInstructions` uses the same candidate-and-receipt boundary and removes stale generated doctrine only after the desired candidate completes. The package also exports the router renderer and scaffold snapshot helpers used by those operations.
