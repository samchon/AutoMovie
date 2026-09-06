import type { DynamicExecutor } from "@nestia/e2e";

/**
 * Repository acceptance of one executor result, retaining assertion and timing
 * failures independently so neither can hide the other.
 *
 * @author Samchon
 */
export interface IScenarioExecutionAssessment {
  execution: Pick<
    DynamicExecutor.IExecution,
    "name" | "error" | "started_at" | "completed_at"
  >;
  elapsedMs: number | null;
  timingLabel: string;
  timingFailure: string | null;
  passed: boolean;
}

/**
 * Apply the same strict unit budget to every selected scenario. Unparseable or
 * backwards timestamps cannot supply an elapsed duration or a passing result.
 */
export const assessScenarioExecution = (
  execution: IScenarioExecutionAssessment["execution"],
): IScenarioExecutionAssessment => {
  const started = new Date(execution.started_at).getTime();
  const completed = new Date(execution.completed_at).getTime();
  let elapsedMs: number | null = null;
  let timingFailure: string | null;
  if (
    !Number.isFinite(started) ||
    !Number.isFinite(completed) ||
    completed < started
  )
    timingFailure = `Invalid scenario timing: ${JSON.stringify(execution.started_at)} -> ${JSON.stringify(execution.completed_at)}.`;
  else {
    elapsedMs = completed - started;
    timingFailure =
      elapsedMs >= 500
        ? `Scenario took ${elapsedMs} ms; every scenario must finish in under 500 ms.`
        : null;
  }
  return {
    execution,
    elapsedMs,
    timingLabel: elapsedMs === null ? "invalid timing" : `${elapsedMs} ms`,
    timingFailure,
    passed: execution.error === null && timingFailure === null,
  };
};
