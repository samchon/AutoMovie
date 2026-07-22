# AutoMovie MCP Operating Guide

AutoMovie MCP is the deterministic gate for turning creative intent into a validated, renderable film. The engine computes and validates (poses, motion, physics plausibility, staging coherence), but it never decides what the film should be. You, the coding agent, are the orchestrator: you author intent, the engine enforces reality ("engine enforces, model creates"). The server blocks wrong order and names the next step, but it does not drive the loop for you.

Read this guide first. Before using a stage's tools, read the matching guide: `STAGING`, `BLOCKING`, `PERFORMANCE`, `FORGE`, `PROPS`, `REVIEW`, `PROJECT_MEMORY`, `RENDER_GUIDES`.

## Compact Gateway Calls

The default server advertises `getGuideDocument`, `openProject`, `nextSteps`,
and `execute`. The first three are called directly. Every other tool name in
this guide is an `execute` operation: call
`execute({ call: { operation: "stage", input: { script, staging } } })`, for
example, and read the original stage output at `result.output`. The operation's
input and output schemas are unchanged; the wrapper lets the shared film type
graph ship once instead of once per tool. If `nextSteps` names `commitScript`,
route it through `execute` the same way. The optional granular compatibility
server advertises the operation names directly, but the production ladder and
result semantics are identical.

## The Ladder

1. `openProject`: activate (or create) the project folder. The folder itself is the durable state: human-readable JSON slices plus registered assets. Call this first in resident mode.
2. `nextSteps`: ask the server what is missing and what to do next, any time. The same computation gates out-of-order commits, so asking first avoids thrown prerequisite errors.
3. `commitScript`: the script is the upstream truth: logline, theme, cast, beats. Committing a new script clears every downstream slice (scene, shots, beat ends, notes, film). In a resident project the cleared slices' files are removed.
4. `forge` / `forgeProp`: build stand-in rigs for `modelRef: null` cast members, and author props as data. `forge` persists nothing. It gates and returns the rigs. `forgeProp` gates and returns too, but in a resident project an accepted spec also writes through as `props/<node>.json` (`stored: true`), so a prop is forged once and later sessions read it instead of re-sending the spec (see `PROPS` / `PROJECT_MEMORY`).
5. `stage` → `commitScene`: place the cast, cameras, and lights; commit the staged scene.
6. `block` → `perform` → `commitShot`, per beat: gate the shot plan, compile the performance into motions and a shot, commit it.
7. `commitBeatEnd` / `commitNotes`: persist continuity handoffs and review notes per beat.
8. `cut` → `commitFilm`: assemble the shots into the sequence.
9. `planRender` / `seeFrame`: plan deterministic render output and capture frames (see `RENDER_GUIDES`).

The authoring payloads (`script`, `staging`, `blocking`, `performance`, `assemble`, `forge`) carry an **optional** `"type": "write"` discriminator. Every tool that takes one takes only the write arm, so the tool's own signature already fixes the value: omit it or supply it, whichever you prefer, and it is never the reason a call fails. A different literal is refused, and the commit tools take finished ARTIFACTS (`commitScript` takes a script, not a script write), which carry no discriminator at all: adding one there is an excess property and is refused.

Compute tools (`stage`, `block`, `perform`, `cut`, `forge`, `forgeProp`) are never gated by prerequisite order. All but `forgeProp` are pure functions of their explicit inputs; `forgeProp` is pure too, except that a resident success writes its spec through as noted above. Order is enforced only where state lives: resident commits.

## Result Semantics

Tool results are shaped for the tool, not forced into one top-level envelope.
Validation tools return `{ validation }` wrapping `IAutoMovieValidation`.
Compute tools wrap the engine verdict in a tool-specific result field: `stage` returns `staged`,
`block` returns `blocked`, `perform` returns `performed`, `cut` returns `cut`,
and `forge` / `forgeProp` return `forged` (with resident storage metadata when
needed). Render and resident mutation tools carry a sibling `validation` field
next to their payload (`plan`, `preview`, `slate`, `assets`, etc.).

