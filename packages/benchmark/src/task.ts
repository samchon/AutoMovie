import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieProductionDeliverable,
} from "@automovie/interface";
import { createHash } from "node:crypto";
import typia from "typia";

/**
 * Harness contract every verdict is produced under.
 *
 * A verdict is comparable only with verdicts produced by the same harness. The
 * value moves when the evaluation law itself changes, never when a task or a
 * product does, so a leaderboard can tell a judge change from a film change.
 */
export const AUTOMOVIE_BENCHMARK_HARNESS_VERSION = "1.0.0";

/** Task-law schema every published task carries. */
export const AUTOMOVIE_BENCHMARK_TASK_PROTOCOL = "automovie.benchmark.task.v1";

/**
 * Reserved id prefix for the delivery-axis results the judge synthesizes.
 *
 * Delivery is declared as one law rather than as a list of assertions, so its
 * results are named by the judge. A declared assertion that took the same
 * prefix would silently replace one of them in a result table keyed by id.
 */
export const AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX = "delivery:";

/** Corpus tier, which fixes the runtime budget one task may consume. */
export type AutoMovieBenchmarkTier = "short" | "medium" | "long";

/** MCP surface one submission was produced through. */
export type AutoMovieBenchmarkSurface =
  | "production"
  | "legacy-compact"
  | "legacy-granular";

/** Scored axis one deterministic assertion belongs to. */
export type AutoMovieBenchmarkAxis =
  | "historical"
  | "production"
  | "frame"
  | "invariant"
  | "delivery";

/** Comparison a deterministic evaluator settles without interpretation. */
export type AutoMovieBenchmarkOperator = "==" | "!=" | ">=" | "<=" | ">" | "<";

/**
 * Every version one verdict is comparable within.
 *
 * `scenarioHelper` counts the helper revision a candidate was handed, because a
 * more capable helper changes the difficulty of the same task text.
 */
export interface IAutoMovieBenchmarkVersions {
  /** Task-law version; a stricter rubric raises it instead of rewriting. */
  task: string;
  /** Harness contract the verdict was produced under. */
  harness: string;
  /** Reference-submission version the calibration anchors were measured on. */
  reference: string;
  /** Monotonic scenario-helper revision handed to the candidate. */
  scenarioHelper: number;
}

/**
 * One numeric fact the runner reads directly from the produced film.
 *
 * The observation key names what was measured, never how it was rendered, so
 * the same law evaluates a production submission and a legacy one. Anything a
 * machine cannot settle belongs to a rubric verdict instead.
 */
export interface IAutoMovieBenchmarkObservationAssertion {
  /** Stable assertion id, unique inside its task. */
  id: string;
  /** Human-facing statement of what the assertion demands. */
  statement: string;
  /** Observation key the runner must publish for this assertion. */
  observation: string;
  /** Comparison applied to the observed value. */
  operator: AutoMovieBenchmarkOperator;
  /** Finite comparand. */
  value: number;
  /** Non-negative slack applied to equality comparisons. */
  tolerance: number;
}

/** One actual captured frame the finished film must contain. */
export interface IAutoMovieBenchmarkFrameAssertion {
  /** Stable assertion id, unique inside its task. */
  id: string;
  /** Human-facing statement of what the frame must show. */
  statement: string;
  /** Compiler-owned shot id the frame belongs to. */
  shot: string;
  /** Exact shot-local capture time in seconds. */
  timeSeconds: number;
  /** Structural or beauty pass the frame was captured through. */
  pass: AutoMovieGuidePass;
  /** Exact raster the production frame format demands. */
  width: number;
  /** Exact raster the production frame format demands. */
  height: number;
  /** Smallest byte count a non-blank capture can have. */
  minBytes: number;
}

/** Deliverable inventory and runtime the finished film must publish. */
export interface IAutoMovieBenchmarkDeliveryLaw {
  /** Deliverable classes final compilation must publish. */
  requiredKinds: IAutoMovieProductionDeliverable["kind"][];
  /** Smallest accepted finished runtime in seconds. */
  minRuntimeSeconds: number;
  /** Largest accepted finished runtime in seconds. */
  maxRuntimeSeconds: number;
}

/** Weight of each scored axis; the five must sum to one. */
export interface IAutoMovieBenchmarkWeights {
  /** Weight of the historical-truth axis. */
  historical: number;
  /** Weight of the machine-checkable production-design axis. */
  production: number;
  /** Weight of the required-frame axis. */
  frame: number;
  /** Weight of the physical-invariant axis. */
  invariant: number;
  /** Weight of the delivery axis. */
  delivery: number;
}

/** Score band one calibration anchor must land in. */
export interface IAutoMovieBenchmarkBand {
  /** Smallest accepted film score. */
  min: number;
  /** Largest accepted film score. */
  max: number;
}

