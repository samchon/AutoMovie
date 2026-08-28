import {
  AutoMovieContentDigest,
  AutoMovieRepaintFailureClass,
  IAutoMovieRepaintExecutionPolicy,
} from "@automovie/interface";

/** Available bytes reported even when an attempt cannot become a candidate. */
interface IAutoMovieRepaintAttemptOutput {
  digest: AutoMovieContentDigest;
  bytes: number;
}

/** One immutable terminal transport-attempt record. */
export interface IAutoMovieRepaintAttemptRecord {
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Versions the immutable attempt record. */
  version: 1;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Names the owning production. */
  productionId: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Names the exact shot. */
  shot: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Keeps retry request identity stable. */
  requestId: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Detects request mutation across retry. */
  requestFingerprint: AutoMovieContentDigest;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Gives each provider call a distinct identity. */
  attemptId: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Records budget order. */
  ordinal: number;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Locks compiler input. */
  compileFingerprint: AutoMovieContentDigest;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Locks deterministic source bytes. */
  sourceRenderFingerprint: AutoMovieContentDigest;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Retains provider and model identity. */
  adapterIdentity: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-seed-semantics Retains the seed as a control rather than a reproducibility promise. */
  seed: number;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Records provider-call start. */
  startedAt: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Records terminal time. */
  completedAt: string;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Distinguishes accepted, failed, cancelled, invalid, and stale attempts. */
  status: "succeeded" | "failed" | "cancelled" | "invalid" | "stale";
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Preserves classified refusal and retryability. */
  failure: {
    class: AutoMovieRepaintFailureClass;
    message: string;
    retryable: boolean;
  } | null;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Charges the request cost ceiling. */
  costUnits: number;
  /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Preserves available partial bytes without admitting a candidate. */
  availableOutput: IAutoMovieRepaintAttemptOutput | null;
}

/** A classified adapter refusal with optional metered cost and partial output. */
export class AutoMovieRepaintAttemptError extends Error {
  public constructor(
    /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Gives the refusal a durable failure class. */
    public readonly failureClass: AutoMovieRepaintFailureClass,
    message: string,
    /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Charges failed provider work to the budget. */
    public readonly costUnits: number = 0,
    /** @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Preserves a partial digest without accepting it. */
    public readonly availableOutput: IAutoMovieRepaintAttemptOutput | null = null,
  ) {
    super(message);
  }
}

