import {
  IAutoMovieCompiledEffect,
  IAutoMovieProductionFrameRate,
} from "@automovie/interface";

import { productionFrameBoundaryToSeconds } from "../film/productionTimebase";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";
import { IAutoMovieFilmEffectClock } from "./IAutoMovieFilmEffectClock";
import { IAutoMovieShotEffectFilmInterval } from "./IAutoMovieShotEffectFilmInterval";
import { estimateProductionFilmFrame } from "./estimateProductionFilmFrame";
import { productionFilmEffectTimelineFrameRate } from "./productionFilmEffectTimelineFrameRate";

/**
 * Project every shot-owned effect occurrence onto the film's half-open frame
 * clock.
 *
 * A shot cue owns the source frames whose exact boundary time satisfies
 * `start <= time < end`, the same comparison the engine sampler performs, so
 * the projection is decided by the rational frame boundary rather than by a
 * rounded `seconds * fps` product. Each film occurrence of the shot is trimmed
 * to its segment, and a shot the compiled set does not contain contributes no
 * interval because the builder's shot-availability diagnostics own that
 * refusal.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Projects every shot-authored cue onto the film clock so film and shot owners can be compared.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Decides cue ownership from the rational frame boundary instead of a display-rate float product.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Supplies the shot-owner intervals the one-authority check reads.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Applies the inclusive-start, exclusive-end boundary law to the shot cue's realized frames.
 */
export const projectProductionShotEffectFilmIntervals = (props: {
  timeline: IAutoMovieFilmEffectClock;
  shots: ReadonlyMap<
    string,
    {
      effects: readonly Pick<
        IAutoMovieCompiledEffect,
        "id" | "zone" | "start" | "end"
      >[];
    }
  >;
}): IAutoMovieShotEffectFilmInterval[] => {
  const frameRate = productionFilmEffectTimelineFrameRate(props.timeline);
  return props.timeline.segments.flatMap((segment) => {
    const shot = props.shots.get(segment.shot);
    if (shot === undefined) return [];
    return shot.effects.flatMap((effect) => {
      const startFrame =
        Number.isFinite(effect.start) && effect.start >= 0
          ? firstFrameAtOrAfter(effect.start, frameRate)
          : null;
      const endFrame =
        Number.isFinite(effect.end) && effect.end > effect.start
          ? firstFrameAtOrAfter(effect.end, frameRate)
          : null;
      if (startFrame === null || endFrame === null)
        throw new AutoMovieFilmEffectRuntimeError(
          "film-effect-input-invalid",
          `Shot effect cue "${effect.id}" on shot "${segment.shot}" has an invalid or unrepresentable second interval ${effect.start}..${effect.end}.`,
        );
      const start = Math.max(segment.sourceInFrame, startFrame);
      const end = Math.min(segment.sourceOutFrame, endFrame);
      return end <= start
        ? []
        : [
            {
              cue: effect.id,
              shot: segment.shot,
              zone: effect.zone,
              startFrame: segment.startFrame + start - segment.sourceInFrame,
              endFrame: segment.startFrame + end - segment.sourceInFrame,
            },
          ];
    });
  });
};

/**
 * The smallest frame whose exact boundary time is at or after `seconds`, or
 * `null` when no safe-integer frame can represent that boundary.
 *
 * The float product only estimates the frame; the answer is settled by the
 * same boundary comparison the sampler performs, so a product that lands one
 * ulp on the wrong side of an integer cannot move ownership by a frame.
 */
const firstFrameAtOrAfter = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
): number | null => {
  let frame = estimateProductionFilmFrame(seconds, frameRate, Math.ceil);
  if (frame === null) return null;
  while (
    frame > 0 &&
    productionFrameBoundaryToSeconds({ frame: frame - 1, frameRate }) >= seconds
  )
    frame -= 1;
  while (productionFrameBoundaryToSeconds({ frame, frameRate }) < seconds)
    frame += 1;
  return frame;
};
