# `@automovie/mcp`

AutoMovie's deterministic motion-control engine, exposed as **Model Context
Protocol (MCP)** tools.

Instead of the repository hosting its own LLM orchestration, the engine is a
**tool surface an external agent drives** (Codex, Claude, any MCP client). The
agent supplies the structured creative intent; the engine computes the
deterministic result and returns it, including the placement / ROM violations
that make the **engine, not the model, the arbiter of physical truth** ("engine
enforces, model creates").

Every tool's JSON schema is derived at compile time from
[`AutoMovieApplication`](./src/AutoMovieApplication.ts)'s method signatures and
JSDoc via `typia.llm.controller` (+ `@typia/mcp`), and calls are validated in and
out.

## Tools

40 tools. Every stateful tool is **resident-or-explicit**: pass a `slate` for a
pure stateless call, or omit it to read/commit the resident project opened with
`openProject`.

| tool | in -> out | engine |
|------|-----------|--------|
| `openProject` | root directory -> activated project summary | resident store (#614) |
| `nextSteps` | (resident) -> ladder status, missing prerequisites, next actions | prerequisite ladder |
| `registerAsset` | project-relative path -> asset index, or refusal | resident manifest |
| `getGuideDocument` | guide name -> authoring guide markdown | guide corpus |
| `getScript` | slate -> script slice or null | `readSlateContext` |
| `getScene` | slate -> staged scene slice or null | `readSlateContext` |
| `getShot` | slate + beat -> shot or null | `readSlateContext` |
| `getNotes` | slate + optional beat -> review notes | `readSlateContext` |
| `getBeatEnd` | slate + beat -> beat end-state or null | `readSlateContext` |
| `getResolvedPose` | geometry context + actor + time -> world-space bones or null | `sampleMotion` + `resolvePose` |
| `getShotEndState` | geometry context (or resident) + beat -> resumable beat end-state, or a reason | `resolveBeatEnd` |
| `getReach` | geometry context + actor + target -> arm reach report or null | `reachPose` |
| `measureDistance` | scene + two targets -> distance report or null | `resolveTargetPoint` |
| `validatePose` | pose + skeleton -> validation | `validatePose` |
| `validateMotion` | MCP-safe motion + skeleton -> validation | `validateMotion` |
| `validateModel` | model -> validation | `validateModel` |
| `validateScene` | scene + model ids -> validation | MCP scene checks |
| `validateShot` | shot + scene + optional motions -> validation | MCP shot checks |
| `validateSequence` | sequence + shots -> validation | MCP sequence checks |
| `commitScript` | slate + script -> updated slate or violations | MCP commit checks |
| `commitScene` | slate + scene + model ids -> updated slate or violations | MCP commit checks |
| `commitShot` | slate + shot + optional motions -> updated slate or violations | MCP commit checks |
| `commitBeatEnd` | slate + beat-end state -> updated slate or violations | MCP commit checks |
| `commitNotes` | slate + review notes -> updated slate or violations | MCP commit checks |
| `commitFilm` | slate + sequence -> updated slate or violations | MCP commit checks |
| `eraseShot` | (resident) beat + reason -> beat's shot/end/notes removed, film nulled, or refusal | resident erase checks |
| `eraseNotes` | (resident) beat + reason -> beat's notes removed, film nulled, or refusal | resident erase checks |
| `eraseProp` | (resident) node + reason -> stored prop spec removed, or refusal | resident erase checks |
| `setActorPerformance` | (resident) beat + actor performance + motions -> spliced shot, or refusal | resident set checks |
| `setPlacement` | (resident) node + Euler transform + reason -> moved node, downstream cleared, or refusal | resident set checks |
| `planRender` | slate + render spec -> frame schedule and ffmpeg args | `@automovie/render` planning |
| `planChunkedRender` | slate + render spec + chunkFrames -> frame-atomic chunk plans + reassembly | `@automovie/render` chunking |
| `planCaptions` | slate + fps (+ chunkFrames) -> caption sidecar (+ chunk-aligned slices) | `planCaptionSidecar` |
| `seeFrame` | slate + render spec + frame/time -> preview frame + optional captured image | `@automovie/render` planning + host capture |
| `stage` | script + staging -> staged scene (or violations) | `stageScene` |
| `block` | script + staged scene + blocking -> blocked beat (or violations) | `blockBeat` |
| `perform` | script + staged scene + performance + actor contexts + optional enacted clips + optional blocking -> performed shot (or violations) | `performShot` |
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
`slate` to read from — and write through to — the project. Resident commits
are gated by the prerequisite ladder (script → scene → shots → beat
ends/notes/film): an out-of-order commit **throws** an actionable prompt
naming the missing rungs, and `nextSteps` returns the same computation as
data. The surgical tools (`eraseShot`/`eraseNotes`/`eraseProp`,
`setActorPerformance`/`setPlacement`) exist only in resident mode and demand a
`reason`. See the `PROJECT_MEMORY` guide for the write-through rules.

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
composite — the registry is no back door around the shield. Clips are derived
output, never persisted; re-supply them on each `perform`.

## Two ways to consume

MCP is the product boundary, but it is not the only door. The same deterministic
engine is directly linkable: import [`@automovie/engine`](../engine) and
`@automovie/interface` and program against the types — inject a custom
`IAutoMovieActionSynthesizer` into `performShot`, call `validateMotion`/ROM as
oracles, sample clips with `sampleMotion`/`sampleClip`. Use **MCP** for
orchestrated film state, transactions, and the guided correction loop; use
**direct linking** for code-native motion authoring and host integrations.
`enact` is the bridge — compute a clip either way, one engine enforces it. See
the [`@automovie/engine` README](../engine#소비-방식-두-갈래) and scaffold a
starter with `npx autobe start <dir>` ([`autobe`](../cli)).

## Run

```bash
# dev (in-workspace, transpiled by ttsx)
pnpm --filter @automovie/mcp start        # = ttsx src/bin.ts

# built (published): the bin runs the compiled server
npx @automovie/mcp                        # = node lib/bin.js
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
