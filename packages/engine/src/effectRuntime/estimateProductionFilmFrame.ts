import { IAutoMovieProductionFrameRate } from "@automovie/interface";

/**
 * Estimate a frame from the float product, or `null` when it cannot be exact.
 *
 * The product only starts the search; callers settle the frame by the exact
 * boundary comparison the sampler performs. Two frames of headroom keep that
 * correction inside the safe-integer range, and an infinite or NaN product
 * fails the comparison and is reported as unrepresentable.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Bounds the float estimate that the exact rational boundary search then corrects.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Reports a boundary no safe-integer frame can hold instead of rounding it into range.
 */
export const estimateProductionFilmFrame = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
  round: (value: number) => number,
): number | null => {
  const frame = Math.max(
    0,
    round((seconds * frameRate.numerator) / frameRate.denominator),
  );
  return frame <= Number.MAX_SAFE_INTEGER - 2 ? frame : null;
};
