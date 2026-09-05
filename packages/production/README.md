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

`projectRoot` is a seed rather than an answer. Every entry point walks upward once to the nearest directory carrying both `package.json` and `lint.config.ts`, which is what a generated project already has, and fixes that workspace for the call. Requiring both is what keeps a seed inside an ordinary Node package from resolving to that package; the legacy `automovie/manifest.json` is no longer a marker, because import input is not a shape a current project is asked to carry, and `automovie.config.ts` is no longer one because the delivery decisions it carried moved onto the production design record. `productionId` selects which production inside it; capture also names its production explicitly, so one process can serve two sibling productions without cache pollution.

## Evidence provenance

Frame capture resolves only ids present in the current compiler-owned `manifests/compile.json`, delegates the actual pixels to an `AutoMovieProductionFrameCapture` the project supplies, decodes the PNG, verifies dimensions and visible variance, and atomically commits a content-addressed render bundle and receipt. A turntable runs that same path once per view of the set an asset owes and answers with a per-view ledger, so the views a contract requires and the views that exist cannot drift apart.

Repaint is unavailable unless the caller passes an `AutoMovieProductionShotRepaint`. Accepted MP4 output is parsed and committed with a receipt binding compiler, source-render, control, reference, adapter and model, parameter, and output identities. Rerolling replaces the active pointer only; unchanged deterministic truth keeps its own receipts.

Subject inspection is the same shape: without an instrument the call refuses rather than answering, because AutoMovie does not report an observation nobody drew.
The scaffold ships one at `scripts/inspectSubject.ts`.
Its versioned plan and observation records bind production, exact target, compile, ordered plan, resolved pose, artifact bytes, actual browser-and-graphics runtime, terminal pass, and the non-delivery boundary.
Readers reopen those records through duplicate-aware strict UTF-8 JSON admission and count only an exact current join; failed, unsupported, not-run, and runtime-unidentified attempts remain history.

## Film effects

A film's effect track has two owners that must never overlap on one world zone: a shot-local cue realized inside that shot, and a film-global cue on the compiler-owned timeline. `materializeProductionFilmEffects` joins the normalized film cues to the current world recipes and zones and refuses a film cue that overlaps a shot cue, or another film cue, on the same zone, naming both cue ids and the overlapping frames. `projectProductionShotEffectFilmIntervals` supplies the shot-owner intervals for that check by the exact rational frame boundary rather than a rounded `seconds * fps` product. `sampleProductionFilmEffects` reconstructs any film-global `timelineFrame` from the persisted runtime alone, so a proxy tier's output index is never mistaken for the film clock and repeated or reordered seeks return the same sample. `readAutoMovieFilmEffects` reopens the persisted runtime beside the timeline it was compiled with and `verifyProductionFilmEffectPopulation` refuses a population that drops, adds, retimes, re-zones, or re-weights any accepted cue. `productionFilmFrameForShotTime` gives a shot page the one film frame that owns a shot-local second, or null when the edit realizes that second never or more than once.

A generated library passes its single graph-derived authoring snapshot into the compiler at `review` and `final`. `readAutoMovieLibraryReviewRequirements` exposes the exact active branch, H2 owner, source, compile, and finite-plan identities to its offline observation commands. The compiler derives the same population again, reopens artifact bytes or canonical structured facts, and refuses stale or inconclusive receipts. Film and brief keep their compiled-consumer population, so an unused recipe is still not charged merely because it exists.

## Reviewed public utility callables

These utilities are public for generated-project scripts and diagnostic clients;
they are not test-only helpers.

| Callable | Direct consumer purpose |
|---|---|
| `decodeAutoMoviePathSegment` | Decodes one canonical project-path segment without accepting traversal. |
| `listAutoMovieDiagnosticCatalog` | Lists the stable diagnostic catalog used by offline project tooling. |
| `findAutoMovieDiagnosticCatalogEntry` | Resolves one diagnostic code to its remediation contract. |
| `assertProductionFeatureUsesRenditionVideo` | Refuses production features that bypass the canonical rendition video. |
| `assertProductionRenderDialogueRuntimeIdentity` | Refuses a capture whose final-byte dialogue generation differs from the versioned render plan. |
| `productionRenderPublicationIdentity` | Projects an exact final or proxy render plan into a structured, independently recomputable publication identity. |
| `parseProductionRenderPublicationIdentity` | Strictly parses and recomputes stored publication provenance before reuse. |
| `assertProductionRenderPublicationCurrent` | Compares stored provenance with the current same-tier render plan. |
| `parseProductionRenderManifestBytes` / `parseProductionRenderReceiptBytes` | Admit the persisted render manifest and renderer receipt through strict structured JSON ingress and their versioned schemas. |
| `assertProductionRenderManifestRecord` / `assertProductionRenderReceiptRecord` | Admit an already materialized manifest or receipt value, naming only schema paths in a refusal. |
| `captureProductionPayloadSnapshot` | Captures exact retained or terminal payload bytes for guarded publication. |
| `isProductionPayloadSnapshotCurrent` | Detects deletion, replacement, or in-place byte mutation across a publication transaction. |
| `readAutoMovieSubjectInspection` | Reads and validates one committed subject-inspection receipt. |
| `compareAutoMovieVisualRevisions` | Compares two visual-revision receipts for review tooling. |
| `decodeAutoMovieProjectRevision` / `advanceAutoMovieProjectRevision` | Validate the one non-negative safe-integer revision domain and compute an exact successor before mutation. |
| `currentAutoMovieLocalProcessOwner` / `observeAutoMovieLocalProcessOwner` | Persist a per-process generation and distinguish absence from PID occupancy, reuse, remote hosts, and unavailable observations. |
| `planProductionRenderGc` | Produces deterministic retain, remove, quarantine, and manual-adjudication sets without treating an unreadable render generation as absent or stale. |

## Migration

`AutoMovieLegacyImporter` remains the upgrade path while format-v1 projects still need one. It plans against a copy, applies one atomic state root beside the untouched legacy bytes, and refuses a rollback once the imported project has been worked in.
