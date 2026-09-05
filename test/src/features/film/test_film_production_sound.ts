import {
  deriveProductionSoundPlan,
  productionPhonemesToVisemes,
  productionSoundSpectrogram,
  productionSoundWaveform,
  renderProductionSound,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeCompiledInstanceSet,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

const transform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const contract = (): IAutoMovieShotContract =>
  ({
    id: "sound-shot",
    events: [
      ["contact", "actor"],
      ["arrival", "formation"],
      ["impact", "instances"],
      ["break", "actor"],
      ["reveal", "formation"],
      ["transition", "actor"],
      ["trimmed", "actor"],
    ].map(([id, subject], index) => ({
      id,
      kind: id === "trimmed" ? "transition" : id === "impact" ? "contact" : id,
      window: { from: index * 0.25, to: index * 0.25 + 0.2 },
      subjects: id === "transition" ? ["actor", "formation"] : [subject],
      predicates: [{}],
    })),
  }) as IAutoMovieShotContract;

const compiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [
      { id: "contact", time: 0.2 },
      { id: "arrival", time: 0.45 },
      { id: "impact", time: 0.7 },
      { id: "break", time: 0.95 },
      { id: "reveal", time: 1.2 },
      { id: "transition", time: 1.45 },
      { id: "trimmed", time: 2.8 },
    ],
    scene: {
      id: "scene",
      name: null,
      nodes: [
        {
          id: "actor",
          model: "actor-model",
          transform: transform(2, 0, -3),
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
          far: 100,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: [
      {
        id: "formation-advance",
        formation: "formation",
        action: "advance",
        start: 0,
        end: 2,
        from: {
          translation: { x: 0, y: 0, z: 0 },
          facingOffsetDeg: 0,
          spacingScale: { lateral: 1, depth: 1 },
        },
        to: {
          translation: { x: 10, y: 0, z: 0 },
          facingOffsetDeg: 0,
          spacingScale: { lateral: 1, depth: 1 },
        },
        easing: "linear",
      },
    ],
    formationSlotMotions: [],
    effectCues: [],
    shot: {
      id: "sound-shot",
      name: null,
      scene: "scene",
      duration: 3,
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [
        {
          id: "actor-flight",
          name: null,
          duration: 3,
          loop: false,
          tracks: [
            {
              channel: {
                kind: "node",
                node: "actor",
                path: "translation",
              },
              times: [0, 3],
              values: [4, 0, -3, 6, 0, -3],
              interpolation: "linear",
            },
          ],
        },
      ],
    },
    models: [],
    formations: [
      materializeCompiledFormation({
        id: "formation",
        modelRecipe: "formation-model",
        count: 1,
        layout: {
          kind: "line",
          ranks: 1,
          files: 1,
          spacing: { lateral: 1, depth: 1 },
        },
        anchor: { x: -4, y: 0, z: -6 },
        facingDeg: 0,
        seed: 1,
        capabilities: ["advance"],
        heroOverrides: [],
      }),
    ],
    instanceSets: [
      materializeCompiledInstanceSet(
        {
          id: "instances",
          modelRecipe: "instance-model",
          count: 1,
          layout: {
            kind: "grid",
            rows: 1,
            columns: 1,
            spacing: { x: 1, z: 1 },
          },
          anchor: { x: 0, y: 0, z: -8 },
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
        shot: "sound-shot",
        sourceInFrame: 0,
        sourceOutFrame: 40,
        startFrame: 0,
        endFrame: 40,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
    omissions: [],
    tracks: {
      audio: ["music", "ambience", "effects", "dialogue", "muted"].map(
        (bus, index) => ({
          id: `${bus}-cue`,
          asset: `public/${bus}.json`,
          sourceDurationFrames: 10,
          sourceOffsetFrame: 0,
          startFrame: 40 + index,
          durationFrames: 8,
          gain: bus === "muted" ? 0 : 0.25,
          fadeInFrames: 1,
          fadeOutFrames: 1,
          bus: bus === "muted" ? "music" : bus,
        }),
      ),
      captions: [
        {
          id: "line",
          text: "Advance.",
          language: "en-US",
          speaker: "captain",
          startFrame: 52,
          endFrame: 60,
        },
      ],
      effects: [],
    },
  }) as IAutoMovieFilmTimeline;

/** Semantic events deterministically become spatial PCM and review evidence. */
export const test_film_production_sound = (): void => {
  const source = compiled();
  const plan = deriveProductionSoundPlan({
    timeline: timeline(),
    contracts: new Map([["sound-shot", contract()]]),
    compiled: new Map([["sound-shot", source]]),
  });
  TestValidator.equals(
    "trimmed events are omitted while every audible event stays frame-bound",
    namedFacts([
      ["trimmedOmitted", () => plan.events.length === 6],
      [
        "framesRounded",
        () =>
          plan.events.every(
            (event) => event.frame === Math.round(event.timeSeconds * plan.fps),
          ),
      ],
      ["audible", () => plan.events.every((event) => event.attenuation > 0)],
      [
        "attenuationCapped",
        () => plan.events.every((event) => event.attenuation <= 1),
      ],
      // The pan's own bounds are not asserted here. It is one component of a
      // displacement over that displacement's own norm, so `[-1, 1]` is
      // arithmetic rather than a rule, and no emitter a production can place
      // could put it outside. Where the pan is really decided — which side of
      // the lens an emitter is on — is the case below.
    ]),
    {
      trimmedOmitted: true,
      framesRounded: true,
      audible: true,
      attenuationCapped: true,
    },
  );
  TestValidator.equals(
    "camera-relative emitters cover nodes, formations and instance sets",
    namedFacts([
      ["planEventsEvent", () => plan.events.some((event) => event.pan > 0)],
      ["planEventsEvent2", () => plan.events.some((event) => event.pan < 0)],
      ["planEventsEvent3", () => plan.events.some((event) => event.pan === 0)],
    ]),
    { planEventsEvent: true, planEventsEvent2: true, planEventsEvent3: true },
  );
  const formationEvents = plan.events.filter(
    (event) => event.event === "arrival" || event.event === "reveal",
  );
  TestValidator.equals(
    "formation emitters sample compact motion at each event time",
    namedFacts([
      ["arrivalEmitterPlaced", () => formationEvents[0]?.emitter.x === -1.75],
      ["revealEmitterPlaced", () => formationEvents[1]?.emitter.x === 2],
    ]),
    { arrivalEmitterPlaced: true, revealEmitterPlaced: true },
  );
  const dialogue = new Map([["line", Float32Array.from([0.5])]]);
  const first = renderProductionSound({ plan, dialogue });
  const second = renderProductionSound({ plan, dialogue });
  TestValidator.equals(
    "the same sound plan produces byte-identical PCM",
    Buffer.from(first.pcm.buffer),
    Buffer.from(second.pcm.buffer),
  );
  // The largest offset whose eight-frame trim still fits the ten-frame source:
  // an offset that left the declared source would be refused, not rephased.
  const offsetTimeline = timeline();
  offsetTimeline.tracks.audio[0]!.sourceOffsetFrame = 2;
  const offsetPlan = deriveProductionSoundPlan({
    timeline: offsetTimeline,
    contracts: new Map([["sound-shot", contract()]]),
    compiled: new Map([["sound-shot", source]]),
  });
  TestValidator.equals(
    "authored cue source offsets survive planning and change source-clock phase",
    namedFacts([
      [
        "planCuesSourceOffsetFrame",
        () => plan.cues[0]!.sourceOffsetFrame === 0,
      ],
      [
        "planCuesSourceDurationFrames",
        () => plan.cues[0]!.sourceDurationFrames === 10,
      ],
      [
        "offsetPlanCuesSourceOffsetFrame",
        () => offsetPlan.cues[0]!.sourceOffsetFrame === 2,
      ],
      [
        "BufferFromRenderProductionSound",
        () =>
          Buffer.from(
            renderProductionSound({ plan: offsetPlan, dialogue }).pcm.buffer,
          ).equals(Buffer.from(first.pcm.buffer)) === false,
      ],
    ]),
    {
      planCuesSourceOffsetFrame: true,
      planCuesSourceDurationFrames: true,
      offsetPlanCuesSourceOffsetFrame: true,
      BufferFromRenderProductionSound: true,
    },
  );
  TestValidator.equals(
    "mixed sound is exact-runtime, audible, unclipped and event aligned",
    namedFacts([
      [
        "firstAnalysisSampleFrames",
        () => first.analysis.sampleFrames === 144_000,
      ],
      [
        "firstAnalysisRuntimeSeconds",
        () => first.analysis.runtimeSeconds === 3,
      ],
      [
        "firstAnalysisIntegratedLoudness",
        () => first.analysis.integratedLoudness !== null,
      ],
      ["firstAnalysisSamplePeak", () => first.analysis.samplePeak > 0],
      ["firstAnalysisSamplePeak2", () => first.analysis.samplePeak <= 0.95],
      [
        "firstAnalysisClippingSamples",
        () => first.analysis.clippingSamples === 0,
      ],
      [
        "firstAnalysisEventAlignment",
        () => first.analysis.eventAlignment.every((event) => event.passed),
      ],
    ]),
    {
      firstAnalysisSampleFrames: true,
      firstAnalysisRuntimeSeconds: true,
      firstAnalysisIntegratedLoudness: true,
      firstAnalysisSamplePeak: true,
      firstAnalysisSamplePeak2: true,
      firstAnalysisClippingSamples: true,
      firstAnalysisEventAlignment: true,
    },
  );
  const waveform = productionSoundWaveform(first.pcm, 32, 16);
  const spectrogram = productionSoundSpectrogram(first.pcm, 8, 8);
  TestValidator.equals(
    "waveform and spectrogram expose deterministic opaque RGBA rasters",
    namedFacts([
      ["waveformRgba", () => waveform.rgba.length === 32 * 16 * 4],
      ["spectrogramRgba", () => spectrogram.rgba.length === 8 * 8 * 4],
      [
        "waveformRgbaValue",
        () =>
          waveform.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
      [
        "spectrogramRgbaValue",
        () =>
          spectrogram.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
    ]),
    {
      waveformRgba: true,
      spectrogramRgba: true,
      waveformRgbaValue: true,
      spectrogramRgbaValue: true,
    },
  );
  const visemes = productionPhonemesToVisemes({
    chunks: [{ phonemes: "a i u e o x", startSample: 0, endSample: 600 }],
    sourceSamples: 600,
    startFrame: 10,
    endFrame: 16,
  });
  TestValidator.equals(
    "phoneme timing covers the caption and maps all VRM vowel targets",
    visemes.map((item) => item.viseme),
    ["aa", "ih", "ou", "ee", "oh", "rest"],
  );
  TestValidator.equals(
    "case folding expansion preserves the matched vowel",
    productionPhonemesToVisemes({
      chunks: [{ phonemes: "İ", startSample: 0, endSample: 20 }],
      sourceSamples: 20,
      startFrame: 0,
      endFrame: 1,
    })[0]?.viseme,
    "ih",
  );
  TestValidator.equals(
    "empty phonemes hold one neutral mouth target",
    productionPhonemesToVisemes({
      chunks: [{ phonemes: " ", startSample: 0, endSample: 20 }],
      sourceSamples: 20,
      startFrame: 1,
      endFrame: 3,
    }),
    [
      {
        phoneme: "",
        viseme: "rest",
        startFrame: 1,
        endFrame: 3,
      },
    ],
  );
  TestValidator.equals(
    "non-positive dialogue windows have no visemes",
    productionPhonemesToVisemes({
      chunks: [{ phonemes: "a", startSample: 0, endSample: 20 }],
      sourceSamples: 20,
      startFrame: 2,
      endFrame: 2,
    }),
    [],
  );
  TestValidator.equals(
    "non-positive source clocks have no visemes",
    productionPhonemesToVisemes({
      chunks: [{ phonemes: "a", startSample: 0, endSample: 20 }],
      sourceSamples: 0,
      startFrame: 0,
      endFrame: 2,
    }),
    [],
  );
  const chunkTimed = productionPhonemesToVisemes({
    chunks: [
      { phonemes: "a", startSample: 0, endSample: 100 },
      { phonemes: "iueox", startSample: 100, endSample: 1_000 },
    ],
    sourceSamples: 1_000,
    startFrame: 0,
    endFrame: 4,
  });
  TestValidator.equals(
    "chunk sample clocks preserve timing and no phoneme token is discarded",
    namedFacts([
      ["chunkTimedEndFrame", () => chunkTimed[0]?.endFrame === 1],
      [
        "chunkTimedItemIndex",
        () =>
          chunkTimed.every(
            (item, index) =>
              index === 0 || item.startFrame >= chunkTimed[index - 1]!.endFrame,
          ),
      ],
      [
        "chunkTimedItemItem",
        () => chunkTimed.map((item) => item.phoneme).join("") === "aiueox",
      ],
    ]),
    {
      chunkTimedEndFrame: true,
      chunkTimedItemIndex: true,
      chunkTimedItemItem: true,
    },
  );
  const silence = renderProductionSound({
    plan: { ...plan, events: [], cues: [], dialogue: [] },
  });
  TestValidator.equals(
    "an empty plan remains exact-runtime measurable silence",
    namedFacts([
      [
        "silenceAnalysisIntegratedLoudness",
        () => silence.analysis.integratedLoudness === null,
      ],
      ["silenceAnalysisSamplePeak", () => silence.analysis.samplePeak === 0],
      [
        "silenceAnalysisLongestSilenceSeconds",
        () => silence.analysis.longestSilenceSeconds === 3,
      ],
    ]),
    {
      silenceAnalysisIntegratedLoudness: true,
      silenceAnalysisSamplePeak: true,
      silenceAnalysisLongestSilenceSeconds: true,
    },
  );
  TestValidator.equals(
    "sound rasters reject malformed dimensions and PCM",
    namedFacts([
      [
        "refusedProductionSoundWaveformFirst",
        () =>
          refused(
            () => productionSoundWaveform(first.pcm, 0, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundWaveformNew",
        () =>
          refused(
            () => productionSoundWaveform(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
      [
        "refusedProductionSoundSpectrogramFirst",
        () =>
          refused(
            () => productionSoundSpectrogram(first.pcm, 1.5, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundSpectrogramNew",
        () =>
          refused(
            () => productionSoundSpectrogram(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
    ]),
    {
      refusedProductionSoundWaveformFirst: true,
      refusedProductionSoundWaveformNew: true,
      refusedProductionSoundSpectrogramFirst: true,
      refusedProductionSoundSpectrogramNew: true,
    },
  );
  TestValidator.equals(
    "sound planning refuses missing and inconsistent compiled evidence",
    namedFacts([
      [
        "refusedDeriveProductionSoundPlanTimeline",
        () =>
          refused(
            () =>
              deriveProductionSoundPlan({
                timeline: timeline(),
                contracts: new Map(),
                compiled: new Map(),
              }),
            "current contract and compiled",
          ),
      ],
      [
        "refusedDeriveProductionSoundPlanTimeline2",
        () =>
          refused(
            () =>
              deriveProductionSoundPlan({
                timeline: timeline(),
                contracts: new Map([["sound-shot", contract()]]),
                compiled: new Map([
                  [
                    "sound-shot",
                    {
                      ...source,
                      scene: { ...source.scene, cameras: [] },
                    },
                  ],
                ]),
              }),
            "cannot find",
          ),
      ],
      [
        "refusedDeriveProductionSoundPlanTimeline3",
        () =>
          refused(
            () =>
              deriveProductionSoundPlan({
                timeline: timeline(),
                contracts: new Map([
                  ["sound-shot", { ...contract(), events: [] }],
                ]),
                compiled: new Map([["sound-shot", source]]),
              }),
            "sampled undeclared",
          ),
      ],
      [
        "refusedDeriveProductionSoundPlanTimeline4",
        () =>
          refused(
            () =>
              deriveProductionSoundPlan({
                timeline: timeline(),
                contracts: new Map([
                  [
                    "sound-shot",
                    {
                      ...contract(),
                      events: contract().events.map((event) => ({
                        ...event,
                        subjects: ["missing"],
                      })),
                    },
                  ],
                ]),
                compiled: new Map([["sound-shot", source]]),
              }),
            "no spatially resolved subject",
          ),
      ],
    ]),
    {
      refusedDeriveProductionSoundPlanTimeline: true,
      refusedDeriveProductionSoundPlanTimeline2: true,
      refusedDeriveProductionSoundPlanTimeline3: true,
      refusedDeriveProductionSoundPlanTimeline4: true,
    },
  );
};
