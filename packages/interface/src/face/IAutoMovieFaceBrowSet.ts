import { IAutoMovieFaceBrow } from "./IAutoMovieFaceBrow";

/**
 * The eyebrow PAIR of an {@link IAutoMovieFace}.
 *
 * **Side rule:** when only ONE of `left`/`right` is defined, it applies to BOTH
 * brows (the symmetric shorthand); when both are defined, each side stands
 * alone (a raised single brow).
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceBrowSet` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceBrowSet` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceBrowSet {
  /**
   * The subject's LEFT brow; applies to BOTH brows when `right` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `left` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `left` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  left?: IAutoMovieFaceBrow;

  /**
   * The subject's RIGHT brow; applies to BOTH brows when `left` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `right` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `right` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  right?: IAutoMovieFaceBrow;
}
