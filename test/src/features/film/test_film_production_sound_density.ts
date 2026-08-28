import {
  deriveProductionSoundPlan,
  renderProductionSound,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionSoundPlan,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeCompiledInstanceSet,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

const transform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * Two units standing in the SAME footprint, differing only in how many stand in
 * it.
 *
 * A `line` places slot `s` at `x = (s - (files - 1)/2) * lateral`, `z = 0`, so
 * a one-rank line is centered on its anchor and reaches `((files - 1)/2) *
 * lateral` to either side. Picking `4 x 2.65625` and `256 x 0.03125` makes both
 * reaches exactly `3.984375` m, and every value here is a dyadic rational, so
 * the two boxes are bit-identical rather than nearly so. That is the whole
 * point of the fixture: centroid, distance, spread and attenuation are held
 * fixed, and `memberCount` is the only thing left that can move the level.
 */
const unit = (id: string, count: number, lateral: number) =>
  materializeCompiledFormation({
    id,
    modelRecipe: `${id}-model`,
    count,
    layout: {
      kind: "line",
      ranks: 1,
      files: count,
      spacing: { lateral, depth: 1 },
    },
    anchor: { x: 0, y: 0, z: -30 },
    facingDeg: 0,
    seed: 1,
    capabilities: [],
    heroOverrides: [],
  });

const SMALL_COUNT = 4;
const LARGE_COUNT = 256;
const CROWD_COUNT = 100;

/** Half the shared footprint: `(4 - 1)/2 * 2.65625 = (256 - 1)/2 * 0.03125`. */
const HALF_WIDTH = 3.984375;

const contract = (): IAutoMovieShotContract =>
  ({
    id: "density-shot",
    events: [
      { id: "small", subjects: ["small-unit"] },
      { id: "large", subjects: ["large-unit"] },
      { id: "mixed", subjects: ["hero", "crowd"] },
    ].map((event, index) => ({
      ...event,
      // One kind throughout, and the one whose procedural voice is a pure tone:
      // `arrival` mixes `sin(2*pi*(58 + 42*n)*t)` with no seeded noise in it, so
      // two events compared at the same offset differ by their level factors and
      // by nothing else. A noisy kind would make the same comparison a
      // measurement of the seed.
      kind: "arrival",
      window: { from: index * 1.25, to: index * 1.25 + 0.5 },
      predicates: [{}],
    })),
  }) as IAutoMovieShotContract;

const compiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [
      { id: "small", time: 0.25 },
      { id: "large", time: 1.5 },
      { id: "mixed", time: 2.5 },
    ],
    scene: {
      id: "scene",
      name: null,
      nodes: [
        {
          // Off the crowd's own line in BOTH axes. Sharing its depth would let
          // any weighting at all — by member, by subject, or none — put the
          // emitter at the crowd's `z`, and the depth fact would hold without
          // measuring anything.
          id: "hero",
          model: "hero-model",
          transform: transform(20, 0, -10),
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: transform(0, 1, 0),
          fovY: 50,
          near: 0.1,
          far: 200,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: [],
    formationSlotMotions: [],
    effectCues: [],
    shot: {
      id: "density-shot",
      name: null,
      scene: "scene",
      duration: 3,
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
    },
    models: [],
    formations: [
      unit("small-unit", SMALL_COUNT, 2.65625),
      unit("large-unit", LARGE_COUNT, 0.03125),
    ],
    instanceSets: [
      materializeCompiledInstanceSet(
        {
          id: "crowd",
          modelRecipe: "crowd-model",
          count: CROWD_COUNT,
          // One row, so every slot shares the anchor's depth and the set's
          // centroid is the anchor itself: a grid centers its columns on the
          // anchor but grows its rows toward +z, and a crowd whose centroid sat
          // half a grid downrange would make the weighting check below measure
          // the layout instead of the weighting.
          layout: {
            kind: "grid",
            rows: 1,
            columns: CROWD_COUNT,
            spacing: { x: 1, z: 1 },
          },
          anchor: { x: 0, y: 0, z: -30 },
          facingDeg: 0,
          seed: 1,
          variation: {
            scale: { min: 1, max: 1 },
            palette: ["#ffffff"],
            traits: [],
          },
        },
        {
          id: "world",
          units: "meter",
          landmarks: [],
          surfaces: [],
          routes: [],
          effectRecipes: [],
          effectZones: [],
        },
      ),
    ],
    effects: [],
  }) satisfies IAutoMovieCompiledShotSource;

const timeline = (): IAutoMovieFilmTimeline =>
  ({
    version: 1,
    compiler: "test",
    inputFingerprint: digest,
    sourceDigest: digest,
    id: "film",
    fps: 20,
    totalFrames: 60,
    segments: [
      {
        shot: "density-shot",
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
    omissions: [],
    tracks: { audio: [], captions: [], effects: [] },
  }) as IAutoMovieFilmTimeline;

const eventOf = (plan: IAutoMovieProductionSoundPlan, id: string) =>
  plan.events.find((event) => event.event === id)!;

/** Absolute amplitude of one mixed stereo frame, independent of its pan. */
const amplitudeAt = (pcm: Float32Array, frame: number): number =>
  Math.hypot(pcm[frame * 2]!, pcm[frame * 2 + 1]!);

/**
 * A group's sound scales with how many are in it (the sound-design handbook's
 * "distant mass" made measurable), instead of collapsing to a single point
 * emitter at its centroid.
 *
 * Before this, a subject that was a unit contributed exactly one emitter no
 * matter its member count, level was a fixed constant times distance
 * attenuation, and several subjects were averaged into one arithmetic centroid.
 * Three people and a hundred thousand were therefore acoustically identical,
 * and an event naming one hero plus the army behind him emitted from the empty
 * midpoint between them.
 *
 * The model is the ordinary one for many independent sources: uncorrelated
 * sources add in POWER, so `N` of them are `sqrt(N)` in amplitude and
 * `10*log10(N)` dB up, and a source with size is heard at the root-mean-square
 * listener distance `sqrt(d^2 + a^2)` rather than at its centroid, which is an
 * identity (`E|x_i - L|^2 = |c - L|^2 + E|x_i - c|^2`) and not a taste.
 *
 * Scenarios (listener at (0, 1, 0), both units centered on (0, 0, -30)):
 *
 * 1. `memberCount` is the unit's real count, and `densityGain` is exactly its
 *    square root, for a node (one, no size), a formation, and an instance set.
 * 2. A unit has a size: `spreadRadiusMeters` is the RMS radius of the uniform box
 *    the compiled bounds describe, and `attenuation` is taken at
 *    `hypot(distance, spread)`, not at the centroid alone, which is strictly
 *    less than the centroid-only gain the mixer used to apply.
 * 3. The controlled pair: two units in the SAME footprint at the SAME distance,
 *    64x apart in count, come out exactly 8x apart in level, in the plan AND in
 *    the rendered PCM, which is `sqrt(64)` and nothing else.
 * 4. Several subjects combine by member count, not by subject count: one figure
 *    standing 20 m across and 20 m in front of a hundred-strong crowd emits
 *    from `(20/101, -3010/101)`, essentially the crowd's own position, where
 *    the arithmetic mean would have put the sound at `(10, -20)` — ten metres
 *    of empty ground on either axis.
 */
export const test_film_production_sound_density = (): void => {
  const plan = deriveProductionSoundPlan({
    timeline: timeline(),
    contracts: new Map([["density-shot", contract()]]),
    compiled: new Map([["density-shot", compiled()]]),
  });
  const small = eventOf(plan, "small");
  const large = eventOf(plan, "large");
  const mixed = eventOf(plan, "mixed");

  // 1. every event counts its real members and gains by their square root.
  TestValidator.equals(
    "member counts are the units' own, and density gain is their square root",
    namedFacts([
      ["smallCount", () => small.memberCount === SMALL_COUNT],
      ["largeCount", () => large.memberCount === LARGE_COUNT],
      ["mixedCount", () => mixed.memberCount === CROWD_COUNT + 1],
      [
        "gainIsSqrtOfCount",
        () =>
          plan.events.every((event) =>
            nclose(event.densityGain, Math.sqrt(event.memberCount), 1e-12),
          ),
      ],
    ]),
    {
      smallCount: true,
      largeCount: true,
      mixedCount: true,
      gainIsSqrtOfCount: true,
    },
  );

  // 2. a unit has a size, and the size is what the listener is really far from.
  const boxRadius = HALF_WIDTH / Math.sqrt(3);
  TestValidator.equals(
    "spread is the box's RMS radius and attenuation is taken at the RMS distance",
    namedFacts([
      ["smallSpread", () => nclose(small.spreadRadiusMeters, boxRadius, 1e-9)],
      ["largeSpread", () => nclose(large.spreadRadiusMeters, boxRadius, 1e-9)],
      [
        "attenuationAtRmsDistance",
        () =>
          plan.events.every((event) =>
            nclose(
              event.attenuation,
              1 /
                (1 +
                  0.08 *
                    (event.distanceMeters * event.distanceMeters +
                      event.spreadRadiusMeters * event.spreadRadiusMeters)),
              1e-12,
            ),
          ),
      ],
      [
        "spreadShrinksTheDryGain",
        () =>
          small.attenuation <
          1 / (1 + 0.08 * small.distanceMeters * small.distanceMeters),
      ],
    ]),
    {
      smallSpread: true,
      largeSpread: true,
      attenuationAtRmsDistance: true,
      spreadShrinksTheDryGain: true,
    },
  );

  // 3. the controlled pair: same footprint, same distance, 64x the members.
  const rendered = renderProductionSound({ plan });
  const sampleOf = (frame: number): number =>
    amplitudeAt(
      rendered.pcm,
      Math.round((frame / plan.fps) * plan.sampleRate) + 1_000,
    );
  const smallSample = sampleOf(small.frame);
  const largeSample = sampleOf(large.frame);
  TestValidator.equals(
    "sixty-four times the members is exactly eight times the level, in plan and in PCM",
    namedFacts([
      [
        "sameDistance",
        () => nclose(small.distanceMeters, large.distanceMeters),
      ],
      ["sameAttenuation", () => nclose(small.attenuation, large.attenuation)],
      [
        "planLevelRatio",
        () => nclose(large.densityGain / small.densityGain, 8, 1e-12),
      ],
      ["bothAudible", () => smallSample > 0 && largeSample > 0],
      ["pcmLevelRatio", () => nclose(largeSample / smallSample, 8, 1e-4)],
    ]),
    {
      sameDistance: true,
      sameAttenuation: true,
      planLevelRatio: true,
      bothAudible: true,
      pcmLevelRatio: true,
    },
  );

  // 4. subjects combine by member count, not by subject count.
  TestValidator.equals(
    "a hero beside a crowd emits from the crowd, not from the midpoint",
    namedFacts([
      ["weightedX", () => nclose(mixed.emitter.x, 20 / 101, 1e-9)],
      ["notTheMidpoint", () => mixed.emitter.x < 1],
      // (1 x -10 + 100 x -30) / 101. Weighting by subject instead would put it
      // at -20, ten metres of empty ground in front of the crowd.
      ["weightedZ", () => nclose(mixed.emitter.z, -3_010 / 101, 1e-9)],
    ]),
    { weightedX: true, notTheMidpoint: true, weightedZ: true },
  );
};
