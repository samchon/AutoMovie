# Performance

`perform` is the micro layer: you emit high-level action verbs with parameters, and the engine synthesizes the dense per-frame motion from its deterministic primitives. You never hand-key frames in chat; the schema stays small and legible, and the richness comes from the engine — or, for motion no verb covers, from a clip you **compute with code** and `enact`.

## The Verb Vocabulary

`locomote` (walk a gait to a destination) · `gesture` (bow, nod, wave, crouch, kick... — including the arm-IK kinds `point` and `strike`, aimed at the `at` target) · `reach` (arm IK toward `to`) · `lookAt` (head aim) · `attachTo` (couple an object to a parent bone frame) · `launch` (a projectile, with engine-computed hit timing and injected reactions) · `react` (a flinch decomposed into the actor's frame) · `emote` (expression) · `hold` · `enact` (play a clip you authored — see below) · `frame` (the camera move: static, push-in, orbit, follow, whip). `point`/`strike` are gesture KINDS, not verbs — emit `{ verb: "gesture", kind: "strike", at: ... }`.

## Enact: Clips You Compute

When no thin verb covers the motion (a sword kata, a stumble-and-recover, a character idiom), do not stretch `gesture custom` and hope — **write code that computes the keyframes** (parametric curves, phase composition, sampled solvers), pass the resulting motion in the perform call's `clips` registry, and reference it with `{ verb: "enact", clip: "<id>" }`. Never hand-write keyframe floats token by token; that is exactly the failure mode `enact` exists to avoid.

Enforcement is unchanged: the engine masks the clip to its region (default `fullBody`; narrow with `region`), layers it with disjoint-region actions, and ROM-gates the compiled composite. The actor needs a rig in its context (a rig-less enact is refused — an ungated dense clip would dodge the ROM shield), and the clip's `skeleton` must match that rig. Clips follow the derived-output rule below: they are never persisted, so re-supply them on every `perform`.

## Actor Contexts

Each performing actor needs a context: its gaits (JSON-safe — named easing only, no bezier tuples), staged position and facing, rest pose, and optionally its rig and rest frames. The server assembles the engine's default synthesizer from these, so the MCP contract stays JSON-only. An IK or physics verb without a rig synthesizes nothing.

In a **resident** project the registry itself stops travelling (#1176): a successful resident `perform` writes each context's beat-invariant half through as `actors/<node>.json`, so a later resident `perform` may omit `actors` entirely — the stored contexts are read back and their openings seeded per the Continuity section. `eraseActor` is the targeted removal; see the PROJECT_MEMORY guide's Actors section.

**Resident-or-explicit:** omit `script` AND `staged` together and the shot performs against the resident project's committed script and scene — the whole staged scene stops travelling per beat. Passing one without the other is refused. Staging mounts are not a committed slice, so a resident shot with a mounted rider re-declares them via the `mounts` parameter (an explicit staged set already carries its own; combining the two is refused).

A `locomote` action's `gait` is a free string matched by name against the gaits this context supplies — the vocabulary is the actor's own (a biped's `walk`/`run`/`sneak`, a horse's `trot`/`gallop`), not a fixed set. Naming a gait the actor did not supply fails the perform gate with a `type` violation rather than freezing silently, so give each actor the gaits its actions reference.

## Rules the Engine Enforces

- **One take, one live camera** — exactly one camera is elected per shot.
- **No overlapping camera moves**, and a `fullBody` action cannot layer with a partial-body action on the same span. Disjoint body regions (lower/upper/head) layer freely — a walk plus a wave plus a look compose without a bone claimed twice; overlapping regions blend by weight.
- **Reaches are not clamped.** An impossible reach fails the shot's ROM gate rather than being quietly bent into range — reposition the actor, do not expect the engine to hide the miss.
- Every compiled motion is ROM-checked (`validateMotion`); the launch compiler injects `react` actions timed to the engine-computed hit, so they share the same gate.

## Motions Are Derived, Not Stored

A `perform` returns the compiled `motions` alongside the shot; the shot itself keeps only motion **id references** (`performances[].motion`), never the clips. Those clips are the densest artifact and are purely derived — deterministically re-`perform`able from the resident script/scene/shot — so the project persists the shot, not the motion (the memory is the AST, not its regenerable output). A re-opened project re-derives motion by re-`perform`ing; it is never read back from a file.

Because of that, a **resident** `commitShot` whose shot references any motion must pass the `motions` registry those references resolve against — otherwise it would store a dangling id. Omitting `motions` there is refused, not silently accepted. An explicit-slate `commitShot` stays a pure transform (references are yours to guarantee).

## Continuity

Author the beat's opening from the previous beat's end state. In a **resident** `perform` this is automatic for placement and stride alike: an actor context that omits `position`/`facingDeg` inherits them from the previous beat's committed end-state (`commitBeatEnd`), so a walking character resumes exactly where it stopped — explicit values always win, and a beat with nothing to inherit (a first beat, an uncommitted predecessor) is refused rather than silently placed at the origin. An omitted `gaitPhase` likewise inherits the recorded cycle phase, so the walk resumes mid-stride instead of stuttering at every cut — a missing phase is never refused, it just starts the cycle at zero. What remains yours: respect the foot plants and mounts the end state (`getBeatEnd`) records.
