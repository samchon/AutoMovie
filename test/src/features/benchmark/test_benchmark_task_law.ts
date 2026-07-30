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
 *    scalar, and refuses non-finite or non-JSON values; the digest of two
 *    structurally equal values is therefore the same.
 * 2. The shipped short-tier corpus task validates and digests stably across
 *    independent constructions.
 * 3. Schema drift, harness drift, a repeated assertion id, an empty law, a
 *    reserved delivery prefix, a negative weight, weights that do not sum to
 *    one, a weighted empty axis, an empty or repeated deliverable inventory, an
 *    inverted runtime window, an inverted calibration band, and a repeated
 *    mutant id are each refused with the reason named.
 * 4. Every task-law number is finite and stays inside its declared integer,
 *    non-negative, positive, runtime, calibration, and sandbox domain.
 * 5. Version drift is reported field by field, and an identical version tuple
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
  TestValidator.equals(
    "canonical JSON accepts a null-prototype JSON object",
    canonicalBenchmarkJson(
      Object.assign(Object.create(null), { zulu: 2, alpha: 1 }),
    ),
    '{"alpha":1,"zulu":2}',
  );
  TestValidator.predicate(
    "canonical JSON refuses values with no JSON identity",
    [
      [{ broken: Number.POSITIVE_INFINITY }, "non-finite numbers"],
      [1n, "JSON-compatible"],
      [Symbol("unsupported"), "JSON-compatible"],
      [() => undefined, "JSON-compatible"],
      [new Array(1), "JSON-compatible"],
      [new Map([["unsupported", true]]), "plain JSON objects"],
      [new Date(0), "plain JSON objects"],
    ].every(([value, fragment]) => {
      try {
        canonicalBenchmarkJson(value);
        return false;
      } catch (error) {
        return (
          error instanceof TypeError &&
          error.message.includes(fragment as string)
        );
      }
    }),
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
  const observationTask = (
    patch: Partial<(typeof task.historicalLaw)[number]>,
  ): IAutoMovieBenchmarkTask => ({
    ...task,
    historicalLaw: [
      { ...task.historicalLaw[0]!, ...patch },
      ...task.historicalLaw.slice(1),
    ],
  });
  const frameTask = (
    patch: Partial<(typeof task.requiredFrames)[number]>,
  ): IAutoMovieBenchmarkTask => ({
    ...task,
    requiredFrames: [
      { ...task.requiredFrames[0]!, ...patch },
      ...task.requiredFrames.slice(1),
    ],
  });
  TestValidator.equals(
    "every numeric task-law domain is validated before a leaderboard opens",
    [
      refusal(
        {
          ...task,
          versions: { ...task.versions, scenarioHelper: 0.5 },
        },
        "scenario-helper revision",
      ),
      refusal(
        {
          ...task,
          versions: { ...task.versions, scenarioHelper: -1 },
        },
        "scenario-helper revision",
      ),
      refusal(observationTask({ value: Number.NaN }), "non-finite comparand"),
      refusal(
        observationTask({ tolerance: Number.NaN }),
        "non-finite tolerance",
      ),
      refusal(observationTask({ tolerance: -1 }), "negative"),
      refusal(frameTask({ timeSeconds: Number.NaN }), "invalid sample time"),
      refusal(frameTask({ timeSeconds: -1 }), "invalid sample time"),
      refusal(frameTask({ width: 0.5 }), "positive safe-integer"),
      refusal(frameTask({ width: 0 }), "positive safe-integer"),
      refusal(
        {
          ...task,
          weights: { ...task.weights, historical: Number.NaN },
        },
        "non-finite axis weight",
      ),
      refusal(
        {
          ...task,
          weights: {
            historical: 1.000_000_000_5,
            production: 0,
            frame: 0,
            invariant: 0,
            delivery: 0,
          },
        },
        "sum to 1",
      ),
      refusal(
        {
          ...task,
          delivery: {
            ...task.delivery,
            minRuntimeSeconds: Number.NaN,
          },
        },
        "runtime window",
      ),
      refusal(
        {
          ...task,
          delivery: {
            ...task.delivery,
            maxRuntimeSeconds: Number.NaN,
          },
        },
        "runtime window",
      ),
      refusal(
        {
          ...task,
          delivery: { ...task.delivery, minRuntimeSeconds: -1 },
        },
        "runtime window",
      ),
      refusal(
        {
          ...task,
          delivery: { ...task.delivery, maxRuntimeSeconds: 0 },
        },
        "runtime window",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            reference: {
              ...task.calibration.reference,
              min: Number.NaN,
            },
          },
        },
        "out-of-range reference",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            reference: {
              ...task.calibration.reference,
              max: Number.NaN,
            },
          },
        },
        "out-of-range reference",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            reference: { ...task.calibration.reference, min: -0.1 },
          },
        },
        "out-of-range reference",
      ),
      refusal(
        {
          ...task,
          calibration: {
            ...task.calibration,
            reference: { ...task.calibration.reference, max: 1.1 },
          },
        },
        "out-of-range reference",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxElapsedSeconds: Number.NaN },
        },
        "sandbox budget",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxElapsedSeconds: 0 },
        },
        "sandbox budget",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxCostUsd: Number.NaN },
        },
        "sandbox budget",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxCostUsd: -1 },
        },
        "sandbox budget",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxCorrections: 0.5 },
        },
        "sandbox budget",
      ),
      refusal(
        {
          ...task,
          sandbox: { ...task.sandbox, maxCorrections: -1 },
        },
        "sandbox budget",
      ),
    ],
    Array.from({ length: 25 }, () => true),
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
