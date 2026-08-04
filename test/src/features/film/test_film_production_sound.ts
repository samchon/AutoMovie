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
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
    effectCues: [],
    shot: {
      id: "volley-shot",
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
  TestValidator.equals(
    "camera-relative emitters cover nodes, formations and instance sets",
    namedFacts([
      ["planEvents", () => plan.events.some((event) => event.pan > 0)],
      ["planEvents2", () => plan.events.some((event) => event.pan < 0)],
      ["planEvents3", () => plan.events.some((event) => event.pan === 0)],
    ]),
    {
      planEvents: true,
      planEvents2: true,
      planEvents3: true,
    },
  );
  const formationEvents = plan.events.filter(
    (event) => event.event === "arrival" || event.event === "reveal",
  );
  TestValidator.predicate(
    "formation emitters sample compact motion at each event time",
    formationEvents[0]?.emitter.x === -1.75 &&
      formationEvents[1]?.emitter.x === 2,
  );
  const dialogue = new Map([["line", Float32Array.from([0.5])]]);
  const first = renderProductionSound({ plan, dialogue });
  const second = renderProductionSound({ plan, dialogue });
  TestValidator.equals(
    "the same sound plan produces byte-identical PCM",
    Buffer.from(first.pcm.buffer),
    Buffer.from(second.pcm.buffer),
  );
  const offsetTimeline = timeline();
  offsetTimeline.tracks.audio[0]!.sourceOffsetFrame = 5;
  const offsetPlan = deriveProductionSoundPlan({
    timeline: offsetTimeline,
    contracts: new Map([["volley-shot", contract()]]),
    compiled: new Map([["volley-shot", source]]),
  });
  TestValidator.equals(
    "authored cue source offsets survive planning and change source-clock phase",
    namedFacts([
      ["planCues", () => plan.cues[0]!.sourceOffsetFrame === 0],
      ["planCues2", () => plan.cues[0]!.sourceDurationFrames === 10],
      ["offsetPlanCues", () => offsetPlan.cues[0]!.sourceOffsetFrame === 5],
      [
        "renderProductionSoundPlan",
        () =>
          Buffer.from(
            renderProductionSound({ plan: offsetPlan, dialogue }).pcm.buffer,
          ).equals(Buffer.from(first.pcm.buffer)) === false,
      ],
    ]),
    {
      planCues: true,
      planCues2: true,
      offsetPlanCues: true,
      renderProductionSoundPlan: true,
    },
  );
  TestValidator.equals(
    "mixed sound is exact-runtime, audible, unclipped and event aligned",
    namedFacts([
      ["firstAnalysis", () => first.analysis.sampleFrames === 144_000],
      ["firstAnalysis2", () => first.analysis.runtimeSeconds === 3],
      ["firstAnalysis3", () => first.analysis.integratedLoudness !== null],
      ["firstAnalysis4", () => first.analysis.samplePeak > 0],
      ["firstAnalysis5", () => first.analysis.samplePeak <= 0.95],
      ["firstAnalysis6", () => first.analysis.clippingSamples === 0],
      [
        "firstAnalysis7",
        () => first.analysis.eventAlignment.every((event) => event.passed),
      ],
    ]),
    {
      firstAnalysis: true,
      firstAnalysis2: true,
      firstAnalysis3: true,
      firstAnalysis4: true,
      firstAnalysis5: true,
      firstAnalysis6: true,
      firstAnalysis7: true,
    },
  );
  const waveform = productionSoundWaveform(first.pcm, 32, 16);
  const spectrogram = productionSoundSpectrogram(first.pcm, 8, 8);
  TestValidator.equals(
    "waveform and spectrogram expose deterministic opaque RGBA rasters",
    namedFacts([
      ["waveformCount", () => waveform.rgba.length === 32 * 16 * 4],
      ["spectrogramCount", () => spectrogram.rgba.length === 8 * 8 * 4],
      [
        "waveformRgba",
        () =>
          waveform.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
      [
        "spectrogramRgba",
        () =>
          spectrogram.rgba.every(
            (value, index) => index % 4 !== 3 || value === 255,
          ),
      ],
    ]),
    {
      waveformCount: true,
      spectrogramCount: true,
      waveformRgba: true,
      spectrogramRgba: true,
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
        "chunkTimedItem",
        () =>
          chunkTimed.every(
            (item, index) =>
              index === 0 || item.startFrame >= chunkTimed[index - 1]!.endFrame,
          ),
      ],
      [
        "chunkTimedItem2",
        () => chunkTimed.map((item) => item.phoneme).join("") === "aiueox",
      ],
    ]),
    {
      chunkTimedEndFrame: true,
      chunkTimedItem: true,
      chunkTimedItem2: true,
    },
  );
  const silence = renderProductionSound({
    plan: { ...plan, events: [], cues: [], dialogue: [] },
  });
  TestValidator.equals(
    "an empty plan remains exact-runtime measurable silence",
    namedFacts([
      ["silenceAnalysis", () => silence.analysis.integratedLoudness === null],
      ["silenceAnalysis2", () => silence.analysis.samplePeak === 0],
      ["silenceAnalysis3", () => silence.analysis.longestSilenceSeconds === 3],
    ]),
    {
      silenceAnalysis: true,
      silenceAnalysis2: true,
      silenceAnalysis3: true,
    },
  );
  TestValidator.equals(
    "sound rasters reject malformed dimensions and PCM",
    namedFacts([
      [
        "refusedProductionSoundWaveform",
        () =>
          refused(
            () => productionSoundWaveform(first.pcm, 0, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundWaveform2",
        () =>
          refused(
            () => productionSoundWaveform(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
      [
        "refusedProductionSoundSpectrogram",
        () =>
          refused(
            () => productionSoundSpectrogram(first.pcm, 1.5, 10),
            "positive integers",
          ),
      ],
      [
        "refusedProductionSoundSpectrogram2",
        () =>
          refused(
            () => productionSoundSpectrogram(new Float32Array(1), 10, 10),
            "interleaved stereo",
          ),
      ],
    ]),
    {
      refusedProductionSoundWaveform: true,
      refusedProductionSoundWaveform2: true,
      refusedProductionSoundSpectrogram: true,
      refusedProductionSoundSpectrogram2: true,
    },
  );
  TestValidator.equals(
    "sound planning refuses missing and inconsistent compiled evidence",
    namedFacts([
      [
        "refusedDeriveProductionSoundPlan",
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
        "refusedDeriveProductionSoundPlan2",
        () =>
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
          ),
      ],
      [
        "refusedDeriveProductionSoundPlan3",
        () =>
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
          ),
      ],
      [
        "refusedDeriveProductionSoundPlan4",
        () =>
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
      ],
    ]),
    {
      refusedDeriveProductionSoundPlan: true,
      refusedDeriveProductionSoundPlan2: true,
      refusedDeriveProductionSoundPlan3: true,
      refusedDeriveProductionSoundPlan4: true,
    },
  );
};
