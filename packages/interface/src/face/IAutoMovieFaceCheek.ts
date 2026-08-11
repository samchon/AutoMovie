import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Traits of ONE cheek: signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged. Lives under {@link IAutoMovieFaceCheekSet.left} / `right`; when it
 * is the only side defined, it applies to BOTH cheeks.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceCheek` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceCheek` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceCheek {
  /**
   * Volume of the cheek around the cheekbone: `+` full and round, `-` gaunt.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `fullness` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `fullness` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  fullness?: AutoMovieFaceWeight;
}
