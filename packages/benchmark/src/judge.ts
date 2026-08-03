import { AutoMovieContentDigest } from "@automovie/interface";

import {
  AutoMovieBenchmarkGate,
  IAutoMovieBenchmarkGateResult,
  IAutoMovieBenchmarkInfraIncident,
  blockingAutoMovieBenchmarkGate,
} from "./lifecycle";
import {
  IAutoMovieBenchmarkGenerationHealth,
  IAutoMovieBenchmarkSubmission,
  assertAutoMovieBenchmarkBinding,
} from "./submission";
import {
  AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX,
  AutoMovieBenchmarkAxis,
  AutoMovieBenchmarkLane,
  AutoMovieBenchmarkOperator,
  AutoMovieBenchmarkSurface,
  IAutoMovieBenchmarkFrameAssertion,
  IAutoMovieBenchmarkObservationAssertion,
  IAutoMovieBenchmarkTask,
  IAutoMovieBenchmarkVersions,
  canonicalBenchmarkJson,
  compareBenchmarkCodeUnits,
} from "./task";

/** Verdict schema every judged run carries. */
export const AUTOMOVIE_BENCHMARK_VERDICT_PROTOCOL =
  "automovie.benchmark.verdict.v2";

/**
 * Outcome of one deterministic assertion.
 *
 * `unknown` is not a soft failure, it is the absence of evidence: nothing was
 * archived to settle the assertion either way. Keeping it apart from `fail` is
 * what lets a report tell a capture that never ran from a capture that ran and
 * produced the wrong frame.
 */
export type AutoMovieBenchmarkAssertionOutcome = "pass" | "fail" | "unknown";

/** One settled assertion with the evidence address it was settled from. */
export interface IAutoMovieBenchmarkAssertionResult {
  /** Assertion id, unique inside the verdict. */
  id: string;
  /** Scored axis the assertion belongs to. */
  axis: AutoMovieBenchmarkAxis;
  /** Human-facing statement the assertion demanded. */
  statement: string;
  /** Settled outcome. */
  outcome: AutoMovieBenchmarkAssertionOutcome;
  /** Address of the archived evidence the outcome was read from. */
  evidence: string;
  /** Observed number, or `null` when no evidence was archived. */
  observed: number | null;
}

/** One axis and the fraction of its assertions that passed. */
export interface IAutoMovieBenchmarkAxisScore {
  /** Scored axis. */
  axis: AutoMovieBenchmarkAxis;
  /** Weight the task law gives the axis. */
  weight: number;
  /** Assertions that passed. */
  passed: number;
  /** Assertions the axis declared. */
  total: number;
  /** `passed / total`, or zero for an axis with no assertion. */
  score: number;
}

/** Fields every verdict carries, whatever its outcome. */
export interface IAutoMovieBenchmarkVerdictBase {
  /** Verdict schema. */
  protocolVersion: typeof AUTOMOVIE_BENCHMARK_VERDICT_PROTOCOL;
  /** Content-addressed run identity. */
  runId: AutoMovieContentDigest;
  /** Task law the run was judged under. */
  taskId: string;
  /** Digest of the exact task law the run was judged under. */
  taskDigest: AutoMovieContentDigest;
  /** Surface the candidate drove. */
  surface: AutoMovieBenchmarkSurface;
  /** Deterministic baseline or optional repaint experiment. */
  lane: AutoMovieBenchmarkLane;
  /** Every version the verdict is comparable within. */
  versions: IAutoMovieBenchmarkVersions;
  /** Canonical ordered lifecycle. */
  lifecycle: IAutoMovieBenchmarkGateResult[];
  /** Candidate generation health, reported beside the film score, never in it. */
  generation: IAutoMovieBenchmarkGenerationHealth;
}

/** A run that completed the lifecycle and was measured against the law. */
export interface IAutoMovieBenchmarkScoredVerdict extends IAutoMovieBenchmarkVerdictBase {
  /** Taxonomy outcome. */
  outcome: "scored";
  /** Every settled assertion, in law order. */
  assertions: IAutoMovieBenchmarkAssertionResult[];
  /** Per-axis pass fractions. */
  axes: IAutoMovieBenchmarkAxisScore[];
  /** Weighted film score in `[0, 1]`. */
  filmScore: number;
}

/** A run the candidate did not carry past one lifecycle gate. */
export interface IAutoMovieBenchmarkGateFailedVerdict extends IAutoMovieBenchmarkVerdictBase {
  /** Taxonomy outcome. */
  outcome: "gate-failed";
  /** Gate the run stopped at. */
  failedGate: AutoMovieBenchmarkGate;
  /** Evidence sentence recorded for that gate. */
  detail: string;
  /** Gate failure scores zero; it still counts in the denominator. */
  filmScore: 0;
}

