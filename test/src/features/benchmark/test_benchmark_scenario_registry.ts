import {
  AUSTERLITZ_BATTLE_FILM_BRIEF,
  AUSTERLITZ_TEASER_BRIEF,
  AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
  assertAutoMovieBenchmarkCalibrated,
  austerlitzBattleFilmTask,
  austerlitzSignalDraft,
  austerlitzTeaserDraft,
  austerlitzTeaserTask,
  austerlitzVolleyExchangeTask,
  createAutoMovieBenchmarkScenarioRegistry,
  getAutoMovieBenchmarkScenario,
  listAutoMovieBenchmarkScenarios,
  reportAutoMovieBenchmarkToolInventory,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

const expectErrorMessage = (
  title: string,
  task: () => unknown,
  message: string,
): void => TestValidator.predicate(title, throwsError(task, message));

/** Registry, demo milestones, calibration, and measured surface inventory. */
export const test_benchmark_scenario_registry = (): void => {
  const scenarios = listAutoMovieBenchmarkScenarios();
  TestValidator.equals(
    "the corpus registry enumerates every milestone in task-id order",
    scenarios.map((scenario) => scenario.taskId),
    [
      "long/austerlitz-battle-film",
      "medium/austerlitz-volley-exchange",
      "short/austerlitz-signal",
      "short/austerlitz-teaser",
    ],
  );
  TestValidator.equals(
    "the deterministic demo family fixes one, five, and twenty minute laws",
    namedFacts([
      [
        "getAutoMovieBenchmarkScenarioShortAusterlitz",
        () =>
          getAutoMovieBenchmarkScenario("short/austerlitz-teaser").brief ===
          AUSTERLITZ_TEASER_BRIEF,
      ],
      [
        "getAutoMovieBenchmarkScenarioMediumAusterlitz",
        () =>
          getAutoMovieBenchmarkScenario("medium/austerlitz-volley-exchange")
            .brief === AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
      ],
      [
        "getAutoMovieBenchmarkScenarioLongAusterlitz",
        () =>
          getAutoMovieBenchmarkScenario("long/austerlitz-battle-film").brief ===
          AUSTERLITZ_BATTLE_FILM_BRIEF,
      ],
      [
        "austerlitzTeaserTaskDeliveryMinRuntimeSeconds",
        () => austerlitzTeaserTask().delivery.minRuntimeSeconds === 55,
      ],
      [
        "austerlitzTeaserTaskProductionLawAssertion",
        () =>
          austerlitzTeaserTask().productionLaw.some(
            (assertion) => assertion.id === "production/object-registration",
          ),
      ],
      [
        "austerlitzVolleyExchangeTaskDeliveryMinRuntimeSeconds",
        () => austerlitzVolleyExchangeTask().delivery.minRuntimeSeconds === 285,
      ],
      [
        "austerlitzBattleFilmTaskDeliveryMinRuntimeSeconds",
        () => austerlitzBattleFilmTask().delivery.minRuntimeSeconds === 1_140,
      ],
      [
        "austerlitzTeaserDraftSurfaceFive",
        () => austerlitzTeaserDraft().surface === "five-tool",
      ],
      [
        "getAutoMovieBenchmarkScenarioShortAusterlitz2",
        () =>
          getAutoMovieBenchmarkScenario("short/austerlitz-teaser").lanes.join(
            ",",
          ) === "deterministic,repaint",
      ],
      [
        "scenariosScenarioIsFrozen",
        () =>
          scenarios.every(
            (scenario) =>
              Object.isFrozen(scenario) && Object.isFrozen(scenario.lanes),
          ),
      ],
    ]),
    {
      getAutoMovieBenchmarkScenarioShortAusterlitz: true,
      getAutoMovieBenchmarkScenarioMediumAusterlitz: true,
      getAutoMovieBenchmarkScenarioLongAusterlitz: true,
      austerlitzTeaserTaskDeliveryMinRuntimeSeconds: true,
      austerlitzTeaserTaskProductionLawAssertion: true,
      austerlitzVolleyExchangeTaskDeliveryMinRuntimeSeconds: true,
      austerlitzBattleFilmTaskDeliveryMinRuntimeSeconds: true,
      austerlitzTeaserDraftSurfaceFive: true,
      getAutoMovieBenchmarkScenarioShortAusterlitz2: true,
      scenariosScenarioIsFrozen: true,
    },
  );
  for (const scenario of scenarios)
    TestValidator.equals(
      `scenario ${scenario.taskId} reproduces its law and calibrated anchors`,
      namedFacts([
        [
          "scenarioTaskTaskId",
          () => scenario.task().taskId === scenario.taskId,
        ],
        [
          "assertAutoMovieBenchmarkCalibratedScenarioTask",
          () =>
            assertAutoMovieBenchmarkCalibrated(
              scenario.task(),
              scenario.anchors(),
            ).every((result) => result.inside),
        ],
      ]),
      {
        scenarioTaskTaskId: true,
        assertAutoMovieBenchmarkCalibratedScenarioTask: true,
      },
    );
  expectErrorMessage(
    "an unknown task names the complete registry",
    () => getAutoMovieBenchmarkScenario("short/missing"),
    "Choose one of: long/austerlitz-battle-film, medium/austerlitz-volley-exchange, short/austerlitz-signal, short/austerlitz-teaser",
  );
  const teaser = getAutoMovieBenchmarkScenario("short/austerlitz-teaser");
  expectErrorMessage(
    "scenario registries refuse duplicate task ids",
    () => createAutoMovieBenchmarkScenarioRegistry([teaser, teaser]),
    'Duplicate benchmark task id "short/austerlitz-teaser"',
  );
  expectErrorMessage(
    "scenario registries bind the entry id to its reproduced law",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        {
          ...teaser,
          task: () => ({
            ...teaser.task(),
            taskId: "short/different-law",
          }),
        },
      ]),
    "does not reproduce its registered task id and brief bytes",
  );
  expectErrorMessage(
    "scenario registries bind exact brief bytes to the law digest",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        { ...teaser, brief: `${teaser.brief}\nchanged` },
      ]),
    "does not reproduce its registered task id and brief bytes",
  );
  expectErrorMessage(
    "scenario registries require a delivery lane",
    () => createAutoMovieBenchmarkScenarioRegistry([{ ...teaser, lanes: [] }]),
    "at least one unique delivery lane",
  );
  expectErrorMessage(
    "scenario registries refuse duplicate delivery lanes",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        { ...teaser, lanes: ["deterministic", "deterministic"] },
      ]),
    "at least one unique delivery lane",
  );
  expectErrorMessage(
    "scenario registries refuse unknown delivery lanes",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        {
          ...teaser,
          lanes: ["deterministic", "unknown"],
        } as unknown as typeof teaser,
      ]),
    "supported set",
  );

  const oldSession = austerlitzSignalDraft("legacy-compact").mcp;
  const currentSession = austerlitzTeaserDraft("five-tool").mcp;
  const inventory = reportAutoMovieBenchmarkToolInventory([
    { surface: "legacy-compact", mcp: oldSession },
    { surface: "five-tool", mcp: currentSession },
  ]);
  TestValidator.equals(
    "actual new and retired handshakes produce a tool-budget comparison",
    namedFacts([
      ["inventorySurfaces", () => inventory.surfaces.length === 2],
      [
        "inventorySurfacesFind",
        () =>
          inventory.surfaces.find((entry) => entry.surface === "five-tool")
            ?.tools === 5,
      ],
      ["inventoryComparisons", () => inventory.comparisons.length === 1],
      [
        "inventoryComparisonsFrom",
        () => inventory.comparisons[0]!.from === "legacy-compact",
      ],
      [
        "inventoryComparisonsTo",
        () => inventory.comparisons[0]!.to === "five-tool",
      ],
      [
        "inventoryComparisonsAdded",
        () => inventory.comparisons[0]!.added.includes("captureFrame"),
      ],
      [
        "inventoryComparisonsRemoved",
        () => inventory.comparisons[0]!.removed.includes("compile"),
      ],
    ]),
    {
      inventorySurfaces: true,
      inventorySurfacesFind: true,
      inventoryComparisons: true,
      inventoryComparisonsFrom: true,
      inventoryComparisonsTo: true,
      inventoryComparisonsAdded: true,
      inventoryComparisonsRemoved: true,
    },
  );
  expectErrorMessage(
    "inventory reports require one measured handshake",
    () => reportAutoMovieBenchmarkToolInventory([]),
    "at least one measured MCP handshake",
  );
  expectErrorMessage(
    "one inventory report refuses duplicate surface measurements",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        { surface: "five-tool", mcp: currentSession },
        { surface: "five-tool", mcp: currentSession },
      ]),
    'Tool inventory repeats surface "five-tool"',
  );
  expectErrorMessage(
    "inventory reports refuse blank advertised tool names",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [{ ...currentSession.tools[0]!, name: " " }],
          },
        },
      ]),
    "blank or untrimmed tool name",
  );
  expectErrorMessage(
    "inventory reports refuse untrimmed advertised tool names",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [{ ...currentSession.tools[0]!, name: " captureFrame " }],
          },
        },
      ]),
    "blank or untrimmed tool name",
  );
  expectErrorMessage(
    "inventory reports refuse invalid measured byte budgets",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [{ ...currentSession.tools[0]!, descriptionBytes: -1 }],
          },
        },
      ]),
    "negative or non-integer byte budget",
  );
  expectErrorMessage(
    "inventory reports refuse fractional measured byte budgets",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [{ ...currentSession.tools[0]!, descriptionBytes: 1.5 }],
          },
        },
      ]),
    "negative or non-integer byte budget",
  );
  expectErrorMessage(
    "inventory reports validate schema bytes independently",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [{ ...currentSession.tools[0]!, schemaBytes: -1 }],
          },
        },
      ]),
    "negative or non-integer byte budget",
  );
  expectErrorMessage(
    "inventory reports refuse repeated advertised tool names",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        {
          surface: "five-tool",
          mcp: {
            ...currentSession,
            tools: [currentSession.tools[0]!, currentSession.tools[0]!],
          },
        },
      ]),
    "repeats an advertised tool name",
  );
};
