# `@automovie/production`

The deterministic production runtime a generated AutoMovie project runs on: the compiler, the tracked project store, frame capture, subject inspection, and the render job. A project's own npm scripts call it. Nothing here listens on a socket, serves a document, or answers a model.

That is a deliberate boundary rather than an omission. What an authoring agent knows comes from the skill the project ships and from what this package refuses; a refusal names the invariant it enforces and the correction that owns it, and the agent reads the project to find the rest. A capability an agent cannot reach by reading the project and running its scripts does not exist.

## Compile and inspect

```ts
import {
  compileAutoMovieProduction,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/production";

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

`projectRoot` is a seed rather than an answer. Every entry point walks upward once to the nearest `automovie.config.ts` or `automovie/manifest.json` and fixes that workspace for the call. `productionId` selects which production inside it; capture also names its production explicitly, so one process can serve two sibling productions without cache pollution.

## Evidence provenance

Frame capture resolves only ids present in the current compiler-owned `manifests/compile.json`, delegates the actual pixels to an `AutoMovieProductionFrameCapture` the project supplies, decodes the PNG, verifies dimensions and visible variance, and atomically commits a content-addressed render bundle and receipt. A turntable runs that same path once per view of the set an asset owes and answers with a per-view ledger, so the views a contract requires and the views that exist cannot drift apart.

Repaint is unavailable unless the caller passes an `AutoMovieProductionShotRepaint`. Accepted MP4 output is parsed and committed with a receipt binding compiler, source-render, control, reference, adapter and model, parameter, and output identities. Rerolling replaces the active pointer only; unchanged deterministic truth keeps its own receipts.

Subject inspection is the same shape: without an instrument the call refuses rather than answering, because AutoMovie does not report an observation nobody drew. The scaffold ships one at `scripts/inspectSubject.ts`.

## Migration

`AutoMovieLegacyImporter` remains the upgrade path while format-v1 projects still need one. It plans against a copy, applies one atomic state root beside the untouched legacy bytes, and refuses a rollback once the imported project has been worked in.
