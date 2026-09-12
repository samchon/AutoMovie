import { IAutoMovieCompiledFilmEffect } from "@automovie/interface";

import { sampleCompiledEffect } from "../effect";
import { productionFrameBoundaryToSeconds } from "../film/productionTimebase";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";
import { IAutoMovieFilmEffectCurrentIdentity } from "./IAutoMovieFilmEffectCurrentIdentity";
import { IAutoMovieProductionFilmEffectSample } from "./IAutoMovieProductionFilmEffectSample";
import { validateProductionFilmEffectIdentity } from "./validateProductionFilmEffectIdentity";
import { validateProductionFilmEffectRuntime } from "./validateProductionFilmEffectRuntime";

/**
 * Sample film-owned effects at one builder-owned full-rate timeline frame.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-arbitrary-seek Samples without retaining a cursor or depending on call order.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Uses the timeline frame even when a proxy output frame has a different index.
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-step-boundary Samples every effect at one declared film frame boundary so anchors, emitters and environment read the same time.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Reconstructs the same state for repeated and reordered seeks.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Performs one exact rational frame-to-seconds conversion at the sampler boundary.
 */
export const sampleProductionFilmEffects = (props: {
  identity: IAutoMovieFilmEffectCurrentIdentity;
  effects: readonly IAutoMovieCompiledFilmEffect[];
  timelineFrame: number;
  cameraDistance?: number;
}): IAutoMovieProductionFilmEffectSample[] => {
  validateProductionFilmEffectIdentity(props.identity);
  if (
    Number.isSafeInteger(props.timelineFrame) === false ||
    props.timelineFrame < 0
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      `Film effect timeline frame ${props.timelineFrame} must be a nonnegative safe integer.`,
    );
  if (
    props.cameraDistance !== undefined &&
    (Number.isFinite(props.cameraDistance) === false ||
      props.cameraDistance < 0)
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      `Film effect camera distance ${props.cameraDistance} must be finite and nonnegative.`,
    );
  return props.effects.map((runtime) => {
    validateProductionFilmEffectRuntime(runtime);
    if (
      runtime.production !== props.identity.production ||
      runtime.film !== props.identity.film ||
      runtime.compileFingerprint !== props.identity.compileFingerprint ||
      runtime.editFingerprint !== props.identity.editFingerprint
    )
      throw new AutoMovieFilmEffectRuntimeError(
        "film-effect-runtime-stale",
        `Film effect runtime "${runtime.effect.id}" differs from the current production, film, compile, or edit identity.`,
      );
    return {
      runtime: structuredClone(runtime),
      sample: sampleCompiledEffect(
        runtime.effect,
        productionFrameBoundaryToSeconds({
          frame: props.timelineFrame,
          frameRate: runtime.frameRate,
        }),
        props.cameraDistance,
      ),
    };
  });
};
