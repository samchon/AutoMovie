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

| tool | in -> out | engine |
|------|-----------|--------|
| `getScript` | slate -> script slice or null | `readSlateContext` |
| `getScene` | slate -> staged scene slice or null | `readSlateContext` |
| `getShot` | slate + beat -> shot or null | `readSlateContext` |
| `getNotes` | slate + optional beat -> review notes | `readSlateContext` |
| `getBeatEnd` | slate + beat -> beat end-state or null | `readSlateContext` |
| `getResolvedPose` | geometry context + actor + time -> world-space bones or null | `sampleMotion` + `resolvePose` |
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
| `planRender` | slate + render spec -> frame schedule and ffmpeg args | `@automovie/render` planning |
| `seeFrame` | slate + render spec + frame/time -> preview frame placeholder | `@automovie/render` planning |
| `stage` | script + staging -> staged scene (or violations) | `stageScene` |
| `block` | script + staged scene + blocking -> blocked beat (or violations) | `blockBeat` |
| `perform` | script + staged scene + performance + actor contexts + optional blocking -> performed shot (or violations) | `performShot` |
| `cut` | assemble plan + performed shots -> cut sequence (or violations) | `cutSequence` |
| `forge` | script + forge spec -> generated cast models (or violations) | `forgeCast` |

The `get*` tools are read-only slate queries. They let an agent ask what has
already been committed before it writes the next stage, instead of reconstructing
state from memory.

Geometry query tools use a narrow context: staged scene nodes, model ids with
their skeletons, MCP-safe motions, and an optional shot. They do not require full
mesh or material payloads.

Validation tools are read-only guards for commit flows. They return the standard
`IAutoMovieValidation` envelope with field-located violations.

Commit tools are pure slate transforms: they take the current slate and a
candidate artifact, return a new slate only when preconditions and validation
pass, and otherwise return the unchanged slate with path-bearing violations.
Upstream replacements clear downstream slices that would become stale.

Render/see tools are placeholders for the capture pipeline. `planRender`
resolves a committed shot or film into deterministic frame times, frame paths,
and ffmpeg args; `seeFrame` resolves one preview frame. Neither tool writes
files or captures pixels yet.

`perform` keeps the MCP payload JSON-only. Clients provide per-actor motion
contexts (`gaits`, staged position/facing, rest pose, optional rig/rest frames);
the server builds the default deterministic synthesizer and rig lookup before it
calls `performShot`. Tuple-valued bezier fields are not part of the MCP
contract: gait limbs use named easing only, and returned keyframe bezier controls
come back as `{ x1, y1, x2, y2 }`.

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
