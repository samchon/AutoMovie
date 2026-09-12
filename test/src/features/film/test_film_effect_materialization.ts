import {
  type IAutoMovieShotEffectFilmInterval,
  materializeProductionFilmEffects,
  verifyProductionFilmEffectPopulation,
} from "@automovie/engine";
import type {
  IAutoMovieFilmTimeline,
  IAutoMovieProductionFrameRate,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import {
  filmEffectCue,
  filmEffectIdentity,
  filmEffectRecipe,
  filmEffectRefusal,
  filmEffectTimeline,
  filmEffectWorld,
  filmEffectZone,
  nodeCanonicalDigest,
} from "./filmEffectRuntimeFixtures";

/**
 * Film cues become current effect streams with one owner per zone and frame.
 *
 * The builder writes what the viewer later verifies and samples, so the writer
 * must refuse every input the reader would reject and must produce exactly the
 * bytes the reader recomputes. Expected times are exact frame boundaries of
 * the declared rate, expected seeds and digests are recomputed through
 * `node:crypto` from the documented seed protocol, and every refusal is paired
 * with an adjacent accepted case.
 *
 * Scenarios:
 *
 * 1. Three cues materialize in start-frame order with the identity, reduced
 *    rate, frame interval, exact second bounds, fixed step and constant
 *    intensity of their cue, a seed from the film seed protocol, and digests
 *    that `node:crypto` reproduces; the result verifies as the timeline's
 *    population, and an adjacent cue on the same zone is not a conflict; two
 *    cues starting on one frame are ordered by code unit, so `B` precedes `a`.
 * 2. A rational 30000/1001 clock yields exact rational second bounds and step.
 * 3. A malformed identity or frame rate is refused as input.
 * 4. A blank or duplicated recipe or zone id is refused as input.
 * 5. A shot interval with a blank cue, shot or zone, a negative or fractional
 *    start, a fractional end, or an empty interval is refused, while a valid
 *    interval on an unused zone is accepted.
 * 6. A cue with a blank id, a foreign recipe, a blank zone, a negative or
 *    fractional start, a fractional or zero duration, an unsafe end, or a
 *    non-finite or out-of-range intensity is refused, intensities 0 and 1 are
 *    accepted, and a repeated cue id is refused.
 * 7. A cue on a missing zone, or on a zone whose recipe is missing, is refused
 *    with its own code.
 * 8. Two film cues overlapping on one zone are refused naming the overlapping
 *    frames, while overlap on different zones is accepted.
 * 9. A film cue overlapping a shot interval on its zone is refused, while shot
 *    intervals that touch or miss it are accepted.
 */
export const test_film_effect_materialization = (): void => {
  const timeline = filmEffectTimeline([
    filmEffectCue(),
    filmEffectCue({
      id: "haze",
      zone: "gate",
      startFrame: 0,
      durationFrames: 6,
      intensity: 1,
    }),
    filmEffectCue({ id: "dew", startFrame: 24, durationFrames: 6 }),
  ]);
  const identity = filmEffectIdentity(timeline);
  const materialize = (
    overrides: Partial<Parameters<typeof materializeProductionFilmEffects>[0]>,
  ) =>
    materializeProductionFilmEffects({
      identity,
      frameRate: 24,
      world: filmEffectWorld(),
      effects: timeline.tracks.effects,
      ...overrides,
    });
  const output = materialize({});
  const zoneOf = (id: string) =>
    filmEffectWorld().effectZones.find((zone) => zone.id === id)!;

  TestValidator.equals(
    "cues become ordered runtimes on their exact frame clock",
    output.map((runtime) => ({
      id: runtime.effect.id,
      zone: runtime.effect.zone,
      owner: [runtime.version, runtime.owner, runtime.clock] as Array<
        string | number
      >,
      identity: [
        runtime.production,
        runtime.film,
        runtime.compileFingerprint,
        runtime.editFingerprint,
      ],
      rate: runtime.frameRate,
      frames: [runtime.startFrame, runtime.endFrame],
      seconds: [runtime.effect.start, runtime.effect.end],
      step: runtime.effect.fixedStepSeconds,
      intensity: runtime.effect.intensity,
    })),
    [
      ["haze", "gate", 0, 6, 1],
      ["mist", "yard", 12, 24, 0.5],
      ["dew", "yard", 24, 30, 0.5],
    ].map(([id, zone, start, end, intensity]) => ({
      id: id as string,
      zone: zone as string,
      owner: [1, "film", "timeline-frame"],
      identity: [
        "production",
        "film",
        timeline.inputFingerprint,
        identity.editFingerprint,
      ],
      rate: { numerator: 24, denominator: 1 },
      frames: [start as number, end as number],
      seconds: [(start as number) / 24, (end as number) / 24],
      step: 1 / 24,
      intensity: { from: intensity as number, to: intensity as number },
    })),
  );
  TestValidator.equals(
    "seeds and digests are the documented protocol through node:crypto",
    output.map((runtime) => [
      runtime.effect.seed,
      runtime.effect.digest,
      runtime.digest,
    ]),
    output.map((runtime) => [
      Number.parseInt(
        nodeCanonicalDigest({
          protocol: "automovie.film-effect-seed.v1",
          owner: { production: "production", film: "film" },
          cue: runtime.effect.id,
          recipe: filmEffectRecipe(),
          zone: zoneOf(runtime.effect.zone),
        }).slice(7, 20),
        16,
      ),
      nodeCanonicalDigest({ ...runtime.effect, digest: undefined }),
      nodeCanonicalDigest({ ...runtime, digest: undefined }),
    ]),
  );
  TestValidator.equals(
    "the written population verifies against its timeline",
    filmEffectRefusal(() =>
      verifyProductionFilmEffectPopulation({ timeline, effects: output }),
    ),
    "accepted",
  );

  TestValidator.equals(
    "cues starting on one frame are ordered by code-unit id, not collation",
    materialize({
      effects: [
        filmEffectCue({
          id: "a",
          zone: "gate",
          startFrame: 0,
          durationFrames: 6,
        }),
        filmEffectCue({ id: "B", startFrame: 0, durationFrames: 6 }),
      ],
    }).map((runtime) => runtime.effect.id),
    ["B", "a"],
  );

  const rational: IAutoMovieProductionFrameRate = {
    numerator: 30000,
    denominator: 1001,
  };
  const rationalRuntime = materialize({
    frameRate: rational,
    effects: [filmEffectCue({ startFrame: 3, durationFrames: 2 })],
  })[0]!;
  TestValidator.equals(
    "a rational clock yields exact rational bounds",
    [
      rationalRuntime.frameRate,
      rationalRuntime.effect.start,
      rationalRuntime.effect.end,
      rationalRuntime.effect.fixedStepSeconds,
    ],
    [rational, 3003 / 30000, 5005 / 30000, 1001 / 30000],
  );

  const refuse = (
    overrides: Partial<Parameters<typeof materializeProductionFilmEffects>[0]>,
  ): string => filmEffectRefusal(() => materialize(overrides));
  TestValidator.equals(
    "a malformed identity or rate is refused as input",
    [
      refuse({ identity: { ...identity, production: "" } }),
      refuse({ identity: { ...identity, film: " " } }),
      refuse({ identity: { ...identity, compileFingerprint: "sha256:c" } }),
      refuse({
        identity: {
          ...identity,
          editFingerprint: `md5:${"0".repeat(64)}` as `sha256:${string}`,
        },
      }),
      refuse({ frameRate: 0 }),
      refuse({ frameRate: 23.976 }),
      refuse({ frameRate: { numerator: 0, denominator: 1 } }),
    ],
    Array.from({ length: 7 }, () => "film-effect-input-invalid"),
  );
  const world = (
    patch: Partial<
      Pick<IAutoMovieWorldDesign, "effectRecipes" | "effectZones">
    >,
  ): IAutoMovieWorldDesign => ({ ...filmEffectWorld(), ...patch });
  TestValidator.equals(
    "blank or duplicated world ids are refused",
    [
      refuse({ world: world({ effectRecipes: [filmEffectRecipe(" ")] }) }),
      refuse({
        world: world({
          effectRecipes: [filmEffectRecipe(), filmEffectRecipe()],
        }),
      }),
      refuse({ world: world({ effectZones: [filmEffectZone("")] }) }),
      refuse({
        world: world({
          effectZones: [filmEffectZone("yard"), filmEffectZone("yard")],
        }),
      }),
    ],
    Array.from({ length: 4 }, () => "film-effect-input-invalid"),
  );

  const interval: IAutoMovieShotEffectFilmInterval = {
    cue: "shot-cue",
    shot: "shot",
    zone: "moat",
    startFrame: 30,
    endFrame: 36,
  };
  TestValidator.equals(
    "a malformed shot interval is refused and a valid one accepted",
    [
      { cue: " " },
      { shot: "" },
      { zone: " " },
      { startFrame: -1 },
      { startFrame: 30.5 },
      { endFrame: 36.5 },
      { endFrame: 30 },
      {},
    ].map((patch) => refuse({ shotEffects: [{ ...interval, ...patch }] })),
    [
      ...Array.from({ length: 7 }, () => "film-effect-input-invalid"),
      "accepted",
    ],
  );

  const cue = (
    patch: Partial<IAutoMovieFilmTimeline["tracks"]["effects"][number]>,
  ): string => refuse({ effects: [filmEffectCue(patch)] });
  TestValidator.equals(
    "a malformed cue is refused and the intensity bounds are accepted",
    [
      cue({ id: " " }),
      cue({ recipe: "shot-zone" as "world-zone" }),
      cue({ zone: "" }),
      cue({ startFrame: -1 }),
      cue({ startFrame: 0.5 }),
      cue({ durationFrames: 1.5 }),
      cue({ durationFrames: 0 }),
      cue({ startFrame: Number.MAX_SAFE_INTEGER, durationFrames: 1 }),
      cue({ intensity: Number.NaN }),
      cue({ intensity: -0.1 }),
      cue({ intensity: 1.1 }),
      cue({ intensity: 0 }),
      cue({ intensity: 1 }),
      refuse({
        effects: [
          filmEffectCue(),
          filmEffectCue({ zone: "gate", startFrame: 30 }),
        ],
      }),
    ],
    [
      ...Array.from({ length: 11 }, () => "film-effect-input-invalid"),
      "accepted",
      "accepted",
      "film-effect-input-invalid",
    ],
  );
  TestValidator.equals(
    "a missing zone and a missing recipe keep their own codes",
    [
      cue({ zone: "moat" }),
      refuse({
        effects: [filmEffectCue()],
        world: world({ effectZones: [filmEffectZone("yard", "smoke-recipe")] }),
      }),
    ],
    ["film-effect-zone-missing", "film-effect-recipe-missing"],
  );

  TestValidator.equals(
    "overlapping film cues on one zone are refused naming the frames",
    {
      sameZone: throwsError(
        () =>
          materialize({
            effects: [
              filmEffectCue(),
              filmEffectCue({ id: "fog", startFrame: 18 }),
            ],
          }),
        'Film effect cues "mist" and "fog" both own zone "yard" during frames 18..24.',
      ),
      otherZone: refuse({
        effects: [
          filmEffectCue(),
          filmEffectCue({ id: "fog", zone: "gate", startFrame: 18 }),
        ],
      }),
    },
    { sameZone: true, otherZone: "accepted" },
  );
  TestValidator.equals(
    "a film cue overlapping a shot interval on its zone is refused",
    {
      overlapping: throwsError(
        () =>
          materialize({
            effects: [filmEffectCue()],
            shotEffects: [
              { ...interval, zone: "yard", startFrame: 20, endFrame: 26 },
            ],
          }),
        'Film effect cue "mist" and shot effect cue "shot-cue" on shot "shot" both own zone "yard" during frames 20..24.',
      ),
      touching: [
        { startFrame: 24, endFrame: 30 },
        { startFrame: 0, endFrame: 12 },
        { startFrame: 30, endFrame: 36 },
      ].map((frames) =>
        refuse({
          effects: [filmEffectCue()],
          shotEffects: [{ ...interval, zone: "yard", ...frames }],
        }),
      ),
    },
    { overlapping: true, touching: ["accepted", "accepted", "accepted"] },
  );
};
