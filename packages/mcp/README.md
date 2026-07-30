# `@automovie/mcp`

World-level `instanceSets` generalize the compact formation path for civilians,
vegetation, props, and debris. Compiler protocol v6 snapshots route geometry,
emits bounded regenerable chunks, exposes `context.engine.instanceSlot`, and
ships the same scale/palette/trait stream the viewer regenerates. Design lint
also validates typed model-profile traits and weapon data before source runs.

AutoMovie's deterministic motion-control engine, exposed as **Model Context
Protocol (MCP)** tools.

Instead of the repository hosting its own LLM orchestration, the engine is a
**tool surface an external agent drives** (Codex, Claude, any MCP client). The
agent supplies the structured creative intent; the engine computes the
deterministic result and returns it, including the placement / ROM violations
that make the **engine, not the model, the arbiter of physical truth** ("engine
enforces, model creates").

Every tool's JSON schema is derived at compile time via
`typia.llm.controller` (+ `@typia/mcp`), and calls are validated in and out.
The default compact server derives its execute union from
[`AutoMovieLegacyApplication`](./src/AutoMovieLegacyApplication.ts) through
[`AutoMovieGatewayApplication`](./src/AutoMovieGatewayApplication.ts); the
coding-agent production server derives its 16 direct tools from canonical
[`AutoMovieApplication`](./src/AutoMovieApplication.ts).

The MCP initialize handshake advertises `automovie` with the installed
`@automovie/mcp` package version. The server reads that version from its sibling
`package.json`, so client diagnostics identify the artifact actually serving
the tools; MCP protocol-version negotiation remains a separate SDK concern.

## Coding-agent production tools

`AutoMovieApplication` is the canonical coding-agent-first class, and
`automovie-mcp-production` is its opt-in comparison binary. It keeps
screenplay, shot builders, motion helpers, effects, and tests in ordinary files,
then uses MCP where structured calls are stronger than file authoring:
validated design, deterministic compilation, geometry facts, actual-frame
evidence, and a freshness-bound review ledger.

Every tool has one exported contract pair:
`method(props: IAutoMovieX.IProps): IAutoMovieX`. The namespace keeps input and
result discoverable as one unit while the domain types remain reusable by the
compiler and host adapters.

| tool | pair contract | purpose |
|------|---------------|---------|
| `getGuideDocument` | `IAutoMovieGetGuideDocument.IProps` → `IAutoMovieGetGuideDocument` | read the overall contract and one task-specific topic |
| `openProject` | `IAutoMovieOpenProject.IProps` → `IAutoMovieOpenProject` | open format-v2 production memory |
| `inspectProject` | `IAutoMovieInspectProject.IProps` → `IAutoMovieInspectProject` | inspect freshness, ownership, and blockers |
| `setProductionDesign` | `IAutoMovieSetProductionDesign.IProps` → `IAutoMovieSetProductionDesign` | record production-wide intent and deliverables |
| `setModelRecipe` | `IAutoMovieSetModelRecipe.IProps` → `IAutoMovieSetModelRecipe` | record a bounded primitive model recipe |
| `setWorldDesign` | `IAutoMovieSetWorldDesign.IProps` → `IAutoMovieSetWorldDesign` | record terrain and environment contracts |
| `setFormationDesign` | `IAutoMovieSetFormationDesign.IProps` → `IAutoMovieSetFormationDesign` | record a repeated-unit formation contract |
| `setShotContract` | `IAutoMovieSetShotContract.IProps` → `IAutoMovieSetShotContract` | bind one shot contract to TypeScript source |
| `setAcceptanceScenario` | `IAutoMovieSetAcceptanceScenario.IProps` → `IAutoMovieSetAcceptanceScenario` | record one observable acceptance criterion |
| `eraseDesignArtifact` | `IAutoMovieEraseDesignArtifact.IProps` → `IAutoMovieEraseDesignArtifact` | remove an artifact through dependency checks |
| `compileProject` | `IAutoMovieCompileProject.IProps` → `IAutoMovieCompileProject` | validate and deterministically lower source |
| `queryGeometry` | `IAutoMovieQueryGeometry.IProps` → `IAutoMovieQueryGeometry` | ask current numerical geometry questions |
| `previewFrame` | `IAutoMoviePreviewFrame.IProps` → `Promise<IAutoMoviePreviewFrame>` | capture a fingerprint-bound actual PNG |
| `prepareReview` | `IAutoMoviePrepareReview.IProps` → `IAutoMoviePrepareReview` | issue a current evidence worksheet |
| `submitReview` | `IAutoMovieSubmitReview.IProps` → `IAutoMovieSubmitReview` | validate checklist coverage and completion |

The coding agent owns `src`; the compiler owns `generated`. Every shot export
declares an `id` equal to the contract selected by its module path and named
export. The agent returns authored scene, sparse motion, shot choreography, and
event sample times. The compiler materializes primitive models, compact
formation runtimes, promoted hero nodes, and shots, then derives named-state,
event, camera, and formation outcomes from current compiled data instead of
accepting a source-authored compliance witness.

A declared `.automovie/assets.json` joins every distributable asset to its
current/original SHA-256, source, license, processing, and production use. The
compiler exposes only manifest-owned byte-exact paths to film source; referenced
assets without that ledger, changed bytes, incomplete rights, and external
models without ingest/LOD/collision/measurement decisions fail compilation.
`@automovie/ingest` remains a pure fixed-byte conversion layer.

A generated manifest binds source hashes, design hashes, compiler protocol and
version, and generated file hashes. Required review uses exact production-raster
frames and passing compiler-derived event or metric outcomes. Final delivery
requires a renderer-owned receipt and independently re-parses current PNG,
WebVTT, and MP4 bytes. A stale source, hand-edited generated file, stale render
manifest, metadata-only media claim, or review copied from another fingerprint
cannot pass the final compile gate. The server validates the evidence and state
transition; it does not call a second LLM or grade creative prose.

Render bundle v3 stores a canonical structured capture-runtime identity:
Playwright package, browser product/version/revision/source, executable digest
when available, platform, headless scale, requested backend, and actual WebGL
vendor/renderer. Arbitrary strings and legacy v2 manifests are not current
review evidence; the host must recapture them. Retained v2 history is a
target-scoped warning rather than a global error once current v3 evidence
exists.

The binary remains opt-in until a comparative external-agent benchmark
demonstrates that it should replace the compact default. The former
47-operation class is explicitly `AutoMovieLegacyApplication`; the compact and
granular binaries remain compatible during that experiment.

## Compact tools

The default server advertises four tools. Keeping the operating entry points
small and putting the shared film type graph in one `execute` schema avoids
repeating that graph for every operation, which keeps the surface usable in a
200k-context client.

| tool | purpose |
|------|---------|
| `getGuideDocument` | read `AUTOMOVIE_OVERALL` first, then the current stage guide |
| `openProject` | activate or create resident project memory |
| `nextSteps` | read ladder status, missing prerequisites, and next operations |
| `execute` | run one of the other 44 strictly typed operations |

An execution call has one wire shape:

```json
{
  "call": {
    "operation": "stage",
    "input": { "script": {}, "staging": {} }
  }
}
```

Its structured result is
`{ "result": { "operation": "stage", "output": { ... } } }`. The operation's
`input` and `output` are the same types the fine-grained application uses; the
gateway changes only how often their shared schema graph is advertised. Exact
input validation, explicit-slate mode, and resident mode are unchanged.

## Operations

Every stateful operation is **resident-or-explicit**: pass a `slate` for a pure
stateless call, or omit it to read/commit the resident project opened with
`openProject`. In the default server, names in this table other than the three
compact entry points are `execute.call.operation` values.

| tool | in -> out | engine |
|------|-----------|--------|
| `openProject` | root directory -> activated project summary | resident store (#614) |
| `nextSteps` | (resident) -> ladder status, missing prerequisites, next actions | prerequisite ladder |
| `registerAsset` | project-relative path -> asset index, or refusal | resident manifest |
| `getGuideDocument` | guide name -> authoring guide markdown | guide corpus |
| `getSlate` | slate -> whole writable slate (all slices + film) | resident store (#614) |
| `getScript` | slate -> script slice or null | `readSlateContext` |
| `getScene` | slate -> staged scene slice or null | `readSlateContext` |
| `getShot` | slate + beat -> shot or null | `readSlateContext` |
| `getNotes` | slate + optional beat -> review notes | `readSlateContext` |
| `getBeatEnd` | slate + beat -> beat end-state or null | `readSlateContext` |
| `getResolvedPose` | geometry context + actor + time -> world-space bones or null | `sampleMotion` + `resolvePose` |
| `getResolvedPropFrame` | resident beat + time -> resolved articulated-prop matrices and clamps | `resolveFrame` |
| `getShotEndState` | geometry context (or resident) + beat -> resumable beat end-state, or a reason | `resolveBeatEnd` |
| `getReach` | geometry context + actor + target -> arm reach report (shell distance AND the rig's ROM verdict) or null | `reachPose` + `validatePose` |
| `measureDistance` | scene + two targets -> distance report or null | `resolveTargetPoint` |
| `validatePose` | pose + skeleton -> validation | `validatePose` |
| `validateMotion` | MCP-safe motion + skeleton -> validation | `validateMotion` |
| `validateFootSkate` | MCP-safe motion + planted-foot windows -> validation | `validateFootSkate` |
| `validateGroundContact` | MCP-safe motion + scalar ground plane -> validation | `validateGroundContact` |
| `validateModel` | model -> validation | `validateModel` |
| `validateScene` | scene + model ids -> validation | MCP scene checks |
| `validateShot` | shot + scene + optional motions -> validation | MCP shot checks |
| `validateSequence` | sequence + shots -> validation | MCP sequence checks |
| `lintContinuity` | scene + ordered beats (shot + motions) -> cross-cut drift warnings | `validateFilmContinuity` |
| `commitScript` | slate + script -> updated slate or violations | MCP commit checks |
| `commitScene` | slate + scene + model ids -> updated slate or violations | MCP commit checks |
| `commitShot` | slate + shot + optional motions -> updated slate or violations | MCP commit checks |
| `commitBeatEnd` | slate + beat-end state -> updated slate or violations | MCP commit checks |
| `commitNotes` | slate + review notes -> updated slate or violations | MCP commit checks |
| `commitFilm` | slate + sequence -> updated slate or violations | MCP commit checks |
| `eraseShot` | (resident) beat + reason -> beat's shot/end/notes removed, film nulled, or refusal | resident erase checks |
| `eraseNotes` | (resident) beat + reason -> beat's notes removed, film nulled, or refusal | resident erase checks |
| `eraseProp` | (resident) node + reason -> stored prop spec removed, or refusal | resident erase checks |
| `eraseActor` | (resident) node + reason -> stored actor context removed, or refusal | resident erase checks |
| `setActorPerformance` | (resident) beat + actor performance + motions -> spliced shot, or refusal | resident set checks |
| `setPlacement` | (resident) node + Euler transform + reason -> moved node, downstream cleared, or refusal | resident set checks |
| `planRender` | slate + render spec (shared frameFormat 포함) -> frame schedule and ffmpeg args | `@automovie/render` planning |
| `planChunkedRender` | slate + render spec + chunkFrames -> frame-atomic chunk plans + reassembly | `@automovie/render` chunking |
| `planCaptions` | slate + shared frameFormat (+ chunkFrames) -> caption sidecar (+ chunk-aligned slices) | `planCaptionSidecar` |
| `planPoseKeypoints` | slate + shared frameFormat + motions + skeletons -> per-frame OpenPose keypoint sidecar | `planPoseKeypointSidecar` |
| `seeFrame` | slate + render spec + frame/time -> preview frame + optional captured image | `@automovie/render` planning + host capture |
| `stage` | script + staging (actors, cameras, directional/point/spot lights, set, space) -> staged scene (or violations) | `stageScene` |
| `block` | script + staged scene + blocking -> blocked beat (or violations) | `blockBeat` |
| `perform` | script + staged scene + performance + actor contexts + optional enacted clips + optional blocking -> performed shot (or violations); resident calls may omit script/staged/actors and read the project (#1176) | `performShot` |
| `cut` | assemble plan + performed shots -> cut sequence (or violations) | `cutSequence` |
| `forge` | script + forge spec -> generated cast models (or violations) | `forgeCast` |
| `forgeProp` | prop spec (model + optional articulation) -> accepted prop (or violations), stored when resident | `forgeProp` |

The `get*` tools are read-only slate queries. They let an agent ask what has
already been committed before it writes the next stage, instead of reconstructing
state from memory.

Geometry query tools use a narrow context: staged scene nodes, model ids with
their skeletons, MCP-safe motions, and an optional shot. They do not require full
mesh or material payloads.

Validation tools are read-only guards for commit flows. They return the standard
`IAutoMovieValidation` envelope with field-located violations.

Commit tools with an explicit `slate` are pure transforms: they take the
current slate and a candidate artifact, return a new slate only when
preconditions and validation pass, and otherwise return the unchanged slate
with path-bearing violations. Upstream replacements clear downstream slices
that would become stale (`commitShot` also drops the beat's end-state and
nulls the film; `commitBeatEnd`/`commitNotes` null the film).

## Resident project

`openProject(root)` activates a directory as the production's memory (#614):
slate slices live as human-readable JSON files (`script.json`,
`shots/<beat>.json`, ...), binary assets are tracked by the manifest
(`registerAsset`), and every `get*`/`commit*`/render tool may then omit its
`slate` to read from (and write through to) the project. Resident commits
are gated by the prerequisite ladder (script → scene → shots → beat
ends/notes/film): an out-of-order commit **throws** an actionable prompt
naming the missing rungs, and `nextSteps` returns the same computation as
data. The surgical tools (`eraseShot`/`eraseNotes`/`eraseProp`/`eraseActor`,
`setActorPerformance`/`setPlacement`) exist only in resident mode and demand a
`reason`. See the `PROJECT_MEMORY` guide for the write-through rules.

`AutoMovieLegacyImporter` is the explicit bridge from this resident v1 layout
to format-v2 production memory. `plan()` validates a temporary byte copy and
returns exact inventory, conservative design drafts, unrecoverable source TODOs,
and diagnostics without mutating the legacy root. `apply()` atomically records
that plan and provenance under `.automovie`; `rollback()` removes it only while
the imported state and any newly owned source/output directories remain
untouched. Planning refuses an active resident commit, applying holds the
resident revision lock across capture and publish, and rollback is
all-or-nothing while reserving both the project root and production state
namespace. Empty-directory topology is part of the rollback baseline. The CLI
exposes the same contract through `automovie migrate`.
If a legacy shot names no performing scene node, its draft does not pretend
that the camera is a readable scene subject; the plan leaves that subject list
unresolved and reports the exact reconstruction required before submission.

Long-running production delivery lives outside the request surface.
`planProductionRenderJob` turns the compiler-owned film timeline into
content-addressed feature and guide-pass chunks fenced by the compile input,
the film edit, and the exact capture/encoder identity.
`productionRenderChunkStatuses`, `verifyProductionRenderChunkReceipt` and
`runProductionRenderJob` resume, quarantine, or rerender one slot at a time
from byte and parser receipts alone. Host adapters can use
`readAutoMovieProductionOwnedFile` to reject traversal, linked ancestry, and
physical replacement while reading those resident bytes.
`AutoMovieProductionProject.commitProductionPublication` publishes every
deliverable byte, the aggregate manifest and its parser receipt under one
revision/input fence. `productionPublicationInputFingerprint` supplies the
terminal adapter with a canonical fence over compiler input, production
manifest and incarnation, compiler-owned bytes, and the live evidence-bound
review queue plus its current records.
Actual capture, encoding and muxing stay with the adapters the host injects;
the project CLI drives the whole sequence through `automovie render
plan|run|status|verify|finalize`.

Render/see tools plan deterministic output, and `seeFrame` can also use a
host-injected capture adapter. `planRender` resolves a committed shot or film
into deterministic frame times, frame paths, guide-pass paths, and ffmpeg args.
`seeFrame` resolves one preview frame and returns `status: "captured"` with an
image when the host adapter is attached, or `status: "no-capture-adapter"` when
it is not. The MCP server still does not write files or own the renderer; bytes
belong to the host adapter.

`perform` keeps the MCP payload JSON-only. Clients provide per-actor motion
contexts (`gaits`, staged position/facing, rest pose, optional rig/rest frames);
the server builds the default deterministic synthesizer and rig lookup before it
calls `performShot`. Tuple-valued bezier fields are not part of the MCP
contract: gait limbs use named easing only, and returned keyframe bezier controls
come back as `{ x1, y1, x2, y2 }`.

For motion no thin verb covers (a sword kata, a character idiom), `perform`
takes an **`enact`** action: **compute** the dense clip in code, pass it in
`perform`'s `clips` registry, and reference it by id. The engine still masks it
to its region, layers it with disjoint-region actions, and ROM-gates the
composite: the registry is no back door around the shield. Clips are derived
output, never persisted; re-supply them on each `perform`.

## Two ways to consume

MCP is the product boundary, but it is not the only door. The same deterministic
engine is directly linkable: import [`@automovie/engine`](../engine) and
`@automovie/interface` and program against the types: inject a custom
`IAutoMovieActionSynthesizer` into `performShot`, call `validateMotion`/ROM as
oracles, sample clips with `sampleMotion`/`sampleClip`. Use **MCP** for
orchestrated film state, transactions, and the guided correction loop; use
**direct linking** for code-native motion authoring and host integrations.
`enact` is the bridge: compute a clip either way, one engine enforces it. See
the [`@automovie/engine` README](../engine#소비-방식-두-갈래) and scaffold a
starter with `npx automovie start <dir>` ([`@automovie/cli`](../cli)).

## Run

```bash
# dev (in-workspace, transpiled by ttsx)
pnpm --filter @automovie/mcp start        # = ttsx src/bin.ts
pnpm --filter @automovie/mcp start:production # 16-tool coding-agent surface
pnpm --filter @automovie/mcp start:granular # 47-tool compatibility surface

# built (published): the bin runs the compiled server
npx @automovie/mcp                        # = node lib/bin.js
npx -p @automovie/mcp automovie-mcp-production # opt-in coding-agent surface
npx -p @automovie/mcp automovie-mcp-legacy # explicit compact compatibility name
npx -p @automovie/mcp automovie-mcp-granular # compatibility binary
```

## Configure an MCP client

```jsonc
{
  "mcpServers": {
    "automovie": {
      "command": "npx",
      "args": ["@automovie/mcp"]
    }
  }
}
```

For an in-repo checkout, point the command at the workspace runner instead
(`ttsx packages/mcp/src/bin.ts`).

The `automovie-mcp-granular` binary and `createAutoMovieGranularMcpServer`
retain the one-tool-per-operation surface for clients that already depend on
those wire names. It advertises the shared schema closure 47 times and can
exceed mainstream model context windows, so new external-client integrations
should use the compact default or join the production-surface experiment with
`automovie-mcp-production`.
