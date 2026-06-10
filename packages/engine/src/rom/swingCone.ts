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
 * what an {@link IAutoFilmJointConstraint}'s `swingDeg` cone bounds for a ball
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
 * The largest scale `k` in `[0, 1]` by which to shrink a flexion + abduction
 * pair (both multiplied by `k`, preserving their ratio — the swing direction)
 * so the combined {@link swingConeAngle} fits within `swingDeg`. Returns `1`
 * when the pair already fits.
 *
 * The combined swing is monotonic in `k` but not linear, so there is no
 * closed-form scale; this bisects (a fixed iteration count, so it is
 * deterministic and replayable) and returns the lower bound, which always sits
 * **inside** the cone — so a clamped pose passes {@link validateJointRom}'s cone
 * check rather than grazing its strict boundary.
 *
 * @author Samchon
 */
export const swingConeScale = (
  flexion: number,
  abduction: number,
  swingDeg: number,
): number => {
  if (swingConeAngle(flexion, abduction) <= swingDeg) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; ++i) {
    const mid = (lo + hi) / 2;
    if (swingConeAngle(flexion * mid, abduction * mid) > swingDeg) hi = mid;
    else lo = mid;
  }
  return lo;
};
