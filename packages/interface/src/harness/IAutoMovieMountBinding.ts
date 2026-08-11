import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * A persistent coupling fixed for the whole film: a rider on a mount, a
 * passenger in a cart. The bound node rides `parent`'s `bone` (e.g. a horse's
 * `spine` saddle). Declared once in staging rather than re-attached every
 * shot.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-reference-frame Exposes `IAutoMovieMountBinding` as the portable data boundary for the staging mark reference frame requirement.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership Types `IAutoMovieMountBinding` for the performance staging mark surface zone membership system contract.
 * @author Samchon
 */
export interface IAutoMovieMountBinding {
  /**
   * The node ridden.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-reference-frame Exposes `parent` as the portable data boundary for the staging mark reference frame requirement.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership Types `parent` for the performance staging mark surface zone membership system contract.
   */
  parent: string;

  /**
   * The parent bone the rider is fixed to (e.g. a horse's `spine` saddle).
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-reference-frame Exposes `bone` as the portable data boundary for the staging mark reference frame requirement.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership Types `bone` for the performance staging mark surface zone membership system contract.
   */
  bone: AutoMovieHumanoidBone;
}
