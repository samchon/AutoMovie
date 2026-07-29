import {
  AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
  IAutoMovieBenchmarkTask,
  austerlitzSignalTask,
  benchmarkTaskAssertionIds,
  benchmarkVersionDrift,
  canonicalBenchmarkJson,
  compareBenchmarkCodeUnits,
  digestAutoMovieBenchmarkText,
  digestBenchmarkValue,
  validateAutoMovieBenchmarkTask,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

const refusal = (task: IAutoMovieBenchmarkTask, fragment: string): boolean => {
  try {
    validateAutoMovieBenchmarkTask(task);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/**
 * A benchmark task law is fixed by digest before its first valid run, so every
 * way it can silently rescore a leaderboard is refused at validation.
 *
 * Scenarios:
 *
 * 1. Canonical JSON sorts keys, drops undefined members, encodes every JSON
 *    scalar, and refuses a non-finite number that has no JSON form; the digest
 *    of two structurally equal values is therefore the same.
 * 2. The shipped short-tier corpus task validates and digests stably across
 *    independent constructions.
 * 3. Schema drift, harness drift, a repeated assertion id, an empty law, a
 *    reserved delivery prefix, a negative weight, weights that do not sum to
 *    one, a weighted empty axis, an empty or repeated deliverable inventory, an
 *    inverted runtime window, an inverted calibration band, and a repeated
 *    mutant id are each refused with the reason named.
 * 4. Version drift is reported field by field, and an identical version tuple
 *    reports nothing.
 */
export const test_benchmark_task_law = (): void => {
  TestValidator.equals(
    "canonical JSON is key-sorted, undefined-free, and scalar-complete",
    canonicalBenchmarkJson({
      zulu: [1, "two", true, null],
      alpha: { nested: 0.5, dropped: undefined },
    }),
    '{"alpha":{"nested":0.5},"zulu":[1,"two",true,null]}',
  );
  TestValidator.equals(
    "code-unit comparison orders below, above, and equal",
    ["a", "b"].map((left, index) =>
      compareBenchmarkCodeUnits(left, ["b", "a"][index]!),
    ),
    [-1, 1],
  );
  TestValidator.equals(
    "equal strings compare equal",
    compareBenchmarkCodeUnits("same", "same"),
    0,
  );
  TestValidator.predicate(
    "canonical JSON refuses a non-finite number",
    (() => {
      try {
        canonicalBenchmarkJson({ broken: Number.POSITIVE_INFINITY });
        return false;
      } catch (error) {
        return (
          error instanceof TypeError &&
          error.message.includes("non-finite numbers")
        );
      }
    })(),
  );
  TestValidator.equals(
    "structurally equal values digest identically regardless of key order",
    digestBenchmarkValue({ b: 1, a: 2 }),
    digestBenchmarkValue({ a: 2, b: 1 }),
  );

  const task = austerlitzSignalTask();
  TestValidator.equals(
    "the corpus task digests stably across constructions",
    validateAutoMovieBenchmarkTask(task),
    validateAutoMovieBenchmarkTask(austerlitzSignalTask()),
  );
  TestValidator.equals(
    "the corpus task law declares its eight deterministic assertions",
    benchmarkTaskAssertionIds(task).length,
    8,
  );
  TestValidator.equals(
    "the corpus brief digest is derived from the shipped brief text",
    task.brief.digest.startsWith("sha256:"),
    true,
  );

  const emptyLaw: IAutoMovieBenchmarkTask = {
    ...task,
    historicalLaw: [],
    productionLaw: [],
    requiredFrames: [],
    physicalInvariants: [],
  };
  TestValidator.equals(
    "every silent-rescoring shape is refused with its reason",
    [
      refusal(
        {} as IAutoMovieBenchmarkTask,
        "Invalid AutoMovie benchmark task",
      ),
      refusal(
        { ...task, versions: { ...task.versions, harness: "0.9.0" } },
        "this harness is",
      ),
      refusal(
        {
          ...task,
          productionLaw: [...task.productionLaw, task.productionLaw[0]!],
        },
        "repeats an assertion id",
      ),
      refusal(emptyLaw, "declares no assertion"),
      refusal(
        {
          ...task,
          productionLaw: [
            ...task.productionLaw,
            { ...task.productionLaw[0]!, id: "delivery:feature" },
          ],
        },
        "reserved",
      ),
      refusal(
        {
          ...task,
          weights: { ...task.weights, historical: -0.1, production: 0.5 },
        },
        "negative axis weight",
      ),
      refusal(
        { ...task, weights: { ...task.weights, delivery: 0.2 } },
        "must sum to 1",
      ),
      refusal(
        {
          ...task,
          physicalInvariants: [],
          historicalLaw: [
            ...task.historicalLaw,
            { ...task.historicalLaw[0]!, id: "historical/extra" },
          ],
        },
        "weights the invariant axis",
      ),
      refusal(
        { ...task, delivery: { ...task.delivery, requiredKinds: [] } },
        "requires no deliverable",
      ),
      refusal(
        {
          ...task,
          delivery: {
            ...task.delivery,
            requiredKinds: ["feature", "feature"],
          },
        },
        "repeats a required deliverable kind",
      ),
      refusal(
        {
          ...task,
          delivery: {
            ...task.delivery,
            minRuntimeSeconds: 90,
          },
        },
        "inverted runtime window",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            empty: { min: 0.9, max: 0.1 },
          },
        },
        "inverted empty calibration band",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            mutants: [
              ...task.calibration.mutants,
              task.calibration.mutants[0]!,
            ],
          },
        },
        "repeats a calibration mutant id",
      ),
    ],
    Array.from({ length: 13 }, () => true),
  );

  TestValidator.equals(
    "version drift names every moved field",
    benchmarkVersionDrift(task.versions, {
      task: "2.0.0",
      harness: AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
      reference: "1.1.0",
      scenarioHelper: 2,
    }),
    [
      "task: 1.0.0 -> 2.0.0",
      "reference: 1.0.0 -> 1.1.0",
      "scenarioHelper: 1 -> 2",
    ],
  );
  TestValidator.equals(
    "an identical version tuple reports no drift",
    benchmarkVersionDrift(task.versions, { ...task.versions }),
    [],
  );
  TestValidator.equals(
    "text digests are stable",
    digestAutoMovieBenchmarkText("automovie"),
    digestAutoMovieBenchmarkText("automovie"),
  );
};
