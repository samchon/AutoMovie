# @automovie/template

`@automovie/template` is the public materializer for a new AutoMovie authoring project. Its API renders and installs the bundled `scaffold` once; the installed files then belong to the project.

## Generated-project contract

Every rendered project is self-contained:

- the scaffold's [contract-target inventory](./scaffold/.agents/skills/evidence-graph/contract-targets.md) is installed inside the generated project's `docs` root;
- `docs/contracts` contains production-specific additive targets;
- one typed `src/lint.config.ts` owns the production shape, population scope, branch stages, local claims, and evidence graph;
- `.agents/skills/{contract,production-lifecycle,evidence-graph,source-authoring,review-verification}` exposes five distinct contract and authoring triggers with conditionally loaded sibling procedures;
- `AGENTS.md` routes those skills, while `CLAUDE.md` only imports the provider-neutral router.

`renderScaffold` excludes working artifacts from its source population. A `node_modules`, `.git`, or `.cache` directory in the scaffold, and any file carrying a builder-output shape, belong to whoever ran a tool in that directory rather than to the template, and none reaches a generated project. That exclusion is load-bearing rather than tidy: the repository ignores the paths a stray type-check emits under the scaffold, so nothing else in the toolchain can see one, and a generated project's loader prefers an emitted `.js` to the `.ts` beside it.

The scaffold's [static-document policy](./scaffold/README.md#static-document-updates) owns installed instructions, contracts, and other project files. Updating the package does not update those files.

Generated graph evaluation never resolves evidence targets from `node_modules/@automovie/template`. The package ships the scaffold bytes that become project-owned inputs; `@automovie/evidence` supplies the reusable graph mechanics that validate those local inputs.

The scaffold supplies no production content, viewer stub, template variant, or provider-specific hook. Its [ownership boundary](./scaffold/README.md#ownership) governs source, static assets, and configuration. The coding agent authors the concrete runtime and view its requested production needs; creation does not register an MCP client.

## Public API

`renderScaffold` returns a deterministic project-relative file map for initial installation. `publishFiles` validates and freezes that complete candidate, then returns a receipt naming every completed file and the first refused or parent-bound partial effect; `writeFiles` preserves the throwing compatibility API. New slots are created through Koffi-backed POSIX `openat` or Windows `NtCreateFile` parent-handle-relative adapters, so neither creation nor verification follows a successor child pathname. The package also exports the scaffold snapshot helpers used by those operations. It supplies no post-install instruction regenerator or updater.
