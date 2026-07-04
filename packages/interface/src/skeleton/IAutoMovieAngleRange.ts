/**
 * A closed `[min, max]` interval of allowed rotation about one anatomical axis,
 * in degrees.
 *
 * This is the atom of automovie's anatomical range-of-motion (ROM) model. The
 * engine holds, per joint and per axis, one of these intervals (sourced from
 * clinical goniometry norms) and rejects any pose whose joint angle falls
 * outside it ??feeding the violation back into the harness as a `// ??
 * correction. That is how automovie makes "physically impossible poses are
 * structurally rejected" real, rather than hoping the LLM emits plausible
 * numbers.
 *
 * Sign convention is per-axis and documented on
 * {@link IautomovieJointConstraint}. `min <= max` is required; the engine treats
 * `min > max` as a malformed constraint.
 *
 * @author Samchon
 */
export interface IautomovieAngleRange {
  /** Lower bound, degrees (inclusive). */
  min: number;

  /** Upper bound, degrees (inclusive). */
  max: number;
}
