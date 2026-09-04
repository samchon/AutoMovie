import {
  IAutoMovieEffectRecipe,
  IAutoMovieFilmTimeline,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AutoMovieFilmEffectRuntimeError,
  IAutoMovieFilmEffectCurrentIdentity,
  materializeProductionFilmEffects,
  sampleProductionFilmEffects,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { worldDesign } from "./productionFixtures";

const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}`;

const identity = (): IAutoMovieFilmEffectCurrentIdentity => ({
  production: "campaign-film",
  film: "campaign-film",
  compileFingerprint: digest("a"),
  editFingerprint: digest("b"),
});

const recipe = (): IAutoMovieEffectRecipe => ({
  id: "fog-recipe",
  kind: "fog",
  seed: 17,
  emission: { rate: 12, burst: 2, duration: 4 },
  particle: {
    lifetime: { min: 1, max: 2 },
    size: { min: 0.1, max: 0.4 },
    color: "#8899aa",
    opacity: { min: 0.2, max: 0.7 },
  },
  motion: {
    wind: { x: 0.1, y: 0, z: -0.1 },
    rise: 0.2,
    turbulence: 0.05,
  },
  budget: { maxParticles: 32, lodDistance: 10 },
  blend: "alpha",
});

const world = (): IAutoMovieWorldDesign => ({
  ...worldDesign(),
  effectRecipes: [recipe()],
  effectZones: [
    {
      id: "courtyard-fog",
      recipe: "fog-recipe",
      bounds: {
        min: { x: -2, y: 0, z: -2 },
        max: { x: 2, y: 3, z: 2 },
      },
      seed: 29,
    },
  ],
});

const cues = (): IAutoMovieFilmTimeline["tracks"]["effects"] => [
  {
    id: "film-fog",
    recipe: "world-zone",
    zone: "courtyard-fog",
    startFrame: 12,
    durationFrames: 24,
    intensity: 0.6,
  },
];

const captureError = (operation: () => void): unknown => {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error;
  }
};

/**
 * Film-global effects must become one current runtime on the compiler-owned
 * full-rate clock rather than remaining fingerprint-only edit data.
 *
 * Scenarios:
 *
 * 1. A registered world-zone cue materializes deterministically, includes the
 *    production, film, recipe and zone revision in its identity, and repeated
 *    or reordered seeks return the same samples.
 * 2. The half-open interval is inactive immediately before and after, and active
 *    at its first and last included frames.
 * 3. Proxy output frame six samples timeline frame twelve and therefore matches
 *    the final-tier sample at frame twelve rather than using frame six.
 * 4. Missing zones or recipes, duplicate world ids, invalid cues, malformed
 *    sample inputs, stale identities, altered bytes and unsupported versions
 *    are named refusals rather than empty successful samples.
 * 5. Film and shot owners on the same zone are accepted when disjoint and
 *    refused with both cue ids when their half-open intervals overlap.
 */
export const test_production_film_effect_runtime = (): void => {
  const current = identity();
  const runtime = materializeProductionFilmEffects({
    identity: current,
    frameRate: { numerator: 24, denominator: 1 },
    world: world(),
    effects: cues(),
  });
  const repeated = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 24,
  });
  sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 35,
  });
  const reordered = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 24,
  });
  const withDistance = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 24,
    cameraDistance: 5,
  });
  const rematerialized = materializeProductionFilmEffects({
    identity: current,
    frameRate: 24,
    world: world(),
    effects: cues(),
  });
  const revisedWorld = world();
  revisedWorld.effectZones[0]!.seed += 1;
  const revised = materializeProductionFilmEffects({
    identity: current,
    frameRate: 24,
    world: revisedWorld,
    effects: cues(),
  });
  TestValidator.equals(
    "film effects retain current identity and seek-order determinism",
    namedFacts([
      ["runtimeLength", () => runtime.length === 1],
      ["ownerFilm", () => runtime[0]?.owner === "film"],
      ["clockTimelineFrame", () => runtime[0]?.clock === "timeline-frame"],
      ["startFrame", () => runtime[0]?.startFrame === 12],
      ["endFrame", () => runtime[0]?.endFrame === 36],
      ["innerStart", () => runtime[0]?.effect.start === 0.5],
      ["innerEnd", () => runtime[0]?.effect.end === 1.5],
      ["fixedStep", () => runtime[0]?.effect.fixedStepSeconds === 1 / 24],
      [
        "repeatedSeek",
        () => JSON.stringify(repeated) === JSON.stringify(reordered),
      ],
      [
        "repeatedMaterialization",
        () => JSON.stringify(runtime) === JSON.stringify(rematerialized),
      ],
      [
        "validDistance",
        () => JSON.stringify(withDistance) === JSON.stringify(repeated),
      ],
      [
        "zoneRevisionChangesDigest",
        () => runtime[0]?.digest !== revised[0]?.digest,
      ],
    ]),
    {
      runtimeLength: true,
      ownerFilm: true,
      clockTimelineFrame: true,
      startFrame: true,
      endFrame: true,
      innerStart: true,
      innerEnd: true,
      fixedStep: true,
      repeatedSeek: true,
      repeatedMaterialization: true,
      validDistance: true,
      zoneRevisionChangesDigest: true,
    },
  );

  const boundary = [11, 12, 35, 36].map(
    (timelineFrame) =>
      sampleProductionFilmEffects({
        identity: current,
        effects: runtime,
        timelineFrame,
      })[0]!.sample.active,
  );
  const proxyFrameSix = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 12,
  });
  const finalFrameTwelve = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 12,
  });
  const wrongTierLocalFrame = sampleProductionFilmEffects({
    identity: current,
    effects: runtime,
    timelineFrame: 6,
  });
  TestValidator.equals(
    "film effect intervals and proxy projection use the full-rate frame",
    namedFacts([
      [
        "halfOpenBoundary",
        () =>
          JSON.stringify(boundary) ===
          JSON.stringify([false, true, true, false]),
      ],
      [
        "proxyMatchesFinal",
        () =>
          JSON.stringify(proxyFrameSix) === JSON.stringify(finalFrameTwelve),
      ],
      [
        "tierLocalWouldDiffer",
        () => wrongTierLocalFrame[0]!.sample.active === false,
      ],
    ]),
    {
      halfOpenBoundary: true,
      proxyMatchesFinal: true,
      tierLocalWouldDiffer: true,
    },
  );

  const missingZone = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: { ...world(), effectZones: [] },
      effects: cues(),
    }),
  );
  const missingRecipe = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: { ...world(), effectRecipes: [] },
      effects: cues(),
    }),
  );
  const duplicateRecipe = captureError(() => {
    const candidate = world();
    candidate.effectRecipes.push(structuredClone(candidate.effectRecipes[0]!));
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: candidate,
      effects: cues(),
    });
  });
  const invalidCue = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: world(),
      effects: [{ ...cues()[0]!, intensity: Number.NaN }],
    }),
  );
  const duplicateCue = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: world(),
      effects: [cues()[0]!, structuredClone(cues()[0]!)],
    }),
  );
  const invalidFrameRate = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 0,
      world: world(),
      effects: cues(),
    }),
  );
  const invalidShotInterval = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: world(),
      effects: cues(),
      shotEffects: [
        {
          cue: "shot-fog",
          shot: "shot-a",
          zone: "courtyard-fog",
          startFrame: 12,
          endFrame: 12,
        },
      ],
    }),
  );
  const stale = captureError(() =>
    sampleProductionFilmEffects({
      identity: { ...current, editFingerprint: digest("c") },
      effects: runtime,
      timelineFrame: 12,
    }),
  );
  const altered = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: [
        {
          ...runtime[0]!,
          effect: { ...runtime[0]!.effect, seed: runtime[0]!.effect.seed + 1 },
        },
      ],
      timelineFrame: 12,
    }),
  );
  const invalidRuntimeRate = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: [
        {
          ...runtime[0]!,
          frameRate: { numerator: 0, denominator: 1 },
        },
      ],
      timelineFrame: 12,
    }),
  );
  const noncanonicalRuntimeRate = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: [
        {
          ...runtime[0]!,
          frameRate: { numerator: 48, denominator: 2 },
        },
      ],
      timelineFrame: 12,
    }),
  );
  const malformedInner = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: [
        {
          ...runtime[0]!,
          effect: {
            ...runtime[0]!.effect,
            intensity: { from: 0.6, to: 0.5 },
          },
        },
      ],
      timelineFrame: 12,
    }),
  );
  const blankIdentity = captureError(() =>
    materializeProductionFilmEffects({
      identity: { ...current, production: "" },
      frameRate: 24,
      world: world(),
      effects: cues(),
    }),
  );
  const badDigest = captureError(() =>
    materializeProductionFilmEffects({
      identity: {
        ...current,
        compileFingerprint: "not-a-digest" as `sha256:${string}`,
      },
      frameRate: 24,
      world: world(),
      effects: cues(),
    }),
  );
  const unsupported = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: [{ ...runtime[0]!, version: 2 as 1 }],
      timelineFrame: 12,
    }),
  );
  const invalidFrame = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: runtime,
      timelineFrame: -1,
    }),
  );
  const invalidDistance = captureError(() =>
    sampleProductionFilmEffects({
      identity: current,
      effects: runtime,
      timelineFrame: 12,
      cameraDistance: Number.POSITIVE_INFINITY,
    }),
  );
  TestValidator.equals(
    "invalid film effect inputs and stale runtime are named refusals",
    [
      missingZone,
      missingRecipe,
      duplicateRecipe,
      invalidCue,
      duplicateCue,
      invalidFrameRate,
      invalidShotInterval,
      stale,
      altered,
      invalidRuntimeRate,
      noncanonicalRuntimeRate,
      malformedInner,
      blankIdentity,
      badDigest,
      unsupported,
      invalidFrame,
      invalidDistance,
    ].map((error) =>
      error instanceof AutoMovieFilmEffectRuntimeError ? error.code : null,
    ),
    [
      "film-effect-zone-missing",
      "film-effect-recipe-missing",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
      "film-effect-runtime-stale",
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
      "film-effect-runtime-invalid",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
      "film-effect-runtime-invalid",
      "film-effect-input-invalid",
      "film-effect-input-invalid",
    ],
  );

  const disjoint = materializeProductionFilmEffects({
    identity: current,
    frameRate: 24,
    world: world(),
    effects: cues(),
    shotEffects: [
      {
        cue: "shot-fog",
        shot: "shot-a",
        zone: "courtyard-fog",
        startFrame: 0,
        endFrame: 12,
      },
    ],
  });
  const conflict = captureError(() =>
    materializeProductionFilmEffects({
      identity: current,
      frameRate: 24,
      world: world(),
      effects: cues(),
      shotEffects: [
        {
          cue: "shot-fog",
          shot: "shot-a",
          zone: "courtyard-fog",
          startFrame: 35,
          endFrame: 48,
        },
      ],
    }),
  );
  TestValidator.equals(
    "shot and film effect ownership is half-open and conflict-exact",
    namedFacts([
      ["disjointRetained", () => disjoint.length === 1],
      [
        "conflictNamed",
        () =>
          conflict instanceof AutoMovieFilmEffectRuntimeError &&
          conflict.code === "film-effect-owner-conflict" &&
          conflict.message.includes("film-fog") &&
          conflict.message.includes("shot-fog") &&
          conflict.message.includes("courtyard-fog"),
      ],
    ]),
    { disjointRetained: true, conflictNamed: true },
  );
};
