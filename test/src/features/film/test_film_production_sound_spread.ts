import {
  deriveProductionSoundPlan,
  renderProductionSound,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationMotion,
  IAutoMovieProductionSoundPlan,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { materializeCompiledFormation } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

const transform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** Where the listener stands, and where the far mass and the lone source are. */
const LISTENER = { x: 0, y: 1, z: 0 };
const FAR_Z = -30;
const LONE_X = 24;

/** The far mass: one rank of five at four-metre intervals, so it reaches 8 m. */
const CROWD_COUNT = 5;
const CROWD_INTERVAL = 4;
const CROWD_REACH = ((CROWD_COUNT - 1) / 2) * CROWD_INTERVAL;

/** The near mass: many members packed tight, two metres from the listener. */
const NEAR_COUNT = 400;
const NEAR_INTERVAL = 0.02;
const NEAR_REACH = ((NEAR_COUNT - 1) / 2) * NEAR_INTERVAL;
const NEAR_Z = -2;

/** How far the cue closes the far mass's own intervals, and over how long. */
const CLOSED = 0.5;
const CUE_END = 2;

/**
 * One rank of `count` members on a stated line, as the compiler materializes
 * it.
 */
const unit = (props: {
  id: string;
  count: number;
  interval: number;
  z: number;
}) =>
  materializeCompiledFormation({
    id: props.id,
    modelRecipe: `${props.id}-model`,
    count: props.count,
    layout: {
      kind: "line",
      ranks: 1,
      files: props.count,
      spacing: { lateral: props.interval, depth: 1 },
    },
    anchor: { x: 0, y: 0, z: props.z },
    facingDeg: 0,
    seed: 1,
    capabilities: [],
    heroOverrides: [],
  });

/**
 * The far mass closes its own intervals to half of themselves.
 *
 * Translation stays at zero throughout, and the anchor is the unit's own
 * centroid, so nothing about where the mass is heard from moves: the cue
 * changes how large it is and nothing else, which is what leaves the spread as
 * the only quantity a case below can be reading.
 */
const CLOSE_RANKS: IAutoMovieFormationMotion[] = [
  {
    id: "close-ranks",
    formation: "crowd",
    action: "hold",
    start: 0,
    end: CUE_END,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: CLOSED, depth: 1 },
    },
    easing: "linear",
  },
];

const contract = (): IAutoMovieShotContract =>
  ({
    id: "spread-shot",
    events: [
      { id: "rest", subjects: ["crowd"] },
      { id: "closed", subjects: ["crowd"] },
      { id: "mixed", subjects: ["lone", "crowd"] },
      { id: "near", subjects: ["near-crowd"] },
    ].map((event) => ({
      ...event,
      // One kind throughout, and the one whose procedural voice carries no
      // seeded noise, so two events compared at the same offset differ by their
      // level factors and by nothing else.
      kind: "arrival",
      window: { from: 0, to: 4 },
      predicates: [{}],
    })),
  }) as IAutoMovieShotContract;

const compiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [
      { id: "rest", time: 0 },
      { id: "mixed", time: 0 },
      { id: "closed", time: CUE_END },
      { id: "near", time: 3 },
    ],
    scene: {
      id: "scene",
      name: null,
      nodes: [
        {
          id: "lone",
          model: "lone-model",
          transform: transform(LONE_X, 0, FAR_Z),
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: transform(LISTENER.x, LISTENER.y, LISTENER.z),
          fovY: 50,
          near: 0.1,
          far: 200,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: CLOSE_RANKS,
    formationSlotMotions: [],
    effectCues: [],
    shot: {
      id: "spread-shot",
      name: null,
      scene: "scene",
      duration: 4,
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
    },
    models: [],
    formations: [
      unit({
        id: "crowd",
        count: CROWD_COUNT,
        interval: CROWD_INTERVAL,
        z: FAR_Z,
      }),
      unit({
        id: "near-crowd",
        count: NEAR_COUNT,
        interval: NEAR_INTERVAL,
        z: NEAR_Z,
      }),
    ],
    instanceSets: [],
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
    totalFrames: 80,
    segments: [
      {
        shot: "spread-shot",
        sourceInFrame: 0,
        sourceOutFrame: 80,
        startFrame: 0,
        endFrame: 80,
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

/**
 * The mean squared distance from the centre of a box to a point drawn uniformly
 * inside it, over its half-extents: one third of its squared half-diagonal.
 */
const boxVariance = (half: { x: number; y: number; z: number }): number =>
  (half.x * half.x + half.y * half.y + half.z * half.z) / 3;

/** Squared distance between two points. */
const squaredDistance = (
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2;

/**
 * A group of sources is heard as ONE extended source, and how far it is spread
 * is the parallel-axis sum of its parts rather than an average of them.
 *
 * A source with size is heard at the root-mean-square listener distance, so how
 * far a group is spread is the one quantity that decides both its pan and its
 * attenuation. For several subjects that quantity does not average: the members
 * of each subject are spread about their OWN centre, and every one of those
 * centres is itself displaced from the group's. Dropping the displacement — the
 * cross term — makes one figure standing 24 m from a mass acoustically the same
 * as one standing inside it, which is the whole of what the identity `variance
 * = sum_i n_i (variance_i + |c_i - c|^2) / sum_i n_i` exists to refuse. It is
 * an identity and not a taste, so the oracle below is arithmetic over the
 * fixture's own geometry and never a reading of the plan.
 *
 * A cue is likewise the only thing that changes how large a mass is. A unit
 * that closes its intervals is smaller, and a mix that went on hearing it at
 * its designed width would be describing an arrangement the shot no longer
 * holds.
 *
 * Scenarios:
 *
 * 1. A lone mass is heard at the RMS radius of the box its compiled bounds
 *    describe: one rank of five at four-metre intervals reaches 8 m, so the
 *    spread is `8 / sqrt(3)`.
 * 2. That mass closing its own intervals to half is heard at half the spread, at
 *    the same count and from the same place, so what the cue changed is the
 *    size and nothing else. Reading the designed bounds instead would report
 *    the same number twice.
 * 3. A lone source beside that mass is one combined source whose spread is the
 *    parallel-axis sum, which is strictly larger than either the mass's own
 *    spread or the count-weighted mean of the two variances. That second
 *    comparison is the cross term: without it the answer would be 4.216 m
 *    rather than 9.888 m.
 * 4. The post-mix limiter owns the headroom a crowd's own level does not: a mass
 *    of four hundred two metres from the listener mixes far past full scale and
 *    comes back at exactly 0.95 with nothing clipped, while the same plan
 *    without it is left alone below that ceiling.
 */
export const test_film_production_sound_spread = (): void => {
  const plan = deriveProductionSoundPlan({
    timeline: timeline(),
    contracts: new Map([["spread-shot", contract()]]),
    compiled: new Map([["spread-shot", compiled()]]),
  });
  const rest = eventOf(plan, "rest");
  const closed = eventOf(plan, "closed");
  const mixed = eventOf(plan, "mixed");

  // 1. the designed box.
  const restVariance = boxVariance({ x: CROWD_REACH, y: 0, z: 0 });
  TestValidator.equals(
    "a mass is heard at the RMS radius of the box its bounds describe",
    namedFacts([
      ["count", () => rest.memberCount === CROWD_COUNT],
      [
        "spread",
        () => nclose(rest.spreadRadiusMeters, Math.sqrt(restVariance), 1e-9),
      ],
      [
        "emitter",
        () =>
          nclose(rest.emitter.x, 0, 1e-9) &&
          nclose(rest.emitter.z, FAR_Z, 1e-9),
      ],
    ]),
    { count: true, spread: true, emitter: true },
  );

  // 2. the cue closes it, and only its size moves.
  const closedVariance = boxVariance({ x: CROWD_REACH * CLOSED, y: 0, z: 0 });
  TestValidator.equals(
    "a cue that closes a mass's intervals is heard as the smaller mass it makes",
    namedFacts([
      ["sameCount", () => closed.memberCount === CROWD_COUNT],
      [
        "sameEmitter",
        () =>
          nclose(closed.emitter.x, rest.emitter.x, 1e-9) &&
          nclose(closed.emitter.z, rest.emitter.z, 1e-9),
      ],
      [
        "spread",
        () =>
          nclose(closed.spreadRadiusMeters, Math.sqrt(closedVariance), 1e-9),
      ],
      // Exactly half, because the cue halved the one axis the box has.
      [
        "halfTheDesignedSpread",
        () =>
          nclose(
            closed.spreadRadiusMeters,
            rest.spreadRadiusMeters * CLOSED,
            1e-9,
          ),
      ],
      // And the attenuation moves with it, because spread is what the RMS
      // listener distance is taken at.
      ["louderClosed", () => closed.attenuation > rest.attenuation],
    ]),
    {
      sameCount: true,
      sameEmitter: true,
      spread: true,
      halfTheDesignedSpread: true,
      louderClosed: true,
    },
  );

  // 3. the parallel-axis sum, computed from the fixture's own geometry.
  const combinedCount = CROWD_COUNT + 1;
  const lone = { x: LONE_X, y: 0, z: FAR_Z };
  const crowdCentre = { x: 0, y: 0, z: FAR_Z };
  const combinedCentre = {
    x: (lone.x + CROWD_COUNT * crowdCentre.x) / combinedCount,
    y: (lone.y + CROWD_COUNT * crowdCentre.y) / combinedCount,
    z: (lone.z + CROWD_COUNT * crowdCentre.z) / combinedCount,
  };
  const combinedVariance =
    (1 * (0 + squaredDistance(lone, combinedCentre)) +
      CROWD_COUNT *
        (restVariance + squaredDistance(crowdCentre, combinedCentre))) /
    combinedCount;
  /** The same sum with the displacement dropped: what an average would say. */
  const withoutTheCrossTerm =
    (1 * 0 + CROWD_COUNT * restVariance) / combinedCount;
  TestValidator.equals(
    "several subjects combine by the parallel-axis identity, cross term included",
    namedFacts([
      ["count", () => mixed.memberCount === combinedCount],
      [
        "weightedCentre",
        () =>
          nclose(mixed.emitter.x, combinedCentre.x, 1e-9) &&
          nclose(mixed.emitter.z, combinedCentre.z, 1e-9),
      ],
      [
        "spread",
        () =>
          nclose(mixed.spreadRadiusMeters, Math.sqrt(combinedVariance), 1e-9),
      ],
      // The two comparisons that make the assertion above falsifiable: the
      // combined spread is neither the mass's own nor the weighted mean of the
      // parts, and the gap between it and the mean IS the displacement.
      [
        "widerThanTheMassAlone",
        () => mixed.spreadRadiusMeters > rest.spreadRadiusMeters,
      ],
      [
        "widerThanTheMeanOfTheParts",
        () =>
          mixed.spreadRadiusMeters > Math.sqrt(withoutTheCrossTerm) + 1 &&
          nclose(Math.sqrt(withoutTheCrossTerm), 4.216, 1e-3),
      ],
    ]),
    {
      count: true,
      weightedCentre: true,
      spread: true,
      widerThanTheMassAlone: true,
      widerThanTheMeanOfTheParts: true,
    },
  );

  // 4. the limiter owns the headroom, and only when there is none left.
  const loud = renderProductionSound({ plan });
  const quiet = renderProductionSound({
    plan: {
      ...plan,
      events: plan.events.filter((event) => event.event !== "near"),
    },
  });
  TestValidator.equals(
    "a mass loud enough to leave no headroom is limited, and a plan with headroom is not",
    namedFacts([
      ["near", () => eventOf(plan, "near").memberCount === NEAR_COUNT],
      // Four hundred uncorrelated sources two metres away mix an order of
      // magnitude past full scale before the limiter reads the peak.
      [
        "wouldHaveClipped",
        () =>
          (0.5 *
            eventOf(plan, "near").attenuation *
            eventOf(plan, "near").densityGain) /
            Math.SQRT2 >
          1,
      ],
      [
        "limitedToTheCeiling",
        () => nclose(loud.analysis.samplePeak, 0.95, 1e-6),
      ],
      ["nothingClipped", () => loud.analysis.clippingSamples === 0],
      ["quietIsAudible", () => quiet.analysis.samplePeak > 0],
      ["quietIsLeftAlone", () => quiet.analysis.samplePeak < 0.95],
      // And the near mass really is what raised it, rather than the ceiling
      // being where a quiet plan lands anyway.
      [
        "theNearMassRaisedIt",
        () => loud.analysis.samplePeak > quiet.analysis.samplePeak,
      ],
    ]),
    {
      near: true,
      wouldHaveClipped: true,
      limitedToTheCeiling: true,
      nothingClipped: true,
      quietIsAudible: true,
      quietIsLeftAlone: true,
      theNearMassRaisedIt: true,
    },
  );

  TestValidator.equals(
    "the near mass is measured as the tight box it is",
    nclose(
      eventOf(plan, "near").spreadRadiusMeters,
      Math.sqrt(boxVariance({ x: NEAR_REACH, y: 0, z: 0 })),
      1e-9,
    ),
    true,
  );
};
