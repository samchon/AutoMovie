import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
} from "@automovie/interface";

import { addPositiveModulo } from "../math/positiveModulo";

/**
 * A motion clip placed at a start time on an actor's shot timeline.
 *
 * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition Places one action source on the actor timeline without losing its authored state.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition Supplies the interval and clip that the ordered composition evaluates.
 * @author Samchon
 */
export interface IAutoMoviePlacement {
  /**
   * Seconds into the shot this clip begins.
   *
   * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition Locates the action's state contribution on the shot clock.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition Fixes the placement boundary used by ordered composition.
   */
  start: number;
  /**
   * The clip (its own local time starts at 0).
   *
   * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition Preserves the authored action source and its terminal state during placement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition Identifies the clip composed at this ordered layer position.
   */
  motion: IAutoMovieMotion;
}

/**
 * Hold a single pose for `duration` seconds: the simplest "action" an actor can
 * perform (a beat of stillness), and the filler the timeline composer uses
 * across gaps. A two-keyframe clip with the same pose at both ends.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default Makes an explicit constant state span instead of inventing motion across an empty interval.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Encodes the hold as two ordered keys with identical state.
 * @author Samchon
 */
export const holdMotion = (
  id: string,
  skeleton: string,
  pose: IAutoMoviePose,
  duration: number,
): IAutoMovieMotion => {
  if (!Number.isFinite(duration))
    throw new Error("hold duration must be finite and positive");
  if (duration <= 0)
    throw new Error("hold duration must be finite and positive");

  const frame = (time: number): IAutoMovieKeyframe => ({
    time,
    pose: { ...pose, skeleton },
    expression: null,
    easing: "linear",
    bezier: null,
  });
  return {
    id,
    skeleton,
    duration,
    loop: false,
    keyframes: [frame(0), frame(duration)],
  };
};

/**
 * Lay several timed clips onto **one actor's** shot timeline, holding the last
 * pose across any gap between them: the composer the harness PERFORMANCE stage
 * uses to turn an actor's ordered action calls (each synthesised to a clip by
 * the engine) into a single performance {@link IAutoMovieMotion}.
 *
 * Each placement's keyframes are shifted to its `start`; where a gap precedes
 * the next placement, the previous clip's final pose is repeated at the next
 * start so the actor holds rather than slowly morphing across the gap. Keyframe
 * times are kept strictly increasing (an overlapping or coincident later frame
 * is dropped: v1 sequences rather than layers concurrent actions). The result
 * is a plain non-looping clip sampled like any other.
 *
 * @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition Composes ordered actions and carries the preceding terminal pose through timeline gaps.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition Makes the last accepted keyframe the authoritative boundary state of the composite.
 * @author Samchon
 */
export const arrangeMotion = (
  id: string,
  placements: IAutoMoviePlacement[],
): IAutoMovieMotion => {
  for (const placement of placements) {
    if (!Number.isFinite(placement.start))
      throw new Error("motion placement start must be finite");
    if (placement.start < 0)
      throw new Error("motion placement start must be non-negative");
    if (placement.motion.keyframes.length === 0)
      throw new Error(
        `motion placement "${placement.motion.id}" must have keyframes`,
      );
    if (
      !Number.isFinite(placement.motion.duration) ||
      placement.motion.duration <= 0
    )
      throw new Error(
        `motion placement "${placement.motion.id}" duration must be finite and positive`,
      );
  }

  const sorted = [...placements].sort((a, b) => a.start - b.start);
  const keyframes: IAutoMovieKeyframe[] = [];
  const push = (k: IAutoMovieKeyframe): void => {
    const last = keyframes[keyframes.length - 1];
    if (last !== undefined && k.time <= last.time) return; // keep strictly increasing
    keyframes.push(k);
  };

  for (let i = 0; i < sorted.length; ++i) {
    const p = sorted[i]!;
    const shifted = p.motion.keyframes.map((k) => ({
      ...k,
      time: k.time + p.start,
    }));
    for (const k of shifted) push(k);

    const end = p.start + p.motion.duration;
    const next = sorted[i + 1];
    if (next !== undefined && next.start > end) {
      // hold this clip's final pose until the next clip begins
      const tail = shifted[shifted.length - 1]!;
      push({ ...tail, time: next.start });
    }
  }

  // The composite's stride clock: the timeline ends inside (or holding) its
  // LAST placement, which is exactly where the beat-end handoff samples, so
  // the composite carries that placement's gait cycle, phase-shifted by its
  // start (`phaseAt' = (phaseAt - start) mod period`), and none when the last
  // placement carries no cycle (the actor is not striding at the end). A
  // mid-timeline cycle followed by a cycle-less action is deliberately NOT
  // carried. The end state is what the handoff resumes.
  const last = sorted[sorted.length - 1];
  const lastCycle = last?.motion.gaitCycle ?? null;
  const gaitCycle =
    lastCycle === null
      ? null
      : {
          period: lastCycle.period,
          phaseAt: addPositiveModulo(
            lastCycle.phaseAt,
            -last!.start,
            lastCycle.period,
          ),
        };

  return {
    id,
    skeleton: sorted[0]?.motion.skeleton ?? "",
    duration: keyframes.length ? keyframes[keyframes.length - 1]!.time : 0,
    loop: false,
    keyframes,
    gaitCycle,
  };
};
