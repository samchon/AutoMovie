import { IAutoMovieGaitLimb } from "./IAutoMovieGaitLimb";

/**
 * A **declarative gait**: a creature's characteristic locomotion expressed as
 * data, not hand-keyed frames. The same engine synthesiser turns this into a
 * human walk, a horse's lateral-sequence walk, a cat's stalk, or a gallop,
 * differing only in the per-limb **phase offsets**, **duty factor**, and
 * **amplitude**. This is the concrete answer to "every object moves
 * differently": one parameter set per gait, the engine fattening it into
 * per-frame motion ({@link IAutoMovieMotion}). A profile carries a set of
 * these.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `IAutoMovieGait` as the portable data boundary for the motion gait table requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `IAutoMovieGait` for the performance kinematics procedural gait rule system contract.
 * @author Samchon
 */
export interface IAutoMovieGait {
  /**
   * Stable name (`"walk"`, `"trot"`, `"gallop"`, `"stalk"`).
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `name` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `name` for the performance kinematics procedural gait rule system contract.
   */
  name: string;

  /**
   * Stride period (one full cycle) in seconds.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `period` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `period` for the performance kinematics procedural gait rule system contract.
   */
  period: number;

  /**
   * Optional vertical root bob for the body mass during the cycle. When
   * present, the gait synthesiser emits a root transform whose `translation.y`
   * follows `center + amplitude * sin(2 * PI * (t / period + phase))`. Omit it
   * for a gait that should leave root placement entirely to `travelMotion` /
   * staging.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `rootBob` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `rootBob` for the performance kinematics procedural gait rule system contract.
   */
  rootBob?: IAutoMovieGaitRootBob;

  /**
   * Optional style scalars that bias the generated gait without changing its
   * footfall sequence. Omit a field to keep the profile's neutral style.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `style` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `style` for the performance kinematics procedural gait rule system contract.
   */
  style?: IAutoMovieGaitStyle;

  /**
   * Each limb's contribution to the cycle.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `limbs` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `limbs` for the performance kinematics procedural gait rule system contract.
   */
  limbs: IAutoMovieGaitLimb[];
}

/**
 * Coarse creature-style hints attached to a gait.
 *
 * These are normalized multipliers, not physical units: the engine interprets
 * them relative to the target rig and gait. They keep "sneaky", "heavy", or
 * "springy" in data instead of hand-authored TypeScript clips.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `IAutoMovieGaitStyle` as the portable data boundary for the motion gait table requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `IAutoMovieGaitStyle` for the performance kinematics procedural gait rule system contract.
 * @author Samchon
 */
export interface IAutoMovieGaitStyle {
  /**
   * Lower the body during the gait. `0` = neutral, `1` = maximum crouch.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `crouch` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `crouch` for the performance kinematics procedural gait rule system contract.
   */
  crouch?: number;

  /**
   * Heavier movement feel. `0` = neutral, `1` = maximum weight.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `weight` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `weight` for the performance kinematics procedural gait rule system contract.
   */
  weight?: number;

  /**
   * Extra bounce/rebound. `0` = neutral, `1` = maximum spring.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `springiness` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `springiness` for the performance kinematics procedural gait rule system contract.
   */
  springiness?: number;

  /**
   * Relative stride length. `1` = neutral, below/above shortens/extends.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `strideScale` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `strideScale` for the performance kinematics procedural gait rule system contract.
   */
  strideScale?: number;
}

/**
 * Vertical body-mass oscillation attached to a gait cycle.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `IAutoMovieGaitRootBob` as the portable data boundary for the motion gait table requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `IAutoMovieGaitRootBob` for the performance kinematics procedural gait rule system contract.
 * @author Samchon
 */
export interface IAutoMovieGaitRootBob {
  /**
   * Peak displacement from `center`, in meters.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `amplitude` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `amplitude` for the performance kinematics procedural gait rule system contract.
   */
  amplitude: number;

  /**
   * Cycle phase offset in `[0, 1)`.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `phase` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `phase` for the performance kinematics procedural gait rule system contract.
   */
  phase: number;

  /**
   * Neutral vertical translation, in meters.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `center` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `center` for the performance kinematics procedural gait rule system contract.
   */
  center: number;
}
