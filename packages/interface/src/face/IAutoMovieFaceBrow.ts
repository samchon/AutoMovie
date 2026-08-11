import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Traits of ONE eyebrow: signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged. Lives under {@link IAutoMovieFaceBrowSet.left} / `right`; when it
 * is the only side defined, it applies to BOTH brows.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceBrow` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceBrow` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceBrow {
  /**
   * Vertical position of the brow: `+` raises it off the eye (open, surprised),
   * `-` settles it low and heavy.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `height` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `height` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  height?: AutoMovieFaceWeight;
}
