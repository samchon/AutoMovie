import {
  type IAutoMovieFilmEffectCurrentIdentity,
  sampleCompiledEffect,
  sampleProductionFilmEffects,
} from "@automovie/engine";
import type { IAutoMovieCompiledFilmEffect } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  filmEffectIdentity,
  filmEffectRefusal,
  filmEffectTimeline,
  materializedFilmEffects,
  resealFilmEffect,
} from "./filmEffectRuntimeFixtures";

/**
 * Film effects are sampled only from a current, well-formed runtime.
 *
 * The browser shot runtime calls this sampler on every film frame, so it must
 * reconstruct state from the frame number alone and refuse anything it cannot
 * trust: a malformed identity, frame or camera distance, a runtime from
 * another identity, and a runtime whose shape, digests or exact clock differ
 * from what the builder writes. Active windows come from hand math on the
 * cue intervals at 24 fps, and each sample is compared with the engine
 * sampler at the exact frame second.
 *
 * Scenarios:
 *
 * 1. `mist` covers frames 12..24 and `haze` 0..6: frames 11 and 24 are outside
 *    `mist`, 12 and 23 inside, frame 0 inside `haze` and 6 outside; each
 *    sample equals the engine sampler at `frame / 24` seconds with the given
 *    camera distance, and repeated or reordered seeks agree.
 * 2. The returned runtime is a copy, and an empty population samples to an
 *    empty list after its identity is validated.
 * 3. A blank production or film, a malformed compile or edit digest, a
 *    negative, fractional or NaN frame, and a negative, infinite or NaN camera
 *    distance are refused as input, while distance zero is accepted.
 * 4. A runtime for another production, film, compile or edit is refused as
 *    stale.
 * 5. A runtime with an unsupported version, owner, clock or interval, a
 *    non-rational or unreduced rate, a malformed inner effect, a tampered
 *    effect or runtime digest, or an inner clock that disagrees with its frames
 *    is refused as invalid, while an unchanged reseal is accepted.
 */
