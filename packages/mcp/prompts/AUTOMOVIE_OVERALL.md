# AutoMovie MCP Operating Guide

AutoMovie MCP is the deterministic gate for turning creative intent into a validated, renderable film. The engine computes and validates — poses, motion, physics plausibility, staging coherence — but it never decides what the film should be. You, the coding agent, are the orchestrator: you author intent, the engine enforces reality ("engine enforces, model creates"). The server blocks wrong order and names the next step, but it does not drive the loop for you.

Read this guide first. Before using a stage's tools, read the matching guide: `STAGING`, `BLOCKING`, `PERFORMANCE`, `REVIEW`, `PROPS`, `PROJECT_MEMORY`, `RENDER_GUIDES`.

## The Ladder

1. `openProject` — activate (or create) the project folder. The folder itself is the durable state: human-readable JSON slices plus registered assets. Call this first in resident mode.
2. `nextSteps` — ask the server what is missing and what to do next, any time. The same computation gates out-of-order commits, so asking first avoids thrown prerequisite errors.
3. `commitScript` — the script is the upstream truth: logline, theme, cast, beats. Committing a new script clears every downstream slice (scene, shots, beat ends, notes, film) — in a resident project the cleared slices' files are removed.
4. `forge` / `forgeProp` — build stand-in rigs for `modelRef: null` cast members, and author props as data. `forge` persists nothing — it gates and returns the rigs. `forgeProp` gates and returns too, but in a resident project an accepted spec also writes through as `props/<node>.json` (`stored: true`), so a prop is forged once and later sessions read it instead of re-sending the spec (see `PROPS` / `PROJECT_MEMORY`).
5. `stage` → `commitScene` — place the cast, cameras, and lights; commit the staged scene.
6. `block` → `perform` → `commitShot` — per beat: gate the shot plan, compile the performance into motions and a shot, commit it.
7. `commitBeatEnd` / `commitNotes` — persist continuity handoffs and review notes per beat.
8. `cut` → `commitFilm` — assemble the shots into the sequence.
9. `planRender` / `seeFrame` — plan deterministic render output and capture frames (see `RENDER_GUIDES`).

Compute tools (`stage`, `block`, `perform`, `cut`, `forge`, `forgeProp`) are never gated by prerequisite order. All but `forgeProp` are pure functions of their explicit inputs; `forgeProp` is pure too, except that a resident success writes its spec through as noted above. Order is enforced only where state lives: resident commits.

## Result Semantics

Every compute/validate tool returns `{ success: true, ... }` or `{ success: false, violations }`. Violations carry a `kind`, a field-located `path` (`$input...`), and a `severity`:

- `error` — the artifact breaks integrity (a broken skeleton graph, an out-of-ROM joint, a dangling reference). Validation fails; fix the artifact and resubmit.
- `warning` — physical-plausibility advice (a planted foot skates, a foot passes through the ground, bodies interpenetrate or a limb self-intersects, a pose loses balance, a stacked object would topple, an unsupported body would fall). Validation still succeeds and the warnings ride along. A film may be deliberately unphysical: accept the suggested response, restage, or acknowledge with a `physicsIntent` marker on the action (e.g. `"moonwalk"`, `"wire-fu"`, `"defies-gravity"`, `"superhuman-impact"`) which suppresses the matching warnings on later rounds. Only an *impossible* fact is an error; an *implausible* one is a suppressible warning (D015).

Never explain a violation away. Fix the owning artifact, or acknowledge it deliberately — those are the only two honest moves.

## Correction Loop

For each stage: submit one coherent artifact → read the violations → fix exactly what they locate → resubmit. Prerequisite errors from resident commits are thrown with a "Do this next" list — follow it literally. Validation tools (`validatePose`, `validateMotion`, `validateModel`, `validateScene`, `validateShot`, `validateSequence`) let you check an artifact before committing anything. When the committed script carries a refinement tree, `commitShot` stamps each violation with the screenplay `node` claiming the beat — the violation names where in the screenplay the correction belongs (see `REVIEW`).

## Surgical Corrections

Prefer the narrowest tool that fixes the fault — surgical, not a reset:

- Beat commits upsert: re-committing a beat replaces exactly that beat's shot or end-state and leaves sibling beats untouched. Fixing beat 7 never means resending beats 1–6.
- `eraseShot` / `eraseNotes` — remove ONE beat's shot (with its end-state and notes) or ONE beat's review notes. Both demand a `reason` and refuse a beat with nothing to erase.
- `setActorPerformance` — splice one actor's performance inside one committed shot. It removes that beat's end-state and review notes, then clears the film. Replacement-only: a NEW performer changes the shot's dramatic content and belongs to `perform` + `commitShot`.
- `setPlacement` — move one staged node without restaging the scene. Author its `transform.rotation` as **semantic Euler degrees** (`{x, y, z, order}`) — never a raw quaternion — or omit it entirely for a move that only slides the node; the engine lowers the angles. It clears everything downstream exactly as `commitScene` would, because every committed shot was performed against the old world coordinates.

## Geometry Before Guesswork

Never stage by hope. `getReach` tells you whether an actor's arms can reach a target; `measureDistance` measures the world; `getResolvedPose` shows where every bone actually is at a shot time. Measure, then stage. These geometry tools are resident-or-explicit: omit `scene`/`context` to read the active project, with rig/motion queries using the session-only payloads remembered from resident `commitScene`/`commitShot`; after reopening, pass explicit context or re-run those commits before asking for rigged pose/reach.
