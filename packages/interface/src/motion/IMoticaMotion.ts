import { IMoticaKeyframe } from "./IMoticaKeyframe";

/**
 * A time-based animation clip: an ordered sequence of keyframes over a fixed
 * duration, targeting one skeleton.
 *
 * This is motica's top-level _motion_ AST and the deterministic-export anchor:
 * the engine samples it (interpolating per `easing`) into dense frames for the
 * viewer, or compiles it to VRMA / VMD / glTF animation. Storing sparse
 * keyframes + easing (rather than baked frames) keeps the LLM's output small
 * and is what the temporal verifier checks for coherence — monotonic time,
 * bounded per-keyframe angular velocity, every keyframe pose within ROM.
 *
 * The clip is frame-rate independent: `duration` and keyframe `time`s are in
 * seconds, sampled at whatever fps the consumer renders.
 *
 * @author Samchon
 */
export interface IMoticaMotion {
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
   * Keyframes in strictly increasing `time` order. At least two are required —
   * a clip needs a start and an end to interpolate between.
   */
  keyframes: IMoticaKeyframe[];
}
