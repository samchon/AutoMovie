# @automovie/cli

Scaffold an [automovie](https://github.com/samchon/automovie) project.

```bash
npx automovie start my-film
```

Lays down a starter with both ways to drive the engine:

- ordinary TypeScript source for treatment, shot, motion, effects, and tests;
- an **MCP** server config (`automovie.mcp.jsonc`) for deterministic compile,
  geometry queries, actual-frame evidence, and review gates; and
- a local viewer and Playwright capture path that render compiler-owned output.

The coding agent owns `src`, `docs`, `test`, and `public`. AutoMovie owns bounded
design documents, the `generated` directory, compile fingerprints, and the
review ledger. The starter intentionally keeps long-form authoring in files
instead of asking the model to serialize dense motion graphs through tool
calls.

## Starter workflow

```bash
pnpm install
pnpm compile
pnpm lint
pnpm test
pnpm preview -- --shot opening --time 2 --pass beauty
pnpm review:status
```

`pnpm compile` is the only command allowed to materialize `generated` output.
`pnpm lint` executes the same compiler checks without writing. `preview`
captures the project-owned viewer and records a frame tied to the current
compile fingerprint; review cannot complete against an arbitrary or stale
screenshot.

## Usage

```
npx automovie start <directory> [--force]
```

`start` refuses a non-empty directory unless `--force`. The scaffolded project's
`@automovie/*` dependency versions are baked in at build time from this repo's
own catalog (`build/sync-versions.mjs`), so a starter never drifts from the
engine it targets.

## API

The renderer and writer are exported for programmatic use: the render step
returns an in-memory file map, and writing is a separate call, so the same
output can be asserted in a test or written by another consumer:

```ts
import { renderScaffold, writeFiles } from "@automovie/cli";

const files = renderScaffold({ name: "my-film" }); // { "package.json": "...", ... }
writeFiles("./my-film", files); // → written absolute paths
```
