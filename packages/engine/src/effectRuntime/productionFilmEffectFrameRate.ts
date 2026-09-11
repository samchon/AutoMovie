import { IAutoMovieProductionFrameRate } from "@automovie/interface";

import { canonicalProductionFrameRate } from "../film/productionTimebase";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";

/**
 * Reduce one film-effect frame rate, or refuse it under the caller's code.
 *
 * The writer reports a malformed rate as invalid input and the reader reports
 * it as an invalid persisted runtime, while both reduce through the one engine
 * rate identity rather than a second rational rule.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Reduces the effect clock to the exact rational rate its frame boundaries are computed on.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#clock-seek-failure-and-recovery Refuses a non-rational clock with a named code instead of remapping it.
 */
export const productionFilmEffectFrameRate = (
  frameRate: number | IAutoMovieProductionFrameRate,
  code: "film-effect-input-invalid" | "film-effect-runtime-invalid",
): IAutoMovieProductionFrameRate => {
  try {
    return canonicalProductionFrameRate(frameRate);
  } catch {
    throw new AutoMovieFilmEffectRuntimeError(
      code,
      "Film effect frame rate must be a positive exact rational identity.",
    );
  }
};
