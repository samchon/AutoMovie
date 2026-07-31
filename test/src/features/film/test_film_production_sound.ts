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
import { TestValidator } from "@nestia/e2e";

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
    id: "volley-shot",
    events: [
      ["contact", "actor"],
      ["arrival", "formation"],
      ["volley", "instances"],
      ["break", "actor"],
      ["reveal", "formation"],
      ["transition", "actor"],
      ["trimmed", "actor"],
    ].map(([id, subject], index) => ({
      id,
      kind: id === "trimmed" ? "transition" : id,
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
      { id: "volley", time: 0.7 },
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
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: [],
    effectCues: [],
    shot: {
      id: "volley-shot",
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
      {
        id: "formation",
        centroid: { x: -4, y: 0, z: -6 },
      },
    ],
    instanceSets: [
      {
        id: "instances",
        centroid: { x: 0, y: 0, z: -8 },
      },
    ],
    effects: [],
  }) as IAutoMovieCompiledShotSource;

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
        shot: "volley-shot",
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
    contracts: new Map([["volley-shot", contract()]]),
    compiled: new Map([["volley-shot", source]]),
  });
  TestValidator.predicate(
    "trimmed events are omitted while every audible event stays frame-bound",
    plan.events.length === 6 &&
      plan.events.every(
        (event) =>
          event.frame === Math.round(event.timeSeconds * plan.fps) &&
          event.attenuation > 0 &&
          event.attenuation <= 1 &&
          event.pan >= -1 &&
          event.pan <= 1,
      ),
  );
  TestValidator.predicate(
    "camera-relative emitters cover nodes, formations and instance sets",
    plan.events.some((event) => event.pan > 0) &&
      plan.events.some((event) => event.pan < 0) &&
      plan.events.some((event) => event.pan === 0),
  );
  const dialogue = new Map([["line", Float32Array.from([0.5])]]);
  const first = renderProductionSound({ plan, dialogue });
  const second = renderProductionSound({ plan, dialogue });
  TestValidator.equals(
    "the same sound plan produces byte-identical PCM",
    Buffer.from(first.pcm.buffer),
    Buffer.from(second.pcm.buffer),
  );
  TestValidator.predicate(
    "mixed sound is exact-runtime, audible, unclipped and event aligned",
    first.analysis.sampleFrames === 144_000 &&
      first.analysis.runtimeSeconds === 3 &&
      first.analysis.integratedLoudness !== null &&
      first.analysis.samplePeak > 0 &&
      first.analysis.samplePeak <= 0.95 &&
      first.analysis.clippingSamples === 0 &&
      first.analysis.eventAlignment.every((event) => event.passed),
  );
  const waveform = productionSoundWaveform(first.pcm, 32, 16);
  const spectrogram = productionSoundSpectrogram(first.pcm, 8, 8);
  TestValidator.predicate(
    "waveform and spectrogram expose deterministic opaque RGBA rasters",
    waveform.rgba.length === 32 * 16 * 4 &&
      spectrogram.rgba.length === 8 * 8 * 4 &&
      waveform.rgba.every((value, index) => index % 4 !== 3 || value === 255) &&
      spectrogram.rgba.every(
        (value, index) => index % 4 !== 3 || value === 255,
      ),
  );
  const visemes = productionPhonemesToVisemes({
    phonemes: "a i u e o x",
    startFrame: 10,
    endFrame: 16,
  });
  TestValidator.equals(
    "phoneme timing covers the caption and maps all VRM vowel targets",
    visemes.map((item) => item.viseme),
    ["aa", "ih", "ou", "ee", "oh", "rest"],
  );
  TestValidator.equals(
    "empty phonemes hold one neutral mouth target",
    productionPhonemesToVisemes({
      phonemes: " ",
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
      phonemes: "a",
      startFrame: 2,
      endFrame: 2,
    }),
    [],
  );
  const silence = renderProductionSound({
    plan: { ...plan, events: [], cues: [], dialogue: [] },
  });
  TestValidator.predicate(
    "an empty plan remains exact-runtime measurable silence",
    silence.analysis.integratedLoudness === null &&
      silence.analysis.samplePeak === 0 &&
      silence.analysis.longestSilenceSeconds === 3,
  );
  TestValidator.predicate(
    "sound rasters reject malformed dimensions and PCM",
    refused(
      () => productionSoundWaveform(first.pcm, 0, 10),
      "positive integers",
    ) &&
      refused(
        () => productionSoundWaveform(new Float32Array(1), 10, 10),
        "interleaved stereo",
      ) &&
      refused(
        () => productionSoundSpectrogram(first.pcm, 1.5, 10),
        "positive integers",
      ) &&
      refused(
        () => productionSoundSpectrogram(new Float32Array(1), 10, 10),
        "interleaved stereo",
      ),
  );
  TestValidator.predicate(
    "sound planning refuses missing and inconsistent compiled evidence",
    refused(
      () =>
        deriveProductionSoundPlan({
          timeline: timeline(),
          contracts: new Map(),
          compiled: new Map(),
        }),
      "current contract and compiled",
    ) &&
      refused(
        () =>
          deriveProductionSoundPlan({
            timeline: timeline(),
            contracts: new Map([["volley-shot", contract()]]),
            compiled: new Map([
              [
                "volley-shot",
                {
                  ...source,
                  scene: { ...source.scene, cameras: [] },
                },
              ],
            ]),
          }),
        "cannot find",
      ) &&
      refused(
        () =>
          deriveProductionSoundPlan({
            timeline: timeline(),
            contracts: new Map([
              ["volley-shot", { ...contract(), events: [] }],
            ]),
            compiled: new Map([["volley-shot", source]]),
          }),
        "sampled undeclared",
      ) &&
      refused(
        () =>
          deriveProductionSoundPlan({
            timeline: timeline(),
            contracts: new Map([
              [
                "volley-shot",
                {
                  ...contract(),
                  events: contract().events.map((event) => ({
                    ...event,
                    subjects: ["missing"],
                  })),
                },
              ],
            ]),
            compiled: new Map([["volley-shot", source]]),
          }),
        "no spatially resolved subject",
      ),
  );
};
