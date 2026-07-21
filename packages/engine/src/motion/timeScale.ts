import { IAutoMovieMotion } from "@automovie/interface";

/**
 * Uniformly time-scale a clip by `k`: keyframe times, duration, and the gait
 * cycle's period/phase (both are seconds), the same footwork played faster or
 * slower, so loop continuity and the recorded stride phase survive the change.
 *
 * Poses are untouched, so a travelling clip still arrives exactly where it
 * arrived: only WHEN each keyframe happens moves. That is what lets both
 * callers share it, {@link locomoteMotion} compressing a sub-stride step and
 * {@link makeActorSynthesizer} fitting a walk onto an author's declared span.
 *
 * @author Samchon
 */
export const timeScaleMotion = (
  clip: IAutoMovieMotion,
  k: number,
): IAutoMovieMotion => ({
  ...clip,
  duration: clip.duration * k,
  keyframes: clip.keyframes.map((kf) => ({ ...kf, time: kf.time * k })),
  ...(clip.gaitCycle === null || clip.gaitCycle === undefined
    ? {}
    : {
        gaitCycle: {
          period: clip.gaitCycle.period * k,
          phaseAt: clip.gaitCycle.phaseAt * k,
        },
      }),
});
