import { TestValidator } from "@nestia/e2e";

import { assessScenarioExecution } from "../../scenarioExecution";

/**
 * Scenario acceptance requires both a successful assertion and a duration below
 * the repository's strict unit budget, without replacing the original error.
 *
 * Scenarios:
 * 1. Durations of 0 and 499 ms pass only without an assertion error.
 * 2. Durations of 500 and 501 ms fail even when the assertion succeeds.
 * 3. An assertion error and a budget failure remain independently observable.
 * 4. Different timestamp offsets denoting the same instant yield zero duration.
 */
export const test_workspace_scenario_execution_budget = (): void => {
  const failure = new Error("the assertion failed");
  for (const elapsedMs of [0, 499, 500, 501])
    for (const error of [null, failure]) {
      const execution = {
        name: `test_budget_${elapsedMs}`,
        error,
        started_at: "2026-09-07T00:00:00.000Z",
        completed_at: new Date(Date.UTC(2026, 8, 7) + elapsedMs).toISOString(),
      };
      const snapshot = { ...execution };
      const result = assessScenarioExecution(execution);
      const title = `${elapsedMs} ms with ${error === null ? "success" : "an assertion failure"}`;
      TestValidator.equals(`${title}: elapsed`, result.elapsedMs, elapsedMs);
      TestValidator.equals(
        `${title}: printed duration`,
        result.timingLabel,
        `${elapsedMs} ms`,
      );
      TestValidator.equals(
        `${title}: acceptance`,
        result.passed,
        error === null && elapsedMs < 500,
      );
      TestValidator.equals(
        `${title}: timing failure`,
        result.timingFailure,
        elapsedMs < 500
          ? null
          : `Scenario took ${elapsedMs} ms; every scenario must finish in under 500 ms.`,
      );
      TestValidator.predicate(
        `${title}: original result and assertion error are retained`,
        result.execution === execution && result.execution.error === error,
      );
      TestValidator.equals(`${title}: input is unchanged`, execution, snapshot);
    }
  const offset = assessScenarioExecution({
    name: "test_equal_instants",
    error: null,
    started_at: "2026-09-07T00:00:00.000Z",
    completed_at: "2026-09-07T09:00:00.000+09:00",
  });
  TestValidator.equals(
    "equivalent instants do not invent elapsed time",
    [offset.elapsedMs, offset.timingLabel, offset.timingFailure, offset.passed],
    [0, "0 ms", null, true],
  );
};