/** Explicit clock, ids, and wait boundary used by repaint execution. */
interface IAutoMovieRepaintExecutionRuntime {
  now: () => Date;
  attemptId: () => string;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

/** Complete bounded execution result for one immutable request. */
interface IAutoMovieRepaintExecutionResult<T> {
  requestId: string;
  attempts: IAutoMovieRepaintAttemptRecord[];
  accepted: { value: T; attempt: IAutoMovieRepaintAttemptRecord } | null;
  stop:
    | "accepted"
    | "cancelled"
    | "cost-exhausted"
    | "elapsed-exhausted"
    | "attempts-exhausted"
    | "not-retryable";
}

/** Validate the exact bounded repaint policy before any provider execution. */
export const assertAutoMovieRepaintExecutionPolicy = (
  policy: IAutoMovieRepaintExecutionPolicy,
): void => {
  if (
    Number.isSafeInteger(policy.maximumAttempts) === false ||
    policy.maximumAttempts <= 0 ||
    Number.isSafeInteger(policy.attemptTimeoutMs) === false ||
    policy.attemptTimeoutMs <= 0 ||
    Number.isSafeInteger(policy.maximumElapsedMs) === false ||
    policy.maximumElapsedMs <= 0 ||
    policy.attemptTimeoutMs > policy.maximumElapsedMs ||
    Number.isFinite(policy.maximumCostUnits) === false ||
    policy.maximumCostUnits < 0 ||
    policy.backoffMs.length !== policy.maximumAttempts - 1 ||
    policy.backoffMs.some(
      (value) => Number.isSafeInteger(value) === false || value < 0,
    ) ||
    new Set(policy.retryableFailures).size !==
      policy.retryableFailures.length ||
    policy.retryableFailures.some(
      (value) => FAILURE_CLASSES.has(value) === false,
    )
  )
    throw new Error(
      "Repaint execution policy requires positive attempt/elapsed time bounds, a non-negative cost ceiling, exactly one deterministic backoff per possible retry, and unique supported retryable failure classes.",
    );
};

/**
 * Execute one repaint request within its complete retry, time, cost, and
 * cancellation envelope. Every attempted provider call yields one terminal
 * record; only a successful validation value can become a candidate.
 */
export const executeAutoMovieRepaintRequest = async <T>(props: {
  productionId: string;
  shot: string;
  requestId: string;
  ordinalOffset?: number;
  requestFingerprint: AutoMovieContentDigest;
  compileFingerprint: AutoMovieContentDigest;
  sourceRenderFingerprint: AutoMovieContentDigest;
  adapterIdentity: string;
  seed: number;
  policy: IAutoMovieRepaintExecutionPolicy;
  runtime: IAutoMovieRepaintExecutionRuntime;
  signal?: AbortSignal;
  execute: (signal: AbortSignal) => Promise<{
    value: T;
    costUnits: number;
    availableOutput: IAutoMovieRepaintAttemptOutput | null;
  }>;
  onAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => void;
}): Promise<IAutoMovieRepaintExecutionResult<T>> => {
  assertAutoMovieRepaintExecutionPolicy(props.policy);
  const started = validInstant(props.runtime.now(), "request start");
  const attempts: IAutoMovieRepaintAttemptRecord[] = [];
  let spent = 0;
  const ordinalOffset = props.ordinalOffset ?? 0;
  const requestCancelled = (): boolean => props.signal?.aborted === true;
  for (let local = 1; local <= props.policy.maximumAttempts; local++) {
    const ordinal = ordinalOffset + local;
    if (requestCancelled())
      return result(props.requestId, attempts, null, "cancelled");
    const elapsed = props.runtime.now().getTime() - started.getTime();
    if (elapsed >= props.policy.maximumElapsedMs)
      return result(props.requestId, attempts, null, "elapsed-exhausted");
    if (spent >= props.policy.maximumCostUnits)
      return result(props.requestId, attempts, null, "cost-exhausted");

    const attemptStarted = validInstant(props.runtime.now(), "attempt start");
    if (
      attemptStarted.getTime() - started.getTime() >=
      props.policy.maximumElapsedMs
    )
      return result(props.requestId, attempts, null, "elapsed-exhausted");
    const attemptId = nonBlank(props.runtime.attemptId(), "attempt id");
    const controller = new AbortController();
    const relay = (): void => controller.abort(props.signal?.reason);
    props.signal?.addEventListener("abort", relay, { once: true });
    const remainingElapsed = Math.max(
      1,
      props.policy.maximumElapsedMs -
        (attemptStarted.getTime() - started.getTime()),
    );
    const timeoutMs = Math.min(props.policy.attemptTimeoutMs, remainingElapsed);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const outcome = await Promise.race([
        props.execute(controller.signal),
        new Promise<never>((resolve, reject) => {
          void resolve;
          timeout = setTimeout(() => {
            timedOut = true;
            controller.abort("timeout");
            reject(
              new AutoMovieRepaintAttemptError(
                "timeout",
                `Repaint attempt exceeded ${timeoutMs}ms.`,
              ),
            );
          }, timeoutMs);
        }),
      ]);
      const outcomeCompleted = validInstant(
        props.runtime.now(),
        "attempt completion",
      );
      if (requestCancelled())
        throw new AutoMovieRepaintAttemptError(
          "cancelled",
          "Repaint request was cancelled.",
          validCost(outcome.costUnits),
          outcome.availableOutput,
        );
      if (
        timedOut ||
        outcomeCompleted.getTime() - attemptStarted.getTime() >= timeoutMs ||
        outcomeCompleted.getTime() - started.getTime() >=
          props.policy.maximumElapsedMs
      )
        throw new AutoMovieRepaintAttemptError(
          "timeout",
          `Repaint attempt exceeded ${timeoutMs}ms.`,
          validCost(outcome.costUnits),
          outcome.availableOutput,
        );
      const costUnits = validCost(outcome.costUnits);
      spent += costUnits;
      if (spent > props.policy.maximumCostUnits) {
        const attempt = terminalAttempt({
          productionId: props.productionId,
          shot: props.shot,
          requestId: props.requestId,
          requestFingerprint: props.requestFingerprint,
          attemptId,
          ordinal,
          compileFingerprint: props.compileFingerprint,
          sourceRenderFingerprint: props.sourceRenderFingerprint,
          adapterIdentity: props.adapterIdentity,
          seed: props.seed,
          startedAt: attemptStarted,
          completedAt: outcomeCompleted,
          status: "failed",
          failure: {
            class: "budget-exhausted",
            message: "Repaint attempt exceeded the request cost ceiling.",
            retryable: false,
          },
          costUnits,
          availableOutput: outcome.availableOutput,
        });
        attempts.push(attempt);
        props.onAttempt(structuredClone(attempt));
        return result(props.requestId, attempts, null, "cost-exhausted");
      }
      const attempt = terminalAttempt({
        productionId: props.productionId,
        shot: props.shot,
        requestId: props.requestId,
        requestFingerprint: props.requestFingerprint,
        attemptId,
        ordinal,
        compileFingerprint: props.compileFingerprint,
        sourceRenderFingerprint: props.sourceRenderFingerprint,
        adapterIdentity: props.adapterIdentity,
        seed: props.seed,
        startedAt: attemptStarted,
        completedAt: outcomeCompleted,
        status: "succeeded",
        failure: null,
        costUnits,
        availableOutput: outcome.availableOutput,
      });
      attempts.push(attempt);
      props.onAttempt(structuredClone(attempt));
      return result(
        props.requestId,
        attempts,
        { value: outcome.value, attempt },
        "accepted",
      );
    } catch (error) {
      const failureCompleted = validInstant(
        props.runtime.now(),
        "attempt completion",
      );
      const deadlineExceeded =
        timedOut ||
        failureCompleted.getTime() - attemptStarted.getTime() >= timeoutMs ||
        failureCompleted.getTime() - started.getTime() >=
          props.policy.maximumElapsedMs;
      const timeoutDisclosure =
        error instanceof AutoMovieRepaintAttemptError ? error : null;
      const classified = classifyFailure(
        deadlineExceeded && timeoutDisclosure?.failureClass !== "timeout"
          ? new AutoMovieRepaintAttemptError(
              "timeout",
              `Repaint attempt exceeded ${timeoutMs}ms.`,
              timeoutDisclosure === null
                ? 0
                : validCost(timeoutDisclosure.costUnits),
              timeoutDisclosure?.availableOutput ?? null,
            )
          : error,
        props.signal,
      );
      spent += classified.costUnits;
      const retryable =
        classified.status === "failed" &&
        props.policy.retryableFailures.includes(classified.failureClass);
      const attempt = terminalAttempt({
        productionId: props.productionId,
        shot: props.shot,
        requestId: props.requestId,
        requestFingerprint: props.requestFingerprint,
        attemptId,
        ordinal,
        compileFingerprint: props.compileFingerprint,
        sourceRenderFingerprint: props.sourceRenderFingerprint,
        adapterIdentity: props.adapterIdentity,
        seed: props.seed,
        startedAt: attemptStarted,
        completedAt: failureCompleted,
        status: classified.status,
        failure: {
          class: classified.failureClass,
          message: classified.message,
          retryable,
        },
        costUnits: classified.costUnits,
        availableOutput: classified.availableOutput,
      });
      attempts.push(attempt);
      props.onAttempt(structuredClone(attempt));
      if (classified.status === "cancelled")
        return result(props.requestId, attempts, null, "cancelled");
      if (retryable === false)
        return result(props.requestId, attempts, null, "not-retryable");
      if (local === props.policy.maximumAttempts)
        return result(props.requestId, attempts, null, "attempts-exhausted");
      if (spent >= props.policy.maximumCostUnits)
        return result(props.requestId, attempts, null, "cost-exhausted");
      const afterAttempt = failureCompleted.getTime() - started.getTime();
      const backoff = props.policy.backoffMs[local - 1]!;
      if (afterAttempt + backoff >= props.policy.maximumElapsedMs)
        return result(props.requestId, attempts, null, "elapsed-exhausted");
      try {
        await props.runtime.wait(backoff, props.signal ?? NEVER_ABORTED_SIGNAL);
      } catch {
        return result(props.requestId, attempts, null, "cancelled");
      }
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      props.signal?.removeEventListener("abort", relay);
    }
  }
  return result(props.requestId, attempts, null, "attempts-exhausted");
};

