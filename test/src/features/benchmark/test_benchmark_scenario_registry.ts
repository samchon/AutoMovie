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

import { throwsError } from "../internal/predicates";

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
        "getAutoMovieBenchmarkScenarioShort",
        () =>
          getAutoMovieBenchmarkScenario("short/austerlitz-teaser").brief ===
          AUSTERLITZ_TEASER_BRIEF,
      ],
      [
        "getAutoMovieBenchmarkScenarioMedium",
        () =>
          getAutoMovieBenchmarkScenario("medium/austerlitz-volley-exchange")
            .brief === AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
      ],
      [
        "getAutoMovieBenchmarkScenarioLong",
        () =>
          getAutoMovieBenchmarkScenario("long/austerlitz-battle-film").brief ===
          AUSTERLITZ_BATTLE_FILM_BRIEF,
      ],
      [
        "austerlitzTeaserTaskDelivery",
        () => austerlitzTeaserTask().delivery.minRuntimeSeconds === 55,
      ],
      [
        "austerlitzTeaserTaskProductionLaw",
        () =>
          austerlitzTeaserTask().productionLaw.some(
            (assertion) => assertion.id === "production/object-registration",
          ),
      ],
      [
        "austerlitzVolleyExchangeTaskDelivery",
        () => austerlitzVolleyExchangeTask().delivery.minRuntimeSeconds === 285,
      ],
      [
        "austerlitzBattleFilmTaskDelivery",
        () => austerlitzBattleFilmTask().delivery.minRuntimeSeconds === 1_140,
      ],
      [
        "austerlitzTeaserDraftSurface",
        () => austerlitzTeaserDraft().surface === "five-tool",
      ],
      [
        "getAutoMovieBenchmarkScenarioShort2",
        () =>
          getAutoMovieBenchmarkScenario("short/austerlitz-teaser").lanes.join(
            ",",
          ) === "deterministic,repaint",
      ],
      [
        "scenariosScenario",
        () =>
          scenarios.every(
            (scenario) =>
              Object.isFrozen(scenario) && Object.isFrozen(scenario.lanes),
          ),
      ],
    ]),
    {
      getAutoMovieBenchmarkScenarioShort: true,
      getAutoMovieBenchmarkScenarioMedium: true,
      getAutoMovieBenchmarkScenarioLong: true,
      austerlitzTeaserTaskDelivery: true,
      austerlitzTeaserTaskProductionLaw: true,
      austerlitzVolleyExchangeTaskDelivery: true,
      austerlitzBattleFilmTaskDelivery: true,
      austerlitzTeaserDraftSurface: true,
      getAutoMovieBenchmarkScenarioShort2: true,
      scenariosScenario: true,
    },
  );
  for (const scenario of scenarios)
    TestValidator.predicate(
      `scenario ${scenario.taskId} reproduces its law and calibrated anchors`,
      scenario.task().taskId === scenario.taskId &&
        assertAutoMovieBenchmarkCalibrated(
          scenario.task(),
          scenario.anchors(),
        ).every((result) => result.inside),
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
      ["inventoryCount", () => inventory.surfaces.length === 2],
      [
        "inventorySurfaces",
        () =>
          inventory.surfaces.find((entry) => entry.surface === "five-tool")
            ?.tools === 5,
      ],
      ["inventoryCount2", () => inventory.comparisons.length === 1],
      [
        "inventoryComparisons",
        () => inventory.comparisons[0]!.from === "legacy-compact",
      ],
      [
        "inventoryComparisons2",
        () => inventory.comparisons[0]!.to === "five-tool",
      ],
      [
        "inventoryComparisons3",
        () => inventory.comparisons[0]!.added.includes("captureFrame"),
      ],
      [
        "inventoryComparisons4",
        () => inventory.comparisons[0]!.removed.includes("compile"),
      ],
    ]),
    {
      inventoryCount: true,
      inventorySurfaces: true,
      inventoryCount2: true,
      inventoryComparisons: true,
      inventoryComparisons2: true,
      inventoryComparisons3: true,
      inventoryComparisons4: true,
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
