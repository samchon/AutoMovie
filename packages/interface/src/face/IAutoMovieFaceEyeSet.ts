import { AutoMovieFaceWeight } from "./AutoMovieFaceWeight";
import { IAutoMovieFaceEye } from "./IAutoMovieFaceEye";

/**
 * The eye PAIR of an {@link IAutoMovieFace}.
 *
 * **Side rule (read this first):** when only ONE of `left`/`right` is defined,
 * it applies to BOTH eyes (the symmetric shorthand: most faces need nothing
 * more). When BOTH are defined, each side stands alone and applies only to its
 * own eye (uneven eyes). There is no separate "both" field.
 *
 * Pair-level traits (the relation between the two eyes) live here; traits of an
 * eye itself live in {@link IAutoMovieFaceEye}. Sides are the SUBJECT's
 * left/right. The Set/single naming split is deliberate: "EyeSet" vs "Eye"
 * cannot be confused by a tool-calling model the way "Eyes" vs "Eye" can.
 *
 * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `IAutoMovieFaceEyeSet` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `IAutoMovieFaceEyeSet` as a coarse proxy parameter under the representation-fidelity ceiling.
 * @author Samchon
 */
export interface IAutoMovieFaceEyeSet {
  /**
   * Distance between the eyes: `+` wide-set, `-` close-set.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `spacing` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `spacing` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  spacing?: AutoMovieFaceWeight;

  /**
   * The subject's LEFT eye; applies to BOTH eyes when `right` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `left` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `left` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  left?: IAutoMovieFaceEye;

  /**
   * The subject's RIGHT eye; applies to BOTH eyes when `left` is omitted.
   *
   * @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling Keeps `right` inside the bounded direct-authoring proxy surface instead of claiming realistic likeness.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-representation-fidelity-boundary Types `right` as a coarse proxy parameter under the representation-fidelity ceiling.
   */
  right?: IAutoMovieFaceEye;
}