const FAILURE_CLASSES = new Set<AutoMovieRepaintFailureClass>([
  "timeout",
  "rate-limit",
  "transport",
  "provider-refusal",
  "invalid-output",
  "cancelled",
  "input-stale",
  "budget-exhausted",
  "internal",
]);

const NEVER_ABORTED_SIGNAL = new AbortController().signal;

const result = <T>(
  requestId: string,
  attempts: IAutoMovieRepaintAttemptRecord[],
  accepted: IAutoMovieRepaintExecutionResult<T>["accepted"],
  stop: IAutoMovieRepaintExecutionResult<T>["stop"],
): IAutoMovieRepaintExecutionResult<T> => ({
  requestId,
  attempts: structuredClone(attempts),
  accepted,
  stop,
});

const terminalAttempt = (
  input: Omit<
    IAutoMovieRepaintAttemptRecord,
    "version" | "startedAt" | "completedAt"
  > & {
    startedAt: Date;
    completedAt: Date;
  },
): IAutoMovieRepaintAttemptRecord => {
  const startedAt = validInstant(input.startedAt, "attempt start");
  const completedAt = validInstant(input.completedAt, "attempt completion");
  if (completedAt.getTime() < startedAt.getTime())
    throw new Error("Repaint attempt completion precedes its start.");
  return {
    version: 1,
    ...input,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
};

const classifyFailure = (
  error: unknown,
  outerSignal: AbortSignal | undefined,
): {
  failureClass: AutoMovieRepaintFailureClass;
  status: IAutoMovieRepaintAttemptRecord["status"];
  message: string;
  costUnits: number;
  availableOutput: IAutoMovieRepaintAttemptOutput | null;
} => {
  if (outerSignal?.aborted === true) {
    const disclosed =
      error instanceof AutoMovieRepaintAttemptError ? error : null;
    return {
      failureClass: "cancelled",
      status: "cancelled",
      message: "Repaint request was cancelled.",
      costUnits: disclosed === null ? 0 : validCost(disclosed.costUnits),
      availableOutput: disclosed?.availableOutput ?? null,
    };
  }
  if (error instanceof AutoMovieRepaintAttemptError)
    return {
      failureClass: error.failureClass,
      status:
        error.failureClass === "cancelled"
          ? "cancelled"
          : error.failureClass === "invalid-output"
            ? "invalid"
            : error.failureClass === "input-stale"
              ? "stale"
              : "failed",
      message: error.message,
      costUnits: validCost(error.costUnits),
      availableOutput: error.availableOutput,
    };
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
    costUnits?: unknown;
  };
  const rateLimited = candidate.status === 429 || candidate.code === 429;
  const transported =
    candidate.name === "FetchError" ||
    candidate.code === "ECONNRESET" ||
    candidate.code === "ETIMEDOUT";
  return {
    failureClass: rateLimited
      ? "rate-limit"
      : transported
        ? "transport"
        : "provider-refusal",
    status: "failed",
    message:
      error instanceof Error
        ? error.message
        : typeof candidate.message === "string"
          ? candidate.message
          : String(error),
    costUnits:
      typeof candidate.costUnits === "number"
        ? validCost(candidate.costUnits)
        : 0,
    availableOutput: null,
  };
};

const validCost = (value: number): number => {
  if (Number.isFinite(value) === false || value < 0)
    throw new Error(
      "Repaint attempt costUnits must be finite and non-negative.",
    );
  return value;
};

const validInstant = (value: Date, label: string): Date => {
  const cloned = new Date(value.getTime());
  if (Number.isNaN(cloned.getTime()))
    throw new Error(`Repaint ${label} must be a valid instant.`);
  return cloned;
};

const nonBlank = (value: string, label: string): string => {
  if (value.trim().length === 0 || value !== value.trim())
    throw new Error(`Repaint ${label} must be trimmed and non-empty.`);
  return value;
};
