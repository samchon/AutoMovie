import {
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
} from "@automovie/interface";

import { resolveProductionFrameRate } from "../film/productionTimebase";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";

/**
 * Resolve the timeline's exact rate for a film-effect question, or refuse it.
 *
 * A display `fps` that disagrees with the declared rational rate is refused as
 * invalid film-effect input, so no projection or verification runs against an
 * ambiguous clock.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Reads the builder timeline's rational rate rather than its display scalar before mapping effect frames.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Resolves one normalized rational rate for the film clock and refuses a display rate that contradicts it before any boundary is evaluated.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#clock-seek-failure-and-recovery Refuses an inconsistent film clock with a named code instead of choosing one of its spellings.
 */
export const productionFilmEffectTimelineFrameRate = (
  timeline: Pick<IAutoMovieFilmTimeline, "fps" | "frameRate">,
): IAutoMovieProductionFrameRate => {
  try {
    return resolveProductionFrameRate(timeline);
  } catch {
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect timeline frame rate must be a consistent positive exact rational identity.",
    );
  }
};