/** A run infrastructure removed from the denominator. */
export interface IAutoMovieBenchmarkInfraExcludedVerdict extends IAutoMovieBenchmarkVerdictBase {
  /** Taxonomy outcome. */
  outcome: "infra-excluded";
  /** Infrastructure failure that excluded the run. */
  incident: IAutoMovieBenchmarkInfraIncident;
  /** An excluded run has no score at all, not a zero. */
  filmScore: null;
}

/** Every verdict a run may receive. */
export type IAutoMovieBenchmarkVerdict =
  | IAutoMovieBenchmarkScoredVerdict
  | IAutoMovieBenchmarkGateFailedVerdict
  | IAutoMovieBenchmarkInfraExcludedVerdict;

/** Settle one numeric comparison, with tolerance applied to every operator. */
const settle = (
  operator: AutoMovieBenchmarkOperator,
  observed: number,
  value: number,
  tolerance: number,
): boolean => {
  if (operator === "==") return Math.abs(observed - value) <= tolerance;
  if (operator === "!=") return Math.abs(observed - value) > tolerance;
  if (operator === ">=") return observed >= value - tolerance;
  if (operator === "<=") return observed <= value + tolerance;
  if (operator === ">") return observed > value + tolerance;
  return observed < value - tolerance;
};

/** Settle one observation assertion against the archived observations. */
const judgeObservation = (
  axis: AutoMovieBenchmarkAxis,
  assertion: IAutoMovieBenchmarkObservationAssertion,
  observations: Readonly<Record<string, number>>,
): IAutoMovieBenchmarkAssertionResult => {
  const observed = observations[assertion.observation];
  const evidence = `observation:${assertion.observation}`;
  if (observed === undefined)
    return {
      id: assertion.id,
      axis,
      statement: assertion.statement,
      outcome: "unknown",
      evidence,
      observed: null,
    };
  return {
    id: assertion.id,
    axis,
    statement: assertion.statement,
    outcome: settle(
      assertion.operator,
      observed,
      assertion.value,
      assertion.tolerance,
    )
      ? "pass"
      : "fail",
    evidence,
    observed,
  };
};

/** Settle one required-frame assertion against the archived captures. */
const judgeFrame = (
  assertion: IAutoMovieBenchmarkFrameAssertion,
  submission: IAutoMovieBenchmarkSubmission,
): IAutoMovieBenchmarkAssertionResult => {
  const logicalEvidence = `frame:${assertion.shot}@${assertion.timeSeconds}:${assertion.pass}`;
  const frames = submission.frames
    .filter(
      (candidate) =>
        candidate.shot === assertion.shot &&
        candidate.pass === assertion.pass &&
        Math.abs(candidate.timeSeconds - assertion.timeSeconds) < 1e-9,
    )
    .sort((left, right) =>
      compareBenchmarkCodeUnits(
        canonicalBenchmarkJson(left),
        canonicalBenchmarkJson(right),
      ),
    );
  const first = frames[0];
  if (first === undefined)
    return {
      id: assertion.id,
      axis: "frame",
      statement: assertion.statement,
      outcome: "unknown",
      evidence: logicalEvidence,
      observed: null,
    };
  const passing = frames.find(
    (frame) =>
      frame.probeValid &&
      frame.width === assertion.width &&
      frame.height === assertion.height &&
      frame.bytes >= assertion.minBytes,
  );
  const observed = passing ?? first;
  return {
    id: assertion.id,
    axis: "frame",
    statement: assertion.statement,
    outcome: passing === undefined ? "fail" : "pass",
    evidence: `archive:${observed.path}`,
    observed: observed.bytes,
  };
};

/** Settle the delivery law against the archived publication. */
const judgeDelivery = (
  task: IAutoMovieBenchmarkTask,
  submission: IAutoMovieBenchmarkSubmission,
): IAutoMovieBenchmarkAssertionResult[] => {
  const kinds = task.delivery.requiredKinds.map((kind) => {
    const files = submission.deliverables.filter((file) => file.kind === kind);
    const evidence = `deliverable:${kind}`;
    if (files.length === 0)
      return {
        id: `${AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX}${kind}`,
        axis: "delivery" as const,
        statement: `Final compilation publishes a ${kind} deliverable.`,
        outcome: "unknown" as const,
        evidence,
        observed: null,
      };
    return {
      id: `${AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX}${kind}`,
      axis: "delivery" as const,
      statement: `Final compilation publishes a ${kind} deliverable.`,
      outcome: files.some((file) => file.probeValid)
        ? ("pass" as const)
        : ("fail" as const),
      evidence: `archive:${
        files.find((file) => file.probeValid)?.path ?? files[0]!.path
      }`,
      observed: files.length,
    };
  });
  const runtime = submission.finishedRuntimeSeconds;
  return [
    ...kinds,
    {
      id: `${AUTOMOVIE_BENCHMARK_DELIVERY_PREFIX}runtime`,
      axis: "delivery",
      statement: `The finished film runs ${task.delivery.minRuntimeSeconds}..${task.delivery.maxRuntimeSeconds} seconds.`,
      outcome:
        runtime === null
          ? "unknown"
          : runtime >= task.delivery.minRuntimeSeconds &&
              runtime <= task.delivery.maxRuntimeSeconds
            ? "pass"
            : "fail",
      evidence: "deliverable:runtime",
      observed: runtime,
    },
  ];
};