The verdict field is the part that uses `{ success: true, ... }` or
`{ success: false, violations }`. Violations carry a `kind`, a field-located
`path` (`$input...`), and a `severity`:

- `error`: the artifact breaks integrity (a broken skeleton graph, an out-of-ROM joint, a dangling reference). Validation fails; fix the artifact and resubmit.
- `warning`: physical-plausibility advice (a planted foot skates, a foot passes through the ground, bodies interpenetrate or a limb self-intersects, a pose loses balance, a stacked object would topple, an unsupported body would fall). Validation still succeeds and the warnings ride along. A film may be deliberately unphysical: accept the suggested response, restage, or acknowledge with a `physicsIntent` marker on the action (e.g. `"moonwalk"`, `"wire-fu"`, `"defies-gravity"`, `"superhuman-impact"`) which suppresses the matching warnings on later rounds. Only an *impossible* fact is an error; an *implausible* one is a suppressible warning.

Never explain a violation away. Fix the owning artifact, or acknowledge it deliberately. Those are the only two honest moves.

## Correction Loop

For each stage: submit one coherent artifact → read the violations → fix exactly what they locate → resubmit. Prerequisite errors from resident commits are thrown with a "Do this next" list. Follow it literally. Validation tools (`validatePose`, `validateMotion`, `validateModel`, `validateScene`, `validateShot`, `validateSequence`) let you check an artifact before committing anything. When the committed script carries a refinement tree, `commitShot` stamps each violation with the screenplay `node` claiming the beat. The violation names where in the screenplay the correction belongs (see `REVIEW`).

## Surgical Corrections

Prefer the narrowest tool that fixes the fault (surgical, not a reset):

- Beat commits upsert: re-committing a beat replaces exactly that beat's shot or end-state and leaves sibling beats untouched. Fixing beat 7 never means resending beats 1–6.
- `eraseShot` / `eraseNotes`: remove ONE beat's shot (with its end-state and notes) or ONE beat's review notes. Both demand a `reason` and refuse a beat with nothing to erase.
- `setActorPerformance`: splice one actor's performance inside one committed shot. It removes that beat's end-state and review notes, then clears the film. Replacement-only: a NEW performer changes the shot's dramatic content and belongs to `perform` + `commitShot`.
- `setPlacement`: move one staged node without restaging the scene. Author its `transform.rotation` as **semantic Euler degrees** (`{x, y, z, order}`), never a raw quaternion, or omit it entirely for a move that only slides the node; the engine lowers the angles. It clears everything downstream exactly as `commitScene` would, because every committed shot was performed against the old world coordinates.

## The Face Has Two Resolutions

`emote`'s preset set is VRM 1.0's closed six, and it is the coarse handle. The fine one is the ARKit 52-channel overlay every keyframe `expression` carries, layered on top of the preset. When a beat asks for an emotion the six do not name (wary, suspicious, resigned, relieved rather than happy), author it on those channels through a clip and `enact`, rather than committing the nearest preset and calling it what the brief asked for. `PERFORMANCE` has the channel groups and a worked example.

## Geometry Before Guesswork

Never stage by hope. `getReach` answers two things and you need both: `reachable` says the target is inside the arm's shell (distance), and per arm `poseWithinRom` says whether the IK pose that lands there is one the joints can hold, with `romViolations` naming the axes that break it. A reach can be well inside the shell and still be a pose `perform` refuses, so read the second answer before you stage on the first. `measureDistance` measures the world; `getResolvedPose` shows where every bone actually is at a shot time. Measure, then stage. These geometry tools are resident-or-explicit: omit `scene`/`context` to read the active project. A reopened project resolves cast rest/ambient poses and reach from each actor's persisted rig (`actors/<node>.json`, written by resident `perform`). No re-commit needed. Motions stay session-only, so a query that samples a specific beat's compiled motion still needs that beat's `commitShot` in this session, or an explicit `context`. Do NOT re-run `commitScene` to recover a rig: it clears shots, beat ends, notes, and the film.
