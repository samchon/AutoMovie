import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompiledContractRealization,
  IAutoMovieDiagnostic,
  IAutoMovieShotContract,
  IAutoMovieShotStoryTime,
} from "@automovie/interface";
import {
  IAutoMovieProductionDesignGraph,
  acceptanceAddressesShot,
  acceptanceCriterionShots,
  autoMovieStorySyncOutcome,
  storySyncCriterionOf,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  shotContract,
  worldDesign,
} from "./productionFixtures";

const STORY_CLOCK = {
  units: "second",
  epoch:
    "Story time zero is the instant the production's first tracked action begins.",
} as const;

/**
 * One starter shot recast as a coverage of a shared moment.
 *
 * Both coverages declare the same event window, so the only thing separating
 * them on the story clock is the pin. That is deliberate: it lets a case change
 * one pin and see the verdict move, without any other field drifting with it.
 */
const coverage = (props: {
  id: string;
  export: string;
  event: string;
  storyTime?: IAutoMovieShotStoryTime;
  window?: { from: number; to: number };
}): IAutoMovieShotContract => {
  const base = shotContract();
  return {
    ...base,
    id: props.id,
    source: { module: base.source.module, export: props.export },
    ...(props.storyTime === undefined ? {} : { storyTime: props.storyTime }),
    events: base.events.map((event) => ({
      ...event,
      id: props.event,
      window: props.window ?? { from: 1.5, to: 3 },
    })),
  };
};

const storySync = (
  criterion: Partial<
    Extract<IAutoMovieAcceptanceScenario["criterion"], { kind: "story-sync" }>
  > = {},
  target: IAutoMovieAcceptanceScenario["target"] = {
    kind: "film",
    id: "fixture-film",
  },
): IAutoMovieAcceptanceScenario => ({
  id: "shared-moment",
  target,
  criterion: {
    kind: "story-sync",
    events: [
      { shot: "opening", event: "mark-a" },
      { shot: "answer", event: "mark-b" },
    ],
    toleranceSeconds: 0.25,
    expectation:
      "Both coverages show one instant, not two consecutive instants.",
    ...criterion,
  },
  required: true,
});

const codes = (diagnostics: readonly IAutoMovieDiagnostic[]): Set<string> =>
  new Set(diagnostics.map((diagnostic) => diagnostic.code));

/** The one compiled fact a cross-shot claim reads: when an event realized. */
const realizationOf = (
  shot: string,
  event: string,
  time: number,
): IAutoMovieCompiledContractRealization => ({
  version: 1,
  shot,
  opening: [],
  closing: [],
  events: [{ id: event, time, predicates: [], passed: true }],
  camera: [],
  formations: [],
});

/**
 * The story clock is optional, and a cross-shot claim on it is refusable.
 *
 * Scenarios:
 *
 * 1. A production that states no story time validates exactly as it does without
 *    one, and so does a pinned production that keeps the clock.
 * 2. A pin without a declared clock, a blank epoch, a non-finite origin, and a
 *    non-positive rate are each refused at their own field.
 * 3. A cross-shot claim must target the film, name at least two distinct
 *    shot-and-event pairs that exist, and address only pinned shots.
 * 4. A claim whose declared windows can never fall inside its tolerance is refused
 *    before anything is compiled, because no source could satisfy it.
 */
