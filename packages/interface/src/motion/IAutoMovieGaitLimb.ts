import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import { AutoMovieEasing } from "./AutoMovieEasing";

/**
 * One limb's part in a gait cycle ({@link IAutoMovieGait}). The limbs differ
 * only in **when** they swing (`phase`) and **how**: a horse walk is its four
 * legs at phase offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0,
 * 0.5, 0.5, 0` (diagonal pairs): same shape, different phases.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `IAutoMovieGaitLimb` as the portable data boundary for the motion gait table requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `IAutoMovieGaitLimb` for the performance kinematics procedural gait rule system contract.
 * @author Samchon
 */
export interface IAutoMovieGaitLimb {
  /**
   * The bone this limb's swing drives (a leg's upper bone).
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `bone` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `bone` for the performance kinematics procedural gait rule system contract.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Joint axis this gait channel writes. Omitted means `"flexion"` so existing
   * gait data keeps the original sagittal swing behavior; set `"abduction"` for
   * side-to-side sway/spread or `"twist"` for axial gait details.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `axis` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `axis` for the performance kinematics procedural gait rule system contract.
   */
  axis?: "flexion" | "abduction" | "twist";

  /**
   * Where in the stride this limb's cycle starts, in `[0, 1)`: the phase offset
   * that distinguishes one gait's footfall sequence from another's.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `phase` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `phase` for the performance kinematics procedural gait rule system contract.
   */
  phase: number;

  /**
   * Fraction of the stride the limb spends in **stance** (planted, pushing the
   * body back) versus **swing** (lifted, recovering forward), in `(0, 1)`. A
   * walk has a high duty (long ground contact); a gallop a low one.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `duty` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `duty` for the performance kinematics procedural gait rule system contract.
   */
  duty: number;

  /**
   * Peak swing on `axis` (degrees) about the limb's neutral.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `amplitude` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `amplitude` for the performance kinematics procedural gait rule system contract.
   */
  amplitude: number;

  /**
   * Easing used while the limb is in stance (planted, pushing back). Omitted
   * means `"linear"`, preserving the original sawtooth.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `stanceEasing` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `stanceEasing` for the performance kinematics procedural gait rule system contract.
   */
  stanceEasing?: AutoMovieEasing;

  /**
   * Control points for `stanceEasing: "cubicBezier"` as `[x1, y1, x2, y2]` in
   * the unit square (CSS `cubic-bezier` convention). Omitted or `null` keeps
   * the named-curve behavior.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `stanceBezier` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `stanceBezier` for the performance kinematics procedural gait rule system contract.
   */
  stanceBezier?: [number, number, number, number] | null;

  /**
   * Easing used while the limb is in swing (recovering forward). Omitted means
   * `"linear"`, preserving the original sawtooth.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `swingEasing` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `swingEasing` for the performance kinematics procedural gait rule system contract.
   */
  swingEasing?: AutoMovieEasing;

  /**
   * Control points for `swingEasing: "cubicBezier"` as `[x1, y1, x2, y2]` in
   * the unit square (CSS `cubic-bezier` convention). Omitted or `null` keeps
   * the named-curve behavior.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `swingBezier` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `swingBezier` for the performance kinematics procedural gait rule system contract.
   */
  swingBezier?: [number, number, number, number] | null;

  /**
   * Center the swing oscillates around (degrees), default `0`. A symmetric limb
   * (a hip, a shoulder) leaves this unset and swings `±amplitude` about zero; a
   * limb that only bends one way needs a nonzero center to keep the whole swing
   * on the anatomical side. A knee, whose flexion ROM is `[0, 150]°` and cannot
   * hyperextend, walks with e.g. `{ neutral: 25, amplitude: 18 }` so its swing
   * stays in `[7, 43]°` instead of crossing zero: the offset the ROM validator
   * forces once you try to bend a knee at all.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `neutral` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `neutral` for the performance kinematics procedural gait rule system contract.
   */
  neutral?: number;
}
