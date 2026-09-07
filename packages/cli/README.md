# automovie

`automovie` creates, migrates, synchronizes, inspects, renders, and verifies coding-agent-first AutoMovie production repositories. It delegates production authoring and review to the generated project's tracked inputs and shipped local procedures rather than storing production decisions in CLI state.

## CLI surface

```text
npx create-automovie <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie start <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie sync
npx automovie verify
npx automovie contracts migrate [--dry-run]
npx automovie toc [--check]
npx automovie migrate <directory> [--dry-run | --rollback]
npx automovie inspect-external <project-path> --profile <profile>
npx automovie routes <film|brief|library>
npx automovie render <all|plan|run|status|verify|finalize|gc> [options]
```

Each invocation is one closed request. Help and version flags are standalone. Unknown, repeated, inapplicable, missing, blank, conflicting, or extra arguments are rejected before a target is resolved, a project is opened, a child process is started, or state is changed.

`start` requires exactly one directory and one supported `--language`; `--force` is its only other option. It refuses a non-empty directory without that flag. The generated dependency versions come from the template package's resolved catalog rather than the invoking workspace. `sync` and `verify` accept no arguments, `contracts migrate` accepts only `--dry-run`, `toc` accepts only `--check`, and `migrate` accepts exactly one directory and at most one of `--dry-run` or `--rollback`.

`inspect-external` accepts one project path and one profile: `gltf-static-v1`, `gltf-humanoid-v1`, `gltf-motion-v1`, or `vrm-humanoid-v1`. `routes` accepts exactly one of `film`, `brief`, or `library`.

Render `all` and `run` accept `--chunk-frames <positive-integer>`, `--deliverable <id>`, `--tier <proxy|final>`, and `--workers <positive-integer>`. `plan` accepts `--chunk-frames` and `--tier`; `status`, `verify`, and `finalize` accept `--tier`; `gc` accepts only the valueless `--apply`.

`start` and `sync` synchronize the owned `automovie_reference` entries in ignored project-local `.mcp.json` and `.codex/config.toml`. They use the installed package and absolute production root, preserve unrelated settings, and refuse ownership conflicts; client trust is never granted automatically. `sync` also replaces the generated instruction surface from the installed template and the current tracked evidence declaration. It does not overwrite tracked production documents or static READMEs; the generated scaffold's [static-document policy](../template/scaffold/README.md#static-document-updates) owns that boundary.

`contracts migrate --dry-run` compares the recorded and installed shared-contract generations without writing. Plain `contracts migrate` applies only conflict-free target changes and preserves local edits, removed anchors, ambiguous renames, and collisions for adjudication. `toc --check` reports stale script or screenplay indexes; plain `toc` updates only their managed link blocks.

Contract and TOC publication retain exact predecessor bytes and generations in a durable archive and pending journal. The current pathname may be absent between preserving its predecessor and installing its successor; this is not a whole-tree atomic swap. A pending attempt refuses graph admission and observation-only maintenance. Rerun the same explicit mutating command to attempt recovery, preserving every competitor and the named archive if adjudication is required. Reference-client registration uses a separate ignored archive because complete client settings may contain private values; that Git exclusion does not grant additional OS permissions or isolate the files from other local users. See [Interrupted maintenance](../template/scaffold/.agents/skills/production-lifecycle/index.md#interrupted-maintenance).

`migrate --dry-run` validates legacy state from a temporary copy. Plain `migrate` adds the tracked migration result without rewriting legacy creative source, while `--rollback` removes that result only while its recorded baseline is unchanged.

Render actions and their applicable options are owned by the generated project's [canonical command inventory](../template/scaffold/README.md#canonical-command-routes) and review procedures. The CLI preserves content-addressed render generations, current runtime identity, and fail-closed recovery rather than treating an existing pathname as a current result.

## Generated project routes

Every new project contains five generated skill routers under `.agents/skills`: contract lookup, production lifecycle, evidence graph, source authoring, and review verification. The generated `AGENTS.md` reports the current project selection and contract bindings, then routes those procedures; `CLAUDE.md` imports that same router.

Use the generated [production document map](../template/scaffold/docs/README.md) for physical ownership and its [authoring routes](../template/scaffold/README.md#authoring-routes) for production-kind, contract, evidence, source, and review decisions. The scaffold README's [command inventory](../template/scaffold/README.md#canonical-command-routes) accounts for the project-local package scripts; this package README does not maintain a second command contract.

The shortest blank-project check is:

```bash
npm install
npm run lint:source
```

The blank scaffold intentionally refuses downstream compile, review, and render work until the routed production prerequisites exist.

## API

The package exports the CLI runner, read-only project-state helpers, explicit maintenance publication capabilities, and `synchronizeAutoMovieReferenceClients`. The reference provider itself lives in `@automovie/mcp`; registering its clients is a separate intentional write. Require current state before using a compiled snapshot for an offline measurement:

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

const loaded = loadAutoMovieProjectState({ root: process.cwd() });
const state = requireCurrentAutoMovieProjectState(loaded);
```

Project-state loading performs filesystem I/O. Use it from CLI, measurement, test, or diagnostic hosts, never from deterministic shot or film build functions.
