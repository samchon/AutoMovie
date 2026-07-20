# Staging

`stage` converts the script's cast into a placed scene: actor placements, cameras, lights, optional `set` pieces (the environment's geometry), and an optional `space` (the ground's meaning). Its gates are referential integrity: geometry is converted, never judged. Whether 0.7 m is striking range is your business, and you settle it by measuring, not hoping.

## Contract

- Every actor placement names a script cast node, and every cast member is placed. A placement for a stranger, or a missing member, violates. Set pieces are the opposite: their node ids are NEW (unique against cast/camera/light ids) and their `model` names a skeleton-less model, typically a forged prop.
- Ids are unique. A camera's `lookAt` and a mount's parent must exist; no self-mounts; the camera FOV must be valid.
- `facingDeg` becomes a rotation; a camera `lookAt` becomes a horizon-stable look rotation; every light lowers to the staged form.
- The staged output carries `mounts[]`: persistent rider→parent-bone couplings that flow into beat-end continuity.

## Geometry First

Before staging an interaction, measure it:

- `measureDistance` between two placements tells you whether a strike, a hand-off, or a conversation distance is plausible. Either endpoint may be an actor, a set piece, or a **camera**: the geometry queries address every staged placement, the same table the performance stage resolves a target against.
- `getReach` tells you whether the actor's arm chain can actually reach the target from its placement, per arm, with the reach gap and the IK pose.
- A strike staged at 3 m mimes at air. The engine will not stop you at staging time (coherence, not craft), but the performance's ROM gate and the reviewer will.

Geometry queries are resident-or-explicit. Pass `scene`/`context` for a stateless check, or omit them after `openProject`: `measureDistance` reads the committed scene from disk, while `getReach` and `getResolvedPose` use the model skeletons remembered from resident `commitScene`. `getResolvedPose({ beat })` also uses the compiled motions remembered from resident `commitShot`. Those skeleton/motion payloads are session memory, not project files; after reopening a project, measure distances directly, but re-run `commitScene`/`commitShot` in the session or pass explicit context for rig/motion queries.

## Set

The stage does not have to be a void. A `set` placement drops environment geometry (a floor slab, walls, a doorway, a backdrop) as static scene nodes realising skeleton-less models (`forgeProp`'s crude primitive proxies are exactly this shape). The point is the guide passes: depth/mask/outline of an empty stage give a diffusion pass no world to condition on, while even a crude box-room describes one. Set pieces never perform; a camera may `lookAt` one (an establishing frame on the doorway is legitimate), and it may `lookAt` another camera (a monitor, a mirror, a making-of angle). `facingDeg` is optional yaw: omit it for a floor or a centered backdrop. Remember `commitScene`'s models registry must resolve every staged model id, set models included.

Size the piece with `scale`, not with another forged model: a bare number scales all three axes, a vector scales each on its own (`{ x: 12, y: 1.8, z: 0.24 }` turns one unit box into a wall). Forge **one** box and place it as the wall, the step, and the table top. Every axis must be finite and greater than zero, since zero collapses the piece and a negative axis mirrors it into an inside-out normal pass.

## Camera

One take, one live camera (enforced at perform time). Place cameras where the blocking's framing intent needs them; the camera move itself is chosen per beat with the `frame` action. Framing distance follows the staged bearing: the director's chosen side is preserved, so stage the camera on the side you mean.

One beat can be covered by several staged cameras. Stage every angle you want (the hero side-on, an alternate close, a wide safety), then name the extra cameras in the blocking's `coverage`: each entry is an ordinary camera intent (framing/move/on) plus the staged camera that plays it. A coverage camera must be staged, named exactly once, and favour something placed. The shot schema carries the compiled alternates as `coverage` beside the singular hero `camera`/`cameraMotion`: structural guide metadata a render/diffusion host reads to cut between angles of the same performed beat. Coverage is intent, not a second election: the deterministic perform stage still elects one live camera per shot, and depth-of-field stays the diffusion pass's job.

## Space

Stage a `space` beside the actors and it is copied onto the composed scene: walkable surfaces (floors, platforms, ramps) and no-go regions. The scene then states its ground height, walkability, and support tops as data instead of assuming a flat plane, and the renderer draws those surfaces. Omit `space` and everything falls back to the flat ground plane. A `space` surface and a `set` piece are two halves of one thing: the surface is the walkable MEANING, the set model is the visible geometry. Pair them so the world the feet obey is the world the passes draw.

One caveat worth knowing: performed motion still plants feet on the flat plane. The surfaces answer height and support queries and they render, but the perform stage does not yet drive locomotion from them, so a ramp reads visually before it reads underfoot.

A surface is a **convex** XZ footprint (at least three non-collinear points, `y` ignored; write `0`) plus height anchors: `anchor` is the height everywhere on a flat patch, and a second `rampTo` anchor at a different `(x, z)` makes it a plane sloping from `anchor.y` to `rampTo.y`. `walkable` lists the surface ids an actor may cross; a surface left out is a standable-but-forbidden top (a table props rest on, not a step). A concave footprint is refused. The ground query would silently fill the notch. The renderer draws these surfaces as real meshes, so a staged floor reaches depth/mask/outline on its own; a set slab under it is optional dressing, not the ground.
