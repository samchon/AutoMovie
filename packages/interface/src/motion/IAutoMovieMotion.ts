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
 * @author Samchon
 */
export interface IAutoMovieGaitCycle {
  /** The source gait's cycle length, seconds. Strictly positive. */
  period: number;

  /**
   * Cycle phase at the motion's local `t = 0`, seconds in `[0, period)`. A
   * fresh bake is `0`; composition offsets shift it (an arranged segment
   * starting at `s` carries `phaseAt = (0 - s) mod period` so the composite's
   * own clock still lands on the segment's true stride phase).
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
 * @author Samchon
 */
export interface IAutoMovieMotion {
  /** Stable id so scenes and exports can cite this clip. */
  id: string;

  /** Which skeleton this clip animates. Every keyframe pose targets this rig. */
  skeleton: string;

  /** Total clip length, seconds. Every keyframe `time` must be `<= duration`. */
  duration: number;

  /**
   * Whether the clip loops seamlessly. When `true`, the engine expects the last
   * keyframe to be continuous with the first.
   */
  loop: boolean;

  /**
   * Keyframes in strictly increasing `time` order. At least two are required: a
   * clip needs a start and an end to interpolate between.
   */
  keyframes: IAutoMovieKeyframe[];

  /**
   * The gait cycle this motion carries ({@link IAutoMovieGaitCycle}), when it
   * was baked from or composed around a cyclic locomotion, lets the beat-end
   * handoff read a stride phase off a non-looping composite. Absent/`null` = no
   * cycle to resume. Evolving-schema optional (the `tree?`/`space?` precedent):
   * pre-cycle motions stay valid unchanged.
   */
  gaitCycle?: IAutoMovieGaitCycle | null;
}
