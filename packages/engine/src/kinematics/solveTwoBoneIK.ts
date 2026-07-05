/** The analytic solution for a two-bone chain reaching a goal. */
export interface ITwoBoneIK {
  /**
   * Interior angle at the mid joint (knee / elbow), degrees. `180` = straight,
   * smaller = more bent.
   */
  bend: number;
  /**
   * Angle to lift the upper segment off the straight root→goal line, degrees,
   * so the tip lands on the goal.
   */
  lift: number;
  /** True when the goal was unreachable and the distance was clamped. */
  clamped: boolean;
}

const acosDeg = (x: number): number =>
  (Math.acos(Math.min(1, Math.max(-1, x))) * 180) / Math.PI;

/**
 * Solve a two-bone IK chain (upper + lower segment) reaching toward a goal a
 * straight-line `distance` from the root — the closed-form, deterministic
 * **analytic IK** the engine references (the 80% case: arms, legs), no solver
 * iteration. Returns the mid-joint bend and the upper-segment lift via the law
 * of cosines; the caller orients the chain toward the goal and applies `bend`
 * to the knee/elbow and `lift` to the hip/shoulder.
 *
 * An unreachable goal (nearer than `|upper−lower|` or farther than
 * `upper+lower`) is clamped to the reachable shell and flagged, so the limb
 * fully folds or fully extends rather than producing NaN.
 *
 * @author Samchon
 */
export const solveTwoBoneIK = (
  upper: number,
  lower: number,
  distance: number,
): ITwoBoneIK => {
  validateSegmentLength("upper", upper);
  validateSegmentLength("lower", lower);
  validateDistance(distance);
  const min = Math.abs(upper - lower);
  const max = upper + lower;
  const clamped = distance < min || distance > max;
  const d = Math.min(Math.max(distance, min), max);
  const bend = acosDeg(
    (upper * upper + lower * lower - d * d) / (2 * upper * lower),
  );
  const lift =
    d === 0
      ? 0
      : acosDeg((upper * upper + d * d - lower * lower) / (2 * upper * d));
  return { bend, lift, clamped };
};

const validateSegmentLength = (
  label: "upper" | "lower",
  value: number,
): void => {
  if (!Number.isFinite(value))
    throw new Error(
      `two-bone IK ${label} length must be finite, but was ${value}`,
    );
  if (value <= 0)
    throw new Error(
      `two-bone IK ${label} length must be > 0, but was ${value}`,
    );
};

const validateDistance = (distance: number): void => {
  if (!Number.isFinite(distance))
    throw new Error(`two-bone IK distance must be finite, but was ${distance}`);
  if (distance < 0)
    throw new Error(
      `two-bone IK distance must be non-negative, but was ${distance}`,
    );
};
