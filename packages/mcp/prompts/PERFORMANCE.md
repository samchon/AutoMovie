# Performance

`perform` is the micro layer: you emit high-level action verbs with parameters, and the engine synthesizes the dense per-frame motion from its deterministic primitives. You never hand-key frames; the schema stays small and legible, and the richness comes from the engine.

## The Verb Vocabulary

`locomote` (walk a gait to a destination) · `gesture` (bow, nod, wave, crouch, kick...) · `reach` / `point` / `strike` (arm IK toward a target) · `lookAt` (head aim) · `attachTo` (couple an object to a parent bone frame) · `launch` (a projectile, with engine-computed hit timing and injected reactions) · `react` (a flinch decomposed into the actor's frame) · `emote` (expression) · `hold` · `frame` (the camera move: static, push-in, orbit, follow, whip).

## Actor Contexts

Each performing actor needs a context: its gaits (JSON-safe — named easing only, no bezier tuples), staged position and facing, rest pose, and optionally its rig and rest frames. The server assembles the engine's default synthesizer from these, so the MCP contract stays JSON-only. An IK or physics verb without a rig synthesizes nothing.

## Rules the Engine Enforces

- **One take, one live camera** — exactly one camera is elected per shot.
- **No overlapping camera moves**, and a `fullBody` action cannot layer with a partial-body action on the same span. Disjoint body regions (lower/upper/head) layer freely — a walk plus a wave plus a look compose without a bone claimed twice; overlapping regions blend by weight.
- **Reaches are not clamped.** An impossible reach fails the shot's ROM gate rather than being quietly bent into range — reposition the actor, do not expect the engine to hide the miss.
- Every compiled motion is ROM-checked (`validateMotion`); the launch compiler injects `react` actions timed to the engine-computed hit, so they share the same gate.

## Continuity

Author the beat's opening from the previous beat's end state (`getBeatEnd`): seed positions and facing from the recorded transforms, and keep looping gaits phase-continuous rather than restarting them. The end state also carries foot plants and mounts — respect them.
