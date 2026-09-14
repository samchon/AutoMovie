import {
  deriveProductionSoundPlan,
  renderProductionSound,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  productionSoundCompiled,
  productionSoundContract,
  productionSoundTimeline,
} from "./productionSoundFixtures";

/** Semantic events deterministically become spatial PCM and review evidence. */
export const test_film_production_sound = (): void => {
  const source = productionSoundCompiled();
  const plan = deriveProductionSoundPlan({
    timeline: productionSoundTimeline(),
    contracts: new Map([["sound-shot", productionSoundContract()]]),
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
  // The largest offset whose eight-frame trim still fits the ten-frame source:
  // an offset that left the declared source would be refused, not rephased.
  const offsetTimeline = productionSoundTimeline();
  offsetTimeline.tracks.audio[0]!.sourceOffsetFrame = 2;
  const offsetPlan = deriveProductionSoundPlan({
    timeline: offsetTimeline,
    contracts: new Map([["sound-shot", productionSoundContract()]]),
    compiled: new Map([["sound-shot", source]]),
  });
  TestValidator.equals(
    "authored cue source offsets survive planning",
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
    ]),
    {
      planCuesSourceOffsetFrame: true,
      planCuesSourceDurationFrames: true,
      offsetPlanCuesSourceOffsetFrame: true,
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
};
