import {
  deriveProductionSoundPlan,
  productionPhonemesToVisemes,
  renderProductionSound,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  productionSoundCompiled,
  productionSoundContract,
  productionSoundRefused,
  productionSoundTimeline,
} from "./productionSoundFixtures";

/** Caption phonemes become mouth targets, and unsound evidence is refused. */
export const test_film_production_sound_viseme = (): void => {
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
  const source = productionSoundCompiled();
  const plan = deriveProductionSoundPlan({
    timeline: productionSoundTimeline(),
    contracts: new Map([["sound-shot", productionSoundContract()]]),
    compiled: new Map([["sound-shot", source]]),
  });
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
    "sound planning refuses missing and inconsistent compiled evidence",
    namedFacts([
      [
        "refusedDeriveProductionSoundPlanTimeline",
        () =>
          productionSoundRefused(
            () =>
              deriveProductionSoundPlan({
                timeline: productionSoundTimeline(),
                contracts: new Map(),
                compiled: new Map(),
              }),
            "current contract and compiled",
          ),
      ],
      [
        "refusedDeriveProductionSoundPlanTimeline2",
        () =>
          productionSoundRefused(
            () =>
              deriveProductionSoundPlan({
                timeline: productionSoundTimeline(),
                contracts: new Map([["sound-shot", productionSoundContract()]]),
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
          productionSoundRefused(
            () =>
              deriveProductionSoundPlan({
                timeline: productionSoundTimeline(),
                contracts: new Map([
                  ["sound-shot", { ...productionSoundContract(), events: [] }],
                ]),
                compiled: new Map([["sound-shot", source]]),
              }),
            "sampled undeclared",
          ),
      ],
      [
        "refusedDeriveProductionSoundPlanTimeline4",
        () =>
          productionSoundRefused(
            () =>
              deriveProductionSoundPlan({
                timeline: productionSoundTimeline(),
                contracts: new Map([
                  [
                    "sound-shot",
                    {
                      ...productionSoundContract(),
                      events: productionSoundContract().events.map((event) => ({
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
