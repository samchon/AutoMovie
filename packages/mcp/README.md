# `@automovie/mcp`

`@automovie/mcp` exposes exactly six MCP tools. They exist for facts an ordinary coding channel cannot carry safely: session-scoped guide acknowledgement, host-produced pixel or diffusion evidence, and evidence-first human judgment.

| Tool               | Responsibility                                                           |
| ------------------ | ------------------------------------------------------------------------ |
| `getGuideDocument` | serve one exact packaged guide and record session read credit            |
| `captureFrame`     | produce and receipt an actual shot or asset PNG through the host adapter |
| `repaintShot`      | optionally derive and receipt a structure-preserving diffusion rendition |
| `inspectSubject`   | open one compiled subject from every planned viewpoint, outside delivery |
| `prepareReview`    | derive the current four-surface worksheet and evidence inventory         |
| `submitReview`     | validate and store a fresh verdict-last worksheet                        |

Every method of `AutoMovieApplication` is one tool and one delegating line. Its implementation lives in the service class or namespace function it names under `src/production`, so the class holds the contract a client reads and nothing else.

The server has no design setters, project switcher, compiler, status query, geometry query, renderer, or internal LLM. Coding agents edit tracked repository files. The scaffold and package APIs own compile, lint/status, geometry, rendering, verification, and migration.

## Host setup

```ts
import { createAutoMovieMcpServer } from "@automovie/mcp";

const server = createAutoMovieMcpServer({
  projectRoot: process.cwd(),
  productionId: "my-film",
  capture,
  repaint, // optional
});
```

`projectRoot` is a host seed, not a tool parameter. The server walks upward once to the nearest `automovie.config.ts` or `.automovie/manifest.json` and fixes that workspace for the session. `productionId` selects the default review namespace; shot evidence also names its production explicitly so one host can capture two sibling productions without cache pollution.

The only binary is:

```bash
npx -p @automovie/mcp automovie-mcp
```

Set `AUTOMOVIE_PROJECT_ROOT` and, for a multi-production repository, `AUTOMOVIE_PRODUCTION_ID` when the process working directory is not already inside the intended workspace.

## Knowledge gate

Every reflected method is present in `AUTOMOVIE_TOOL_GUIDES`, a `Record<keyof AutoMovieApplication, ...>`. Review calls add the exact target-specific guide from `AUTOMOVIE_REVIEW_GUIDES`. Calling a gated tool before its documents are read throws a plain recovery script containing the missing `getGuideDocument` calls and partial-credit count. It is deliberately not a schema validation error.

Start with:

```json
{ "name": "AUTOMOVIE_OVERALL" }
```

Then read the exact contract guides named by the tool refusal. `repaintShot`
always requires its contract guide, then dynamically requires
`DIFFUSION_ENHANCE` only after the selected production's typed
`visualDelivery` is `repainted`. Deterministic delivery returns a concrete
policy refusal without requesting diffusion knowledge. Repainted design
requires a non-optional feature deliverable; final review preflights the current
cut and selected clip presentation before delivery can be approved.

## Non-MCP runtime

Compilation and project inspection remain programmable without becoming model tools:

```ts
import {
  compileAutoMovieProduction,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/mcp";

const output = compileAutoMovieProduction({
  projectRoot: process.cwd(),
  productionId: "my-film",
  scope: "source",
});

const status = inspectAutoMovieProduction(
  openAutoMovieProduction({
    projectRoot: process.cwd(),
    productionId: "my-film",
  }),
);
```

`AutoMovieLegacyImporter` remains a non-MCP migration API while format-v1 projects still need an upgrade path.

## Evidence provenance

`captureFrame` resolves only ids in the current compiler-owned `manifests/compile.json`, delegates actual pixels to `AutoMovieProductionFrameCapture`, decodes the PNG, verifies dimensions and visible variance, and atomically commits a content-addressed render bundle and receipt.

`repaintShot` is unavailable unless the host injects `AutoMovieProductionShotRepaint`. It also requires a current completed deterministic `shot` review before any pixels leave for the adapter. Accepted MP4 output is parsed and committed with a receipt binding compiler, source-render, source-review, control, reference, adapter/model, parameter, and output identities. Review the active output through a separate `rendition` target; rerolling replaces only the active pointer and stales rendition/sequence/film review, not unchanged deterministic truth.

`prepareReview` and `submitReview` retain the four visual surfaces: asset, shot, sequence, and film. Repainted shot, sequence, and film worksheets additionally expose byte- and receipt-verified `renditions`; completion must cite one current rendition per addressed shot, and any reroll changes the review fingerprint. The reflected `submitReview` schema keeps `complete` last so evidence, checks, corrections, and completion basis are generated before the declaration.
