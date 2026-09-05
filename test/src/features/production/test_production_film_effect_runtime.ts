import { productionFrameBoundaryToSeconds } from "@automovie/engine";
import {
  IAutoMovieEffectRecipe,
  IAutoMovieFilmTimeline,
  IAutoMovieGeneratedManifest,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AutoMovieFilmEffectRuntimeError,
  IAutoMovieFilmEffectClock,
  IAutoMovieFilmEffectCurrentIdentity,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  materializeProductionFilmEffects,
  parseAutoMovieFilmEffects,
  planProductionRenderJob,
  productionFilmEffectEditFingerprint,
  productionFilmFrameForShotTime,
  projectProductionShotEffectFilmIntervals,
  sampleProductionFilmEffects,
  verifyProductionFilmEffectPopulation,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { isDeepStrictEqual } from "node:util";

import { namedFacts } from "../internal/predicates";
import {
  productionDesign,
  testCaptureRuntimeIdentity,
  worldDesign,
} from "./productionFixtures";

const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}`;

/**
 * A 10 fps clock whose float products land on the wrong side of an integer.
 *
 * `1.1 * 10` evaluates to `11.000000000000002` and `0.57 * 100` to
 * `56.99999999999999`, so a projection that trusts `Math.ceil`, `Math.floor`
 * or `Math.round` of the product moves ownership by one frame at exactly the
 * boundaries an author writes. Shot `b` is realized twice so the review-seek
 * mapping has an ambiguous occurrence to refuse.
 */
const clock = (
  overrides: Partial<IAutoMovieFilmEffectClock> = {},
): IAutoMovieFilmEffectClock => ({
  fps: 10,
  segments: [
    {
      shot: "shot-a",
      sourceInFrame: 0,
      sourceOutFrame: 30,
      startFrame: 0,
      endFrame: 30,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
    {
      shot: "shot-b",
      sourceInFrame: 5,
      sourceOutFrame: 25,
      startFrame: 30,
      endFrame: 50,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
    {
      shot: "shot-b",
      sourceInFrame: 0,
      sourceOutFrame: 10,
      startFrame: 50,
      endFrame: 60,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
    {
      shot: "shot-absent",
      sourceInFrame: 0,
      sourceOutFrame: 10,
      startFrame: 60,
      endFrame: 70,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
  ],
  ...overrides,
});

const shotCue = (
  id: string,
  start: number,
  end: number,
): { id: string; zone: string; start: number; end: number } => ({
  id,
  zone: "courtyard-fog",
  start,
  end,
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

/** One 48-frame single-shot edit whose effect track carries the film cue. */
const timeline = (
  effects: IAutoMovieFilmTimeline["tracks"]["effects"] = cues(),
): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "automovie.production-compiler.test",
  inputFingerprint: digest("a"),
  sourceDigest: digest("e"),
  id: "campaign-film",
  fps: 24,
  totalFrames: 48,
  segments: [
    {
      shot: "shot-a",
      sourceInFrame: 0,
      sourceOutFrame: 48,
      startFrame: 0,
      endFrame: 48,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
  ],
  omissions: [],
  tracks: { audio: [], captions: [], effects },
});

const identity = (): IAutoMovieFilmEffectCurrentIdentity => ({
  production: "campaign-film",
  film: "campaign-film",
  compileFingerprint: digest("a"),
  editFingerprint: productionFilmEffectEditFingerprint(timeline()),
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
    {
      id: "courtyard-dust",
      recipe: "fog-recipe",
      bounds: {
        min: { x: 4, y: 0, z: -2 },
        max: { x: 8, y: 3, z: 2 },
      },
      seed: 31,
    },
  ],
});

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
 * full-rate clock rather than remaining fingerprint-only edit data, and a
 * persisted runtime is admitted only as the exact projection of the timeline
 * it is read beside.
 *
 * Scenarios:
 *
 * 1. The artifact reader keeps manifest, byte, schema and compile ownership,
 *    and then refuses an empty, truncated, extended, retimed, re-rated,
 *    re-zoned, re-weighted or foreign-film runtime population that every
 *    per-entry check would pass, while an empty population beside an empty
 *    effect track is current.
 * 2. A registered world-zone cue materializes deterministically, includes the
 *    production, film, recipe and zone revision in its identity, and repeated
 *    or reordered seeks return the same samples.
 * 3. The half-open interval is inactive immediately before and after, and active
 *    at its first and last included frames.
 * 4. A proxy render plan with `frameStep: 2` carries the runtime unchanged and
 *    maps its output frame six to timeline frame twelve; sampling at that
 *    timeline frame is active and equals the final tier's frame twelve, while
 *    the tier-local index six would have been inactive.
 * 5. Missing zones or recipes, duplicate world ids, invalid cues, malformed
 *    sample inputs, stale identities, altered bytes and unsupported versions
 *    are named refusals rather than empty successful samples.
 * 6. Film and shot owners on the same zone are accepted when disjoint and
 *    refused with both cue ids when their half-open intervals overlap; two
 *    film cues on one zone are refused the same way when they overlap and
 *    accepted when they only touch or own different zones.
 * 7. Shot cues project onto the film clock by the exact rational frame boundary:
 *    `1.1 s` at 10 fps owns frame 11 although its float product exceeds 11,
 *    a cue no boundary falls inside owns nothing, a cue one boundary falls
 *    inside owns that frame, every realized occurrence is trimmed to its
 *    segment, an unknown shot contributes nothing, and a non-finite, empty,
 *    negative or unrepresentable interval is a named refusal.
 * 8. A shot-local review second maps to the film frame whose boundary owns it
 *    (`0.57 s` at 100 fps is frame 57 although its float product is below 57),
 *    answers null for a second outside every occurrence, inside two
 *    occurrences, or that is negative or non-finite, and refuses a clock whose
 *    fps contradicts its rational identity.
 */
export const test_production_film_effect_runtime = (): void => {
  const current = identity();
  const runtime = materializeProductionFilmEffects({
    identity: current,
    frameRate: { numerator: 24, denominator: 1 },
    world: world(),
    effects: cues(),
  });
  const artifact = (
    value: unknown,
    props: {
      expectedFingerprint?: `sha256:${string}`;
      manifestFingerprint?: `sha256:${string}`;
      declaredDigest?: `sha256:${string}`;
      includeEntry?: boolean;
    } = {},
  ) => {
    const bytes = Buffer.concat([
      Buffer.from(canonicalAutoMovieJsonBytes(value)),
      Buffer.from("\n", "utf8"),
    ]);
    const manifest: IAutoMovieGeneratedManifest = {
      version: 1,
      compiler: { packageVersion: "test", protocolVersion: "test" },
      inputFingerprint: props.manifestFingerprint ?? current.compileFingerprint,
      files:
        props.includeEntry === false
          ? []
          : [
              {
                path: "film-effects.json",
                owner: "compiler",
                digest: props.declaredDigest ?? digestAutoMovieBytes(bytes),
                sourceTargets: ["film"],
              },
            ],
    };
    return {
      manifest,
      fingerprint: props.expectedFingerprint ?? current.compileFingerprint,
      read: () => bytes,
    };
  };
  const staleRuntime = structuredClone(runtime);
  staleRuntime[0]!.compileFingerprint = digest("c");
  const materializeAgainst = (props: {
    identity?: IAutoMovieFilmEffectCurrentIdentity;
    frameRate?: number;
    effects?: IAutoMovieFilmTimeline["tracks"]["effects"];
  }) =>
    materializeProductionFilmEffects({
      identity: props.identity ?? current,
      frameRate: props.frameRate ?? 24,
      world: world(),
      effects: props.effects ?? cues(),
    });
  const populationRefusal = (
    effects: readonly (typeof runtime)[number][],
    against: IAutoMovieFilmTimeline = timeline(),
  ): string | null => {
    const error = captureError(() =>
      parseAutoMovieFilmEffects(artifact(effects), against),
    );
    return error instanceof AutoMovieFilmEffectRuntimeError &&
      error.code === "film-effect-runtime-invalid"
      ? error.message
      : null;
  };
  const retimed = materializeAgainst({
    effects: [{ ...cues()[0]!, startFrame: 13 }],
  });
  const rerated = materializeAgainst({ frameRate: 25 });
  const rezoned = materializeAgainst({
    effects: [{ ...cues()[0]!, zone: "courtyard-dust" }],
  });
  const reweighted = materializeAgainst({
    effects: [{ ...cues()[0]!, intensity: 0.5 }],
  });
  const foreignFilm = materializeAgainst({
    identity: { ...current, film: "other-film" },
  });
  const secondCue = {
    ...cues()[0]!,
    id: "film-fog-late",
    startFrame: 40,
    durationFrames: 4,
  };
  const twoCueTimeline = timeline([cues()[0]!, secondCue]);
  const twoCueRuntime = materializeProductionFilmEffects({
    identity: {
      ...current,
      editFingerprint: productionFilmEffectEditFingerprint(twoCueTimeline),
    },
    frameRate: 24,
    world: world(),
    effects: [secondCue, cues()[0]!],
  });
  TestValidator.equals(
    "film effect artifacts retain manifest, byte, schema, compile ownership, and exact population",
    namedFacts([
      [
        "current",
        () =>
          isDeepStrictEqual(
            parseAutoMovieFilmEffects(artifact(runtime), timeline()),
            runtime,
          ),
      ],
      [
        "manifestMissing",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(
                {
                  ...artifact(runtime),
                  manifest: null,
                },
                timeline(),
              ),
            ),
          ).includes("missing or changed"),
      ],
      [
        "manifestStale",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(
                artifact(runtime, { manifestFingerprint: digest("c") }),
                timeline(),
              ),
            ),
          ).includes("missing or changed"),
      ],
      [
        "entryMissing",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(
                artifact(runtime, { includeEntry: false }),
                timeline(),
              ),
            ),
          ).includes("missing or changed"),
      ],
      [
        "bytesChanged",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(
                artifact(runtime, { declaredDigest: digest("d") }),
                timeline(),
              ),
            ),
          ).includes("bytes differ"),
      ],
      [
        "schemaInvalid",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(artifact({}), timeline()),
            ),
          ).includes("invalid or stale"),
      ],
      [
        "runtimeStale",
        () =>
          String(
            captureError(() =>
              parseAutoMovieFilmEffects(artifact(staleRuntime), timeline()),
            ),
          ).includes("invalid or stale"),
      ],
      [
        "emptyPopulationRefused",
        () => populationRefusal([])?.includes("0 entries") === true,
      ],
      [
        "extendedPopulationRefused",
        () =>
          populationRefusal([runtime[0]!, runtime[0]!])?.includes(
            "2 entries",
          ) === true,
      ],
      [
        "retimedRefused",
        () => populationRefusal(retimed)?.includes("film-fog") === true,
      ],
      [
        "reratedRefused",
        () => populationRefusal(rerated)?.includes("film-fog") === true,
      ],
      [
        "rezonedRefused",
        () => populationRefusal(rezoned)?.includes("film-fog") === true,
      ],
      [
        "reweightedRefused",
        () => populationRefusal(reweighted)?.includes("film-fog") === true,
      ],
      [
        "foreignFilmRefused",
        () => populationRefusal(foreignFilm)?.includes("film-fog") === true,
      ],
      [
        "canonicalOrderAdmitted",
        () =>
          parseAutoMovieFilmEffects(artifact(twoCueRuntime), twoCueTimeline)
            .map((effect) => effect.effect.id)
            .join(",") === "film-fog,film-fog-late",
      ],
      [
        "reorderedPopulationRefused",
        () =>
          populationRefusal(
            [twoCueRuntime[1]!, twoCueRuntime[0]!],
            twoCueTimeline,
          )?.includes("film-fog") === true,
      ],
      [
        "emptyTrackAdmitsEmptyPopulation",
        () =>
          parseAutoMovieFilmEffects(artifact([]), timeline([])).length === 0,
      ],
      [
        "directVerification",
        () =>
          captureError(() =>
            verifyProductionFilmEffectPopulation({
              timeline: timeline(),
              effects: runtime,
            }),
          ) === undefined,
      ],
      [
        "rationalSeconds",
        () =>
          productionFrameBoundaryToSeconds({
            frame: 12,
            frameRate: { numerator: 24_000, denominator: 1_001 },
          }) === 0.5005,
      ],
      [
        "invalidFrame",
        () =>
          captureError(() =>
            productionFrameBoundaryToSeconds({
              frame: -1,
              frameRate: { numerator: 24, denominator: 1 },
            }),
          ) instanceof Error,
      ],
    ]),
    {
      current: true,
      manifestMissing: true,
      manifestStale: true,
      entryMissing: true,
      bytesChanged: true,
      schemaInvalid: true,
      runtimeStale: true,
      emptyPopulationRefused: true,
      extendedPopulationRefused: true,
      retimedRefused: true,
      reratedRefused: true,
      rezonedRefused: true,
      reweightedRefused: true,
      foreignFilmRefused: true,
      canonicalOrderAdmitted: true,
      reorderedPopulationRefused: true,
      emptyTrackAdmitsEmptyPopulation: true,
      directVerification: true,
      rationalSeconds: true,
      invalidFrame: true,
    },
  );
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
  // The proxy tier is the one real consumer that owns an output index different
  // from the film frame, so the frame it hands the sampler is taken from an
  // actual plan rather than typed into the test twice.
  const renderPlan = (tier: { kind: "proxy" | "final"; frameStep: number }) =>
    planProductionRenderJob({
      timeline: timeline(),
      effects: runtime,
      production: productionDesign({
        id: "campaign-film",
        targetRuntimeSeconds: 2,
        frameFormat: { width: 32, height: 18, fps: 24, colorSpace: "srgb" },
        deliverables: [{ id: "feature", kind: "feature", required: true }],
      }),
      runtimeIdentity: {
        protocolVersion: "automovie.production-render-runtime.v3",
        dialogueRuntimeIdentity: null,
        sourceDigest: digest("f"),
        capture: testCaptureRuntimeIdentity(),
        encoder: {
          package: "h264-mp4-encoder",
          version: "1.0.12",
          closureDigest: digest("b"),
          codec: "h264",
          arguments: {
            quantizationParameter: 26,
            speed: 10,
            groupOfPictures: 24,
          },
        },
      },
      sourceFingerprints: { "shot-a": digest("1") },
      audioAssets: [],
      chunkFrames: 12,
      tier: { ...tier, resolutionScale: 1 },
    });
  const proxyPlan = renderPlan({ kind: "proxy", frameStep: 2 });
  const finalPlan = renderPlan({ kind: "final", frameStep: 1 });
  const planFrame = (
    plan: typeof proxyPlan,
    globalFrame: number,
  ): { globalFrame: number; timelineFrame: number } | undefined =>
    plan.chunks
      .filter((chunk) => chunk.pass === "beauty")
      .flatMap((chunk) => chunk.frames)
      .find((frame) => frame.globalFrame === globalFrame);
  const proxyFrameSix = planFrame(proxyPlan, 6);
  const finalFrameTwelve = planFrame(finalPlan, 12);
  const sampleAt = (timelineFrame: number) =>
    sampleProductionFilmEffects({
      identity: current,
      effects: runtime,
      timelineFrame,
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
        "proxyPlanCarriesRuntime",
        () =>
          JSON.stringify(proxyPlan.tracks.effects) === JSON.stringify(runtime),
      ],
      [
        "proxyPlanEditIdentity",
        () => proxyPlan.editFingerprint === current.editFingerprint,
      ],
      [
        "proxyOutputSixIsTimelineTwelve",
        () =>
          proxyFrameSix !== undefined &&
          proxyFrameSix.globalFrame === 6 &&
          proxyFrameSix.timelineFrame === 12,
      ],
      [
        "finalTwelveIsTimelineTwelve",
        () =>
          finalFrameTwelve !== undefined &&
          finalFrameTwelve.globalFrame === 12 &&
          finalFrameTwelve.timelineFrame === 12,
      ],
      [
        "proxySampleMatchesFinal",
        () =>
          proxyFrameSix !== undefined &&
          finalFrameTwelve !== undefined &&
          JSON.stringify(sampleAt(proxyFrameSix.timelineFrame)) ===
            JSON.stringify(sampleAt(finalFrameTwelve.timelineFrame)),
      ],
      [
        "proxySampleActive",
        () =>
          proxyFrameSix !== undefined &&
          sampleAt(proxyFrameSix.timelineFrame)[0]!.sample.active === true,
      ],
      [
        "tierLocalWouldDiffer",
        () =>
          proxyFrameSix !== undefined &&
          sampleAt(proxyFrameSix.globalFrame)[0]!.sample.active === false,
      ],
    ]),
    {
      halfOpenBoundary: true,
      proxyPlanCarriesRuntime: true,
      proxyPlanEditIdentity: true,
      proxyOutputSixIsTimelineTwelve: true,
      finalTwelveIsTimelineTwelve: true,
      proxySampleMatchesFinal: true,
      proxySampleActive: true,
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
  const filmOverlap = captureError(() =>
    materializeAgainst({
      effects: [
        cues()[0]!,
        { ...cues()[0]!, id: "film-fog-late", startFrame: 30 },
      ],
    }),
  );
  const filmTouching = materializeAgainst({
    effects: [
      cues()[0]!,
      { ...cues()[0]!, id: "film-fog-late", startFrame: 36, durationFrames: 6 },
    ],
  });
  const filmOtherZone = materializeAgainst({
    effects: [
      cues()[0]!,
      {
        ...cues()[0]!,
        id: "film-dust",
        zone: "courtyard-dust",
        startFrame: 30,
      },
    ],
  });
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
          conflict.message.includes("courtyard-fog") &&
          conflict.message.includes("35..36"),
      ],
      [
        "filmOverlapNamed",
        () =>
          filmOverlap instanceof AutoMovieFilmEffectRuntimeError &&
          filmOverlap.code === "film-effect-owner-conflict" &&
          filmOverlap.message.includes('"film-fog"') &&
          filmOverlap.message.includes('"film-fog-late"') &&
          filmOverlap.message.includes("courtyard-fog") &&
          filmOverlap.message.includes("30..36"),
      ],
      [
        "filmTouchingRetained",
        () =>
          filmTouching.map((effect) => effect.effect.id).join(",") ===
          "film-fog,film-fog-late",
      ],
      [
        "filmOtherZoneRetained",
        () =>
          filmOtherZone.map((effect) => effect.effect.zone).join(",") ===
          "courtyard-fog,courtyard-dust",
      ],
    ]),
    {
      disjointRetained: true,
      conflictNamed: true,
      filmOverlapNamed: true,
      filmTouchingRetained: true,
      filmOtherZoneRetained: true,
    },
  );

  const project = (
    shots: Array<[string, ReturnType<typeof shotCue>[]]>,
    against: IAutoMovieFilmEffectClock = clock(),
  ) =>
    projectProductionShotEffectFilmIntervals({
      timeline: against,
      shots: new Map(shots.map(([shot, effects]) => [shot, { effects }])),
    });
  const intervals = (
    shots: Array<[string, ReturnType<typeof shotCue>[]]>,
    against?: IAutoMovieFilmEffectClock,
  ): string =>
    project(shots, against)
      .map(
        (interval) =>
          `${interval.shot}/${interval.cue}:${interval.startFrame}..${interval.endFrame}`,
      )
      .join(" ");
  const projectionRefusal = (
    shots: Array<[string, ReturnType<typeof shotCue>[]]>,
    against?: IAutoMovieFilmEffectClock,
  ): string | null => {
    const error = captureError(() => project(shots, against));
    return error instanceof AutoMovieFilmEffectRuntimeError ? error.code : null;
  };
  const fractionalClock = clock({
    fps: 24_000 / 1_001,
    frameRate: { numerator: 24_000, denominator: 1_001 },
  });
  // `1.2929583333333334 * 24000 / 1001` evaluates to `31.000000000000004`, so
  // a projection that trusts `Math.ceil` of the product would start one frame
  // late; the segment is long enough to hold the exact frame 31 answer.
  const longFractionalClock = clock({
    fps: 24_000 / 1_001,
    frameRate: { numerator: 24_000, denominator: 1_001 },
    segments: [
      {
        shot: "shot-a",
        sourceInFrame: 0,
        sourceOutFrame: 60,
        startFrame: 0,
        endFrame: 60,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
  });
  TestValidator.equals(
    "shot cues project onto the film clock by exact frame boundaries",
    namedFacts([
      [
        "ulpAboveInteger",
        () =>
          intervals([["shot-a", [shotCue("a-fog", 1.1, 1.5)]]]) ===
          "shot-a/a-fog:11..15",
      ],
      [
        "noBoundaryInside",
        () => intervals([["shot-a", [shotCue("a-gap", 0.31, 0.36)]]]) === "",
      ],
      [
        "oneBoundaryInside",
        () =>
          intervals([["shot-a", [shotCue("a-late", 0.26, 0.31)]]]) ===
          "shot-a/a-late:3..4",
      ],
      [
        "exactBoundaries",
        () =>
          intervals([["shot-a", [shotCue("a-exact", 0.3, 0.4)]]]) ===
          "shot-a/a-exact:3..4",
      ],
      [
        "trimmedPerOccurrence",
        () =>
          intervals([["shot-b", [shotCue("b-fog", 0.4, 2)]]]) ===
          "shot-b/b-fog:30..45 shot-b/b-fog:54..60",
      ],
      [
        "occurrenceOutsideCue",
        () =>
          intervals([["shot-b", [shotCue("b-tail", 1.5, 2.5)]]]) ===
          "shot-b/b-tail:40..50",
      ],
      [
        "segmentOrderPreserved",
        () =>
          intervals([
            ["shot-b", [shotCue("b-fog", 0.4, 2)]],
            ["shot-a", [shotCue("a-fog", 1.1, 1.5)]],
          ]) === "shot-a/a-fog:11..15 shot-b/b-fog:30..45 shot-b/b-fog:54..60",
      ],
      [
        "unknownShotSkipped",
        () => intervals([["shot-c", [shotCue("c-fog", 0, 1)]]]) === "",
      ],
      ["absentShotSkipped", () => intervals([]) === ""],
      [
        "fractionalRate",
        () =>
          intervals(
            [["shot-a", [shotCue("a-frac", 0.5005, 1.001)]]],
            fractionalClock,
          ) === "shot-a/a-frac:12..24",
      ],
      [
        "ulpAboveBoundaryStartsNextFrame",
        () =>
          intervals([["shot-a", [shotCue("a-ulp", 1.7000000000000002, 2)]]]) ===
          "shot-a/a-ulp:18..20",
      ],
      [
        "productAboveBoundaryStaysOnFrame",
        () =>
          intervals(
            [["shot-a", [shotCue("a-high", 1.2929583333333334, 2)]]],
            longFractionalClock,
          ) === "shot-a/a-high:31..48",
      ],
      [
        "nanStart",
        () =>
          projectionRefusal([["shot-a", [shotCue("a-nan", Number.NaN, 1)]]]) ===
          "film-effect-input-invalid",
      ],
      [
        "emptyInterval",
        () =>
          projectionRefusal([["shot-a", [shotCue("a-empty", 1, 1)]]]) ===
          "film-effect-input-invalid",
      ],
      [
        "negativeStart",
        () =>
          projectionRefusal([["shot-a", [shotCue("a-neg", -0.1, 1)]]]) ===
          "film-effect-input-invalid",
      ],
      [
        "unrepresentableEnd",
        () =>
          projectionRefusal([["shot-a", [shotCue("a-huge", 0, 1e300)]]]) ===
          "film-effect-input-invalid",
      ],
      [
        "inconsistentClock",
        () =>
          projectionRefusal(
            [["shot-a", [shotCue("a-fog", 1.1, 1.5)]]],
            clock({ fps: 10, frameRate: { numerator: 24, denominator: 1 } }),
          ) === "film-effect-input-invalid",
      ],
    ]),
    {
      ulpAboveInteger: true,
      noBoundaryInside: true,
      oneBoundaryInside: true,
      exactBoundaries: true,
      trimmedPerOccurrence: true,
      occurrenceOutsideCue: true,
      segmentOrderPreserved: true,
      unknownShotSkipped: true,
      absentShotSkipped: true,
      fractionalRate: true,
      ulpAboveBoundaryStartsNextFrame: true,
      productAboveBoundaryStaysOnFrame: true,
      nanStart: true,
      emptyInterval: true,
      negativeStart: true,
      unrepresentableEnd: true,
      inconsistentClock: true,
    },
  );

  const filmFrame = (
    shot: string,
    time: number,
    against: IAutoMovieFilmEffectClock = clock(),
  ): number | null =>
    productionFilmFrameForShotTime({ timeline: against, shot, time });
  const hundredFps = clock({
    fps: 100,
    segments: [
      {
        shot: "shot-a",
        sourceInFrame: 0,
        sourceOutFrame: 100,
        startFrame: 0,
        endFrame: 100,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
  });
  TestValidator.equals(
    "shot review seconds map to the one film frame whose boundary owns them",
    namedFacts([
      ["ulpBelowInteger", () => filmFrame("shot-a", 0.57, hundredFps) === 57],
      [
        "ulpBelowBoundaryOwnsPriorFrame",
        () => filmFrame("shot-a", 0.8999999999999999) === 8,
      ],
      ["exactBoundary", () => filmFrame("shot-a", 0.3) === 3],
      ["insideFrame", () => filmFrame("shot-a", 0.35) === 3],
      ["lastOwnedSecond", () => filmFrame("shot-a", 2.999) === 29],
      ["firstSecondOutside", () => filmFrame("shot-a", 3) === null],
      ["singleOccurrenceOffset", () => filmFrame("shot-b", 1.5) === 40],
      ["repeatedOccurrence", () => filmFrame("shot-b", 0.7) === null],
      ["unknownShot", () => filmFrame("shot-c", 0.5) === null],
      ["negativeSecond", () => filmFrame("shot-a", -0.1) === null],
      ["nanSecond", () => filmFrame("shot-a", Number.NaN) === null],
      [
        "infiniteSecond",
        () => filmFrame("shot-a", Number.POSITIVE_INFINITY) === null,
      ],
      [
        "unrepresentableSecond",
        () => filmFrame("shot-a", Number.MAX_VALUE) === null,
      ],
      [
        "inconsistentClock",
        () => {
          const error = captureError(() =>
            filmFrame(
              "shot-a",
              0.3,
              clock({ fps: 10, frameRate: { numerator: 24, denominator: 1 } }),
            ),
          );
          return (
            error instanceof AutoMovieFilmEffectRuntimeError &&
            error.code === "film-effect-input-invalid"
          );
        },
      ],
    ]),
    {
      ulpBelowInteger: true,
      ulpBelowBoundaryOwnsPriorFrame: true,
      exactBoundary: true,
      insideFrame: true,
      lastOwnedSecond: true,
      firstSecondOutside: true,
      singleOccurrenceOffset: true,
      repeatedOccurrence: true,
      unknownShot: true,
      negativeSecond: true,
      nanSecond: true,
      infiniteSecond: true,
      unrepresentableSecond: true,
      inconsistentClock: true,
    },
  );
};
