# @automovie/cli

Scaffold an [automovie](https://github.com/samchon/automovie) project.

```bash
npx automovie start my-film
```

Lays down a starter with both ways to drive the engine:

- an **MCP** server config (`automovie.config.jsonc`) for agent-driven film
  production, and
- a **direct-link** engine example (`src/motion.ts` + `src/main.ts`) that
  computes a clip in code and runs it through the engine's `validateMotion` /
  `sampleMotion` primitives.

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
