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
