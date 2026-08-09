import {
  IAutoMovieCompiledDefinedShot,
  compileDefinedShot,
  defineShot,
  inheritProductionLighting,
} from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieLight,
  IAutoMovieProductionDesign,
  IAutoMovieProductionLighting,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
  IAutoMovieShotContract,
  IAutoMovieShotStoryTime,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM, createSkeleton } from "../internal/fixtures";
import { namedFacts, nclose } from "../internal/predicates";

/** The story span the production's source travels across, in story seconds. */
const SPAN = 600;

/** The production's one declared source, carried at story time zero. */
const key: IAutoMovieLight = {
  id: "key",
  type: "directional",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 1, b: 1, a: null, hex: null },
  intensity: 3,
};

/** A light the scene stages for itself, which the production never addresses. */
const practical: IAutoMovieLight = {
  id: "practical",
  type: "point",
  transform: IDENTITY_TRANSFORM,
  color: { r: 1, g: 0.9, b: 0.7, a: null, hex: null },
  intensity: 1.4,
  range: 4,
};

const productionLighting = (): IAutoMovieProductionLighting => ({
  id: "span-light",
  name: null,
  lights: [key],
  motions: [
    {
      id: "keyFades",
      name: null,
      duration: SPAN,
      loop: false,
      tracks: [
        {
          channel: {
            kind: "pointer",
            pointer: "/lights/key/intensity",
            valueType: "scalar",
          },
          times: [0, SPAN],
          values: [3, 1],
          interpolation: "linear",
        },
      ],
    },
  ],
});

const productionDesign = (
  lighting?: IAutoMovieProductionLighting,
): IAutoMovieProductionDesign => ({
  id: "span",
  title: "One source across a span",
  logline: "A production states its light once and every shot reads it.",
  targetRuntimeSeconds: 8,
  visualDelivery: "deterministic",
  storyClock: {
    units: "second",
    epoch: "Story time zero is the instant the span opens.",
  },
  ...(lighting === undefined ? {} : { lighting }),
  frameFormat: { width: 1920, height: 1080, fps: 24, colorSpace: "srgb" },
  artDirection: {
    style: "primitive-3d",
    palette: ["#101010", "#f0f0f0"],
    silhouettePriority: "Keep every required subject separable from the set.",
    scaleGrammar: "Read scale from the shared ground plane.",
  },
  deliverables: [{ id: "preview", kind: "preview", required: true }],
});

const pinnedContract = (
  id: string,
  storyTime: IAutoMovieShotStoryTime,
): IAutoMovieShotContract => ({
  id,
  beat: `beat-${id}`,
  source: { module: `src/shots/${id}.ts`, export: id },
  durationSeconds: 4,
  storyTime,
  participants: [],
  opening: [],
  closing: [],
  camera: {
    intent: "Hold the required subject readable.",
    requiredSubjects: ["knightA"],
    maxOcclusionRatio: 0.2,
  },
  events: [],
  reviewFrames: [{ id: `${id}-entry`, time: 0, passes: ["beauty"] }],
});

/**
 * The two fields a source builder reads to light itself, assembled exactly as
 * the production compiler assembles them: the shot's own contract, and the
 * production's lighting when it declares any.
 */
const buildContext = (
  design: IAutoMovieProductionDesign,
  contract: IAutoMovieShotContract,
): Pick<IAutoMovieShotBuildContext, "contract" | "lighting"> => ({
  contract,
  lighting: design.lighting,
});

/** What one shot is lit by at its own opening moment. */
const openingLights = (
  context: Pick<IAutoMovieShotBuildContext, "contract" | "lighting">,
  staged: readonly IAutoMovieLight[],
): IAutoMovieLight[] =>
  inheritProductionLighting({
    lighting: context.lighting ?? null,
    lights: staged,
    pin: context.contract.storyTime ?? null,
    seconds: 0,
  });

const intensityOf = (lights: readonly IAutoMovieLight[], id: string): number =>
  lights.find((light) => light.id === id)!.intensity;

/** The shot program the engine ladder compiles, with room for a light clip. */
const shotProgram = (
  lightMotions?: IAutoMovieClip[],
): IAutoMovieProductionShotProgram => {
  const blocking = makeBlockingWrite();
  const performance = makePerformanceWrite();
  blocking.camera.framing = "full";
  blocking.rationale =
    "full static keeps both required actor roots readable throughout.";
  for (const action of performance.draft)
    if (action.verb === "frame") action.framing = "full";
  return {
    actors: [
      { node: "knightA", model: "knightA", speed: 1, eyeHeight: 1.6 },
      { node: "knightB", model: "knightB", speed: 1, eyeHeight: 1.6 },
    ],
    script: makeScriptWrite(),
    stage: makeStagingWrite(),
    blocking,
    performance,
    eventSamples: [],
    ...(lightMotions === undefined ? {} : { lightMotions }),
  };
};