export const test_film_effect_runtime_sampling = (): void => {
  const timeline = filmEffectTimeline();
  const identity = filmEffectIdentity(timeline);
  const effects = materializedFilmEffects(timeline);
  const [haze, mist] = effects as [
    IAutoMovieCompiledFilmEffect,
    IAutoMovieCompiledFilmEffect,
  ];
  const sample = (
    timelineFrame: number,
    cameraDistance?: number,
    candidates: readonly IAutoMovieCompiledFilmEffect[] = effects,
    current: IAutoMovieFilmEffectCurrentIdentity = identity,
  ) =>
    sampleProductionFilmEffects({
      identity: current,
      effects: candidates,
      timelineFrame,
      cameraDistance,
    });

  TestValidator.equals(
    "active windows follow the half-open cue frames",
    [11, 12, 23, 24, 0, 6].map((frame) =>
      sample(frame).map((item) => item.sample.active),
    ),
    [
      [false, false],
      [false, true],
      [false, true],
      [false, false],
      [true, false],
      [false, false],
    ],
  );
  TestValidator.equals(
    "each sample is the engine sample at the exact frame second",
    sample(12, 3).map((item) => item.sample),
    [
      sampleCompiledEffect(haze.effect, 12 / 24, 3),
      sampleCompiledEffect(mist.effect, 12 / 24, 3),
    ],
  );
  const late = sample(23);
  const early = sample(12);
  TestValidator.equals(
    "reordered seeks reconstruct the same state",
    [sample(23), sample(12)],
    [late, early],
  );
  const copied = sample(12);
  copied[1]!.runtime.effect.id = "mutated";
  TestValidator.equals(
    "the returned runtime is a copy and an empty population samples empty",
    [mist.effect.id, sample(0, undefined, [])],
    ["mist", []],
  );

  const refusal = (task: () => unknown): string => filmEffectRefusal(task);
  TestValidator.equals(
    "malformed identity, frame and distance are refused as input",
    [
      refusal(() => sample(0, undefined, [], { ...identity, production: " " })),
      refusal(() => sample(0, undefined, [], { ...identity, film: "" })),
      refusal(() =>
        sample(0, undefined, [], {
          ...identity,
          compileFingerprint: `sha256:${"C".repeat(64)}`,
        }),
      ),
      refusal(() =>
        sample(0, undefined, [], {
          ...identity,
          editFingerprint: `sha256:${"a".repeat(63)}`,
        }),
      ),
      refusal(() => sample(-1)),
      refusal(() => sample(1.5)),
      refusal(() => sample(Number.NaN)),
      refusal(() => sample(0, -0.1)),
      refusal(() => sample(0, Number.POSITIVE_INFINITY)),
      refusal(() => sample(0, Number.NaN)),
      refusal(() => sample(0, 0)),
    ],
    [
      ...Array.from({ length: 10 }, () => "film-effect-input-invalid"),
      "accepted",
    ],
  );
  TestValidator.equals(
    "a runtime for another identity is stale",
    (
      [
        { ...identity, production: "other" },
        { ...identity, film: "other" },
        { ...identity, compileFingerprint: `sha256:${"1".repeat(64)}` },
        { ...identity, editFingerprint: `sha256:${"2".repeat(64)}` },
      ] satisfies IAutoMovieFilmEffectCurrentIdentity[]
    ).map((current) => refusal(() => sample(0, undefined, effects, current))),
    Array.from({ length: 4 }, () => "film-effect-runtime-stale"),
  );

  const malformed: IAutoMovieCompiledFilmEffect[] = [
    resealFilmEffect(mist, (draft) => {
      (draft as { version: number }).version = 2;
    }),
    resealFilmEffect(mist, (draft) => {
      (draft as { owner: string }).owner = "shot";
    }),
    resealFilmEffect(mist, (draft) => {
      (draft as { clock: string }).clock = "output-frame";
    }),
    resealFilmEffect(mist, (draft) => {
      draft.startFrame = -1;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.endFrame = draft.startFrame;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.startFrame = 1.5;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.endFrame = 2 ** 53;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.frameRate = { numerator: 0, denominator: 1 };
    }),
    resealFilmEffect(mist, (draft) => {
      draft.frameRate = { numerator: 48, denominator: 2 };
    }),
    resealFilmEffect(mist, (draft) => {
      (draft.effect as { version: number }).version = 2;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.id = " ";
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.zone = "";
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.intensity = { from: 0.5, to: 0.25 };
    }),
    // Canonical JSON cannot digest an infinite number, and the shape check
    // refuses it before any digest is recomputed, so this one is not resealed.
    {
      ...mist,
      effect: {
        ...mist.effect,
        intensity: {
          from: Number.POSITIVE_INFINITY,
          to: Number.POSITIVE_INFINITY,
        },
      },
    },
    resealFilmEffect(mist, (draft) => {
      draft.effect.intensity = { from: -0.5, to: -0.5 };
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.intensity = { from: 1.5, to: 1.5 };
    }),
    {
      ...mist,
      effect: { ...mist.effect, digest: `sha256:${"3".repeat(64)}` },
    },
    { ...mist, digest: `sha256:${"4".repeat(64)}` },
    resealFilmEffect(mist, (draft) => {
      draft.effect.start = 0.51;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.end = 1.01;
    }),
    resealFilmEffect(mist, (draft) => {
      draft.effect.fixedStepSeconds = 0.05;
    }),
  ];
  TestValidator.equals(
    "a runtime the builder would not write is refused as invalid",
    [
      ...malformed.map((runtime) =>
        refusal(() => sample(12, undefined, [runtime])),
      ),
      refusal(() => sample(12, undefined, [resealFilmEffect(mist, () => {})])),
    ],
    [...malformed.map(() => "film-effect-runtime-invalid"), "accepted"],
  );
};