/** Reduce settled assertions into the weighted per-axis score table. */
const scoreAxes = (
  task: IAutoMovieBenchmarkTask,
  assertions: readonly IAutoMovieBenchmarkAssertionResult[],
): IAutoMovieBenchmarkAxisScore[] =>
  (["historical", "production", "frame", "invariant", "delivery"] as const).map(
    (axis) => {
      const owned = assertions.filter((result) => result.axis === axis);
      const passed = owned.filter((result) => result.outcome === "pass").length;
      return {
        axis,
        weight: task.weights[axis],
        passed,
        total: owned.length,
        score: owned.length === 0 ? 0 : passed / owned.length,
      };
    },
  );

/**
 * Judge one sealed submission against one task law.
 *
 * The three outcomes answer three different questions and never substitute for
 * each other: infrastructure that broke removes the run from the denominator, a
 * candidate that could not carry the lifecycle scores zero inside it, and only
 * a run that reached final compilation is measured against the law at all.
 * Every settled assertion carries the evidence address it was read from, so a
 * score is always traceable back to an archived artifact.
 */
export const judgeAutoMovieBenchmarkSubmission = (
  task: IAutoMovieBenchmarkTask,
  submission: IAutoMovieBenchmarkSubmission,
): IAutoMovieBenchmarkVerdict => {
  assertAutoMovieBenchmarkBinding(task, submission);
  const base: IAutoMovieBenchmarkVerdictBase = {
    protocolVersion: AUTOMOVIE_BENCHMARK_VERDICT_PROTOCOL,
    runId: submission.runId,
    taskId: submission.taskId,
    taskDigest: submission.taskDigest,
    surface: submission.surface,
    lane: submission.lane,
    versions: submission.versions,
    lifecycle: submission.lifecycle,
    generation: submission.generation,
  };
  if (submission.incident !== null)
    return {
      ...base,
      outcome: "infra-excluded",
      incident: submission.incident,
      filmScore: null,
    };
  const blocking = blockingAutoMovieBenchmarkGate(submission.lifecycle);
  if (blocking !== null)
    return {
      ...base,
      outcome: "gate-failed",
      failedGate: blocking.gate,
      detail: blocking.detail,
      filmScore: 0,
    };
  const repaintFailure = repaintEvidenceFailure(submission);
  if (repaintFailure !== null)
    return {
      ...base,
      outcome: "gate-failed",
      failedGate: "final-compile",
      detail: repaintFailure,
      filmScore: 0,
    };
  const assertions: IAutoMovieBenchmarkAssertionResult[] = [
    ...task.historicalLaw.map((assertion) =>
      judgeObservation("historical", assertion, submission.observations),
    ),
    ...task.productionLaw.map((assertion) =>
      judgeObservation("production", assertion, submission.observations),
    ),
    ...task.requiredFrames.map((assertion) =>
      judgeFrame(assertion, submission),
    ),
    ...task.physicalInvariants.map((assertion) =>
      judgeObservation("invariant", assertion, submission.observations),
    ),
    ...judgeDelivery(task, submission),
  ];
  const axes = scoreAxes(task, assertions);
  return {
    ...base,
    outcome: "scored",
    assertions,
    axes,
    filmScore: axes.reduce((sum, axis) => sum + axis.weight * axis.score, 0),
  };
};

const repaintEvidenceFailure = (
  submission: IAutoMovieBenchmarkSubmission,
): string | null => {
  if (submission.lane === "deterministic")
    return submission.repaint.status === "not-requested"
      ? null
      : "Deterministic lane submission carries repaint runtime claims.";
  if (submission.repaint.status !== "verified")
    return "Completed repaint lane has no runner-verified adapter, receipt, output, and rendition-review chain.";
  const repaint = submission.repaint;
  const feature = submission.deliverables.find(
    (file) => file.kind === "feature" && file.probeValid,
  );
  if (
    repaint.adapterIdentity.trim().length === 0 ||
    repaint.shots.length === 0 ||
    new Set(repaint.shots.map((shot) => shot.shot)).size !==
      repaint.shots.length ||
    feature === undefined ||
    feature.digest !== repaint.featureDigest
  )
    return "Repaint lane evidence is incomplete, duplicates a shot, or does not bind the delivered feature digest.";
  return null;
};
