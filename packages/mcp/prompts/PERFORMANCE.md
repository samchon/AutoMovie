# Performance

`perform` is the micro layer: you emit high-level action verbs with parameters, and the engine synthesizes the dense per-frame motion from its deterministic primitives. You never hand-key frames in chat; the schema stays small and legible, and the richness comes from the engine (or, for motion no verb covers, from a clip you **compute with code** and `enact`).

## The Verb Vocabulary

`locomote` (walk a gait to a destination) · `gesture` (bow, nod, wave, crouch, kick..., including the arm-IK kinds `point` and `strike`, aimed at the `at` target) · `reach` (arm IK toward `to`) · `lookAt` (head aim) · `attachTo` (couple an object to a parent bone frame) · `launch` (a projectile, with engine-computed hit timing and injected reactions) · `react` (a flinch decomposed into the actor's frame) · `emote` (expression) · `hold` · `enact` (play a clip you authored; see below) · `frame` (the camera move: static, push-in, orbit, follow, whip). `point`/`strike` are gesture KINDS, not verbs. Emit `{ verb: "gesture", kind: "strike", at: ... }`.

## Enact: Clips You Compute

When no thin verb covers the motion (a sword kata, a stumble-and-recover, a character idiom), do not stretch `gesture custom` and hope: **write code that computes the keyframes** (parametric curves, phase composition, sampled solvers), pass the resulting motion in the perform call's `clips` registry, and reference it with `{ verb: "enact", clip: "<id>" }`. Never hand-write keyframe floats token by token; that is exactly the failure mode `enact` exists to avoid.

Enforcement is unchanged: the engine masks the clip to its region (default `fullBody`; narrow with `region`), layers it with disjoint-region actions, and ROM-gates the compiled composite. The actor needs a rig in its context (a rig-less enact is refused: an ungated dense clip would dodge the ROM shield), and the clip's `skeleton` must match that rig. Clips follow the derived-output rule below: they are never persisted, so re-supply them on every `perform`.

## Body Regions, and Which One Each Verb Drives

An action drives ONE body region, and the engine masks its clip to that region's bones so disjoint regions can layer. When `region` is omitted the verb's default applies, and a channel outside it is **refused**, not dropped: the shot fails with a `type` violation on that action's `region`, naming every bone the region does not carry. Set `region` to one that owns the content instead of diffing the compiled clip to discover what went missing.

| Region | Owns |
| --- | --- |
| `lowerBody` | `hips` + both leg chains (through the toes), and the root displacement that makes an actor travel |
| `upperBody` | `spine`/`chest`/`upperChest` + both arm chains + every finger |
| `head` | `neck`, `head`, both eyes, `jaw` |
| `face` | no bones at all: the expression channel only |
| `fullBody` | every bone, and the root |

| Verb | Default region |
| --- | --- |
| `locomote` | `lowerBody` |
| `gesture` | `upperBody`, except `nod`/`shake` (`head`) and `bow`/`crouch`/`kick`/`stagger`/`jump`/`draw` (`fullBody`) |
| `reach` | `upperBody` |
| `lookAt` | `head` |
| `emote` | `face` |
| `hold`, `enact`, `react`, `attachTo`, `launch` | `fullBody` |

The root and the expression are masked on the same rule as the bones. The expression always belongs to `face` alone, so any other region's clip loses it. The root is only contested when one actor's actions span several regions at once: then only the striding region (`lowerBody` or `fullBody`) keeps it, since two regions cannot both move the actor. An actor performing on a single region keeps whatever its clip carries.

**A retargeted non-biped is where this bites.** The humanoid bone enum is the only vocabulary, so a quadruped's FRONT legs ride the arm chains (`leftUpperArm`/`leftLowerArm`/`leftHand` and the right pair). A four-legged gait therefore reaches outside `locomote`'s `lowerBody` default: write `"region": "fullBody"` on that action, or the front legs are refused rather than frozen.

## Actor Contexts

Each performing actor needs a context: its gaits (JSON-safe: named easing only, no bezier tuples), staged position and facing, rest pose, and optionally its rig and rest frames. The server assembles the engine's default synthesizer from these, so the MCP contract stays JSON-only. An IK or physics verb without a rig synthesizes nothing.

In a **resident** project the registry itself stops travelling (#1176): a successful resident `perform` writes each context's beat-invariant half through as `actors/<node>.json`, so a later resident `perform` may omit `actors` entirely: the stored contexts are read back and their openings seeded per the Continuity section. `eraseActor` is the targeted removal; see the PROJECT_MEMORY guide's Actors section.

**Resident-or-explicit:** omit `script` AND `staged` together and the shot performs against the resident project's committed script and scene. The whole staged scene stops travelling per beat. Passing one without the other is refused. Staging mounts are not a committed slice, so a resident shot with a mounted rider re-declares them via the `mounts` parameter (an explicit staged set already carries its own; combining the two is refused).

A `locomote` action's `gait` is a free string matched by name against the gaits this context supplies: the vocabulary is the actor's own (a biped's `walk`/`run`/`sneak`, a horse's `trot`/`gallop`), not a fixed set. Naming a gait the actor did not supply fails the perform gate with a `type` violation rather than freezing silently, so give each actor the gaits its actions reference.

## Rules the Engine Enforces

- **One take, one live camera**: exactly one camera is elected per shot.
- **No overlapping camera moves**, and a `fullBody` action cannot layer with a partial-body action on the same span. Disjoint body regions (lower/upper/head) layer freely: a walk plus a wave plus a look compose without a bone claimed twice; overlapping regions blend by weight.
- **Reaches are not clamped.** An impossible reach fails the shot's ROM gate rather than being quietly bent into range. Reposition the actor, do not expect the engine to hide the miss.
- **A positional target may name any staged placement**: an actor, a set piece, or a **camera**. `lookAt`, `reach`, a `point`/`strike` gesture aim, a `launch` aim, and a frame subject or focus all resolve the same table, so "face the camera" is written `{ "kind": "node", "node": "<camera id>" }` and needs no invented point. The same table is what `stage`'s camera `lookAt`, `block`'s `camera.on` and `coverage[].on`, and the `measureDistance` / `getReach` queries resolve, so a subject one rung accepts is a subject every rung accepts. That does not make a camera an actor: a camera still acts only through `frame`, it is a place to point at, not a performer, and a `launch` carrying `onHit` must aim at a scene **node**, since nothing recoils a camera. A target that fails to resolve is refused by the **id** it named (or by the relative kind that names no place at all), so read the violation for the id, not for the discriminator.
- **The same table does not mean the same aim height.** Which ids resolve is one rule; where on the subject each verb aims is another, and it decides whether a ROM gate fires. See Aim Height below.
- Every compiled motion is ROM-checked (`validateMotion`); the launch compiler injects `react` actions timed to the engine-computed hit, so they share the same gate.

## Aim Height

Every positional verb resolves the same ids. WHERE on the subject each one aims is a separate, per-verb rule, because a node's placement is where the thing STANDS: for an actor that is the floor between its feet.

| Verb | Aims at | Why |
| --- | --- | --- |
| `lookAt` | the subject's **eyes**: an actor placement lifted by that actor's `eyeHeight` | a gaze meets a gaze. Without the lift two actors at conversational range both stare at the floor, and 1.6 m of eye height over 0.7 m of separation needs 66 degrees of head flexion against a 45 degree limit, so the shot is refused |
| `reach`, `point`, `strike` | the **placement** point | an arm does not reach for eyes, and no measured chest/hand height exists on the actor context to lift by. Author an explicit `point` target when you need a precise arm goal |
| `locomote` | the **placement** point | a destination is a place on the ground |
| `launch` | the **placement** point | the review pass measures a hit against the target's ground root, so aim and review agree |
| `frame`, a `coverage` angle | a **measured fraction of the subject's rig height**: mid-body for `wide`/`full`, 0.72 for `medium`, 0.85 for `close` | the framing grammar owns its own aim height and measures it from the rig |

Only actor ids move. A set piece, a prop, and a camera always resolve to their placement: a prop's origin is wherever staging put it, and a camera's translation is already its lens.

## Motions Are Derived, Not Stored

A `perform` returns the compiled `motions` alongside the shot; the shot itself keeps only motion **id references** (`performances[].motion`), never the clips. Those clips are the densest artifact and are purely derived (deterministically re-`perform`able from the resident script/scene/shot), so the project persists the shot, not the motion (the memory is the AST, not its regenerable output). A re-opened project re-derives motion by re-`perform`ing; it is never read back from a file.

Because of that, a **resident** `commitShot` whose shot references any motion must pass the `motions` registry those references resolve against. Otherwise it would store a dangling id. Omitting `motions` there is refused, not silently accepted. An explicit-slate `commitShot` stays a pure transform (references are yours to guarantee).

## A Shot Clip Animates Nodes

A shot's `objectMotions` and `cameraMotion` tracks address **node** channels: `{ "kind": "node", "node": "<scene node id>", "path": "translation" | "rotation" | "scale" | "weights" }`. That is what the renderer and the viewer apply, and a track addressing anything else is refused at `validateShot` / `commitShot` rather than accepted and dropped.

The keyframe payload is a glTF-style pair of flat arrays, and it is checked to the depth the sampler reads it: `times` strictly increases inside `[0, duration]`, `values` holds exactly `times.length x channel width` finite numbers (3 for `translation`/`scale`, 4 for `rotation`, whatever the model carries for `weights`, and for a pointer channel whatever its `valueType` fixes: 1 for `scalar`, 3 for `vec3`; times three for `cubicspline`, which stores in-tangent/value/out-tangent per keyframe), `interpolation` is `step`, `linear`, or `cubicspline`, and `loop` is a boolean. A payload that misses any of those is refused at `validateShot` / `commitShot` with the field named, never accepted and left to fail while the film is being played. **This applies to every clip a shot carries, `lightMotions` included.**

A `pointer` channel is refused on those two fields, and on a `coverage` take's move, for the same reason: nothing applies one there, so accepting it would hand you a clean validation for a film that never changes.

### A Light Changes Through `lightMotions`

The shot's `lightMotions` is the one field whose tracks address a **pointer** channel, because a light is not a scene node and no node channel can reach it (glTF has the same split: a node animation moves a light's placement, animating the light itself needs a pointer). Each clip is an ordinary clip, held to the same payload rules above; each track addresses one staged light by **id**:

```json
"lightMotions": [{ "id": "candleOut", "name": null, "duration": 3, "loop": false, "tracks": [{
  "channel": { "kind": "pointer", "pointer": "/lights/candleGlow/intensity", "valueType": "scalar" },
  "times": [0, 1.55, 1.6, 3], "values": [1.4, 1.4, 0.04, 0.04], "interpolation": "step" }] }]
```

| property | pointer | `valueType` | on which lights |
| --- | --- | --- | --- |
| intensity | `/lights/<id>/intensity` | `scalar` | every kind |
| colour | `/lights/<id>/color` | `vec3` (linear RGB) | every kind |
| range | `/lights/<id>/range` | `scalar` | `point`, `spot` |
| cone half-angle | `/lights/<id>/coneAngle` | `scalar` (degrees) | `spot` |

`/lights/0/intensity` is **not** the form: lights are addressed by their staged id, never by position. A pointer naming an unstaged light, a property its kind does not carry (a `range` on a `directional`), or a wrong `valueType` is refused with the path that carries it, and no two tracks in the whole field may drive the same light property, so the film's lighting is single-valued at every instant. Anything reading the committed artifacts evaluates the light at any frame from `scene.json` plus `shots/<beat>.json`; there is nothing to re-derive.

Two things to know before you write one. **`perform` does not emit `lightMotions`**: no verb means "light", so add the field to the shot `perform` returned and pass THAT shot to `validateShot` / `commitShot`. And the change **does not carry to the next beat**: continuity inherits placement and stride, not lighting, so a later beat opens on the light `commitScene` staged. A candle that must stay out restates it, e.g. a one-key `[0] -> [0.04]` track on that beat.

Still absent, and still worth saying rather than encoding: material properties (`/materials/2/baseColor`) and camera FOV. The pointer form is real for those too, but no applier resolves them yet, so they are refused everywhere on a shot.

## Continuity

Author the beat's opening from the previous beat's end state. In a **resident** `perform` this is automatic for placement and stride alike: an actor context that omits `position`/`facingDeg` inherits them from the previous beat's committed end-state (`commitBeatEnd`), so a walking character resumes exactly where it stopped.

The film's **first** beat has no predecessor and needs none: a first beat opens on the staged placement, so an omitted `position` comes from that node's committed transform and an omitted `facingDeg` from the same placement's rotation. You never restate what `commitScene` just stored. That seeds the first beat only; on a later beat the staged placement is where the film opened, not where the actor now stands, so inheriting it would teleport the actor back to the top of the film.

Explicit values always win over either seed. Three things are still refused rather than placed at an invented origin, each with its own remedy: an actor the committed scene does not place, on a beat with no predecessor (stage it with `commitScene`); a later beat whose predecessor's end was never committed (`commitBeatEnd`, the only case that hint fits); and an actor the committed end never recorded (pass the opening explicitly, it is entering mid-film).

An omitted `gaitPhase` likewise inherits the recorded cycle phase, so the walk resumes mid-stride instead of stuttering at every cut. A missing phase is never refused, it just starts the cycle at zero, and staging records no stride, so a first beat always starts there. What remains yours: respect the foot plants and mounts the end state (`getBeatEnd`) records.
