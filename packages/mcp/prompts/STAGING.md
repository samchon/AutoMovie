# Staging

`stage` converts the script's cast into a placed scene: actor placements, cameras, lights, optional `set` pieces (the environment's geometry), and an optional `space` (the ground's meaning). Its gates are referential integrity: geometry is converted, never judged. Whether 0.7 m is striking range is your business, and you settle it by measuring, not hoping.

## Contract

- Every actor placement names a script cast node, and every cast member is placed. A placement for a stranger, or a missing member, violates. Set pieces are the opposite: their node ids are NEW (unique against cast/camera/light ids) and their `model` names a skeleton-less model, typically a forged prop.
- Ids are unique. A camera's `lookAt` and a mount's parent must exist; no self-mounts; the camera FOV must be valid.
- `facingDeg` becomes a rotation; a camera `lookAt` becomes a horizon-stable look rotation; a light lowers to the directional, point, or spot form its `type` names (see Light).
- The staged output carries `mounts[]`: persistent rider→parent-bone couplings that flow into beat-end continuity.

## Geometry First

Before staging an interaction, measure it:

- `measureDistance` between two placements tells you whether a strike, a hand-off, or a conversation distance is plausible. Either endpoint may be an actor, a set piece, or a **camera**: the geometry queries address every staged placement, the same table the performance stage resolves a target against.
- `getReach` tells you whether the actor's arm chain can reach the target from its placement, per arm, with the reach gap and the IK pose. It answers in two parts. `reachable` is the DISTANCE verdict, the arm's shell contains the target. `poseWithinRom` is whether the returned pose is one the joints can hold, and `romViolations` names the axes that break it, at the paths `perform` will report. Both matter: an arm can be long enough and still be asked for a pose the elbow cannot make. The solve keeps the elbow on its own hinge (its abduction and twist come back at exactly 0) and spends the shoulder's remaining freedom on staying inside the rig's ROM, so `poseWithinRom: false` now means the rig's declared ranges refused this placement rather than the solver having picked an awkward pose; restage, or widen the range you actually meant. A `pose` of `null` is the third answer: nothing could be solved, and `poseReason` says whether the target sits on the shoulder or the arm chain itself cannot bend (see FORGE, "Rest the Arms Out, Not Down").
- A strike staged at 3 m mimes at air. The engine will not stop you at staging time (coherence, not craft), but the performance's ROM gate and the reviewer will.

Geometry queries are resident-or-explicit. Pass `scene`/`context` for a stateless check, or omit them after `openProject`: `measureDistance` reads the committed scene from disk, while `getReach` and `getResolvedPose` use the model skeletons remembered from resident `commitScene`. `getResolvedPose({ beat })` also uses the compiled motions remembered from resident `commitShot`. Those skeleton/motion payloads are session memory, not project files; after reopening a project, measure distances directly, but re-run `commitScene`/`commitShot` in the session or pass explicit context for rig/motion queries.

## Set

The stage does not have to be a void. A `set` placement drops environment geometry (a floor slab, walls, a doorway, a backdrop) as static scene nodes realising skeleton-less models (`forgeProp`'s crude primitive proxies are exactly this shape). The point is the guide passes: depth/mask/outline of an empty stage give a diffusion pass no world to condition on, while even a crude box-room describes one. Set pieces never perform; a camera may `lookAt` one (an establishing frame on the doorway is legitimate), and it may `lookAt` another camera (a monitor, a mirror, a making-of angle). `facingDeg` is optional yaw: omit it for a floor or a centered backdrop. Remember `commitScene`'s models registry must resolve every staged model id, set models included.

Size the piece with `scale`, not with another forged model: a bare number scales all three axes, a vector scales each on its own (`{ x: 12, y: 1.8, z: 0.24 }` turns one unit box into a wall). Forge **one** box and place it as the wall, the step, and the table top. Every axis must be finite and greater than zero, since zero collapses the piece and a negative axis mirrors it into an inside-out normal pass.

## Light

A light placement lowers to the scene light its `type` names, so state the light's physics, not a label:

| `type` | needs | forbids | what it is |
| --- | --- | --- | --- |
| `directional` (default) | `direction` | `position`, `range`, `coneAngle` | an infinitely distant parallel source: the sun, a sky, a moon. No falloff. |
| `point` | `position` | `direction`, `coneAngle` | radiates every way from a place: a candle, a bulb, a fire. `range` in metres, `0` = infinite. |
| `spot` | `direction`, `position` | nothing | a cone from a place along an aim. `coneAngle` is the half-angle in degrees, `(0, 90]`, default `45`. |

`color` is a linear RGB triple in `[0, 1]` (`a: null` for a light); omit it for neutral white. A candle is a warm low-intensity `point` at the flame, a dawn is a cold `directional`, a practical lamp is a `point` inside the shade. A parameter the chosen kind cannot use is **refused**, not ignored, so a `coneAngle` on a point light is a violation rather than a silent drop.

`role` (`key`/`fill`/`rim`/`ambient`/`sun`) is optional annotation the lowering does not read. It used to be required and discarded; state the light through `type`/`color`/`position` instead.

There is no light animation: a scene's lights hold for the whole film, and a shot clip cannot address them (see PERFORMANCE, "A Shot Clip Animates Nodes"). If a beat needs the light to change, say so rather than encoding it.

## Camera

One take, one live camera (enforced at perform time). Place cameras where the blocking's framing intent needs them; the camera move itself is chosen per beat with the `frame` action. Framing distance follows the staged bearing: the director's chosen side is preserved, so stage the camera on the side you mean.

One beat can be covered by several staged cameras. Stage every angle you want (the hero side-on, an alternate close, a wide safety), then name the extra cameras in the blocking's `coverage`: each entry is an ordinary camera intent (framing/move/on) plus the staged camera that plays it. A coverage camera must be staged, named exactly once, and favour something placed. The shot schema carries the compiled alternates as `coverage` beside the singular hero `camera`/`cameraMotion`: structural guide metadata a render/diffusion host reads to cut between angles of the same performed beat. Coverage is intent, not a second election: the deterministic perform stage still elects one live camera per shot, and depth-of-field stays the diffusion pass's job.

## Space

Stage a `space` beside the actors and it is copied onto the composed scene: walkable surfaces (floors, platforms, ramps) and no-go regions. The scene then states its ground height, walkability, and support tops as data instead of assuming a flat plane, and the renderer draws those surfaces. Omit `space` and everything falls back to the flat ground plane. A `space` surface and a `set` piece are two halves of one thing: the surface is the walkable MEANING, the set model is the visible geometry. Pair them so the world the feet obey is the world the passes draw.

One caveat worth knowing: performed motion still plants feet on the flat plane. The surfaces answer height and support queries and they render, but the perform stage does not yet drive locomotion from them, so a ramp reads visually before it reads underfoot.

A surface is a **convex** XZ footprint (at least three non-collinear points, `y` ignored; write `0`) plus height anchors: `anchor` is the height everywhere on a flat patch, and a second `rampTo` anchor at a different `(x, z)` makes it a plane sloping from `anchor.y` to `rampTo.y`. `walkable` lists the surface ids an actor may cross; a surface left out is a standable-but-forbidden top (a table props rest on, not a step). A concave footprint is refused. The ground query would silently fill the notch. The renderer draws these surfaces as real meshes, so a staged floor reaches depth/mask/outline on its own; a set slab under it is optional dressing, not the ground.
