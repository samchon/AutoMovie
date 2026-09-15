# automovie

`automovie` creates coding-agent-first AutoMovie production repositories and inspects external source bytes. It delegates production authoring and review to the project's tracked inputs and installed local procedures rather than storing production decisions in CLI state.

## CLI surface

```text
npx create-automovie <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie start <directory> --language <chinese|english|japanese|korean> [--force]
npx automovie toc [--check]
npx automovie inspect-external <project-path> --profile <profile>
npx automovie routes <film|brief|library>
```

Each invocation is one closed request. Help and version flags are standalone. Unknown, repeated, inapplicable, missing, blank, conflicting, or extra arguments are rejected before a target is resolved, a project is opened, a child process is started, or state is changed.

`start` requires exactly one directory and one supported `--language`; `--force` is its only other option. It refuses a non-empty directory without that flag. The generated dependency versions come from the template package's resolved catalog rather than the invoking workspace. `toc` accepts only `--check`.

`inspect-external` accepts one project path and one profile: `gltf-static-v1`, `gltf-humanoid-v1`, `gltf-motion-v1`, or `vrm-humanoid-v1`. `routes` accepts exactly one of `film`, `brief`, or `library`.

`start` installs the authored harness without registering MCP clients. Installation is one-way under the scaffold's [static-document policy](../template/scaffold/README.md#static-document-updates); the CLI supplies no instruction synchronization or automatic project upgrade.

`toc --check` reports stale script or screenplay indexes; plain `toc` updates only their managed link blocks after verifying the observed files and physical parents. It writes Markdown directly and creates no baseline, journal, receipt, or migration directory.

Contract and production changes are ordinary reviewed source changes. The CLI does not maintain a second JSON migration history beside Git.

## Generated project routes

Every new project contains five installed skill routers under `.agents/skills`: contract lookup, production lifecycle, evidence graph, source authoring, and review verification. `AGENTS.md` is their shared entry point and `CLAUDE.md` imports it. The current project selection and contract bindings come from `src/lint.config.ts` and the project-local documents, not from a regenerated instruction inventory.

Use the generated [production document map](../template/scaffold/docs/README.md) for physical ownership and its [authoring routes](../template/scaffold/README.md#authoring-routes) for production-kind, contract, evidence, source, and review decisions. The scaffold README's [command inventory](../template/scaffold/README.md#canonical-command-routes) accounts for the project-local package scripts; this package README does not maintain a second command contract.

The shortest blank-project check is:

```bash
npm install
npm run lint
```

The blank scaffold provides source lint and authoring documents. It ships no authored production, viewer stub, optional tooling payload, or persisted project-state workflow. A coding agent adds the project's actual source and requested viewing or rendering integration when that work is needed.

## API

The package exports the CLI runner, closed command-argument parser and dispatcher, scaffold next-step text, and bounded Markdown observation helpers. Production values and runtime composition belong to the project's authored source and the public engine, ingest, production, render, and viewer APIs that consume them; this CLI does not load a second persisted production-state store.
