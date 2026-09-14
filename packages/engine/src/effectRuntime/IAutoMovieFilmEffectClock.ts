import { IAutoMovieFilmTimeline } from "@automovie/interface";

/**
 * The builder-owned film clock every film-effect projection reads.
 *
 * Segments map realized film frames back to shot-local source frames, and the
 * exact rational rate turns a shot-local second into the frame the engine
 * sampler will actually compare against.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Fixes the rational rate and segment map every shot-to-film frame projection reads.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Supplies the exact rational film clock the boundary comparison uses instead of a display rate.
 * @author Samchon
 */
export type IAutoMovieFilmEffectClock = Pick<
  IAutoMovieFilmTimeline,
  "fps" | "frameRate" | "segments"
>;
