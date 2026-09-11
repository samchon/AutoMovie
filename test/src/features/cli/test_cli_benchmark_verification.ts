import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

type Command = { executable: string; args: string[] };
type Result = { id: string; status: "not-run" | "passed" | "failed" };
const { runBenchmarkVerification } = loadSourceModule<{
  runBenchmarkVerification: (props: {
    checks: { id: string; command: Command }[];
    enabled: boolean;
    isInterrupted: () => boolean;
    run: (command: Command, index: number) => Promise<boolean>;
    observe: (checks: readonly Result[]) => void;
  }) => Promise<Result[]>;
}>(path.resolve(__dirname, "../../../../build/benchmarkObservation.ts"));

/**
 * Operator interruption ends verification dispatch without inventing results.
 *
 * Scenarios:
 * 1. Disabled, already interrupted and empty runs launch no command.
 * 2. Ordinary failure preserves order and still permits independent checks.
 * 3. Interruption during the first check leaves every remaining check not-run.
 */
export const test_cli_benchmark_verification = async (): Promise<void> => {
  const checks = ["first", "second"].map((id) => ({
    id,
    command: { executable: id, args: [] },
  }));
  const observe = (): never => {
    throw new Error("An unstarted check cannot publish a result.");
  };
  const run = async (): Promise<never> => {
    throw new Error("This declaration authorizes no command.");
  };
  for (const state of [
    { enabled: false, isInterrupted: () => false },
    { enabled: true, isInterrupted: () => true },
  ])
    TestValidator.equals(
      "unstarted results are explicit",
      await runBenchmarkVerification({ checks, ...state, run, observe }),
      checks.map(({ id }) => ({ id, status: "not-run" })),
    );
  TestValidator.equals(
    "empty population performs no observation",
    await runBenchmarkVerification({
      checks: [],
      enabled: true,
      isInterrupted: () => false,
      run,
      observe,
    }),
    [],
  );
  for (const stopAfterFirst of [false, true]) {
    let interrupted = false;
    const calls: string[] = [];
    const observations: string[][] = [];
    const result = await runBenchmarkVerification({
      checks,
      enabled: true,
      isInterrupted: () => interrupted,
      run: async (command, index) => {
        calls.push(command.executable);
        if (index === 0) interrupted = stopAfterFirst;
        return index !== 0;
      },
      observe: (results) =>
        observations.push(results.map((item) => item.status)),
    });
    TestValidator.equals(
      "ordered dispatch respects interruption",
      calls,
      stopAfterFirst ? ["first"] : ["first", "second"],
    );
    TestValidator.equals("terminal results preserve unstarted checks", result, [
      { id: "first", status: "failed" },
      { id: "second", status: stopAfterFirst ? "not-run" : "passed" },
    ]);
    TestValidator.equals(
      "only completed checks publish progress",
      observations,
      stopAfterFirst
        ? [["failed", "not-run"]]
        : [
            ["failed", "not-run"],
            ["failed", "passed"],
          ],
    );
  }
};