export const test_mcp_production_story_clock = (): void => {
  const starter: IAutoMovieProductionDesignGraph = {
    production: productionDesign(),
    models: new Map([["sentinel", modelRecipe()]]),
    world: worldDesign(),
    formations: new Map([["line", formationDesign()]]),
    shots: new Map([["opening", shotContract()]]),
    acceptance: new Map(acceptanceScenarios().map((item) => [item.id, item])),
  };
  TestValidator.equals(
    "a production that states no story time validates unchanged",
    validateAutoMovieProductionGraph(starter),
    [],
  );

  const pinned: IAutoMovieProductionDesignGraph = {
    ...starter,
    production: productionDesign({ storyClock: STORY_CLOCK }),
    shots: new Map([
      [
        "opening",
        coverage({
          id: "opening",
          export: "opening",
          event: "mark-a",
          storyTime: { originSeconds: 0 },
        }),
      ],
      [
        "answer",
        coverage({
          id: "answer",
          export: "answer",
          event: "mark-b",
          storyTime: { originSeconds: 0 },
        }),
      ],
    ]),
    acceptance: new Map([["shared-moment", storySync()]]),
  };
  TestValidator.equals(
    "a declared clock, two pinned coverages and one cross-shot claim validate clean",
    validateAutoMovieProductionGraph(pinned),
    [],
  );

  const rated = validateAutoMovieProductionGraph({
    ...pinned,
    shots: new Map([
      ...pinned.shots,
      [
        "answer",
        coverage({
          id: "answer",
          export: "answer",
          event: "mark-b",
          storyTime: { originSeconds: 1.5, rate: 0.5 },
        }),
      ],
    ]),
  });
  TestValidator.equals(
    "a stretched coverage stays admissible while its mapped window still meets the claim",
    rated,
    [],
  );

  TestValidator.equals(
    "a pin is refused wherever the production keeps no clock",
    namedFacts([
      [
        "unclockedPin",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              production: productionDesign(),
              acceptance: new Map(),
            }),
          ).has("design-story-clock-absent"),
      ],
      [
        "unclockedClaim",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              production: productionDesign(),
              shots: new Map([
                [
                  "opening",
                  coverage({
                    id: "opening",
                    export: "opening",
                    event: "mark-a",
                  }),
                ],
                [
                  "answer",
                  coverage({ id: "answer", export: "answer", event: "mark-b" }),
                ],
              ]),
            }),
          ).has("design-story-clock-absent"),
      ],
      [
        "blankEpoch",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              production: productionDesign({
                storyClock: { units: "second", epoch: "  " },
              }),
            }),
          ).has("design-text-empty"),
      ],
      [
        "unusableOrigin",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              shots: new Map([
                ...pinned.shots,
                [
                  "answer",
                  coverage({
                    id: "answer",
                    export: "answer",
                    event: "mark-b",
                    storyTime: { originSeconds: Number.POSITIVE_INFINITY },
                  }),
                ],
              ]),
            }),
          ).has("design-range-invalid"),
      ],
      [
        "unusableRate",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              shots: new Map([
                ...pinned.shots,
                [
                  "answer",
                  coverage({
                    id: "answer",
                    export: "answer",
                    event: "mark-b",
                    storyTime: { originSeconds: 0, rate: 0 },
                  }),
                ],
              ]),
            }),
          ).has("design-range-invalid"),
      ],
    ]),
    {
      unclockedPin: true,
      unclockedClaim: true,
      blankEpoch: true,
      unusableOrigin: true,
      unusableRate: true,
    },
  );

  TestValidator.equals(
    "an unaddressable cross-shot claim is refused at the field that made it unaddressable",
    namedFacts([
      [
        "shotTarget",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                [
                  "shared-moment",
                  storySync({}, { kind: "shot", id: "opening" }),
                ],
              ]),
            }),
          ).has("design-target-invalid"),
      ],
      [
        "singleEvent",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                [
                  "shared-moment",
                  storySync({ events: [{ shot: "opening", event: "mark-a" }] }),
                ],
              ]),
            }),
          ).has("design-collection-cardinality-invalid"),
      ],
      [
        "repeatedPair",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                [
                  "shared-moment",
                  storySync({
                    events: [
                      { shot: "opening", event: "mark-a" },
                      { shot: "opening", event: "mark-a" },
                    ],
                  }),
                ],
              ]),
            }),
          ).has("design-duplicate-id"),
      ],
      [
        "absentShot",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                [
                  "shared-moment",
                  storySync({
                    events: [
                      { shot: "opening", event: "mark-a" },
                      { shot: "nowhere", event: "mark-b" },
                    ],
                  }),
                ],
              ]),
            }),
          ).has("design-reference-missing"),
      ],
      [
        "absentEvent",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                [
                  "shared-moment",
                  storySync({
                    events: [
                      { shot: "opening", event: "mark-a" },
                      { shot: "answer", event: "never-declared" },
                    ],
                  }),
                ],
              ]),
            }),
          ).has("design-reference-missing"),
      ],
      [
        "unpinnedShot",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              shots: new Map([
                ...pinned.shots,
                [
                  "answer",
                  coverage({ id: "answer", export: "answer", event: "mark-b" }),
                ],
              ]),
            }),
          ).has("design-story-pin-missing"),
      ],
      [
        "unusableTolerance",
        () =>
          codes(
            validateAutoMovieProductionGraph({
              ...pinned,
              acceptance: new Map([
                ["shared-moment", storySync({ toleranceSeconds: -1 })],
              ]),
            }),
          ).has("design-range-invalid"),
      ],
      // A field the author has yet to fix is diagnosed once, where it lives. A
      // reachability verdict derived from it would be a second complaint about
      // the same unfixed number, so the cross-shot check stands down until the
      // pin and the window can answer.
      ["unusableRateIsNotRestated", () => derivedOnce({ rate: Number.NaN })],
      [
        "openWindowIsNotRestated",
        () => derivedOnce(undefined, { from: Number.NaN, to: 3 }),
      ],
      [
        "unboundedWindowIsNotRestated",
        () =>
          derivedOnce(undefined, {
            from: 1.5,
            to: Number.POSITIVE_INFINITY,
          }),
      ],
      [
        "reversedWindowIsNotRestated",
        () => derivedOnce(undefined, { from: 3, to: 1.5 }),
      ],
    ]),
    {
      shotTarget: true,
      singleEvent: true,
      repeatedPair: true,
      absentShot: true,
      absentEvent: true,
      unpinnedShot: true,
      unusableTolerance: true,
      unusableRateIsNotRestated: true,
      openWindowIsNotRestated: true,
      unboundedWindowIsNotRestated: true,
      reversedWindowIsNotRestated: true,
    },
  );

  const unsatisfiable = validateAutoMovieProductionGraph({
    ...pinned,
    shots: new Map([
      ...pinned.shots,
      [
        "answer",
        coverage({
          id: "answer",
          export: "answer",
          event: "mark-b",
          storyTime: { originSeconds: 10 },
        }),
      ],
    ]),
  });
  TestValidator.equals(
    "a claim no realization could satisfy is refused before anything compiles",
    namedFacts([
      [
        "refused",
        () => codes(unsatisfiable).has("design-story-sync-unsatisfiable"),
      ],
      [
        "namesTheClosestPossibleGap",
        () =>
          unsatisfiable.some((diagnostic) =>
            diagnostic.message.includes("cannot come closer than 8.5s"),
          ),
      ],
      [
        "namesTheClaimedTolerance",
        () =>
          unsatisfiable.some((diagnostic) =>
            diagnostic.message.includes("claims simultaneity within 0.25s"),
          ),
      ],
    ]),
    {
      refused: true,
      namesTheClosestPossibleGap: true,
      namesTheClaimedTolerance: true,
    },
  );

  const criterion = storySyncCriterionOf(storySync());
  const measure = (
    contracts: ReadonlyMap<string, IAutoMovieShotContract>,
    realization: (shot: string) => IAutoMovieCompiledContractRealization | null,
  ): ReturnType<typeof autoMovieStorySyncOutcome> | null =>
    criterion === null
      ? null
      : autoMovieStorySyncOutcome({ criterion, contracts, realization });
  TestValidator.equals(
    "the shared measurement reads its pins and its realized times from current state",
    namedFacts([
      ["crossShotCriterion", () => criterion !== null],
      [
        "frameCriterionIsNotCrossShot",
        () => storySyncCriterionOf(acceptanceScenarios()[0]!) === null,
      ],
      [
        "measuresPinnedShots",
        () =>
          measure(pinned.shots, (shot) =>
            realizationOf(shot, shot === "opening" ? "mark-a" : "mark-b", 2),
          )?.passed === true,
      ],
      [
        "refusesUnpinnedOrAbsentShot",
        () =>
          measure(starter.shots, (shot) =>
            realizationOf(shot, shot === "opening" ? "mark-a" : "mark-b", 2),
          )?.spreadSeconds === null,
      ],
      [
        "refusesUnrealizedEvent",
        () =>
          measure(pinned.shots, (shot) =>
            realizationOf(shot, "never-realized", 2),
          )?.passed === false,
      ],
      [
        "refusesAbsentRealization",
        () => measure(pinned.shots, () => null)?.passed === false,
      ],
      [
        "crossShotCriterionReadsEveryNamedShot",
        () =>
          acceptanceCriterionShots(storySync()).join(",") === "opening,answer",
      ],
      [
        "shotLocalFrameCriterionReadsNoCriterionShot",
        () => acceptanceCriterionShots(acceptanceScenarios()[0]!).length === 0,
      ],
      [
        "filmLevelEventCriterionReadsItsOwningShot",
        () =>
          acceptanceCriterionShots({
            id: "film-event",
            target: { kind: "film", id: "fixture-film" },
            criterion: {
              kind: "event",
              shot: "opening",
              event: "mark-a",
              expectation: "The compiled event remains inside the edit.",
            },
            required: true,
          }).join(",") === "opening",
      ],
      [
        "metricCriterionReadsNoShot",
        () =>
          acceptanceCriterionShots({
            id: "runtime",
            target: { kind: "film", id: "fixture-film" },
            criterion: {
              kind: "metric",
              metric: "runtime-seconds",
              operator: "==",
              value: 6,
            },
            required: true,
          }).length === 0,
      ],
      [
        "crossShotClaimAddressesEachNamedShot",
        () =>
          acceptanceAddressesShot(storySync(), "answer") &&
          acceptanceAddressesShot(storySync(), "nowhere") === false,
      ],
    ]),
    {
      crossShotCriterion: true,
      frameCriterionIsNotCrossShot: true,
      measuresPinnedShots: true,
      refusesUnpinnedOrAbsentShot: true,
      refusesUnrealizedEvent: true,
      refusesAbsentRealization: true,
      crossShotCriterionReadsEveryNamedShot: true,
      shotLocalFrameCriterionReadsNoCriterionShot: true,
      filmLevelEventCriterionReadsItsOwningShot: true,
      metricCriterionReadsNoShot: true,
      crossShotClaimAddressesEachNamedShot: true,
    },
  );
};
