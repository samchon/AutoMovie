import { IAutoMovieCompiledFilmEffect } from "@automovie/interface";

import { IAutoMovieEffectSample } from "../effect";

/**
 * One film-owned effect and its deterministic engine sample.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek Pairs one frame's sample with the runtime it was reconstructed from so no previous-frame state is implied.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Returns the target state beside the immutable stream identity that produced it.
 * @author Samchon
 */
export interface IAutoMovieProductionFilmEffectSample {
  /** Persisted film-owned runtime identity. */
  runtime: IAutoMovieCompiledFilmEffect;
  /** Existing engine sample at the requested full-rate frame. */
  sample: IAutoMovieEffectSample;
}
