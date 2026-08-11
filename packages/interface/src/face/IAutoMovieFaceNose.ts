import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Nose traits of an {@link IAutoMovieFace}: signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's nose unchanged.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceNose` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceNose` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceNose {
  /**
   * Vertical length of the nose: `+` longer (the tip drops).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `length` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `length` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  length?: AutoMovieFaceWeight;

  /**
   * Width of the nostrils / alar base: `+` broader.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;

  /**
   * Forward projection of the nose tip: `+` more prominent in profile.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `projection` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `projection` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  projection?: AutoMovieFaceWeight;
}
