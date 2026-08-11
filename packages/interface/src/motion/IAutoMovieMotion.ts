import { IAutoMovieKeyframe } from "./IAutoMovieKeyframe";

/**
 * The gait cycle a motion carries: the provenance meta that lets a
 * **non-looping composite** (a baked travel, an arranged performance) still
 * answer "where in the stride am I?" at any local time.
 *
 * A looping gait clip answers that by construction (`time % duration`), but the
 * film ladder's compiled performances are non-looping composites, so without
 * this meta the next beat could never resume mid-stride (the #597 continuity
 * handoff). Producers that bake or compose a cyclic locomotion stamp it;
 * consumers compute `phase(t) = (phaseAt + t) % period`. Absent means the
 * motion carries no cycle to resume: a one-shot.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `IAutoMovieGaitCycle` as the portable data boundary for the motion gait table requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `IAutoMovieGaitCycle` for the performance kinematics procedural gait rule system contract.
 * @author Samchon
 */
export interface IAutoMovieGaitCycle {
  /**
   * The source gait's cycle length, seconds. Strictly positive.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `period` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `period` for the performance kinematics procedural gait rule system contract.
   */
  period: number;

  /**
   * Cycle phase at the motion's local `t = 0`, seconds in `[0, period)`. A
   * fresh bake is `0`; composition offsets shift it (an arranged segment
   * starting at `s` carries `phaseAt = (0 - s) mod period` so the composite's
   * own clock still lands on the segment's true stride phase).
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `phaseAt` as the portable data boundary for the motion gait table requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `phaseAt` for the performance kinematics procedural gait rule system contract.
   */
  phaseAt: number;
}

/**
 * A time-based animation clip: an ordered sequence of keyframes over a fixed
 * duration, targeting one skeleton.
 *
 * This is automovie's top-level _motion_ AST and the deterministic-export
 * anchor: the engine samples it (interpolating per `easing`) into dense frames
 * for the viewer, or compiles it to VRMA / VMD / glTF animation. Storing sparse
 * keyframes + easing (rather than baked frames) keeps the LLM's output small
 * and is what the temporal verifier checks for coherence: monotonic time,
 * bounded per-keyframe angular velocity, every keyframe pose within ROM.
 *
 * The clip is frame-rate independent: `duration` and keyframe `time`s are in
 * seconds, sampled at whatever fps the consumer renders.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `IAutoMovieMotion` as the portable data boundary for the motion clip refusal requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieMotion` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export interface IAutoMovieMotion {
  /**
   * Stable id so scenes and exports can cite this clip.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `id` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `id` for the performance motion clip keytime interpolation system contract.
   */
  id: string;

  /**
   * Which skeleton this clip animates. Every keyframe pose targets this rig.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `skeleton` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `skeleton` for the performance motion clip keytime interpolation system contract.
   */
  skeleton: string;

  /**
   * Total clip length, seconds. Every keyframe `time` must be `<= duration`.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `duration` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `duration` for the performance motion clip keytime interpolation system contract.
   */
  duration: number;

  /**
   * Whether the clip loops seamlessly. When `true`, the engine expects the last
   * keyframe to be continuous with the first.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `loop` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `loop` for the performance motion clip keytime interpolation system contract.
   */
  loop: boolean;

  /**
   * Keyframes in strictly increasing `time` order. At least two are required: a
   * clip needs a start and an end to interpolate between.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `keyframes` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `keyframes` for the performance motion clip keytime interpolation system contract.
   */
  keyframes: IAutoMovieKeyframe[];

  /**
   * The gait cycle this motion carries ({@link IAutoMovieGaitCycle}), when it
   * was baked from or composed around a cyclic locomotion, lets the beat-end
   * handoff read a stride phase off a non-looping composite. Absent/`null` = no
   * cycle to resume. Evolving-schema optional (the `tree?`/`space?` precedent):
   * pre-cycle motions stay valid unchanged.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal Exposes `gaitCycle` as the portable data boundary for the motion clip refusal requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `gaitCycle` for the performance motion clip keytime interpolation system contract.
   */
  gaitCycle?: IAutoMovieGaitCycle | null;
}
