/**
 * One executable invocation. Arguments bypass a shell and stdin stays UTF-8.
 * @author Samchon
 */
export interface IBenchmarkCommand {
  executable: string;
  args: string[];
}

/**
 * Frozen operator inputs for one authoring turn and its declared checks.
 * @author Samchon
 */
export interface IBenchmarkTurnPlan {
  runId: string;
  generation: number;
  cwd: string;
  basisFile: string;
  promptFile: string;
  requestedModel: string;
  command: IBenchmarkCommand;
  artifacts: string[];
  checks: Array<{ id: string; command: IBenchmarkCommand }>;
  pollMs: number;
  stallMs: number;
}

/** Refuse an unusable plan before any process starts or receipt is opened. */
export const assertBenchmarkTurnPlan = (plan: IBenchmarkTurnPlan): void => {
  for (const value of [
    plan.runId,
    plan.cwd,
    plan.basisFile,
    plan.promptFile,
    plan.requestedModel,
  ])
    if (typeof value !== "string" || value.trim() === "")
      throw new Error(
        "Benchmark identity, paths and requested model must be nonblank strings.",
      );
  if (!Number.isSafeInteger(plan.generation) || plan.generation < 1)
    throw new Error("Benchmark generation must be a positive integer.");
  if (
    !Number.isSafeInteger(plan.pollMs) ||
    plan.pollMs < 1 ||
    plan.pollMs > 2147483647 ||
    !Number.isSafeInteger(plan.stallMs) ||
    plan.stallMs < plan.pollMs
  )
    throw new Error(
      "Benchmark cadence must fit a Node timer (1..2147483647 ms), with integer stallMs >= pollMs.",
    );
  if (
    !Array.isArray(plan.artifacts) ||
    plan.artifacts.some(
      (file) => typeof file !== "string" || file.trim() === "",
    )
  )
    throw new Error("Benchmark artifacts must be an array of nonblank paths.");
  if (
    !Array.isArray(plan.checks) ||
    plan.checks.some(
      (check) => typeof check.id !== "string" || check.id.trim() === "",
    ) ||
    new Set(plan.checks.map((check) => check.id)).size !== plan.checks.length
  )
    throw new Error("Benchmark check ids must be nonblank and unique.");
  for (const command of [
    plan.command,
    ...plan.checks.map((check) => check.command),
  ])
    if (
      typeof command.executable !== "string" ||
      command.executable.trim() === "" ||
      !Array.isArray(command.args) ||
      command.args.some((arg) => typeof arg !== "string")
    )
      throw new Error(
        "Benchmark commands require an executable and a string argument array.",
      );
};

/** Liveness is evidence of activity, never a completion or retry decision. */
export const benchmarkLiveness = (props: {
  now: number;
  lastProgress: number;
  advanced: boolean;
  stallMs: number;
}): "alive" | "idle" | "stalled" =>
  props.advanced
    ? "alive"
    : props.now - props.lastProgress >= props.stallMs
      ? "stalled"
      : "idle";

/** Count only terminated, successful declared checks; no checks means no ratio. */
export const benchmarkCheckProgress = (
  checks: readonly { id: string; status: "not-run" | "passed" | "failed" }[],
) => {
  const completed = checks.filter((check) => check.status === "passed").length;
  return {
    declared: checks.length,
    completed,
    failed: checks.filter((check) => check.status === "failed").length,
    notRun: checks.filter((check) => check.status === "not-run").length,
    fraction: checks.length === 0 ? null : completed / checks.length,
    scope:
      "declared verification commands only; final benchmark judgment remains with the coordinator",
  };
};
