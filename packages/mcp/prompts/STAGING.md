# Staging

`stage` converts the script's cast into a placed scene: actor placements, cameras, lights. Its gates are referential integrity — geometry is converted, never judged. Whether 0.7 m is striking range is your business, and you settle it by measuring, not hoping.

## Contract

- Every placement names a script cast node, and every cast member is placed. A placement for a stranger, or a missing member, violates.
- Ids are unique. A camera's `lookAt` and a mount's parent must exist; no self-mounts; the camera FOV must be valid.
- `facingDeg` becomes a rotation; a camera `lookAt` becomes a horizon-stable look rotation; every light lowers to the staged form.
- The staged output carries `mounts[]` — persistent rider→parent-bone couplings that flow into beat-end continuity.

## Geometry First

Before staging an interaction, measure it:

- `measureDistance` between two placements tells you whether a strike, a hand-off, or a conversation distance is plausible.
- `getReach` tells you whether the actor's arm chain can actually reach the target from its placement — per arm, with the reach gap and the IK pose.
- A strike staged at 3 m mimes at air. The engine will not stop you at staging time (coherence, not craft), but the performance's ROM gate and the reviewer will.

## Camera

One take, one live camera (enforced at perform time). Place cameras where the blocking's framing intent needs them; the camera move itself is chosen per beat with the `frame` action. Framing distance follows the staged bearing — the director's chosen side is preserved, so stage the camera on the side you mean.

## Space

A scene may carry a `space` — walkable surfaces (floors, platforms, ramps) and no-go regions. Ground height then comes from the surfaces instead of a flat plane: locomotion follows ramps, feet plant on real heights, support contacts derive from surface tops. Omit `space` and everything falls back to the flat ground plane.
