/**
 * Fixed lifecycle every benchmark run walks, in order.
 *
 * The order is the whole point of the taxonomy: a later gate is not merely
 * unscored when an earlier one fails, it never existed. Reading a reported
 * `pass` for a gate that could not have run is how a silent capture and a real
 * capture become indistinguishable.
 */
export const AUTOMOVIE_BENCHMARK_GATES = [
  "packaged-install",
  "mcp-handshake",
  "project-bootstrap",
  "source-compile",
  "capture-runtime",
  "required-frames",
  "review-queue",
  "deliverable-render",
  "final-compile",
] as const;

/** One ordered lifecycle gate. */
export type AutoMovieBenchmarkGate = (typeof AUTOMOVIE_BENCHMARK_GATES)[number];

/** Outcome one gate may carry. There is no implicit third state. */
export type AutoMovieBenchmarkGateStatus = "not-run" | "pass" | "fail";

/** One gate outcome with the evidence sentence the runner recorded. */
export interface IAutoMovieBenchmarkGateResult {
  /** Gate this outcome belongs to. */
  gate: AutoMovieBenchmarkGate;
  /** Explicit outcome. */
  status: AutoMovieBenchmarkGateStatus;
  /** Short operator-facing evidence sentence. */
  detail: string;
}

/** Failure class owned by the harness or its infrastructure, not a candidate. */
export type AutoMovieBenchmarkInfraKind =
  | "runner-interrupted"
  | "account-limit"
  | "rate-limit"
  | "repaint-adapter-unavailable"
  | "harness-error";

/** One infrastructure failure that removes a run from the denominator. */
export interface IAutoMovieBenchmarkInfraIncident {
  /** Failure class. */
  kind: AutoMovieBenchmarkInfraKind;
  /** Gate the run was standing on when infrastructure failed. */
  gate: AutoMovieBenchmarkGate;
  /** Short operator-facing evidence sentence. */
  detail: string;
}

/** Detail written onto every gate the run never reached. */
export const AUTOMOVIE_BENCHMARK_UNREACHED_DETAIL =
  "Not run: an earlier lifecycle gate did not pass.";

/**
 * Resolve whatever a runner reported into the canonical ordered lifecycle.
 *
 * Reported outcomes are trusted only up to the first gate that does not pass.
 * From there the resolved lifecycle states `not-run` regardless of what the
 * runner claimed, so a harness that kept going after a failed compile cannot
 * publish downstream passes it could not have earned.
 */
export const resolveAutoMovieBenchmarkLifecycle = (
  reported: readonly IAutoMovieBenchmarkGateResult[],
): IAutoMovieBenchmarkGateResult[] => {
  const seen = new Set<string>();
  for (const result of reported) {
    if (seen.has(result.gate))
      throw new Error(
        `Benchmark lifecycle reports gate "${result.gate}" more than once.`,
      );
    seen.add(result.gate);
  }
  const byGate = new Map(reported.map((result) => [result.gate, result]));
  let reached = true;
  return AUTOMOVIE_BENCHMARK_GATES.map((gate) => {
    if (reached === false)
      return {
        gate,
        status: "not-run" as const,
        detail: AUTOMOVIE_BENCHMARK_UNREACHED_DETAIL,
      };
    const result = byGate.get(gate) ?? {
      gate,
      status: "not-run" as const,
      detail: AUTOMOVIE_BENCHMARK_UNREACHED_DETAIL,
    };
    reached = result.status === "pass";
    return result;
  });
};

/**
 * The first gate that did not pass, or `null` when the run completed.
 *
 * A failed gate and a gate the runner never reported are the same blocker: in
 * both cases the run has no evidence past this point, and scoring it against
 * the full law would credit a film that was never delivered.
 */
export const blockingAutoMovieBenchmarkGate = (
  lifecycle: readonly IAutoMovieBenchmarkGateResult[],
): IAutoMovieBenchmarkGateResult | null =>
  lifecycle.find((result) => result.status !== "pass") ?? null;
