import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const unit = loadSourceModule<{
  assertBenchmarkTurnPlan: (plan: unknown) => void;
  benchmarkLiveness: (props: {
    now: number;
    lastProgress: number;
    advanced: boolean;
    stallMs: number;
  }) => string;
  benchmarkCheckProgress: (
    checks: { id: string; status: "not-run" | "passed" | "failed" }[],
  ) => {
    declared: number;
    completed: number;
    failed: number;
    notRun: number;
    fraction: number | null;
  };
}>(path.resolve(__dirname, "../../../../build/benchmarkObservation.ts"));

/**
 * A timed observation cannot authorize another turn or manufacture completion.
 *
 * Scenarios:
 * 1. Invalid identity, cadence, artifacts and command declarations fail admission.
 * 2. New activity, a quiet interval and the exact stall boundary stay distinct.
 * 3. Empty and mixed check populations report only verified successful work.
 */
export const test_cli_benchmark_observation = (): void => {
  const command = { executable: "author", args: ["exec", "-"] };
  const plan = {
    runId: "run",
    generation: 1,
    cwd: ".",
    basisFile: "basis.json",
    promptFile: "prompt.txt",
    requestedModel: "declared-model",
    command,
    artifacts: ["result.json"],
    checks: [{ id: "gate", command }],
    pollMs: 300000,
    stallMs: 900000,
  };
  unit.assertBenchmarkTurnPlan(plan);
  for (const patch of [
    { runId: "" },
    { generation: 0 },
    { generation: 0.5 },
    { pollMs: 0 },
    { pollMs: 2147483648, stallMs: 2147483648 },
    { stallMs: 1 },
    { artifacts: null },
    { artifacts: [""] },
    { checks: null },
    { checks: [{ id: "", command }] },
    {
      checks: [
        { id: "gate", command },
        { id: "gate", command },
      ],
    },
    { command: { executable: "", args: [] } },
    { command: { executable: "author", args: null } },
    { command: { executable: "author", args: [0] } },
  ])
    TestValidator.equals(
      "invalid plan is refused before launch",
      throwsError(() => unit.assertBenchmarkTurnPlan({ ...plan, ...patch })),
      true,
    );
  unit.assertBenchmarkTurnPlan({ ...plan, artifacts: [], checks: [] });
  const sample = {
    now: 900000,
    lastProgress: 0,
    advanced: false,
    stallMs: 900000,
  };
  TestValidator.equals(
    "stall boundary",
    unit.benchmarkLiveness(sample),
    "stalled",
  );
  TestValidator.equals(
    "quiet before boundary",
    unit.benchmarkLiveness({ ...sample, now: 899999 }),
    "idle",
  );
  TestValidator.equals(
    "new evidence is activity",
    unit.benchmarkLiveness({ ...sample, advanced: true }),
    "alive",
  );
  TestValidator.equals(
    "no checks gives no invented completion",
    unit.benchmarkCheckProgress([]).fraction,
    null,
  );
  const progress = unit.benchmarkCheckProgress([
    { id: "a", status: "passed" },
    { id: "b", status: "failed" },
    { id: "c", status: "not-run" },
  ]);
  TestValidator.equals(
    "only a completed successful check counts",
    [
      progress.declared,
      progress.completed,
      progress.failed,
      progress.notRun,
      progress.fraction,
    ],
    [3, 1, 1, 1, 1 / 3],
  );
};
