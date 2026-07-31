import { AutoMovieContentDigest } from "@automovie/interface";

import {
  AutoMovieBenchmarkAssertionOutcome,
  IAutoMovieBenchmarkInfraExcludedVerdict,
  IAutoMovieBenchmarkVerdict,
} from "./judge";
import {
  AutoMovieBenchmarkLane,
  AutoMovieBenchmarkSurface,
  benchmarkVersionDrift,
  compareBenchmarkCodeUnits,
} from "./task";

/**
 * One reviewed axis a machine cannot settle.
 *
 * A rubric verdict is kept in its own shape on purpose. It never enters the
 * film score, and it must name the exact frames and source addresses it was
 * formed from, so a reader can tell a judged opinion from a measured fact
 * without reading the harness.
 */
export interface IAutoMovieBenchmarkRubricVerdict {
  /** Run the rubric verdict was formed about. */
  runId: AutoMovieContentDigest;
  /** Reviewed axis. */
  axis: "aesthetic" | "narrative" | "historical-reading";
  /** Non-blank reviewer identity, human or agent. */
  reviewer: string;
  /** Fixed-rubric score in `[0, 1]`. */
  score: number;
  /** Non-blank reason the reviewer scored it that way. */
  rationale: string;
  /** Non-blank exact frame and source addresses the reviewer read. */
  evidence: string[];
}

/** Aggregate outcome for one surface and delivery lane. */
export interface IAutoMovieBenchmarkSurfaceReport {
  /** Surface the runs drove. */
  surface: AutoMovieBenchmarkSurface;
  /** Deterministic baseline or optional repaint experiment. */
  lane: AutoMovieBenchmarkLane;
  /** Runs measured against the law. */
  scored: number;
  /** Runs the candidate could not carry past a lifecycle gate. */
  gateFailed: number;
  /** Runs infrastructure removed from the denominator. */
  infraExcluded: number;
  /** Runs that count: scored plus gate-failed. */
  denominator: number;
  /** Mean film score over the denominator, or `null` when it is empty. */
  meanFilmScore: number | null;
  /** Mean candidate cost in US dollars over the denominator. */
  meanCostUsd: number | null;
  /** Mean wall-clock run time in seconds over the denominator. */
  meanElapsedSeconds: number | null;
  /** Mean correction rounds over the denominator. */
  meanCorrections: number | null;
}

/** One benchmark report: measured film outcomes beside generation health. */
export interface IAutoMovieBenchmarkReport {
  /** Per-surface/lane aggregates in code-unit key order. */
  surfaces: IAutoMovieBenchmarkSurfaceReport[];
  /** Reviewed axes, carried beside the measured ones and never inside them. */
  rubric: IAutoMovieBenchmarkRubricVerdict[];
}

/** Change in one assertion between two comparable verdicts. */
export interface IAutoMovieBenchmarkAssertionChange {
  /** Assertion id. */
  id: string;
  /** Outcome the earlier verdict settled, or `null` when it had none. */
  from: AutoMovieBenchmarkAssertionOutcome | null;
  /** Outcome the later verdict settled, or `null` when it has none. */
  to: AutoMovieBenchmarkAssertionOutcome | null;
}

/** Difference between two verdicts, drift first. */
export interface IAutoMovieBenchmarkVerdictDiff {
  /** Version fields that moved between the two verdicts. */
  versionDrift: string[];
  /** Whether the two verdicts answer the same question at all. */
  comparable: boolean;
  /** Film-score change, or `null` when the verdicts are not comparable. */
  filmScoreDelta: number | null;
  /** Assertions whose outcome moved, in code-unit id order. */
  assertionChanges: IAutoMovieBenchmarkAssertionChange[];
}

/**
 * Refuse a rubric verdict that reads like a measurement.
 *
 * A reviewed axis without an evidence address is an opinion presented as a
 * result, which is exactly the shape a deterministic score has. Requiring the
 * addresses is what keeps the two kinds of claim separable in a report.
 */
export const assertAutoMovieBenchmarkRubric = (
  rubric: IAutoMovieBenchmarkRubricVerdict,
): void => {
  if (
    rubric.evidence.length === 0 ||
    rubric.evidence.some((address) => address.trim().length === 0)
  )
    throw new Error(
      `Rubric verdict on ${rubric.runId} carries no evidence address. A reviewed axis names the frames and sources it read.`,
    );
  if (
    rubric.reviewer.trim().length === 0 ||
    rubric.rationale.trim().length === 0
  )
    throw new Error(
      `Rubric verdict on ${rubric.runId} must name its reviewer and rationale.`,
    );
  if (
    Number.isFinite(rubric.score) === false ||
    rubric.score < 0 ||
    rubric.score > 1
  )
    throw new Error(
      `Rubric verdict on ${rubric.runId} scores ${rubric.score}, outside the 0..1 rubric range.`,
    );
};

/** Mean of a non-empty sample, or `null` for an empty one. */
const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Refuse duplicate runs and verdicts produced under different laws.
 *
 * A surface mean has one denominator and one evaluation law. Counting the same
 * content-addressed run twice inflates that denominator, while averaging scores
 * across task or harness versions turns two different questions into one
 * leaderboard number.
 */
