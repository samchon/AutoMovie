import { IAutoMovieFilmTimeline } from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";

/**
 * Order film effect cues by start frame, then by code-unit cue id.
 *
 * This is the one order a runtime population is written in and verified
 * against. The materializer and the population verifier both read it here, so
 * the order a builder persists cannot drift from the order a consumer checks.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-platform-determinism Fixes the population order by integer frame and code unit so host sort or locale cannot reorder a runtime.
 */
export const sortProductionFilmEffectCues = (
  cues: IAutoMovieFilmTimeline["tracks"]["effects"],
): IAutoMovieFilmTimeline["tracks"]["effects"] =>
  [...cues].sort(
    (left, right) =>
      left.startFrame - right.startFrame || compareCodeUnits(left.id, right.id),
  );
