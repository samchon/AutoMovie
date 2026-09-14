import { verifyProductionFilmEffectPopulation } from "@automovie/engine";
import type {
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  filmEffectRefusal,
  filmEffectTimeline,
  materializedFilmEffects,
  resealFilmEffect,
} from "./filmEffectRuntimeFixtures";

/**
 * A persisted film-effect population is current only as the whole cue set.
 *
 * The viewer and the render planner run this check before sampling any frame,
 * so it must refuse an absent, extra, reordered, or retargeted runtime even
 * when every entry is individually well formed. Each mutated runtime below is
 * resealed with fresh digests, so the refusal comes from the population rule
 * that owns the field rather than from the digest check.
 *
 * Scenarios:
 *
 * 1. The builder's population verifies for its timeline, an empty track with an
 *    empty population verifies, a reseal with no change still verifies, and a
 *    timeline differing only in its source digest still verifies.
 * 2. A truncated, extended, or empty population and a reordered one are
 *    refused as invalid runtime populations.
 * 3. A digest-valid runtime differing in film, compile, edit, frame rate, cue
 *    id, zone, start frame, end frame, or intensity is refused, and so is the
 *    unchanged population against a timeline with another compile input or
 *    another edit.
 * 4. A malformed runtime is refused by shape validation, and a timeline whose
 *    display rate contradicts its rational rate is refused as invalid input.
 */
export const test_film_effect_population_verification = (): void => {
  const timeline = filmEffectTimeline();
  const effects = materializedFilmEffects(timeline);
  const [haze, mist] = effects as [
    IAutoMovieCompiledFilmEffect,
    IAutoMovieCompiledFilmEffect,
  ];
  const verify = (
    candidate: readonly IAutoMovieCompiledFilmEffect[],
    current: IAutoMovieFilmTimeline = timeline,
  ): string =>
    filmEffectRefusal(() =>
      verifyProductionFilmEffectPopulation({
        timeline: current,
        effects: candidate,
      }),
    );

  TestValidator.equals(
    "the current population and its empty twin verify",
    [
      verify(effects),
      verify([], filmEffectTimeline([])),
      verify([haze, resealFilmEffect(mist, () => {})]),
      verify(effects, {
        ...timeline,
        sourceDigest: `sha256:${"9".repeat(64)}`,
      }),
    ],
    ["accepted", "accepted", "accepted", "accepted"],
  );
  TestValidator.equals(
    "an incomplete, extended, or reordered population is refused",
    [
      verify([haze]),
      verify([haze, mist, mist]),
      verify([]),
      verify([mist, haze]),
    ],
    [
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
    ],
  );

  const retargeted: Array<(draft: IAutoMovieCompiledFilmEffect) => void> = [
    (draft) => {
      draft.film = "other-film";
    },
    (draft) => {
      draft.compileFingerprint = `sha256:${"e".repeat(64)}`;
    },
    (draft) => {
      draft.editFingerprint = `sha256:${"f".repeat(64)}`;
    },
    (draft) => {
      draft.frameRate = { numerator: 25, denominator: 1 };
      draft.effect.start = 12 / 25;
      draft.effect.end = 24 / 25;
      draft.effect.fixedStepSeconds = 1 / 25;
    },
    (draft) => {
      draft.effect.id = "fog";
    },
    (draft) => {
      draft.effect.zone = "gate";
    },
    (draft) => {
      draft.startFrame = 13;
      draft.effect.start = 13 / 24;
    },
    (draft) => {
      draft.endFrame = 25;
      draft.effect.end = 25 / 24;
    },
    (draft) => {
      draft.effect.intensity = { from: 0.75, to: 0.75 };
    },
  ];
  TestValidator.equals(
    "a digest-valid runtime that differs from its cue or identity is refused",
    [
      ...retargeted.map((mutate) =>
        verify([haze, resealFilmEffect(mist, mutate)]),
      ),
      verify(effects, {
        ...timeline,
        inputFingerprint: `sha256:${"e".repeat(64)}`,
      }),
      verify(effects, { ...timeline, totalFrames: 49 }),
    ],
    [...retargeted, "compile", "edit"].map(() => "film-effect-runtime-invalid"),
  );
  TestValidator.equals(
    "shape and clock refusals keep their own classes",
    [
      verify([
        haze,
        resealFilmEffect(mist, (draft) => {
          (draft as { version: number }).version = 2;
        }),
      ]),
      verify(effects, {
        ...timeline,
        frameRate: { numerator: 25, denominator: 1 },
      }),
    ],
    ["film-effect-runtime-invalid", "film-effect-input-invalid"],
  );
};