const assertAutoMovieBenchmarkReportCohort = (
  verdicts: readonly IAutoMovieBenchmarkVerdict[],
): void => {
  const duplicate = verdicts.find(
    (verdict, index) =>
      verdicts.findIndex((candidate) => candidate.runId === verdict.runId) !==
      index,
  );
  if (duplicate !== undefined)
    throw new Error(
      `Benchmark report repeats run ${duplicate.runId}. One archived run enters the denominator once.`,
    );
  const reference = verdicts[0];
  if (reference === undefined) return;
  for (const verdict of verdicts.slice(1)) {
    const drift = [
      ...(reference.taskId === verdict.taskId
        ? []
        : [`taskId: ${reference.taskId} -> ${verdict.taskId}`]),
      ...(reference.taskDigest === verdict.taskDigest
        ? []
        : [`taskDigest: ${reference.taskDigest} -> ${verdict.taskDigest}`]),
      ...benchmarkVersionDrift(reference.versions, verdict.versions),
    ];
    if (drift.length !== 0)
      throw new Error(
        `Benchmark report mixes incomparable run ${verdict.runId} with ${reference.runId}: ${drift.join("; ")}. Build one report per task law and harness.`,
      );
  }
};

/**
 * Aggregate verdicts per surface, with infrastructure out of the denominator.
 *
 * Excluding infrastructure is what makes the leaderboard about the product: a
 * rate-limited runner is not a worse film, and counting it as one would make
 * the score depend on the day the run happened.
 */
export const reportAutoMovieBenchmark = (
  verdicts: readonly IAutoMovieBenchmarkVerdict[],
  rubric: readonly IAutoMovieBenchmarkRubricVerdict[] = [],
): IAutoMovieBenchmarkReport => {
  assertAutoMovieBenchmarkReportCohort(verdicts);
  const runIds = new Set(verdicts.map((verdict) => verdict.runId));
  for (const item of rubric) {
    assertAutoMovieBenchmarkRubric(item);
    if (runIds.has(item.runId) === false)
      throw new Error(
        `Rubric verdict on ${item.runId} has no measured verdict in this report.`,
      );
  }
  const surfaces = [
    ...new Set(
      verdicts.map((verdict) => `${verdict.surface}\u0000${verdict.lane}`),
    ),
  ].sort(compareBenchmarkCodeUnits);
  return {
    surfaces: surfaces.map((key) => {
      const [surface, lane] = key.split("\u0000") as [
        AutoMovieBenchmarkSurface,
        AutoMovieBenchmarkLane,
      ];
      const owned = verdicts.filter(
        (verdict) => verdict.surface === surface && verdict.lane === lane,
      );
      const counted = owned.filter(
        (
          verdict,
        ): verdict is Exclude<
          IAutoMovieBenchmarkVerdict,
          IAutoMovieBenchmarkInfraExcludedVerdict
        > => verdict.outcome !== "infra-excluded",
      );
      return {
        surface,
        lane,
        scored: owned.filter((verdict) => verdict.outcome === "scored").length,
        gateFailed: owned.filter((verdict) => verdict.outcome === "gate-failed")
          .length,
        infraExcluded: owned.filter(
          (verdict) => verdict.outcome === "infra-excluded",
        ).length,
        denominator: counted.length,
        meanFilmScore: mean(counted.map((verdict) => verdict.filmScore)),
        meanCostUsd: mean(counted.map((verdict) => verdict.generation.costUsd)),
        meanElapsedSeconds: mean(
          counted.map((verdict) => verdict.generation.elapsedSeconds),
        ),
        meanCorrections: mean(
          counted.map((verdict) => verdict.generation.corrections),
        ),
      };
    }),
    rubric: [...rubric],
  };
};

/** Settled outcomes of one verdict, keyed by assertion id. */
const outcomesOf = (
  verdict: IAutoMovieBenchmarkVerdict,
): Map<string, AutoMovieBenchmarkAssertionOutcome> =>
  new Map(
    verdict.outcome === "scored"
      ? verdict.assertions.map((result) => [result.id, result.outcome])
      : [],
  );

/**
 * Diff two verdicts under one task law, reporting law drift before any score.
 *
 * The verdicts may come from different surfaces and therefore carry different
 * run ids. A score that moved under a changed harness, task, reference, or
 * helper revision is not a product change, so the delta is withheld entirely
 * rather than reported with a caveat a reader can skip.
 */
export const diffAutoMovieBenchmarkVerdicts = (
  before: IAutoMovieBenchmarkVerdict,
  after: IAutoMovieBenchmarkVerdict,
): IAutoMovieBenchmarkVerdictDiff => {
  const versionDrift = [
    ...(before.lane === after.lane
      ? []
      : [`lane: ${before.lane} -> ${after.lane}`]),
    ...(before.taskDigest === after.taskDigest
      ? []
      : [`taskDigest: ${before.taskDigest} -> ${after.taskDigest}`]),
    ...benchmarkVersionDrift(before.versions, after.versions),
  ];
  const left = outcomesOf(before);
  const right = outcomesOf(after);
  const comparable = versionDrift.length === 0;
  return {
    versionDrift,
    comparable,
    filmScoreDelta:
      comparable === false ||
      before.filmScore === null ||
      after.filmScore === null
        ? null
        : after.filmScore - before.filmScore,
    assertionChanges: [...new Set([...left.keys(), ...right.keys()])]
      .sort(compareBenchmarkCodeUnits)
      .filter((id) => left.get(id) !== right.get(id))
      .map((id) => ({
        id,
        from: left.get(id) ?? null,
        to: right.get(id) ?? null,
      })),
  };
};
