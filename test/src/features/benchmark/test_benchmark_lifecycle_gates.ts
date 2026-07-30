import {
  AUTOMOVIE_BENCHMARK_GATES,
  AUTOMOVIE_BENCHMARK_UNREACHED_DETAIL,
  IAutoMovieBenchmarkGateResult,
  blockingAutoMovieBenchmarkGate,
  resolveAutoMovieBenchmarkLifecycle,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

const pass = (
  gate: IAutoMovieBenchmarkGateResult["gate"],
): IAutoMovieBenchmarkGateResult => ({
  gate,
  status: "pass",
  detail: `${gate} ok`,
});

/**
 * A lifecycle gate that did not pass erases everything reported after it,
 * because a later gate never existed rather than merely going unscored.
 *
 * Scenarios:
 *
 * 1. A complete run resolves to nine passing gates in the fixed order and has no
 *    blocking gate.
 * 2. A failed compile keeps the gates before it, keeps the failure, and turns
 *    every later gate the runner claimed to pass into an explicit `not-run`.
 * 3. A run that reported nothing at all resolves to nine explicit `not-run` gates
 *    and blocks on the first one, so silence never reads as success.
 * 4. A gate omitted in the middle short-circuits from that gate onward even though
 *    the runner reported later passes.
 * 5. A duplicate gate report is refused outright: one gate has one outcome.
 */
export const test_benchmark_lifecycle_gates = (): void => {
  const complete = resolveAutoMovieBenchmarkLifecycle(
    AUTOMOVIE_BENCHMARK_GATES.map(pass),
  );
  TestValidator.equals(
    "a complete run resolves to the nine gates in fixed order",
    complete.map((result) => `${result.gate}:${result.status}`),
    AUTOMOVIE_BENCHMARK_GATES.map((gate) => `${gate}:pass`),
  );
  TestValidator.equals(
    "a complete run has no blocking gate",
    blockingAutoMovieBenchmarkGate(complete),
    null,
  );

  const failed = resolveAutoMovieBenchmarkLifecycle([
    ...AUTOMOVIE_BENCHMARK_GATES.slice(0, 3).map(pass),
    {
      gate: "source-compile",
      status: "fail",
      detail: "3 type errors remained.",
    },
    ...AUTOMOVIE_BENCHMARK_GATES.slice(4).map(pass),
  ]);
  TestValidator.equals(
    "a failed gate erases every later outcome the runner claimed",
    failed.map((result) => result.status),
    [
      "pass",
      "pass",
      "pass",
      "fail",
      "not-run",
      "not-run",
      "not-run",
      "not-run",
      "not-run",
    ],
  );
  TestValidator.equals(
    "the erased gates say why they were never run",
    failed[8]!.detail,
    AUTOMOVIE_BENCHMARK_UNREACHED_DETAIL,
  );
  TestValidator.equals(
    "the blocking gate is the one that failed",
    blockingAutoMovieBenchmarkGate(failed)?.gate,
    "source-compile",
  );

  const silent = resolveAutoMovieBenchmarkLifecycle([]);
  TestValidator.equals(
    "silence resolves to nine explicit not-run gates",
    silent.filter((result) => result.status === "not-run").length,
    9,
  );
  TestValidator.equals(
    "silence blocks on the very first gate",
    blockingAutoMovieBenchmarkGate(silent)?.gate,
    "packaged-install",
  );

  const skipped = resolveAutoMovieBenchmarkLifecycle([
    ...AUTOMOVIE_BENCHMARK_GATES.slice(0, 4).map(pass),
    ...AUTOMOVIE_BENCHMARK_GATES.slice(5).map(pass),
  ]);
  TestValidator.equals(
    "an omitted gate short-circuits the reported passes after it",
    skipped.map((result) => result.status),
    [
      "pass",
      "pass",
      "pass",
      "pass",
      "not-run",
      "not-run",
      "not-run",
      "not-run",
      "not-run",
    ],
  );

  TestValidator.predicate(
    "one gate cannot carry two outcomes",
    (() => {
      try {
        resolveAutoMovieBenchmarkLifecycle([
          pass("mcp-handshake"),
          { gate: "mcp-handshake", status: "fail", detail: "also failed" },
        ]);
        return false;
      } catch (error) {
        return (
          error instanceof Error && error.message.includes("more than once")
        );
      }
    })(),
  );
};
