import {
  deriveProductionSoundPlan,
  renderProductionSound,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionEventSoundPropagation,
  IAutoMovieProductionSoundPlan,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

const transform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const EVENT_SUBJECTS = [
  ["zero", "zero-source", 0],
  ["below-half-frame", "below-half-frame-source", 0.5],
  ["half-frame", "half-frame-source", 1],
  ["cross-cut", "cross-cut-source", 1.9],
  ["near", "near-source", 2.2],
  ["far", "far-source", 2.6],
  ["moving-first", "moving-source", 3],
  ["moving-second", "moving-source", 3.5],
  ["outside-film", "outside-film-source", 3.9],
] as const;

const contract = (): IAutoMovieShotContract =>
  ({
    id: "propagation-shot",
    events: EVENT_SUBJECTS.map(([id, subject]) => ({
      id,
      kind: "break",
      window: { from: 0, to: 4 },
      subjects: [subject],
      predicates: [{}],
    })),
  }) as IAutoMovieShotContract;

const translationTrack = (
  node: string,
  values: number[],
): IAutoMovieCompiledShotSource["shot"]["objectMotions"][number] => ({
  id: `${node}-translation`,
  name: null,
  duration: 4,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node, path: "translation" },
      times: [0, 2.9, 3, 3.5, 4],
      values,
      interpolation: "linear",
    },
  ],
});

const compiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: EVENT_SUBJECTS.map(([id, , time]) => ({ id, time })),
    scene: {
      id: "scene",
      name: null,
      nodes: [
        ["zero-source", 0],
        ["below-half-frame-source", -4.9],
        ["half-frame-source", -5],
        ["cross-cut-source", -20],
        ["near-source", -10],
        ["far-source", -20],
        ["moving-source", -10],
        ["outside-film-source", -20],
      ].map(([id, z]) => ({
        id: id as string,
        model: `${id}-model`,
        transform: transform(0, 0, z as number),
        motion: null,
        pose: null,
      })),
      cameras: [
        {
          id: "camera",
          transform: transform(0, 0, 0),
          fovY: 50,
          near: 0.1,
          far: 200,
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: [],
    formationSlotMotions: [],
    effectCues: [],
    shot: {
      id: "propagation-shot",
      name: null,
      scene: "scene",
      duration: 4,
      camera: "camera",
      cameraMotion: translationTrack(
        "camera",
        [0, 0, 0, 0, 0, 0, 30, 0, 0, 35, 0, 0, 40, 0, 0],
      ),
      performances: [],
      objectMotions: [
        translationTrack(
          "moving-source",
          [0, 0, -10, 0, 0, -10, 30, 0, -10, 35, 0, -10, 40, 0, -10],
        ),
      ],
    },
    models: [],
    formations: [],
    instanceSets: [],
    effects: [],
  }) satisfies IAutoMovieCompiledShotSource;

const timeline = (): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "test",
  inputFingerprint: digest,
  sourceDigest: digest,
  id: "film",
  fps: 10,
  totalFrames: 40,
  segments: [
    {
      shot: "propagation-shot",
      sourceInFrame: 0,
      sourceOutFrame: 20,
      startFrame: 0,
      endFrame: 20,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
    {
      shot: "propagation-shot",
      sourceInFrame: 20,
      sourceOutFrame: 40,
      startFrame: 20,
      endFrame: 40,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
  ],
  omissions: [],
  tracks: { audio: [], captions: [], effects: [] },
});

const LOSS_FOR_HALF_AT_TEN_METERS = 20 * Math.log10(2) * 0.1;

const propagation = (
  airAbsorption: IAutoMovieProductionEventSoundPropagation["airAbsorption"] = {
    crossoverHz: 1_000,
    highBandLossDecibelsPerMeter: LOSS_FOR_HALF_AT_TEN_METERS,
  },
): IAutoMovieProductionEventSoundPropagation => ({
  kind: "direct-path-v1",
  speedOfSoundMetersPerSecond: 100,
  airAbsorption,
});

const plan = (
  eventSoundPropagation?: IAutoMovieProductionEventSoundPropagation | null,
): IAutoMovieProductionSoundPlan =>
  deriveProductionSoundPlan({
    timeline: timeline(),
    contracts: new Map([["propagation-shot", contract()]]),
    compiled: new Map([["propagation-shot", compiled()]]),
    propagation: eventSoundPropagation,
  });

const eventOf = (sound: IAutoMovieProductionSoundPlan, id: string) =>
  sound.events.find((event) => event.event === id)!;

const renderEvent = (
  sound: IAutoMovieProductionSoundPlan,
  id: string,
  transformEvent: (
    event: IAutoMovieProductionSoundPlan["events"][number],
  ) => IAutoMovieProductionSoundPlan["events"][number] = (event) => event,
) =>
  renderProductionSound({
    plan: {
      ...sound,
      events: [transformEvent(eventOf(sound, id))],
      cues: [],
      dialogue: [],
    },
  });

const differenceEnergy = (pcm: Float32Array): number => {
  let previous = 0;
  let energy = 0;
  for (let frame = 0; frame < pcm.length / 2; ++frame) {
    const current = (pcm[frame * 2]! + pcm[frame * 2 + 1]!) * 0.5;
    const difference = current - previous;
    energy += difference * difference;
    previous = current;
  }
  return energy;
};

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

/**
 * One declared direct path separates causal emission from audible arrival
 * without turning an intentionally bounded event mix into a wave simulation.
 *
 * Scenarios:
 *
 * 1. Hand-calculated distances produce exact unrounded delays, half-up frame
 *    arrivals, and two-band gains while emission identity remains unchanged.
 * 2. An event emitted before a cut arrives after it and remains audible; an
 *    arrival beyond the finished film remains accounted for and fails audible
 *    alignment instead of disappearing.
 * 3. A camera and emitter translated together at two emission times retain the
 *    same relative path, pan, delay, and absorption without claiming in-flight
 *    listener motion or Doppler.
 * 4. The declared high-band gain is consumed by the mixer, while explicit absent
 *    absorption and zero distance preserve the corresponding dry bytes.
 * 5. Invalid speed, crossover, loss, unsafe arrival, and a plan whose gain has no
 *    crossover are refused at the deterministic boundary.
 */
export const test_film_production_sound_propagation = (): void => {
  const direct = plan(propagation());
  const immediate = plan();
  const noAbsorption = plan(propagation(null));
  const zero = eventOf(direct, "zero");
  const below = eventOf(direct, "below-half-frame");
  const half = eventOf(direct, "half-frame");
  const near = eventOf(direct, "near");
  const far = eventOf(direct, "far");

  TestValidator.equals(
    "declared path math keeps emission and derives bounded audible arrival",
    namedFacts([
      ["zeroDelay", () => zero.propagationDelaySeconds === 0],
      ["zeroArrival", () => zero.arrivalFrame === zero.frame],
      ["zeroAbsorptionIdentity", () => zero.airAbsorptionHighBandGain === 1],
      [
        "representativePath",
        () =>
          direct.events.every((event) =>
            nclose(
              event.propagationDistanceMeters,
              Math.hypot(event.distanceMeters, event.spreadRadiusMeters),
              1e-12,
            ),
          ),
      ],
      ["belowHalfRoundsDown", () => below.arrivalFrame === below.frame],
      ["halfRoundsUp", () => half.arrivalFrame === half.frame + 1],
      ["nearDelay", () => nclose(near.propagationDelaySeconds, 0.1)],
      ["nearArrival", () => near.arrivalFrame === near.frame + 1],
      ["nearHighBand", () => nclose(near.airAbsorptionHighBandGain!, 0.5)],
      ["farHighBand", () => nclose(far.airAbsorptionHighBandGain!, 0.25)],
      [
        "emissionIdentity",
        () =>
          direct.events.every(
            (event) => event.timeSeconds === event.frame / direct.fps,
          ),
      ],
    ]),
    {
      zeroDelay: true,
      zeroArrival: true,
      zeroAbsorptionIdentity: true,
      representativePath: true,
      belowHalfRoundsDown: true,
      halfRoundsUp: true,
      nearDelay: true,
      nearArrival: true,
      nearHighBand: true,
      farHighBand: true,
      emissionIdentity: true,
    },
  );

  const crossing = eventOf(direct, "cross-cut");
  const crossingSound = renderEvent(direct, "cross-cut");
  const crossingEvidence = crossingSound.analysis.eventAlignment[0]!;
  const outsideSound = renderEvent(direct, "outside-film");
  TestValidator.equals(
    "arrival crosses visual cuts but not the finished-film evidence boundary",
    namedFacts([
      ["emittedBeforeCut", () => crossing.frame === 19],
      ["arrivedAfterCut", () => crossing.arrivalFrame === 21],
      ["crossingAudible", () => crossingEvidence.passed],
      ["emissionEvidence", () => crossingEvidence.emissionSeconds === 1.9],
      ["arrivalEvidence", () => crossingEvidence.expectedSeconds === 2.1],
      [
        "outsideStillPlanned",
        () =>
          eventOf(direct, "outside-film").arrivalFrame >= direct.totalFrames,
      ],
      [
        "outsideFailsAudibleAlignment",
        () => outsideSound.analysis.eventAlignment[0]?.passed === false,
      ],
    ]),
    {
      emittedBeforeCut: true,
      arrivedAfterCut: true,
      crossingAudible: true,
      emissionEvidence: true,
      arrivalEvidence: true,
      outsideStillPlanned: true,
      outsideFailsAudibleAlignment: true,
    },
  );

  const movingFirst = eventOf(direct, "moving-first");
  const movingSecond = eventOf(direct, "moving-second");
  TestValidator.equals(
    "co-moving endpoints are sampled together on emission time",
    namedFacts([
      ["firstListenerMoved", () => movingFirst.listener.x === 30],
      ["secondListenerMoved", () => movingSecond.listener.x === 35],
      ["firstEmitterMoved", () => movingFirst.emitter.x === 30],
      ["secondEmitterMoved", () => movingSecond.emitter.x === 35],
      [
        "relativeDistanceStable",
        () => nclose(movingFirst.distanceMeters, movingSecond.distanceMeters),
      ],
      [
        "relativeDelayStable",
        () =>
          nclose(
            movingFirst.propagationDelaySeconds,
            movingSecond.propagationDelaySeconds,
          ),
      ],
      ["relativePanStable", () => movingFirst.pan === movingSecond.pan],
      [
        "relativeAbsorptionStable",
        () =>
          nclose(
            movingFirst.airAbsorptionHighBandGain!,
            movingSecond.airAbsorptionHighBandGain!,
          ),
      ],
    ]),
    {
      firstListenerMoved: true,
      secondListenerMoved: true,
      firstEmitterMoved: true,
      secondEmitterMoved: true,
      relativeDistanceStable: true,
      relativeDelayStable: true,
      relativePanStable: true,
      relativeAbsorptionStable: true,
    },
  );

  const filtered = renderEvent(direct, "near");
  const dryAtArrival = renderEvent(direct, "near", (event) => ({
    ...event,
    airAbsorptionHighBandGain: 1,
  }));
  const explicitlyDry = renderEvent(noAbsorption, "near");
  const activeZero = renderEvent(direct, "zero");
  const immediateZero = renderEvent(immediate, "zero");
  TestValidator.equals(
    "the mixer consumes declared high-band loss and preserves dry identities",
    namedFacts([
      [
        "highBandEnergyFalls",
        () =>
          differenceEnergy(filtered.pcm) < differenceEnergy(dryAtArrival.pcm),
      ],
      [
        "absentAbsorptionIsDry",
        () =>
          Buffer.from(explicitlyDry.pcm.buffer).equals(
            Buffer.from(dryAtArrival.pcm.buffer),
          ),
      ],
      [
        "zeroDistanceIsByteIdentical",
        () =>
          Buffer.from(activeZero.pcm.buffer).equals(
            Buffer.from(immediateZero.pcm.buffer),
          ),
      ],
      [
        "undeclaredModelIsImmediate",
        () =>
          immediate.events.every(
            (event) =>
              event.arrivalFrame === event.frame &&
              event.propagationDelaySeconds === 0 &&
              event.airAbsorptionHighBandGain === null,
          ),
      ],
      ["undeclaredPlanRecordsAbsence", () => immediate.propagation === null],
    ]),
    {
      highBandEnergyFalls: true,
      absentAbsorptionIsDry: true,
      zeroDistanceIsByteIdentical: true,
      undeclaredModelIsImmediate: true,
      undeclaredPlanRecordsAbsence: true,
    },
  );

  TestValidator.equals(
    "malformed or numerically unbounded propagation is refused",
    namedFacts([
      [
        "unknownKind",
        () =>
          refused(
            () =>
              plan({
                ...propagation(),
                kind: "direct-path-v2",
              } as unknown as IAutoMovieProductionEventSoundPropagation),
            "kind",
          ),
      ],
      [
        "zeroSpeed",
        () =>
          refused(
            () => plan({ ...propagation(), speedOfSoundMetersPerSecond: 0 }),
            "speed",
          ),
      ],
      [
        "nonFiniteSpeed",
        () =>
          refused(
            () =>
              plan({
                ...propagation(),
                speedOfSoundMetersPerSecond: Number.NaN,
              }),
            "speed",
          ),
      ],
      [
        "upperCrossover",
        () =>
          refused(
            () =>
              plan(
                propagation({
                  crossoverHz: 24_000,
                  highBandLossDecibelsPerMeter: 0,
                }),
              ),
            "crossover",
          ),
      ],
      [
        "lowerCrossover",
        () =>
          refused(
            () =>
              plan(
                propagation({
                  crossoverHz: 0,
                  highBandLossDecibelsPerMeter: 0,
                }),
              ),
            "crossover",
          ),
      ],
      [
        "nonFiniteCrossover",
        () =>
          refused(
            () =>
              plan(
                propagation({
                  crossoverHz: Number.NaN,
                  highBandLossDecibelsPerMeter: 0,
                }),
              ),
            "crossover",
          ),
      ],
      [
        "negativeLoss",
        () =>
          refused(
            () =>
              plan(
                propagation({
                  crossoverHz: 1_000,
                  highBandLossDecibelsPerMeter: -1,
                }),
              ),
            "high-band loss",
          ),
      ],
      [
        "nonFiniteLoss",
        () =>
          refused(
            () =>
              plan(
                propagation({
                  crossoverHz: 1_000,
                  highBandLossDecibelsPerMeter: Number.NaN,
                }),
              ),
            "high-band loss",
          ),
      ],
      [
        "unsafeArrival",
        () =>
          refused(
            () =>
              plan({
                ...propagation(null),
                speedOfSoundMetersPerSecond: Number.MIN_VALUE,
              }),
            "safe film-frame range",
          ),
      ],
      [
        "gainWithoutCrossover",
        () =>
          refused(
            () =>
              renderProductionSound({
                plan: {
                  ...direct,
                  propagation: null,
                  events: [near],
                  cues: [],
                  dialogue: [],
                },
              }),
            "without a propagation crossover",
          ),
      ],
    ]),
    {
      unknownKind: true,
      zeroSpeed: true,
      nonFiniteSpeed: true,
      upperCrossover: true,
      lowerCrossover: true,
      nonFiniteCrossover: true,
      negativeLoss: true,
      nonFiniteLoss: true,
      unsafeArrival: true,
      gainWithoutCrossover: true,
    },
  );
};
