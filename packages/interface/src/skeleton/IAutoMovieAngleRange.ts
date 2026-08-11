/**
 * A closed `[min, max]` interval of allowed rotation about one anatomical axis,
 * in degrees.
 *
 * This is the atom of automovie's anatomical range-of-motion (ROM) model. The
 * engine holds, per joint and per axis, one of these intervals (sourced from
 * clinical goniometry norms) and rejects any pose whose joint angle falls
 * outside it, feeding the violation back into the harness as a `// ❌`
 * correction. That is how automovie makes "physically impossible poses are
 * structurally rejected" real, rather than hoping the LLM emits plausible
 * numbers.
 *
 * Sign convention is per-axis and documented on
 * {@link IAutoMovieJointConstraint}. `min <= max` is required; the engine treats
 * `min > max` as a malformed constraint.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `IAutoMovieAngleRange` as the portable data boundary for the actor joint range constraints requirement.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `IAutoMovieAngleRange` for the performance rig rom control driver graph system contract.
 * @author Samchon
 */
export interface IAutoMovieAngleRange {
  /**
   * Lower bound, degrees (inclusive).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `min` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `min` for the performance rig rom control driver graph system contract.
   */
  min: number;

  /**
   * Upper bound, degrees (inclusive).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `max` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `max` for the performance rig rom control driver graph system contract.
   */
  max: number;
}
