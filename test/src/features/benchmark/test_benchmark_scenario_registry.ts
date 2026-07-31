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
  TestValidator.predicate(
    "the deterministic demo family fixes one, five, and twenty minute laws",
    getAutoMovieBenchmarkScenario("short/austerlitz-teaser").brief ===
      AUSTERLITZ_TEASER_BRIEF &&
      getAutoMovieBenchmarkScenario("medium/austerlitz-volley-exchange")
        .brief === AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF &&
      getAutoMovieBenchmarkScenario("long/austerlitz-battle-film").brief ===
        AUSTERLITZ_BATTLE_FILM_BRIEF &&
      austerlitzTeaserTask().delivery.minRuntimeSeconds === 55 &&
      austerlitzTeaserTask().productionLaw.some(
        (assertion) => assertion.id === "production/object-registration",
      ) &&
      austerlitzVolleyExchangeTask().delivery.minRuntimeSeconds === 285 &&
      austerlitzBattleFilmTask().delivery.minRuntimeSeconds === 1_140 &&
      austerlitzTeaserDraft().surface === "five-tool" &&
      getAutoMovieBenchmarkScenario("short/austerlitz-teaser").lanes.join(
        ",",
      ) === "deterministic,repaint" &&
      scenarios.every(
        (scenario) =>
          Object.isFrozen(scenario) && Object.isFrozen(scenario.lanes),
      ),
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
  TestValidator.error(
    "an unknown task names the complete registry",
    () => getAutoMovieBenchmarkScenario("short/missing"),
    "Choose one of: long/austerlitz-battle-film, medium/austerlitz-volley-exchange, short/austerlitz-signal, short/austerlitz-teaser",
  );
  const teaser = getAutoMovieBenchmarkScenario("short/austerlitz-teaser");
  TestValidator.error(
    "scenario registries refuse duplicate task ids",
    () => createAutoMovieBenchmarkScenarioRegistry([teaser, teaser]),
    'Duplicate benchmark task id "short/austerlitz-teaser"',
  );
  TestValidator.error(
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
  TestValidator.error(
    "scenario registries bind exact brief bytes to the law digest",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        { ...teaser, brief: `${teaser.brief}\nchanged` },
      ]),
    "does not reproduce its registered task id and brief bytes",
  );
  TestValidator.error(
    "scenario registries require a delivery lane",
    () => createAutoMovieBenchmarkScenarioRegistry([{ ...teaser, lanes: [] }]),
    "at least one unique delivery lane",
  );
  TestValidator.error(
    "scenario registries refuse duplicate delivery lanes",
    () =>
      createAutoMovieBenchmarkScenarioRegistry([
        { ...teaser, lanes: ["deterministic", "deterministic"] },
      ]),
    "at least one unique delivery lane",
  );
  TestValidator.error(
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
  TestValidator.predicate(
    "actual new and retired handshakes produce a tool-budget comparison",
    inventory.surfaces.length === 2 &&
      inventory.surfaces.find((entry) => entry.surface === "five-tool")
        ?.tools === 5 &&
      inventory.comparisons.length === 1 &&
      inventory.comparisons[0]!.from === "legacy-compact" &&
      inventory.comparisons[0]!.to === "five-tool" &&
      inventory.comparisons[0]!.added.includes("captureFrame") &&
      inventory.comparisons[0]!.removed.includes("compile"),
  );
  TestValidator.error(
    "inventory reports require one measured handshake",
    () => reportAutoMovieBenchmarkToolInventory([]),
    "at least one measured MCP handshake",
  );
  TestValidator.error(
    "one inventory report refuses duplicate surface measurements",
    () =>
      reportAutoMovieBenchmarkToolInventory([
        { surface: "five-tool", mcp: currentSession },
        { surface: "five-tool", mcp: currentSession },
      ]),
    'Tool inventory repeats surface "five-tool"',
  );
  TestValidator.error(
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
  TestValidator.error(
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
  TestValidator.error(
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
  TestValidator.error(
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
  TestValidator.error(
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
  TestValidator.error(
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
