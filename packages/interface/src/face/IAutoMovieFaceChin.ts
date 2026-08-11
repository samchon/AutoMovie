import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Chin traits of an {@link IAutoMovieFace}'s jaw: signed morph weights in `[-2,
 * 2]`, `0`/omitted meaning the template's chin unchanged.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceChin` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceChin` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceChin {
  /**
   * Vertical reach of the chin tip: `+` a longer chin, `-` a short one.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `length` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `length` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  length?: AutoMovieFaceWeight;

  /**
   * Forward projection of the chin: `+` protrudes, `-` recedes.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `protrusion` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `protrusion` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  protrusion?: AutoMovieFaceWeight;
}
