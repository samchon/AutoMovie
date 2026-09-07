import { TestValidator } from "@nestia/e2e";

import { assessScenarioExecution } from "../../scenarioExecution";

/**
 * A malformed or reversed executor clock record cannot masquerade as a fast
 * passing scenario, including when an assertion already failed.
 *
 * Scenarios:
 * 1. An unparseable start, completion, or both refuse a duration.
 * 2. Empty and out-of-range timestamps fail rather than becoming zero time.
 * 3. A completion one millisecond before its start fails without clamping.
 * 4. Every invalid timing shape retains any simultaneous assertion error.
 */
export const test_workspace_scenario_execution_timing = (): void => {
  const failure = new Error("the assertion also failed");
  const instant = "2026-09-07T00:00:00.000Z";
  for (const [started_at, completed_at] of [
    ["not-an-instant", instant],
    [instant, "not-an-instant"],
    ["not-an-instant", "also-not-an-instant"],
    ["", instant],
    [instant, ""],
    ["+999999-01-01T00:00:00.000Z", instant],
    [instant, "+999999-01-01T00:00:00.000Z"],
    [instant, "2026-09-06T23:59:59.999Z"],
  ])
    for (const error of [null, failure]) {
      const execution = {
        name: "test_invalid_timing",
        error,
        started_at,
        completed_at,
      };
      const result = assessScenarioExecution(execution);
      const title = `${JSON.stringify(started_at)} -> ${JSON.stringify(completed_at)}`;
      TestValidator.equals(
        `${title}: refuses acceptance`,
        result.passed,
        false,
      );
      TestValidator.equals(
        `${title}: no fabricated duration`,
        result.elapsedMs,
        null,
      );
      TestValidator.equals(
        `${title}: printed invalid timing`,
        result.timingLabel,
        "invalid timing",
      );
      TestValidator.equals(
        `${title}: retains the invalid timing facts`,
        result.timingFailure,
        `Invalid scenario timing: ${JSON.stringify(started_at)} -> ${JSON.stringify(completed_at)}.`,
      );
      TestValidator.predicate(
        `${title}: retains the original assertion error`,
        result.execution === execution && result.execution.error === error,
      );
    }
};
