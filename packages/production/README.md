# `@automovie/production`

This package exposes production building, document binding, capture, inspection, and rendering APIs. Its stored-project runtime remains available to compatible callers and persists project state; it is not the execution workflow supplied by the blank scaffold. The scaffold's [ownership boundary](../template/scaffold/README.md#ownership) governs source-first productions and does not authorize that store. Nothing here listens on a socket, serves a document, or answers a model.

That is a deliberate boundary rather than an omission. What an authoring agent knows comes from the skill the project ships and from what this package refuses; a refusal names the invariant it enforces and the correction that owns it, and the agent reads the project to find the rest. A capability an agent cannot reach by reading the project and running its scripts does not exist.

## Stored-project compile and inspection

```ts
import {
  buildAutoMovieProduction,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/production";

const output = buildAutoMovieProduction({
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

For these stored-project entry points, `projectRoot` is a seed rather than an answer. The resolver walks upward to the nearest directory carrying both `package.json` and a root-level `lint.config.ts`. That is a compatibility layout, not the current scaffold's `src/lint.config.ts` layout. Do not add a root configuration or state directory to a source-first project to invoke this example. `productionId` selects the production inside a compatible store; capture also names that production explicitly.

## Reader editions

`AutoMovieProductionBinder` derives one deterministic Markdown edition from an authored document layer without changing its source. Construction remains the default API pass for compatibility. A final screenplay edition explicitly selects `pass: "final"`, reads `docs/final/screenplays`, and names the output with `final-screenplays`; no other authored layer accepts that pass. Call the binder API with the intended pass. The scaffold supplies no `book` command.

## Evidence provenance

Frame capture resolves only ids present in the current builder-owned `manifests/compile.json`, delegates the actual pixels to an `AutoMovieProductionFrameCapture` the project supplies, decodes the PNG, verifies dimensions and visible variance, and atomically commits a content-addressed render bundle and receipt. A turntable runs that same path once per view of the set an asset owes and answers with a per-view ledger, so the views a contract requires and the views that exist cannot drift apart.

Repaint is unavailable unless the caller passes an `AutoMovieProductionShotRepaint`. Accepted MP4 output is parsed and committed with a receipt binding builder, source-render, control, reference, adapter and model, parameter, and output identities. Rerolling replaces the active pointer only; unchanged deterministic truth keeps its own receipts.

Stored-project subject inspection likewise refuses without a supplied instrument. Its versioned plan and observation records bind production, exact target, compile, ordered plan, resolved pose, artifact bytes, actual browser-and-graphics runtime, terminal pass, and the non-delivery boundary. Readers reopen those records through duplicate-aware strict UTF-8 JSON admission and count only an exact current join; failed, unsupported, not-run, and runtime-unidentified attempts remain history. The scaffold supplies no inspection instrument; its [inspection procedure](../template/scaffold/.agents/skills/review-verification/inspection.md) owns source-first observation.

## Film effects

A film's effect track has two owners that must never overlap on one world zone: a shot-local cue realized inside that shot, and a film-global cue on the builder-owned timeline. The effect runtime itself lives in `@automovie/engine` so the browser viewer and this package run one implementation: the builder calls `materializeProductionFilmEffects` with the shot-owner intervals from `projectProductionShotEffectFilmIntervals`, and render planning calls `sampleProductionFilmEffects` at film-global timeline frames. `readAutoMovieFilmEffects` reopens the persisted runtime beside the timeline it was compiled with and refuses a population that `verifyProductionFilmEffectPopulation` rejects. Frame and pass-layer sampling (`sampleProductionRenderFrame`, `productionRenderLayersForPass`) also come from `@automovie/engine`; `planProductionRenderJob` slices chunks from that one global schedule.

Library builders receive verified precomputed inputs through `IAutoMovieLibraryBuildContext.derivedArtifacts`, keyed by output path. The builder checks the declared ledger, basis, output and external-asset collisions before source execution and includes those bytes in its publication freshness check. Generation remains an explicit authoring command; library compilation does not run generators.

For a complete precomputed contribution, export an `IAutoMovieLibraryDerivedSourceOwner` with `design` and `derivedArtifact` instead of `build`. The path selects a current UTF-8 ledger output containing an `IAutoMovieLibraryContribution`. The builder parses that artifact's exact bytes through the duplicate-aware structured JSON ingress outside authored execution, refusing malformed syntax, a leading byte order mark, or a member name repeated inside one object with the export, artifact, stage, byte offset and JSON Pointer, and then applies the same DTO, branch and spatial validation, attributing those refusals to the artifact path as well. Declaring both forms is refused; module evaluation and ordinary builders retain their one-second execution limit.

Call `retireAutoMovieDerivedArtifact({ root, output })` from an explicit project script when an obsolete output is no longer an active input. It removes only that ledger entry under the generation lock and preserves the resident output bytes. Source owners must adopt the replacement explicitly; retirement does not mark an old result current.

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
