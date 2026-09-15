# automovie

`automovie` creates, synchronizes, inspects, and renders coding-agent-first AutoMovie production repositories. It delegates production authoring and review to the generated project's tracked inputs and shipped local procedures rather than storing production decisions in CLI state.

## CLI surface

```text
npx create-automovie <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie start <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie sync
npx automovie toc [--check]
npx automovie inspect-external <project-path> --profile <profile>
npx automovie routes <film|brief|library>
npx automovie render <all|plan|run|status|verify|finalize|gc> [options]
```

Each invocation is one closed request. Help and version flags are standalone. Unknown, repeated, inapplicable, missing, blank, conflicting, or extra arguments are rejected before a target is resolved, a project is opened, a child process is started, or state is changed.

`start` requires exactly one directory and one supported `--language`; `--force` is its only other option. It refuses a non-empty directory without that flag. The generated dependency versions come from the template package's resolved catalog rather than the invoking workspace. `sync` accepts no arguments, and `toc` accepts only `--check`.

`inspect-external` accepts one project path and one profile: `gltf-static-v1`, `gltf-humanoid-v1`, `gltf-motion-v1`, or `vrm-humanoid-v1`. `routes` accepts exactly one of `film`, `brief`, or `library`.

Render `all` and `run` accept `--chunk-frames <positive-integer>`, `--deliverable <id>`, `--tier <proxy|final>`, and `--workers <positive-integer>`. `plan` accepts `--chunk-frames` and `--tier`; `status`, `verify`, and `finalize` accept `--tier`; `gc` accepts only the valueless `--apply`.

`start` installs the authored harness without registering MCP clients. `sync` replaces only the generated instruction surface from the installed template and the current tracked evidence declaration. It does not overwrite tracked production documents or static READMEs; the generated scaffold's [static-document policy](../template/scaffold/README.md#static-document-updates) owns that boundary.

`toc --check` reports stale script or screenplay indexes; plain `toc` updates only their managed link blocks after verifying the observed files and physical parents. It writes Markdown directly and creates no baseline, journal, receipt, or migration directory.

Contract and production changes are ordinary reviewed source changes. The CLI does not maintain a second JSON migration history beside Git.

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

The package exports the CLI runner, read-only project-state helpers, and bounded Markdown observation helpers. Require current state before using a compiled snapshot for an offline measurement:

```ts
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

const loaded = loadAutoMovieProjectState({ root: process.cwd() });
const state = requireCurrentAutoMovieProjectState(loaded);
```

Project-state loading performs filesystem I/O. Use it from CLI, measurement, test, or diagnostic hosts, never from deterministic shot or film build functions.
