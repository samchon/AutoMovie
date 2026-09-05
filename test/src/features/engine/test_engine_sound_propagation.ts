import {
  deriveAutoMovieSoundPropagation,
  deriveProductionSoundPlan,
  productionPhonemesToVisemes,
  renderProductionSound,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieAcousticResponseProfile,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionSoundPlan,
  IAutoMovieShotContract,
  IAutoMovieSoundPropagationProfile,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

const profile = (): IAutoMovieSoundPropagationProfile => ({
  id: "declared-air",
  speedOfSoundMetersPerSecond: 100,
  distanceGain: { kind: "softened-inverse-square-v1", coefficient: 0.01 },
  spectral: {
    kind: "broadband-high-frequency-v1",
    absorptionDbPerMeter: 1,
  },
  segmentBoundary: "carry-across-cut",
  assumptions: ["caller supplied the effective path length"],
});

const eventPlan = (
  propagation?: IAutoMovieProductionSoundPlan["events"][number]["propagation"],
): IAutoMovieProductionSoundPlan => ({
  version: 1,
  inputFingerprint: digest,
  fps: 10,
  totalFrames: 20,
  sampleRate: 48_000,
  channels: 2,
  events: [
    {
      id: "0:shot:hit",
      shot: "shot",
      event: "hit",
      kind: "contact",
      frame: 2,
      timeSeconds: 0.2,
      emitter: { x: 4, y: 0, z: 0 },
      listener: { x: 0, y: 0, z: 0 },
      distanceMeters: 4,
      memberCount: 1,
      spreadRadiusMeters: 0,
      densityGain: 1,
      pan: 0,
      attenuation: 1,
      ...(propagation === undefined ? {} : { propagation }),
      seed: 1,
    },
  ],
  cues: [],
  dialogue: [],
});

const firstAudibleFrame = (pcm: Float32Array): number => {
  const sample = pcm.findIndex((value) => value !== 0);
  return sample < 0 ? -1 : Math.floor(sample / 2);
};

const adjacentEnergy = (pcm: Float32Array): number => {
  let total = 0;
  for (let index = 2; index < pcm.length; index += 2)
    total += Math.abs(pcm[index]! - pcm[index - 2]!);
  return total;
};

/** Direct-path delay, cut policy, spectral loss, mix use, and refusal twins. */
export const test_engine_sound_propagation = (): void => {
  const carried = deriveAutoMovieSoundPropagation({
    distanceMeters: 20,
    emissionFrame: 2,
    segmentEndFrame: 3,
    fps: 10,
    totalFrames: 20,
    profile: profile(),
  });
  TestValidator.equals(
    "declared propagation keeps emission separate from cross-cut arrival",
    {
      arrival: carried.arrivalFrame,
      boundary: carried.boundary,
      gain: nclose(carried.distanceGain, 0.2),
      high: nclose(carried.highFrequencyGain!, 0.1),
    },
    { arrival: 4, boundary: "carried-across-cut", gain: true, high: true },
  );

  const zero = deriveAutoMovieSoundPropagation({
    distanceMeters: 0,
    emissionFrame: 2,
    segmentEndFrame: 10,
    fps: 10,
    totalFrames: 20,
    profile: { ...profile(), spectral: { kind: "none" } },
  });
  TestValidator.equals(
    "zero distance is exact and an explicit no-spectral choice stays null",
    {
      arrival: zero.arrivalFrame,
      gain: zero.distanceGain,
      high: zero.highFrequencyGain,
      boundary: zero.boundary,
      legacyBytes: Buffer.from(
        renderProductionSound({ plan: eventPlan(zero) }).pcm.buffer,
      ).equals(
        Buffer.from(renderProductionSound({ plan: eventPlan() }).pcm.buffer),
      ),
    },
    {
      arrival: 2,
      gain: 1,
      high: null,
      boundary: "inside-segment",
      legacyBytes: true,
    },
  );

  const trimmed = deriveAutoMovieSoundPropagation({
    distanceMeters: 20,
    emissionFrame: 2,
    segmentEndFrame: 3,
    fps: 10,
    totalFrames: 20,
    profile: { ...profile(), segmentBoundary: "trim-at-segment" },
  });
  TestValidator.equals(
    "the authored trim decision yields silence while carry starts at arrival",
    {
      trim: (() => {
        const rendered = renderProductionSound({ plan: eventPlan(trimmed) });
        return {
          audibleFrame: firstAudibleFrame(rendered.pcm),
          aligned: rendered.analysis.eventAlignment[0]!.passed,
        };
      })(),
      carry: (() => {
        const rendered = renderProductionSound({ plan: eventPlan(carried) });
        return {
          startsAtArrival:
            firstAudibleFrame(rendered.pcm) ===
            Math.round((carried.arrivalFrame / 10) * 48_000),
          expectedSeconds: rendered.analysis.eventAlignment[0]!.expectedSeconds,
          aligned: rendered.analysis.eventAlignment[0]!.passed,
        };
      })(),
    },
    {
      trim: { audibleFrame: -1, aligned: false },
      carry: { startsAtArrival: true, expectedSeconds: 0.4, aligned: true },
    },
  );

  const unfiltered = renderProductionSound({
    plan: eventPlan({ ...zero, highFrequencyGain: 1 }),
  });
  const absorbed = renderProductionSound({
    plan: eventPlan({ ...zero, highFrequencyGain: 0.05 }),
  });
  const first = firstAudibleFrame(unfiltered.pcm) * 2;
  TestValidator.equals(
    "declared spectral absorption filters the complete event including its transient",
    {
      firstTransientFalls: absorbed.pcm[first]! < unfiltered.pcm[first]!,
      adjacentEnergyFalls:
        adjacentEnergy(absorbed.pcm) < adjacentEnergy(unfiltered.pcm),
    },
    { firstTransientFalls: true, adjacentEnergyFalls: true },
  );

  const selectedProfile = profile();
  const acousticProfile: IAutoMovieAcousticResponseProfile = {
    kind: "adopted-response",
    id: "hall-ir",
    asset: "assets/hall.wav",
    digest,
    sampleRate: 48_000,
    roomMappings: [{ source: "hall", listener: "hall", response: "main" }],
    provider: { name: "declared archive", version: "1" },
  };
  const planned = deriveProductionSoundPlan({
    timeline: minimalTimeline(),
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    propagationProfile: selectedProfile,
    acousticProfile,
  });
  selectedProfile.assumptions[0] = "mutated";
  acousticProfile.roomMappings[0]!.response = "mutated";
  TestValidator.equals(
    "planning derives the event receipt and snapshots selected profiles",
    {
      event: planned.events[0]!.propagation?.profile,
      assumption: planned.propagationProfile?.assumptions[0],
      response:
        planned.acousticProfile?.kind === "adopted-response"
          ? planned.acousticProfile.roomMappings[0]!.response
          : null,
    },
    {
      event: "declared-air",
      assumption: "caller supplied the effective path length",
      response: "main",
    },
  );

  const moving = minimalCompiled();
  moving.shot.objectMotions = [
    {
      id: "actor-motion",
      name: null,
      duration: 1,
      loop: false,
      tracks: [
        {
          channel: { kind: "node", node: "actor", path: "translation" },
          times: [0, 1],
          values: [4, 0, 0, 14, 0, 0],
          interpolation: "linear",
        },
      ],
    },
  ];
  moving.shot.cameraMotion = {
    id: "camera-motion",
    name: null,
    duration: 1,
    loop: false,
    tracks: [
      {
        channel: { kind: "node", node: "camera", path: "translation" },
        times: [0, 1],
        values: [0, 0, 0, 5, 0, 0],
        interpolation: "linear",
      },
    ],
  };
  const movingEvent = deriveProductionSoundPlan({
    timeline: minimalTimeline(),
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", moving]]),
    propagationProfile: profile(),
  }).events[0]!;
  TestValidator.equals(
    "event-time motion samples both the emitter and listener before propagation",
    {
      emitterX: movingEvent.emitter.x,
      listenerX: movingEvent.listener.x,
      distance: movingEvent.distanceMeters,
      arrival: movingEvent.propagation?.arrivalFrame,
    },
    { emitterX: 6, listenerX: 1, distance: 5, arrival: 3 },
  );

  TestValidator.equals(
    "invalid or out-of-film propagation is refused without fallback",
    {
      assumptions: throwsError(
        () =>
          deriveAutoMovieSoundPropagation({
            distanceMeters: 1,
            emissionFrame: 0,
            segmentEndFrame: 1,
            fps: 24,
            totalFrames: 2,
            profile: { ...profile(), assumptions: [] },
          }),
        "assumptions",
      ),
      outside: throwsError(
        () =>
          deriveAutoMovieSoundPropagation({
            distanceMeters: 100,
            emissionFrame: 1,
            segmentEndFrame: 2,
            fps: 10,
            totalFrames: 3,
            profile: profile(),
          }),
        "outside",
      ),
      coefficient: throwsError(
        () =>
          deriveAutoMovieSoundPropagation({
            distanceMeters: 1,
            emissionFrame: 0,
            segmentEndFrame: 2,
            fps: 10,
            totalFrames: 3,
            profile: {
              ...profile(),
              distanceGain: {
                kind: "softened-inverse-square-v1",
                coefficient: -1,
              },
            },
          }),
        "coefficient",
      ),
    },
    { assumptions: true, outside: true, coefficient: true },
  );

  const propagate = (
    values: Partial<{
      distanceMeters: number;
      emissionFrame: number;
      segmentEndFrame: number;
      fps: number;
      totalFrames: number;
    }> = {},
    selected: IAutoMovieSoundPropagationProfile = profile(),
  ) =>
    deriveAutoMovieSoundPropagation({
      distanceMeters: 1,
      emissionFrame: 0,
      segmentEndFrame: 2,
      fps: 10,
      totalFrames: 3,
      profile: selected,
      ...values,
    });
  TestValidator.equals(
    "every numeric and profile precondition refuses its negative boundary",
    {
      distanceNaN: throwsError(
        () => propagate({ distanceMeters: NaN }),
        "non-negative",
      ),
      distanceNegative: throwsError(
        () => propagate({ distanceMeters: -1 }),
        "non-negative",
      ),
      emissionFractional: throwsError(
        () => propagate({ emissionFrame: 0.5 }),
        "integer at least 0",
      ),
      emissionNegative: throwsError(
        () => propagate({ emissionFrame: -1 }),
        "integer at least 0",
      ),
      segmentBeforeEmission: throwsError(
        () => propagate({ segmentEndFrame: 0 }),
        "integer at least 1",
      ),
      fpsNaN: throwsError(() => propagate({ fps: NaN }), "positive"),
      fpsZero: throwsError(() => propagate({ fps: 0 }), "positive"),
      totalFractional: throwsError(
        () => propagate({ totalFrames: 2.5 }),
        "integer at least 1",
      ),
      totalZero: throwsError(
        () => propagate({ totalFrames: 0 }),
        "integer at least 1",
      ),
      emissionOutside: throwsError(
        () => propagate({ emissionFrame: 3, segmentEndFrame: 4 }),
        "emission frame lies outside",
      ),
      segmentOutside: throwsError(
        () => propagate({ segmentEndFrame: 4 }),
        "segment end lies outside",
      ),
      blankProfile: throwsError(
        () => propagate({}, { ...profile(), id: " " }),
        "id must not be blank",
      ),
      speedNaN: throwsError(
        () => propagate({}, { ...profile(), speedOfSoundMetersPerSecond: NaN }),
        "speed must be finite and positive",
      ),
      speedZero: throwsError(
        () => propagate({}, { ...profile(), speedOfSoundMetersPerSecond: 0 }),
        "speed must be finite and positive",
      ),
      gainLaw: throwsError(
        () =>
          propagate({}, {
            ...profile(),
            distanceGain: { kind: "other", coefficient: 1 },
          } as unknown as IAutoMovieSoundPropagationProfile),
        "gain law is unsupported",
      ),
      coefficientNaN: throwsError(
        () =>
          propagate(
            {},
            {
              ...profile(),
              distanceGain: {
                kind: "softened-inverse-square-v1",
                coefficient: NaN,
              },
            },
          ),
        "coefficient must be finite",
      ),
      blankAssumption: throwsError(
        () => propagate({}, { ...profile(), assumptions: [" "] }),
        "assumptions",
      ),
      absorptionNaN: throwsError(
        () =>
          propagate(
            {},
            {
              ...profile(),
              spectral: {
                kind: "broadband-high-frequency-v1",
                absorptionDbPerMeter: NaN,
              },
            },
          ),
        "absorption must be finite",
      ),
      absorptionNegative: throwsError(
        () =>
          propagate(
            {},
            {
              ...profile(),
              spectral: {
                kind: "broadband-high-frequency-v1",
                absorptionDbPerMeter: -1,
              },
            },
          ),
        "absorption must be finite",
      ),
      spectralLaw: throwsError(
        () =>
          propagate({}, {
            ...profile(),
            spectral: { kind: "other" },
          } as unknown as IAutoMovieSoundPropagationProfile),
        "spectral law is unsupported",
      ),
      segmentBoundary: throwsError(
        () =>
          propagate({}, {
            ...profile(),
            segmentBoundary: "other",
          } as unknown as IAutoMovieSoundPropagationProfile),
        "segment-boundary policy is unsupported",
      ),
    },
    {
      distanceNaN: true,
      distanceNegative: true,
      emissionFractional: true,
      emissionNegative: true,
      segmentBeforeEmission: true,
      fpsNaN: true,
      fpsZero: true,
      totalFractional: true,
      totalZero: true,
      emissionOutside: true,
      segmentOutside: true,
      blankProfile: true,
      speedNaN: true,
      speedZero: true,
      gainLaw: true,
      coefficientNaN: true,
      blankAssumption: true,
      absorptionNaN: true,
      absorptionNegative: true,
      spectralLaw: true,
      segmentBoundary: true,
    },
  );

  const derivedPlan = deriveProductionSoundPlan({
    timeline: minimalTimeline(),
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    acousticProfile: {
      kind: "derived-room-analysis",
      id: "derived-room",
      solver: "sabine-broadband-v1",
    },
  });
  const providerlessPlan = deriveProductionSoundPlan({
    timeline: minimalTimeline(),
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    acousticProfile: {
      kind: "adopted-response",
      id: "providerless",
      asset: "assets/ir.wav",
      digest,
      sampleRate: 48_000,
      roomMappings: [],
    },
  });
  const zeroCuePlan: IAutoMovieProductionSoundPlan = {
    ...eventPlan(),
    events: [],
    cues: [
      {
        id: "zero",
        asset: "assets/zero.wav",
        startFrame: 0,
        durationFrames: 0,
        sourceOffsetFrame: 0,
        sourceDurationFrames: 0,
        gain: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        bus: "ambience",
        seed: 1,
      },
    ],
  };
  const oneSampleDialoguePlan: IAutoMovieProductionSoundPlan = {
    ...eventPlan(),
    fps: 48_000,
    totalFrames: 2,
    events: [],
    dialogue: [
      {
        id: "one-sample",
        text: "a",
        language: "en",
        startFrame: 0,
        endFrame: 1,
      },
    ],
  };
  const visemeOverflow = productionPhonemesToVisemes({
    chunks: [
      { phonemes: "a", startSample: 0, endSample: 1 },
      { phonemes: "b", startSample: 100, endSample: 101 },
    ],
    sourceSamples: 10,
    startFrame: 0,
    endFrame: 2,
  });
  TestValidator.equals(
    "profile variants, zero-length cues, one-sample dialogue, and late phonemes are decided",
    {
      derivedProfile: derivedPlan.acousticProfile?.kind,
      providerlessProfile:
        providerlessPlan.acousticProfile?.kind === "adopted-response"
          ? providerlessPlan.acousticProfile.provider
          : "wrong",
      // A cue with no frames has no sample to mix and no source to read: the
      // compiler refuses it when lowering the edit, and the mix refuses the
      // same contradiction rather than rendering it as silence.
      zeroCueRefused: throwsError(
        () => renderProductionSound({ plan: zeroCuePlan }),
        ['cue "zero"', "positive whole-frame span"],
      ),
      missingDialogueSilent:
        renderProductionSound({ plan: oneSampleDialoguePlan }).analysis
          .samplePeak === 0,
      oneSampleDialogueFinite: Array.from(
        renderProductionSound({
          plan: oneSampleDialoguePlan,
          dialogue: new Map([["one-sample", Float32Array.from([0.25, 0.5])]]),
        }).pcm,
      ).every(Number.isFinite),
      latePhonemeMerged: visemeOverflow[0]?.phoneme,
    },
    {
      derivedProfile: "derived-room-analysis",
      providerlessProfile: undefined,
      zeroCueRefused: true,
      missingDialogueSilent: true,
      oneSampleDialogueFinite: true,
      latePhonemeMerged: "ab",
    },
  );

  const decodedCuePlan: IAutoMovieProductionSoundPlan = {
    ...zeroCuePlan,
    cues: [
      {
        ...zeroCuePlan.cues[0]!,
        durationFrames: 1,
        sourceDurationFrames: 1,
      },
    ],
  };
  const decodedCue = renderProductionSound({
    plan: decodedCuePlan,
    assets: new Map([
      [decodedCuePlan.cues[0]!.asset, Float32Array.from([1e-6])],
    ]),
  });
  const resampledDialoguePlan: IAutoMovieProductionSoundPlan = {
    ...eventPlan(),
    events: [],
    dialogue: [
      {
        id: "resampled",
        text: "ab",
        language: "en",
        startFrame: 0,
        endFrame: 1,
      },
    ],
  };
  const resampledDialogue = renderProductionSound({
    plan: resampledDialoguePlan,
    dialogue: new Map([["resampled", Float32Array.from([0.25, 0.5])]]),
  });
  const duplicatedSampleCompiled = minimalCompiled();
  duplicatedSampleCompiled.eventSamples = [
    duplicatedSampleCompiled.eventSamples[0]!,
    { ...duplicatedSampleCompiled.eventSamples[0]! },
  ];
  TestValidator.equals(
    "decoded bounds, the absolute loudness gate, resampling, and equal sort keys are explicit",
    {
      decodedFirstSample: nclose(decodedCue.pcm[0]!, 1e-6),
      decodedPastEndIsSilent: decodedCue.pcm[2] === 0,
      subGateLoudness: decodedCue.analysis.integratedLoudness,
      emptyDialogueIsRefused: throwsError(
        () =>
          renderProductionSound({
            plan: oneSampleDialoguePlan,
            dialogue: new Map([["one-sample", new Float32Array()]]),
          }),
        ['dialogue line "one-sample"', "empty PCM"],
      ),
      resampledDialogueAudible: resampledDialogue.pcm.some(
        (sample) => sample !== 0,
      ),
      resampledDialogueFinite: Array.from(resampledDialogue.pcm).every(
        Number.isFinite,
      ),
      equalSortKeysRetained: deriveProductionSoundPlan({
        timeline: minimalTimeline(),
        contracts: new Map([["shot", minimalContract()]]),
        compiled: new Map([["shot", duplicatedSampleCompiled]]),
      }).events.length,
    },
    {
      decodedFirstSample: true,
      decodedPastEndIsSilent: true,
      subGateLoudness: null,
      emptyDialogueIsRefused: true,
      resampledDialogueAudible: true,
      resampledDialogueFinite: true,
      equalSortKeysRetained: 2,
    },
  );

  const crowdCompiled = minimalCompiled();
  crowdCompiled.scene.nodes = [];
  crowdCompiled.formations = [
    {
      id: "crowd",
      centroid: { x: 2, y: 0, z: 0 },
      anchor: { x: 2, y: 0, z: 0 },
      count: 2,
      facingDeg: 0,
      bounds: {
        min: { x: 1, y: 0, z: 0 },
        max: { x: 3, y: 0, z: 0 },
      },
    },
  ] as IAutoMovieCompiledShotSource["formations"];
  delete (crowdCompiled as { formationMotions?: unknown }).formationMotions;
  const crowdContract = minimalContract();
  crowdContract.events[0]!.subjects = ["crowd"];
  TestValidator.equals(
    "a static formation remains a resolved aggregate when no motion list exists",
    deriveProductionSoundPlan({
      timeline: minimalTimeline(),
      contracts: new Map([["shot", crowdContract]]),
      compiled: new Map([["shot", crowdCompiled]]),
    }).events[0]!.memberCount,
    2,
  );
};

const transform = (x: number) => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const minimalTimeline = (): IAutoMovieFilmTimeline =>
  ({
    inputFingerprint: digest,
    fps: 10,
    totalFrames: 20,
    segments: [
      {
        shot: "shot",
        sourceInFrame: 0,
        sourceOutFrame: 10,
        startFrame: 0,
        endFrame: 10,
      },
    ],
    tracks: { audio: [], captions: [] },
  }) as unknown as IAutoMovieFilmTimeline;

const minimalContract = (): IAutoMovieShotContract =>
  ({
    events: [
      {
        id: "hit",
        kind: "contact",
        window: { from: 0, to: 1 },
        subjects: ["actor"],
        predicates: [{}],
      },
    ],
  }) as IAutoMovieShotContract;

const minimalCompiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [{ id: "hit", time: 0.2 }],
    scene: {
      nodes: [
        {
          id: "actor",
          model: "actor-model",
          transform: transform(4),
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: transform(0),
          fovY: 50,
          near: 0.1,
          far: 100,
        },
      ],
      lights: [],
    },
    shot: {
      id: "shot",
      camera: "camera",
      cameraMotion: null,
      objectMotions: [],
    },
    formations: [],
    formationMotions: [],
    instanceSets: [],
  }) as unknown as IAutoMovieCompiledShotSource;
