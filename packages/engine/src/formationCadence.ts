import { IAutoMovieFormationMotion } from "@automovie/interface";

import { easingProgress } from "./formation";

/**
 * One interval of a unit's shot over which one action runs at one rate.
 *
 * A unit's cadence is not a property of a moment: how fast a member's cycle
 * turns follows the ground its unit has covered since the shot opened, and that
 * ground is spread over every cue the unit has performed so far. So the
 * question "where in its cycle is this member now" is answered by walking the
 * whole interval `[0, time]` once and adding up what each part of it did, which
 * is what these segments are.
 *
 * Nothing accumulates between frames: the same cue list and the same time
 * always produce the same segments, so a re-render is byte-identical and a seek
 * is exact.
 *
 * @author Samchon
 */
export interface IAutoMovieFormationCadenceSegment {
  /**
   * Gait the cue owning this interval calls for, or null before the first cue.
   *
   * This is the cue's own request ({@link IAutoMovieFormationMotion.gait}, or
   * its `action` label when the cue named no gait), not a resolved figure gait.
   * Which figure can perform it is a question about a runtime model, and a unit
   * can hold several of them at once across its LOD tiers.
   */
  gait: string | null;
  /** Seconds this interval lasts; a zero-length interval is never emitted. */
  seconds: number;
  /** Ground meters the unit's own origin covers over this interval. */
  distance: number;
  /** Radians the unit turns about its own origin over this interval. */
  turn: number;
}

/**
 * Cut one unit's cue sequence into the intervals its cadence is made of.
 *
 * Each cue interpolates its unit from `from` to `to`, so the ground covered
 * inside a cue is its straight-line displacement scaled by the same eased
 * progress {@link sampleFormationMotion} places the unit by: the two read one
 * law, and a member's feet cannot disagree with where its unit stands. Every
 * easing this shape allows is monotone, so an interval never covers negative
 * ground.
 *
 * A gap between cues covers nothing. The state a unit holds between two cues is
 * the earlier cue's exact `to`, and a jump from that state to the next cue's
 * `from` is a discontinuity the sampler already permits rather than travel a
 * member could walk, so it contributes seconds and no distance. The gait is
 * retained across it, because a unit that has stopped is still doing whatever
 * its last cue had it doing.
 *
 * Turning is reported apart from travel because the two reach a member
 * differently: every member of a unit covers the unit's translation, while the
 * ground a turn carries a member over is that member's own distance from the
 * pivot. A consumer that knows a member's radius composes them; one that does
 * not still gets the unit's travel exactly.
 *
 * Cues are ordered by start alone. The compiler refuses overlapping cues inside
 * one unit, so no two starts can tie except in malformed input, where the
 * input's own order is kept.
 *
 * @author Samchon
 */
export const formationCadenceSegments = (
  motions: readonly IAutoMovieFormationMotion[],
  formation: string,
  time: number,
): IAutoMovieFormationCadenceSegment[] => {
  const cues = motions
    .filter((cue) => cue.formation === formation)
    .sort((left, right) => left.start - right.start);
  const end = Math.max(0, time);
  const segments: IAutoMovieFormationCadenceSegment[] = [];
  let cursor = 0;
  let gait: string | null = null;
  const hold = (until: number): void => {
    if (until <= cursor) return;
    segments.push({ gait, seconds: until - cursor, distance: 0, turn: 0 });
    cursor = until;
  };
  for (const cue of cues) {
    if (cue.start >= end) break;
    hold(cue.start);
    const closed = Math.min(cue.end, end);
    // `at >= cue.end` is the sampler's own rule that a finished cue sits at its
    // exact `to` state, which is what carries a `step` cue's whole displacement
    // at its end instead of losing it to a curve that never reaches one.
    const progress = (at: number): number =>
      at >= cue.end
        ? 1
        : easingProgress(
            cue.easing,
            Math.max(0, Math.min(1, (at - cue.start) / (cue.end - cue.start))),
          );
    const covered = progress(closed) - progress(cursor);
    segments.push({
      gait: cue.gait ?? cue.action,
      seconds: closed - cursor,
      distance:
        Math.hypot(
          cue.to.translation.x - cue.from.translation.x,
          cue.to.translation.z - cue.from.translation.z,
        ) * covered,
      turn:
        (Math.abs(cue.to.facingOffsetDeg - cue.from.facingOffsetDeg) *
          Math.PI *
          covered) /
        180,
    });
    cursor = closed;
    gait = cue.gait ?? cue.action;
  }
  hold(end);
  return segments;
};
