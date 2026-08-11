import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";

/**
 * Traits of ONE eye: signed morph weights in `[-2, 2]`, `0`/omitted meaning
 * unchanged.
 *
 * Lives under {@link IAutoMovieFaceEyeSet.left} / `right`. **Side rule:** when
 * it is the only side defined on the set, these traits apply to BOTH eyes; when
 * both sides are defined, each applies to its own eye only. Sides are the
 * SUBJECT's left/right: her left eye is on the viewer's right. Heterochromia is
 * an iris-color concern, not geometry.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceEye` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceEye` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceEye {
  /**
   * Uniform scale of the eye about its own center: `+` larger.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `size` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `size` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  size?: AutoMovieFaceWeight;

  /**
   * Horizontal-only scale of the eye fissure: widens the opening without
   * lifting the lids; use with `size` to control the aspect ratio.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `width` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `width` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  width?: AutoMovieFaceWeight;

  /**
   * Vertical position of the eye on the face: `+` higher.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `height` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `height` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  height?: AutoMovieFaceWeight;

  /**
   * Outer-corner slant: `+` lifts the outer corner (upturned eye).
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `tilt` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `tilt` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  tilt?: AutoMovieFaceWeight;

  /**
   * Outward shift of the eye, away from the nose: `+` toward the temple. Adds
   * to the pair-level {@link IAutoMovieFaceEyeSet.spacing}; use this for one
   * eye, `spacing` for the pair.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `offset` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `offset` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  offset?: AutoMovieFaceWeight;
}
