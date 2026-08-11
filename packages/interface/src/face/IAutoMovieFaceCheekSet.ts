import { IAutoMovieFaceCheek } from "./IAutoMovieFaceCheek";

/**
 * The cheek PAIR of an {@link IAutoMovieFace}.
 *
 * **Side rule:** when only ONE of `left`/`right` is defined, it applies to BOTH
 * cheeks (the symmetric shorthand); when both are defined, each side stands
 * alone.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceCheekSet` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceCheekSet` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceCheekSet {
  /**
   * The subject's LEFT cheek; applies to BOTH cheeks when `right` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `left` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `left` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  left?: IAutoMovieFaceCheek;

  /**
   * The subject's RIGHT cheek; applies to BOTH cheeks when `left` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `right` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `right` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  right?: IAutoMovieFaceCheek;
}
