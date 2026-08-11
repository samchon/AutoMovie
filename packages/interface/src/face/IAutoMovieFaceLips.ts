import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Lip traits of an {@link IAutoMovieFace}'s mouth: signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's lips unchanged.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceLips` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceLips` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceLips {
  /**
   * Vertical thickness of the lips about the lip seam: `+` fuller, `-` thinner.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `fullness` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `fullness` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  fullness?: AutoMovieFaceWeight;
}
