import { IAutoMovieBenchmarkAnchors } from "../calibration";
import {
  IAutoMovieBenchmarkTask,
  compareBenchmarkCodeUnits,
  digestAutoMovieBenchmarkText,
  validateAutoMovieBenchmarkTask,
} from "../task";
import {
  AUSTERLITZ_SIGNAL_BRIEF,
  austerlitzSignalAnchors,
  austerlitzSignalTask,
} from "./austerlitzSignal";
import {
  AUSTERLITZ_BATTLE_FILM_BRIEF,
  AUSTERLITZ_TEASER_BRIEF,
  AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
  austerlitzBattleFilmAnchors,
  austerlitzBattleFilmTask,
  austerlitzTeaserAnchors,
  austerlitzTeaserTask,
  austerlitzVolleyExchangeAnchors,
  austerlitzVolleyExchangeTask,
} from "./demoMilestones";

/** One immutable task-law family entry exposed by the pure corpus registry. */
export interface IAutoMovieBenchmarkScenario {
  /** Stable id, equal to the task factory's `taskId`. */
  taskId: string;
  /** Exact brief bytes handed to an external candidate. */
  brief: string;
  /** Fresh validated task law. */
  task: () => IAutoMovieBenchmarkTask;
  /** Fresh calibration anchors for the task law. */
  anchors: () => IAutoMovieBenchmarkAnchors;
}

const scenarios = [
  {
    taskId: "short/austerlitz-signal",
    brief: AUSTERLITZ_SIGNAL_BRIEF,
    task: austerlitzSignalTask,
    anchors: austerlitzSignalAnchors,
  },
  {
    taskId: "short/austerlitz-teaser",
    brief: AUSTERLITZ_TEASER_BRIEF,
    task: austerlitzTeaserTask,
    anchors: austerlitzTeaserAnchors,
  },
  {
    taskId: "medium/austerlitz-volley-exchange",
    brief: AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
    task: austerlitzVolleyExchangeTask,
    anchors: austerlitzVolleyExchangeAnchors,
  },
  {
    taskId: "long/austerlitz-battle-film",
    brief: AUSTERLITZ_BATTLE_FILM_BRIEF,
    task: austerlitzBattleFilmTask,
    anchors: austerlitzBattleFilmAnchors,
  },
] as const satisfies readonly IAutoMovieBenchmarkScenario[];

/** Read-only task-id registry built from one candidate corpus. */
export interface IAutoMovieBenchmarkScenarioRegistry {
  /** Enumerate every entry in stable task-id order. */
  list(): IAutoMovieBenchmarkScenario[];
  /** Resolve one exact task id. */
  get(taskId: string): IAutoMovieBenchmarkScenario;
}

/** Validate and index a scenario corpus without running an agent or filesystem. */
export const createAutoMovieBenchmarkScenarioRegistry = (
  entries: readonly IAutoMovieBenchmarkScenario[],
): IAutoMovieBenchmarkScenarioRegistry => {
  const indexed = new Map<string, IAutoMovieBenchmarkScenario>();
  for (const scenario of entries) {
    if (indexed.has(scenario.taskId))
      throw new Error(`Duplicate benchmark task id "${scenario.taskId}".`);
    const task = scenario.task();
    validateAutoMovieBenchmarkTask(task);
    if (
      task.taskId !== scenario.taskId ||
      task.brief.digest !== digestAutoMovieBenchmarkText(scenario.brief)
    )
      throw new Error(
        `Benchmark scenario "${scenario.taskId}" does not reproduce its registered task id and brief bytes.`,
      );
    indexed.set(scenario.taskId, Object.freeze({ ...scenario }));
  }
  const list = (): IAutoMovieBenchmarkScenario[] =>
    [...indexed.values()].sort((left, right) =>
      compareBenchmarkCodeUnits(left.taskId, right.taskId),
    );
  return Object.freeze({
    list,
    get: (taskId) => {
      const scenario = indexed.get(taskId);
      if (scenario !== undefined) return scenario;
      throw new Error(
        `Unknown AutoMovie benchmark task "${taskId}". Choose one of: ${list()
          .map((candidate) => candidate.taskId)
          .join(", ")}.`,
      );
    },
  });
};

const registry = createAutoMovieBenchmarkScenarioRegistry(scenarios);

/** Enumerate every registered scenario in stable task-id order. */
export const listAutoMovieBenchmarkScenarios =
  (): IAutoMovieBenchmarkScenario[] => registry.list();

/** Resolve one exact scenario id or fail with the complete registry. */
export const getAutoMovieBenchmarkScenario = (
  taskId: string,
): IAutoMovieBenchmarkScenario => registry.get(taskId);
