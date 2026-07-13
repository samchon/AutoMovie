# Staging

`stage` converts the script's cast into a placed scene: actor placements, cameras, lights, and optional `set` pieces (the environment). Its gates are referential integrity — geometry is converted, never judged. Whether 0.7 m is striking range is your business, and you settle it by measuring, not hoping.

## Contract

- Every actor placement names a script cast node, and every cast member is placed. A placement for a stranger, or a missing member, violates. Set pieces are the opposite: their node ids are NEW (unique against cast/camera/light ids) and their `model` names a skeleton-less model — typically a forged prop.
- Ids are unique. A camera's `lookAt` and a mount's parent must exist; no self-mounts; the camera FOV must be valid.
- `facingDeg` becomes a rotation; a camera `lookAt` becomes a horizon-stable look rotation; every light lowers to the staged form.
- The staged output carries `mounts[]` — persistent rider→parent-bone couplings that flow into beat-end continuity.

## Geometry First

Before staging an interaction, measure it:

- `measureDistance` between two placements tells you whether a strike, a hand-off, or a conversation distance is plausible.
- `getReach` tells you whether the actor's arm chain can actually reach the target from its placement — per arm, with the reach gap and the IK pose.
- A strike staged at 3 m mimes at air. The engine will not stop you at staging time (coherence, not craft), but the performance's ROM gate and the reviewer will.

Geometry queries are resident-or-explicit. Pass `scene`/`context` for a stateless check, or omit them after `openProject`: `measureDistance` reads the committed scene from disk, while `getReach` and `getResolvedPose` use the model skeletons remembered from resident `commitScene`. `getResolvedPose({ beat })` also uses the compiled motions remembered from resident `commitShot`. Those skeleton/motion payloads are session memory, not project files; after reopening a project, measure distances directly, but re-run `commitScene`/`commitShot` in the session or pass explicit context for rig/motion queries.

## Set

The stage does not have to be a void. A `set` placement drops environment geometry — a floor slab, walls, a doorway, a backdrop — as static scene nodes realising skeleton-less models (`forgeProp`'s crude primitive proxies are exactly this shape). The point is the guide passes: depth/mask/outline of an empty stage give a diffusion pass no world to condition on, while even a crude box-room describes one. Set pieces never perform; a camera may `lookAt` one (an establishing frame on the doorway is legitimate). `facingDeg` is optional yaw — omit it for a floor or a centered backdrop. Remember `commitScene`'s models registry must resolve every staged model id, set models included.

## Camera

One take, one live camera (enforced at perform time). Place cameras where the blocking's framing intent needs them; the camera move itself is chosen per beat with the `frame` action. Framing distance follows the staged bearing — the director's chosen side is preserved, so stage the camera on the side you mean.

## Space

A scene may carry a `space` — walkable surfaces (floors, platforms, ramps) and no-go regions. Ground height then comes from the surfaces instead of a flat plane: locomotion follows ramps, feet plant on real heights, support contacts derive from surface tops. Omit `space` and everything falls back to the flat ground plane. A `space` surface and a `set` floor piece are two halves of one thing: the surface is the walkable MEANING, the set model is the visible geometry — pair them so the world the feet obey is the world the passes draw.
