/**
 * The **combined swing half-angle** (degrees) of a flexion + abduction pair,
 * measured from the joint's neutral. Because flexion and abduction rotate about
 * orthogonal axes, the composed rotation's angle has the closed form
 *
 *     2 · acos( cos(flexion/2) · cos(abduction/2) )
 *
 * Which captures that simultaneous flexion and abduction reach _further_ than
 * either alone (90° flexion + 90° abduction → 120° of swing, not 90°). That
 * combined sweep is exactly what a per-axis `[min,max]` box cannot see, and
 * what an {@link IAutoMovieJointConstraint}'s `swingDeg` cone bounds for a ball
 * joint.
 *
 * Inputs are in degrees; the result is in degrees, always within `[0, 360)`.
 *
 * @author Samchon
 */
export const swingConeAngle = (flexion: number, abduction: number): number =>
  (Math.acos(
    Math.cos((flexion * Math.PI) / 360) * Math.cos((abduction * Math.PI) / 360),
  ) *
    360) /
  Math.PI;

/**
 * The largest blend `t` in `[0, 1]` along the segment from `(anchorFlexion,
 * anchorAbduction)` to `(flexion, abduction)` whose combined
 * {@link swingConeAngle} still fits within `swingDeg` — `1` when the pose
 * already fits, `0` when only the anchor does.
 *
 * Pulling toward `(0, 0)` — the anchor a box that brackets neutral yields — is
 * right only when the joint can actually reach neutral. For a per-bone override
 * whose flexion/abduction box EXCLUDES neutral (a limb that cannot fully
 * extend), shrinking toward the origin drops the axis below its own `min`, and
 * the clamped pose then fails {@link validateJointRom}'s box check (#1245).
 * Pulling toward a point the box contains keeps the result inside the box — the
 * segment between two box points stays in the box, which is convex — while the
 * bisection puts it inside the cone.
 *
 * The combined swing is monotonic along that segment but not linear, so there
 * is no closed form; this bisects and returns the lower bound, which always
 * sits INSIDE the cone rather than grazing its strict boundary.
 *
 * The caller must pass an anchor that is itself inside the cone;
 * `validateModel` rejects a constraint whose box and cone do not intersect,
 * which is exactly the condition that no such anchor exists.
 *
 * @author Samchon
 */
export const swingConeBlend = (
  flexion: number,
  abduction: number,
  anchorFlexion: number,
  anchorAbduction: number,
  swingDeg: number,
): number => {
  if (swingConeAngle(flexion, abduction) <= swingDeg) return 1;
  const at = (t: number): number =>
    swingConeAngle(
      anchorFlexion + (flexion - anchorFlexion) * t,
      anchorAbduction + (abduction - anchorAbduction) * t,
    );
  let lo = 0;
  let hi = 1;
  // A fixed iteration count, so the result is deterministic and replayable. The
  // lower bound always sits INSIDE the cone, so a clamped pose passes the cone
  // check rather than grazing its strict boundary.
  for (let i = 0; i < 40; ++i) {
    const mid = (lo + hi) / 2;
    if (at(mid) > swingDeg) hi = mid;
    else lo = mid;
  }
  return lo;
};
