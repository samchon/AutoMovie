import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceLips } from "./IAutoMovieFaceLips";

/**
 * Mouth traits of an {@link IAutoMovieFace}: signed morph weights in `[-2, 2]`,
 * `0`/omitted meaning the template's mouth unchanged.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceMouth` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceMouth` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceMouth {
  /**
   * Width of the mouth: `+` a wider smile line.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;

  /**
   * Vertical position of the whole mouth: `+` higher toward the nose.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `height` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `height` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  height?: AutoMovieFaceWeight;

  /**
   * The lips themselves. See {@link IAutoMovieFaceLips}.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `lips` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `lips` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  lips?: IAutoMovieFaceLips;
}
