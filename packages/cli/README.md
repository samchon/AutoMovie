# @automovie/cli

Scaffold an [automovie](https://github.com/samchon/automovie) project.

```bash
npx automovie start my-film
npx automovie migrate legacy-film --dry-run
npx automovie migrate legacy-film
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
pnpm capture:install
pnpm capture:doctor
pnpm compile
pnpm test
pnpm preview -- --shot opening --time 2 --pass beauty
pnpm review:status
# Complete the current evidence-bound MCP review, then:
pnpm lint
```

`pnpm compile` is the only command allowed to materialize `generated` output.
`pnpm lint` is stricter: it reruns compilation without writing and fails until
every current design, source, shot, and film review is complete. `preview`
captures the project-owned viewer and records a frame tied to target-local
generated/viewer inputs and the renderer identity; review cannot complete
against an arbitrary or stale screenshot.

The default capture runtime is the Chromium build pinned to the starter's
Playwright package. `capture:install` downloads it explicitly into
Playwright's project-local browser path and writes an ignored receipt containing
the package version, browser revision, executable path, and executable digest.
`capture:doctor` launches that exact executable, requires WebGL, captures a
canvas, and decodes the PNG. Proxy and offline mirror settings use Playwright's
standard `HTTPS_PROXY`, `PLAYWRIGHT_DOWNLOAD_HOST`, and
`PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` environment variables. The default
`PLAYWRIGHT_BROWSERS_PATH=0` keeps the binary package-local; set that variable
to an explicit path to use a configured shared cache.

System Chrome or Edge remains an explicit compatibility choice in
`automovie.config.ts`:

```ts
capture: {
  browser: { source: "system-channel", channel: "chrome" },
}
```

A configured executable must likewise declare its product and path; its exact
binary digest, rather than a guessed machine identity, enters render evidence.

Each render bundle stores canonical structured identity for Playwright, browser
revision/source, executable digest when available, platform, headless/raster
mode, requested backend, and actual WebGL vendor/renderer. Existing v2 bundle
manifests remain on disk but require recapture before they can serve as current
review evidence; they remain target-scoped history warnings and do not block a
current valid v3 bundle.

Chunk render `status`, `verify`, and `finalize` re-run the capture, actual
graphics, declared render-source, and package-owned encoder identity preflight.
They can launch Chromium and mark every stored chunk stale when that structured
runtime identity changes.

Chunk workers publish complete UUID claims before they become visible inside a
slot-specific lock namespace. They yield to every other live claim and remove
only their own exact path. A killed worker leaves either a recoverable claim or
a non-authoritative candidate that the next run quarantines.

## Usage

```
npx automovie start <directory> [--force]
npx automovie migrate <directory> [--dry-run | --rollback]
```

`start` refuses a non-empty directory unless `--force`. The scaffolded project's
`@automovie/*` dependency versions are baked in at build time from this repo's
own catalog (`build/sync-versions.mjs`), so a starter never drifts from the
engine it targets.

`migrate --dry-run` validates legacy v1 storage from a temporary copy and prints
the immutable byte inventory, production and shot drafts, source TODOs, and
warnings without touching the project. Plain `migrate` atomically adds only
tracked `.automovie` provenance; it never rewrites legacy files or guesses the
missing creative TypeScript. `--rollback` removes that state only while no
production work has changed it. The import plan fingerprints the pre-import
`src`, `generated`, and `renders` baselines, and rollback restores the complete
applied state if removing any newly created empty directory fails. Baselines
include empty subdirectory topology as well as file bytes, and the project root
stays locked until rollback either completes or restores `.automovie`.

## API

The renderer and writer are exported for programmatic use: the render step
returns an in-memory file map, and writing is a separate call, so the same
output can be asserted in a test or written by another consumer:

```ts
import { renderScaffold, writeFiles } from "@automovie/cli";

const files = renderScaffold({ name: "my-film" }); // { "package.json": "...", ... }
writeFiles("./my-film", files); // → written absolute paths
```
