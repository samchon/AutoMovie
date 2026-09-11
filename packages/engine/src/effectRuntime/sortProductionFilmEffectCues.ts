import { IAutoMovieFilmTimeline } from "@automovie/interface";

import { compareCodeUnits } from "../text/compareCodeUnits";

/**
 * Order film effect cues by start frame, then by code-unit cue id.
 *
 * This is the one order a runtime population is written in and verified
 * against. The materializer and the population verifier both read it here, so
 * the order a builder persists cannot drift from the order a consumer checks.
 * Integer frames and code units decide it, so neither host sort nor locale can
 * reorder a runtime.
 */
export const sortProductionFilmEffectCues = (
  cues: IAutoMovieFilmTimeline["tracks"]["effects"],
): IAutoMovieFilmTimeline["tracks"]["effects"] =>
  [...cues].sort(
    (left, right) =>
      left.startFrame - right.startFrame || compareCodeUnits(left.id, right.id),
  );
