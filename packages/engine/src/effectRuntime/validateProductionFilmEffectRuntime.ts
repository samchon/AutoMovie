import { IAutoMovieCompiledFilmEffect } from "@automovie/interface";

import { productionFrameBoundaryToSeconds } from "../film/productionTimebase";
import { autoMovieRenderDigest } from "../render/renderDigest";
import { canonicalizeAutoMovieJson } from "../text/canonicalizeAutoMovieJson";
import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";
import { productionFilmEffectFrameRate } from "./productionFilmEffectFrameRate";

/**
 * Refuse a persisted runtime whose shape is not the one the materializer writes.
 *
 * Version, owner, clock, interval, reduced frame rate, inner effect, content
 * digests and the exact frame clock of the inner stream must all match.
 * Identity currentness is a separate question each consumer answers against
 * the identity it independently established.
 *
 * Both digests are recomputed with the engine's canonical JSON and pure
 * SHA-256, which produce the same bytes and digest as the Node builder path,
 * so a browser and the builder accept or refuse the same persisted runtime.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity Recomputes the runtime and inner stream digests before a persisted stream is trusted.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#checkpoint-cache-identity-and-validity Rejects a persisted stream whose digest, clock or shape differs from what its identity promises.
 */
export const validateProductionFilmEffectRuntime = (
  runtime: IAutoMovieCompiledFilmEffect,
): void => {
  if (
    runtime.version !== 1 ||
    runtime.owner !== "film" ||
    runtime.clock !== "timeline-frame" ||
    runtime.startFrame < 0 ||
    runtime.endFrame <= runtime.startFrame ||
    Number.isSafeInteger(runtime.startFrame) === false ||
    Number.isSafeInteger(runtime.endFrame) === false
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" has an unsupported version, owner, clock, or interval.`,
    );
  const frameRate = productionFilmEffectFrameRate(
    runtime.frameRate,
    "film-effect-runtime-invalid",
  );
  if (
    runtime.frameRate.numerator !== frameRate.numerator ||
    runtime.frameRate.denominator !== frameRate.denominator ||
    runtime.effect.version !== 1 ||
    runtime.effect.id.trim().length === 0 ||
    runtime.effect.zone.trim().length === 0 ||
    runtime.effect.intensity.from !== runtime.effect.intensity.to ||
    Number.isFinite(runtime.effect.intensity.from) === false ||
    runtime.effect.intensity.from < 0 ||
    runtime.effect.intensity.from > 1
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" has a noncanonical frame rate or malformed inner film effect.`,
    );
  const expectedEffectDigest = autoMovieRenderDigest(
    canonicalizeAutoMovieJson({ ...runtime.effect, digest: undefined }),
  );
  const expectedRuntimeDigest = autoMovieRenderDigest(
    canonicalizeAutoMovieJson({ ...runtime, digest: undefined }),
  );
  if (
    runtime.effect.digest !== expectedEffectDigest ||
    runtime.digest !== expectedRuntimeDigest ||
    runtime.effect.start !==
      productionFrameBoundaryToSeconds({
        frame: runtime.startFrame,
        frameRate,
      }) ||
    runtime.effect.end !==
      productionFrameBoundaryToSeconds({
        frame: runtime.endFrame,
        frameRate,
      }) ||
    runtime.effect.fixedStepSeconds !==
      frameRate.denominator / frameRate.numerator
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-runtime-invalid",
      `Film effect runtime "${runtime.effect.id}" differs from its content digest or exact frame clock.`,
    );
};
