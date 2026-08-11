/**
 * A material response owned by a deterministic collision/measurement proxy.
 *
 * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Exposes `IAutoMovieImpactBody` as the portable data boundary for the effects impact consequence requirement.
 * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Types `IAutoMovieImpactBody` for the collision proxy and world contact output system contract.
 */
export interface IAutoMovieImpactBody {
  /**
   * Body mass in kilograms.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Exposes `mass` as the portable data boundary for the effects impact consequence requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Types `mass` for the collision proxy and world contact output system contract.
   */
  mass: number;
  /**
   * Normal rebound ratio from zero through one.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Exposes `restitution` as the portable data boundary for the effects impact consequence requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Types `restitution` for the collision proxy and world contact output system contract.
   */
  restitution: number;
  /**
   * Relative surface hardness, strictly above zero.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Exposes `hardness` as the portable data boundary for the effects impact consequence requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Types `hardness` for the collision proxy and world contact output system contract.
   */
  hardness: number;
  /**
   * Relative penetration resistance, strictly above zero.
   *
   * @evidence requirements/effects-and-simulation/rigid-motion-ballistics-and-collision.md#effects-impact-consequence Exposes `penetrability` as the portable data boundary for the effects impact consequence requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#collision-proxy-and-world-contact-output Types `penetrability` for the collision proxy and world contact output system contract.
   */
  penetrability: number;
}

/**
 * Profile trait proving that other bodies can mount this one.
 *
 * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `IAutoMovieMountableTrait` as the portable data boundary for the motion object authored vocabulary requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `IAutoMovieMountableTrait` for the performance interaction attachment object handoff system contract.
 */
export interface IAutoMovieMountableTrait {
  /**
   * Trait discriminator.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `kind` as the portable data boundary for the motion object authored vocabulary requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `kind` for the performance interaction attachment object handoff system contract.
   */
  kind: "mountable";
  /**
   * Positive simultaneous rider capacity.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `seats` as the portable data boundary for the motion object authored vocabulary requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `seats` for the performance interaction attachment object handoff system contract.
   */
  seats: number;
  /**
   * Maximum supported payload in kilograms.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `payloadMass` as the portable data boundary for the motion object authored vocabulary requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `payloadMass` for the performance interaction attachment object handoff system contract.
   */
  payloadMass: number;
}

/**
 * Profile trait proving that deterministic impacts can damage this body.
 *
 * @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-trait-result Exposes `IAutoMovieDestructibleTrait` as the portable data boundary for the effects damage trait result requirement.
 * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#damage-trait-result-state-boundary Types `IAutoMovieDestructibleTrait` for the damage trait result state boundary system contract.
 */
export interface IAutoMovieDestructibleTrait {
  /**
   * Trait discriminator.
   *
   * @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-trait-result Exposes `kind` as the portable data boundary for the effects damage trait result requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#damage-trait-result-state-boundary Types `kind` for the damage trait result state boundary system contract.
   */
  kind: "destructible";
  /**
   * Positive structural durability.
   *
   * @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-trait-result Exposes `durability` as the portable data boundary for the effects damage trait result requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#damage-trait-result-state-boundary Types `durability` for the damage trait result state boundary system contract.
   */
  durability: number;
  /**
   * Collision and material response owned by the declared proxy.
   *
   * @evidence requirements/effects-and-simulation/damage-and-destruction-boundary.md#effects-damage-trait-result Exposes `impactBody` as the portable data boundary for the effects damage trait result requirement.
   * @evidence specifications/simulation-effects-and-sound/rigid-collision-and-damage.md#damage-trait-result-state-boundary Types `impactBody` for the damage trait result state boundary system contract.
   */
  impactBody: IAutoMovieImpactBody;
}

/**
 * Declarative profile capabilities; every variant is data, never code.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery Exposes `IAutoMovieProfileTrait` as the portable data boundary for the agent capability gap discovery requirement.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Types `IAutoMovieProfileTrait` for the spec authoring capability state system contract.
 */
export type IAutoMovieProfileTrait =
  | IAutoMovieMountableTrait
  | IAutoMovieDestructibleTrait;