/** A clip dimming the staged source over this shot's own two seconds. */
const dim = (): IAutoMovieClip => ({
  id: "sunDims",
  name: null,
  duration: 2,
  loop: false,
  tracks: [
    {
      channel: {
        kind: "pointer",
        pointer: "/lights/sun/intensity",
        valueType: "scalar",
      },
      times: [0, 2],
      values: [1, 0.25],
      interpolation: "linear",
    },
  ],
});

const compileWith = (
  lightMotions?: IAutoMovieClip[],
): IAutoMovieCompiledDefinedShot => {
  const program = shotProgram(lightMotions);
  return compileDefinedShot({
    shot: defineShot("SB-LIGHT", {
      scene: "scene-duel",
      contract: {
        beat: "beat-1",
        durationSeconds: 2,
        participants: [
          { kind: "actor", id: "knightA" },
          { kind: "actor", id: "knightB" },
        ],
        opening: [],
        closing: [],
        camera: {
          intent: "Keep both figures readable.",
          requiredSubjects: ["knightA", "knightB"],
          maxOcclusionRatio: 0.2,
        },
        events: [],
        reviewFrames: [{ id: "middle", time: 1, passes: ["beauty"] }],
      },
      build: () => program,
    }),
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      // Exactly the handoff the production compiler makes: the program's own
      // statement about light, or nothing at all.
      lightMotions: program.lightMotions,
    },
  });
};

/**
 * A production can state its light, and a shot can carry its own.
 *
 * `inheritProductionLighting` worked and light placement was an animatable
 * channel, but no design record, build context or compiled shot carried either
 * one: a film of any length was lit by one unchanging rig with the machinery to
 * change it sitting unreachable. These cases pin the three joins that make it
 * reachable, and pin that a production saying nothing about light is
 * untouched.
 *
 * Scenarios:
 *
 * 1. One production source lights two shots differently, because each shot reads
 *    it at the story moment its own pin fixes: the source ramps from 3 to 1
 *    across the span, so a shot pinned at its opening reads 3 and one pinned
 *    halfway reads 2.
 * 2. A production stating no lighting leaves the shot's staged lights exactly as
 *    staged, element for element.
 * 3. A shot program's own `lightMotions` reach the compiled shot, and a program
 *    stating none compiles a shot carrying no such field at all.
 */
export const test_film_production_lighting_wiring = (): void => {
  const design = productionDesign(productionLighting());
  const opening = buildContext(
    design,
    pinnedContract("opening", {
      originSeconds: 0,
    }),
  );
  const later = buildContext(
    design,
    pinnedContract("later", {
      originSeconds: SPAN / 2,
    }),
  );
  const staged = [key, practical];
  TestValidator.equals(
    "one declared source lights two shots differently at different story times",
    namedFacts([
      ["reaches the opening context", () => opening.lighting !== undefined],
      ["reaches the later context", () => later.lighting !== undefined],
      [
        "opening reads the source at the span's start",
        () => nclose(intensityOf(openingLights(opening, staged), "key"), 3),
      ],
      [
        "later reads the same source halfway along",
        () => nclose(intensityOf(openingLights(later, staged), "key"), 2),
      ],
      [
        "the shot's own light is untouched by the production",
        () =>
          nclose(intensityOf(openingLights(later, staged), "practical"), 1.4),
      ],
    ]),
    {
      "reaches the opening context": true,
      "reaches the later context": true,
      "opening reads the source at the span's start": true,
      "later reads the same source halfway along": true,
      "the shot's own light is untouched by the production": true,
    },
  );

  const unlit = buildContext(
    productionDesign(),
    pinnedContract("unlit", { originSeconds: 0 }),
  );
  TestValidator.equals(
    "a production stating no lighting leaves the staged lights unchanged",
    namedFacts([
      ["declares nothing", () => unlit.lighting === undefined],
      [
        "same lights, in order",
        () =>
          openingLights(unlit, staged).every(
            (light, index) => light === staged[index],
          ),
      ],
      ["same count", () => openingLights(unlit, staged).length === 2],
    ]),
    {
      "declares nothing": true,
      "same lights, in order": true,
      "same count": true,
    },
  );

  const lit = compileWith([dim()]);
  const dark = compileWith();
  TestValidator.equals(
    "a shot's own light clips reach the compiled shot",
    namedFacts([
      ["compiles", () => lit.success],
      [
        "carries one clip",
        () => lit.success && lit.source.shot.lightMotions?.length === 1,
      ],
      [
        "carries the authored clip",
        () =>
          lit.success && lit.source.shot.lightMotions?.[0]?.id === "sunDims",
      ],
      [
        "addresses the staged source",
        () =>
          lit.success &&
          lit.source.shot.lightMotions?.[0]?.tracks[0]?.channel.kind ===
            "pointer",
      ],
      ["a program stating none compiles", () => dark.success],
      [
        "and carries no light field",
        () => dark.success && "lightMotions" in dark.source.shot === false,
      ],
    ]),
    {
      compiles: true,
      "carries one clip": true,
      "carries the authored clip": true,
      "addresses the staged source": true,
      "a program stating none compiles": true,
      "and carries no light field": true,
    },
  );
};