/** Anchors that pin the judge itself rather than any candidate. */
export interface IAutoMovieBenchmarkCalibration {
  /** Band the intended vertical slice must score inside. */
  reference: IAutoMovieBenchmarkBand;
  /** Band a bootstrap-only submission must score inside. */
  empty: IAutoMovieBenchmarkBand;
  /** Bands each known-broken submission must score inside. */
  mutants: IAutoMovieBenchmarkMutantBand[];
}

/** One known-broken submission and the band its score may not leave. */
export interface IAutoMovieBenchmarkMutantBand {
  /** Stable mutant id. */
  id: string;
  /** Defect the mutant fixes in place. */
  defect: string;
  /** Band the mutant must score inside. */
  band: IAutoMovieBenchmarkBand;
}

/** Runtime budget one candidate may consume inside the sandbox. */
export interface IAutoMovieBenchmarkSandbox {
  /** Largest accepted wall-clock run time in seconds. */
  maxElapsedSeconds: number;
  /** Largest accepted candidate cost in US dollars. */
  maxCostUsd: number;
  /** Largest accepted number of correction rounds. */
  maxCorrections: number;
}

/** Immutable brief bytes every surface receives unchanged. */
export interface IAutoMovieBenchmarkBrief {
  /** Repository-relative module that owns the brief text. */
  path: string;
  /** Digest of the exact brief bytes handed to the candidate. */
  digest: AutoMovieContentDigest;
}

/** One versioned, digest-fixed movie task law. */
export interface IAutoMovieBenchmarkTask {
  /** Task-law schema. */
  protocolVersion: typeof AUTOMOVIE_BENCHMARK_TASK_PROTOCOL;
  /** Stable task id, unique inside the corpus. */
  taskId: string;
  /** Corpus tier. */
  tier: AutoMovieBenchmarkTier;
  /** Every version this task's verdicts are comparable within. */
  versions: IAutoMovieBenchmarkVersions;
  /** Immutable brief identity. */
  brief: IAutoMovieBenchmarkBrief;
  /** Historical-truth assertions. */
  historicalLaw: IAutoMovieBenchmarkObservationAssertion[];
  /** Machine-checkable production-design assertions. */
  productionLaw: IAutoMovieBenchmarkObservationAssertion[];
  /** Required actual-frame assertions. */
  requiredFrames: IAutoMovieBenchmarkFrameAssertion[];
  /** Physical-invariant assertions. */
  physicalInvariants: IAutoMovieBenchmarkObservationAssertion[];
  /** Deliverable inventory and runtime law. */
  delivery: IAutoMovieBenchmarkDeliveryLaw;
  /** Axis weights. */
  weights: IAutoMovieBenchmarkWeights;
  /** Judge calibration anchors. */
  calibration: IAutoMovieBenchmarkCalibration;
  /** Sandbox budget. */
  sandbox: IAutoMovieBenchmarkSandbox;
}

/** Stable SHA-256 digest for benchmark bytes. */
export const digestAutoMovieBenchmarkBytes = (
  bytes: Uint8Array,
): AutoMovieContentDigest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Digest of one UTF-8 benchmark text, such as an immutable brief. */
export const digestAutoMovieBenchmarkText = (
  text: string,
): AutoMovieContentDigest =>
  digestAutoMovieBenchmarkBytes(Buffer.from(text, "utf8"));

/** Compare UTF-16 code units for deterministic ordering. */
export const compareBenchmarkCodeUnits = (
  left: string,
  right: string,
): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * Canonical JSON with lexicographically sorted keys.
 *
 * Run and law identity are digests of this text, so two structurally equal
 * values must produce the same bytes no matter which key an author typed first.
 * A non-finite number has no JSON form, so it is refused rather than silently
 * written as `null`.
 */
export const canonicalBenchmarkJson = (value: unknown): string => {
  const encode = (current: unknown): string => {
    if (current === null || typeof current === "boolean")
      return JSON.stringify(current);
    if (typeof current === "string") return JSON.stringify(current);
    if (typeof current === "number") {
      if (Number.isFinite(current) === false)
        throw new TypeError(
          "Benchmark canonical JSON refuses non-finite numbers.",
        );
      return JSON.stringify(current);
    }
    if (Array.isArray(current))
      return `[${current.map((item) => encode(item)).join(",")}]`;
    const record = current as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareBenchmarkCodeUnits)
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${encode(record[key])}`)
      .join(",")}}`;
  };
  return encode(value);
};

/** Digest of one canonically encoded benchmark value. */
export const digestBenchmarkValue = (value: unknown): AutoMovieContentDigest =>
  digestAutoMovieBenchmarkText(canonicalBenchmarkJson(value));

/** Every assertion one task law declares, in evaluation order. */
export const benchmarkTaskAssertionIds = (
  task: IAutoMovieBenchmarkTask,
): string[] => [
  ...task.historicalLaw.map((item) => item.id),
  ...task.productionLaw.map((item) => item.id),
  ...task.requiredFrames.map((item) => item.id),
  ...task.physicalInvariants.map((item) => item.id),
];

/**
 * Validate one task law and return its canonical digest.
 *
 * The law is fixed by digest before the first valid run, so every refusal here
 * is a refusal to open a leaderboard: a duplicate assertion id would silently
 * overwrite a result, weights that do not sum to one would rescale scores
 * against every earlier verdict, and an inverted band would accept every
 * calibration anchor.
 */
export const validateAutoMovieBenchmarkTask = (
  task: IAutoMovieBenchmarkTask,
): AutoMovieContentDigest => {
  const validation = typia.validateEquals<IAutoMovieBenchmarkTask>(task);
  if (validation.success === false)
    throw new Error(
      `Invalid AutoMovie benchmark task: ${validation.errors
        .map((error) => `${error.path} expects ${error.expected}`)
        .join("; ")}.`,
    );
  if (task.versions.harness !== AUTOMOVIE_BENCHMARK_HARNESS_VERSION)
    throw new Error(
      `Benchmark task "${task.taskId}" declares harness ${task.versions.harness}, but this harness is ${AUTOMOVIE_BENCHMARK_HARNESS_VERSION}. Raise the task version instead of rescoring old verdicts.`,
    );
  const ids = benchmarkTaskAssertionIds(task);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      `Benchmark task "${task.taskId}" repeats an assertion id. Every assertion result is keyed by id.`,
    );
  if (ids.length === 0)
    throw new Error(
      `Benchmark task "${task.taskId}" declares no assertion. A task with no law scores every submission alike.`,
    );
  if (ids.some((id) => id.startsWith(AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX)))
    throw new Error(
      `Benchmark task "${task.taskId}" declares an assertion under the reserved "${AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX}" prefix.`,
    );
  const weights = Object.values(task.weights);
  if (weights.some((weight) => weight < 0))
    throw new Error(
      `Benchmark task "${task.taskId}" declares a negative axis weight.`,
    );
  if (Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-9)
    throw new Error(
      `Benchmark task "${task.taskId}" axis weights must sum to 1.`,
    );
  for (const [axis, declared] of [
    ["historical", task.historicalLaw.length] as const,
    ["production", task.productionLaw.length] as const,
    ["frame", task.requiredFrames.length] as const,
    ["invariant", task.physicalInvariants.length] as const,
  ])
    if (task.weights[axis] > 0 && declared === 0)
      throw new Error(
        `Benchmark task "${task.taskId}" weights the ${axis} axis but declares no ${axis} assertion. A weighted empty axis silently caps every score.`,
      );
  if (task.delivery.requiredKinds.length === 0)
    throw new Error(
      `Benchmark task "${task.taskId}" requires no deliverable. Delivery is a scored axis.`,
    );
  if (
    new Set(task.delivery.requiredKinds).size !==
    task.delivery.requiredKinds.length
  )
    throw new Error(
      `Benchmark task "${task.taskId}" repeats a required deliverable kind.`,
    );
  if (task.delivery.minRuntimeSeconds > task.delivery.maxRuntimeSeconds)
    throw new Error(
      `Benchmark task "${task.taskId}" declares an inverted runtime window.`,
    );
  for (const [label, band] of [
    ["reference", task.calibration.reference] as const,
    ["empty", task.calibration.empty] as const,
    ...task.calibration.mutants.map(
      (mutant) => [`mutant ${mutant.id}`, mutant.band] as const,
    ),
  ])
    if (band.min > band.max)
      throw new Error(
        `Benchmark task "${task.taskId}" declares an inverted ${label} calibration band.`,
      );
  const mutantIds = task.calibration.mutants.map((mutant) => mutant.id);
  if (new Set(mutantIds).size !== mutantIds.length)
    throw new Error(
      `Benchmark task "${task.taskId}" repeats a calibration mutant id.`,
    );
  return digestBenchmarkValue(task);
};

/**
 * Refuse a task whose versions do not match the ones a verdict was produced
 * under, naming the drifted field first.
 *
 * Version drift is reported before any score, because a score difference read
 * across two laws is not a product difference at all.
 */
export const benchmarkVersionDrift = (
  left: IAutoMovieBenchmarkVersions,
  right: IAutoMovieBenchmarkVersions,
): string[] =>
  (
    [
      ["task", left.task, right.task],
      ["harness", left.harness, right.harness],
      ["reference", left.reference, right.reference],
      ["scenarioHelper", left.scenarioHelper, right.scenarioHelper],
    ] as const
  )
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => `${field}: ${String(from)} -> ${String(to)}`);
