import {
  AutoMovieContentDigest,
  AutoMovieRepaintFailureClass,
  AutoMovieRepaintRetryableFailureClass,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintRuntimeIdentity,
} from "@automovie/interface";

import { canonicalAutoMovieRepaintRuntimeIdentity } from "./renditionIdentity";

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
    | "backoff-failed"
    | "not-retryable"
    | "outcome-unknown"
    | "observer-failed";
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
    policy.attemptTimeoutMs > MAX_TIMER_MILLISECONDS ||
    Number.isSafeInteger(policy.maximumElapsedMs) === false ||
    policy.maximumElapsedMs <= 0 ||
    policy.attemptTimeoutMs > policy.maximumElapsedMs ||
    Number.isFinite(policy.maximumCostUnits) === false ||
    policy.maximumCostUnits < 0 ||
    policy.backoffMs.length !== policy.maximumAttempts - 1 ||
    policy.backoffMs.some(
      (value) =>
        Number.isSafeInteger(value) === false ||
        value < 0 ||
        value > MAX_TIMER_MILLISECONDS,
    ) ||
    new Set(policy.retryableFailures).size !==
      policy.retryableFailures.length ||
    policy.retryableFailures.some(
      (value) => RETRYABLE_FAILURE_CLASSES.has(value) === false,
    )
  )
    throw new Error(
      "Repaint execution policy requires positive attempt/elapsed time bounds, host-safe timer delays, a non-negative cost ceiling, exactly one deterministic backoff per possible retry, and unique supported retryable failure classes.",
    );
};

/**
 * Execute one repaint request within its complete retry, time, cost, and
 * cancellation envelope. Every attempted provider call yields one terminal
 * record; only a successful validation value can become a candidate. Injected
 * clock observations must remain monotonic so a rollback cannot reopen elapsed
 * budget or move an attempt before an already observed terminal fact. A retry
 * never starts until the runtime clock proves that its complete declared
 * backoff elapsed; wait-boundary failures stop without another provider call.
 * An attempt-observer refusal also stops without changing or duplicating the
 * terminal record already produced by the provider call.
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
  onAttempt: (attempt: IAutoMovieRepaintAttemptRecord) => unknown;
}): Promise<IAutoMovieRepaintExecutionResult<T>> => {
  assertAutoMovieRepaintExecutionPolicy(props.policy);
  assertRepaintExecutionIdentity(props);
  const started = validInstant(props.runtime.now(), "request start");
  let lastObservedAt = started.getTime();
  const observeNow = (label: string): Date => {
    let current: Date;
    try {
      current = validInstant(props.runtime.now(), label);
    } catch (error) {
      throw new AutoMovieRepaintClockError(
        safeUnknownMessage(
          error,
          `Repaint ${label} clock observation failed without an inspectable message.`,
        ),
      );
    }
    if (current.getTime() < lastObservedAt)
      throw new AutoMovieRepaintClockError(
        `Repaint ${label} precedes the previous runtime clock observation.`,
      );
    lastObservedAt = current.getTime();
    return current;
  };
  const attempts: IAutoMovieRepaintAttemptRecord[] = [];
  const notifyAttempt = async (
    attempt: IAutoMovieRepaintAttemptRecord,
  ): Promise<boolean> => {
    try {
      await props.onAttempt(structuredClone(attempt));
      return true;
    } catch {
      return false;
    }
  };
  let spent = 0;
  let nextAttemptNotBefore = started.getTime();
  const ordinalOffset = props.ordinalOffset ?? 0;
  const requestCancelled = (): boolean => props.signal?.aborted === true;
  for (let local = 1; local <= props.policy.maximumAttempts; local++) {
    const ordinal = ordinalOffset + local;
    if (requestCancelled())
      return result(props.requestId, attempts, null, "cancelled");
    let elapsedAt: Date;
    try {
      elapsedAt = observeNow("request elapsed");
    } catch (error) {
      if (attempts.length === 0) throw error;
      return result(props.requestId, attempts, null, "backoff-failed");
    }
    if (elapsedAt.getTime() < nextAttemptNotBefore)
      return result(props.requestId, attempts, null, "backoff-failed");
    const elapsed = elapsedAt.getTime() - started.getTime();
    if (elapsed >= props.policy.maximumElapsedMs)
      return result(props.requestId, attempts, null, "elapsed-exhausted");
    if (spent >= props.policy.maximumCostUnits)
      return result(props.requestId, attempts, null, "cost-exhausted");

    let attemptStarted: Date;
    try {
      attemptStarted = observeNow("attempt start");
    } catch (error) {
      if (attempts.length === 0) throw error;
      return result(props.requestId, attempts, null, "backoff-failed");
    }
    if (
      attemptStarted.getTime() - started.getTime() >=
      props.policy.maximumElapsedMs
    )
      return result(props.requestId, attempts, null, "elapsed-exhausted");
    const controller = new AbortController();
    const relay = (): void => controller.abort(props.signal?.reason);
    props.signal?.addEventListener("abort", relay, { once: true });
    if (requestCancelled()) {
      props.signal?.removeEventListener("abort", relay);
      return result(props.requestId, attempts, null, "cancelled");
    }
    let attemptId: string;
    try {
      attemptId = nonBlank(props.runtime.attemptId(), "attempt id");
    } catch (error) {
      props.signal?.removeEventListener("abort", relay);
      throw error;
    }
    const remainingElapsed = Math.max(
      1,
      props.policy.maximumElapsedMs -
        (attemptStarted.getTime() - started.getTime()),
    );
    const timeoutMs = Math.min(props.policy.attemptTimeoutMs, remainingElapsed);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let adapterSettled = false;
    let disclosedCostUnits = 0;
    let disclosedOutput: IAutoMovieRepaintAttemptOutput | null = null;
    try {
      const adapter = props.execute(controller.signal);
      void adapter
        .then(() => {
          adapterSettled = true;
        })
        .catch(() => {
          adapterSettled = true;
        });
      const outcome = await Promise.race([
        adapter,
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
      try {
        disclosedCostUnits = validCost(outcome.costUnits);
      } catch (error) {
        throw new AutoMovieRepaintAttemptError(
          "invalid-output",
          safeUnknownMessage(
            error,
            "Repaint adapter returned an unreadable cost disclosure.",
          ),
        );
      }
      try {
        disclosedOutput = validAttemptOutput(outcome.availableOutput);
      } catch (error) {
        throw new AutoMovieRepaintAttemptError(
          "invalid-output",
          safeUnknownMessage(
            error,
            "Repaint adapter returned an unreadable output disclosure.",
          ),
          disclosedCostUnits,
        );
      }
      let value: T;
      try {
        value = outcome.value;
      } catch {
        throw new AutoMovieRepaintAttemptError(
          "invalid-output",
          "Repaint adapter output value could not be inspected safely.",
          disclosedCostUnits,
          disclosedOutput,
        );
      }
      const outcomeCompleted = observeNow("attempt completion");
      if (requestCancelled())
        throw new AutoMovieRepaintAttemptError(
          "cancelled",
          "Repaint request was cancelled.",
          disclosedCostUnits,
          disclosedOutput,
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
          disclosedCostUnits,
          disclosedOutput,
        );
      if (disclosedOutput === null)
        throw new AutoMovieRepaintAttemptError(
          "invalid-output",
          "Repaint adapter accepted an output without a positive byte count and canonical digest.",
          disclosedCostUnits,
        );
      spent += disclosedCostUnits;
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
          costUnits: disclosedCostUnits,
          availableOutput: disclosedOutput,
        });
        attempts.push(attempt);
        if ((await notifyAttempt(attempt)) === false)
          return result(props.requestId, attempts, null, "observer-failed");
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
        costUnits: disclosedCostUnits,
        availableOutput: disclosedOutput,
      });
      attempts.push(attempt);
      if ((await notifyAttempt(attempt)) === false)
        return result(props.requestId, attempts, null, "observer-failed");
      return result(props.requestId, attempts, { value, attempt }, "accepted");
    } catch (error) {
      let terminalError = error;
      let terminalClockError = repaintClockErrorOrNull(error);
      let clockFailed = terminalClockError !== null;
      let failureCompleted: Date;
      if (clockFailed) failureCompleted = new Date(lastObservedAt);
      else
        try {
          failureCompleted = observeNow("attempt completion");
        } catch (clockError) {
          terminalError = clockError;
          terminalClockError = repaintClockErrorOrNull(clockError);
          clockFailed = true;
          failureCompleted = new Date(lastObservedAt);
        }
      const deadlineExceeded =
        clockFailed === false &&
        (timedOut ||
          failureCompleted.getTime() - attemptStarted.getTime() >= timeoutMs ||
          failureCompleted.getTime() - started.getTime() >=
            props.policy.maximumElapsedMs);
      const timeoutDisclosure = repaintAttemptErrorOrNull(terminalError);
      const safeTimeoutDisclosure =
        timeoutDisclosure === null
          ? null
          : repaintAttemptErrorDisclosure(timeoutDisclosure);
      const externalOutcomeUnknown = timedOut && adapterSettled === false;
      const classified = externalOutcomeUnknown
        ? ({
            failureClass: "internal",
            status: "failed",
            message:
              "Repaint adapter did not acknowledge cancellation; external outcome requires reconciliation before retry.",
            costUnits: disclosedCostUnits,
            availableOutput: disclosedOutput,
          } satisfies IClassifiedRepaintFailure)
        : clockFailed
          ? requestCancelled()
            ? ({
                failureClass: "cancelled",
                status: "cancelled",
                message: "Repaint request was cancelled.",
                costUnits: disclosedCostUnits,
                availableOutput: disclosedOutput,
              } satisfies IClassifiedRepaintFailure)
            : ({
                failureClass: "internal",
                status: "failed",
                message: terminalClockError!.message,
                costUnits: disclosedCostUnits,
                availableOutput: disclosedOutput,
              } satisfies IClassifiedRepaintFailure)
          : classifyFailure(
              deadlineExceeded &&
                safeTimeoutDisclosure?.failureClass !== "timeout"
                ? new AutoMovieRepaintAttemptError(
                    "timeout",
                    `Repaint attempt exceeded ${timeoutMs}ms.`,
                    safeTimeoutDisclosure?.costUnits ?? 0,
                    safeTimeoutDisclosure?.availableOutput ?? null,
                  )
                : terminalError,
              props.signal,
            );
      spent += classified.costUnits;
      const retryable =
        externalOutcomeUnknown === false &&
        clockFailed === false &&
        classified.status === "failed" &&
        props.policy.retryableFailures.some(
          (failureClass) => failureClass === classified.failureClass,
        );
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
      if ((await notifyAttempt(attempt)) === false)
        return result(props.requestId, attempts, null, "observer-failed");
      if (externalOutcomeUnknown)
        return result(props.requestId, attempts, null, "outcome-unknown");
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
      nextAttemptNotBefore = failureCompleted.getTime() + backoff;
      try {
        await props.runtime.wait(backoff, props.signal ?? NEVER_ABORTED_SIGNAL);
      } catch {
        return result(
          props.requestId,
          attempts,
          null,
          requestCancelled() ? "cancelled" : "backoff-failed",
        );
      }
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      props.signal?.removeEventListener("abort", relay);
    }
  }
  return result(props.requestId, attempts, null, "attempts-exhausted");
};

const RETRYABLE_FAILURE_CLASSES: ReadonlySet<AutoMovieRepaintFailureClass> =
  new Set<AutoMovieRepaintRetryableFailureClass>([
    "timeout",
    "rate-limit",
    "transport",
    "provider-refusal",
    "internal",
  ]);

const FAILURE_CLASSES: ReadonlySet<AutoMovieRepaintFailureClass> = new Set([
  ...RETRYABLE_FAILURE_CLASSES,
  "invalid-output",
  "cancelled",
  "input-stale",
  "budget-exhausted",
]);

const MAX_TIMER_MILLISECONDS = 2_147_483_647;

const NEVER_ABORTED_SIGNAL = new AbortController().signal;

class AutoMovieRepaintClockError extends Error {}

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
  return {
    version: 1,
    ...input,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
};

interface IClassifiedRepaintFailure {
  failureClass: AutoMovieRepaintFailureClass;
  status: IAutoMovieRepaintAttemptRecord["status"];
  message: string;
  costUnits: number;
  availableOutput: IAutoMovieRepaintAttemptOutput | null;
}

const classifyFailure = (
  error: unknown,
  outerSignal: AbortSignal | undefined,
): IClassifiedRepaintFailure => {
  try {
    return classifyFailureDisclosure(error, outerSignal);
  } catch {
    return {
      failureClass: "internal",
      status: "failed",
      message:
        "Repaint provider rejection could not be inspected safely; the attempt was stopped without trusting hostile disclosure fields.",
      costUnits: 0,
      availableOutput: null,
    };
  }
};

const classifyFailureDisclosure = (
  error: unknown,
  outerSignal: AbortSignal | undefined,
): IClassifiedRepaintFailure => {
  const attemptError = repaintAttemptErrorOrNull(error);
  const disclosure =
    attemptError === null ? null : repaintAttemptErrorDisclosure(attemptError);
  if (outerSignal?.aborted === true) {
    return {
      failureClass: "cancelled",
      status: "cancelled",
      message: "Repaint request was cancelled.",
      costUnits: disclosure?.costUnits ?? 0,
      availableOutput: disclosure?.availableOutput ?? null,
    };
  }
  if (attemptError !== null) {
    if (disclosure?.valid === false)
      return {
        failureClass: "invalid-output",
        status: "invalid",
        message:
          "Repaint adapter returned a malformed failure class, cost, message, or available-output disclosure.",
        costUnits: disclosure.costUnits,
        availableOutput: disclosure.availableOutput,
      };
    const failureClass = disclosure!.failureClass!;
    return {
      failureClass,
      status:
        failureClass === "cancelled"
          ? "cancelled"
          : failureClass === "invalid-output"
            ? "invalid"
            : failureClass === "input-stale"
              ? "stale"
              : "failed",
      message: repaintFailureMessage(disclosure!.message),
      costUnits: disclosure!.costUnits,
      availableOutput: disclosure!.availableOutput,
    };
  }
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
    message: repaintFailureMessage(
      error instanceof Error
        ? error.message
        : typeof candidate.message === "string"
          ? candidate.message
          : String(error),
    ),
    costUnits:
      typeof candidate.costUnits === "number" &&
      Number.isFinite(candidate.costUnits) &&
      candidate.costUnits >= 0
        ? candidate.costUnits
        : 0,
    availableOutput: null,
  };
};

const repaintAttemptErrorOrNull = (
  value: unknown,
): AutoMovieRepaintAttemptError | null => {
  try {
    return value instanceof AutoMovieRepaintAttemptError ? value : null;
  } catch {
    return null;
  }
};

const repaintClockErrorOrNull = (
  value: unknown,
): AutoMovieRepaintClockError | null => {
  try {
    return value instanceof AutoMovieRepaintClockError ? value : null;
  } catch {
    return null;
  }
};

const repaintAttemptErrorDisclosure = (
  error: AutoMovieRepaintAttemptError,
): {
  valid: boolean;
  failureClass: AutoMovieRepaintFailureClass | null;
  message: string;
  costUnits: number;
  availableOutput: IAutoMovieRepaintAttemptOutput | null;
} => {
  try {
    const message = error.message;
    const failureClass = error.failureClass;
    return {
      valid: FAILURE_CLASSES.has(failureClass) && typeof message === "string",
      failureClass: FAILURE_CLASSES.has(failureClass) ? failureClass : null,
      message: typeof message === "string" ? message : "",
      costUnits: validCost(error.costUnits),
      availableOutput: validAttemptOutput(error.availableOutput),
    };
  } catch {
    return {
      valid: false,
      failureClass: null,
      message: "",
      costUnits: 0,
      availableOutput: null,
    };
  }
};

const repaintFailureMessage = (value: string): string => {
  const message = value.trim();
  return message.length === 0
    ? "Repaint provider failed without a message."
    : message;
};

const safeUnknownMessage = (value: unknown, fallback: string): string => {
  try {
    const message = value instanceof Error ? value.message : String(value);
    return typeof message === "string" ? message : fallback;
  } catch {
    return fallback;
  }
};

const validCost = (value: number): number => {
  if (Number.isFinite(value) === false || value < 0)
    throw new Error(
      "Repaint attempt costUnits must be finite and non-negative.",
    );
  return value;
};

const validAttemptOutput = (
  value: IAutoMovieRepaintAttemptOutput | null,
): IAutoMovieRepaintAttemptOutput | null => {
  if (value === null) return null;
  if (
    /^sha256:[0-9a-f]{64}$/u.test(value.digest) === false ||
    Number.isSafeInteger(value.bytes) === false ||
    value.bytes <= 0
  )
    throw new Error(
      "Repaint available output requires a canonical sha256 digest and positive safe-integer byte count.",
    );
  return value;
};

const assertRepaintExecutionIdentity = (props: {
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
}): void => {
  nonBlank(props.productionId, "production id");
  nonBlank(props.shot, "shot");
  uuid(props.requestId, "request id");
  contentDigest(props.requestFingerprint, "request fingerprint");
  contentDigest(props.compileFingerprint, "compile fingerprint");
  contentDigest(props.sourceRenderFingerprint, "source render fingerprint");
  let runtimeIdentity: IAutoMovieRepaintRuntimeIdentity;
  try {
    runtimeIdentity = JSON.parse(
      props.adapterIdentity,
    ) as IAutoMovieRepaintRuntimeIdentity;
  } catch {
    throw new Error("Repaint adapter identity must be canonical runtime JSON.");
  }
  if (
    canonicalAutoMovieRepaintRuntimeIdentity(runtimeIdentity) !==
    props.adapterIdentity
  )
    throw new Error("Repaint adapter identity must be canonical runtime JSON.");
  if (Number.isSafeInteger(props.seed) === false)
    throw new Error("Repaint seed must be a safe integer.");
  if (
    props.ordinalOffset !== undefined &&
    (Number.isSafeInteger(props.ordinalOffset) === false ||
      props.ordinalOffset < 0 ||
      props.ordinalOffset >
        Number.MAX_SAFE_INTEGER - props.policy.maximumAttempts)
  )
    throw new Error(
      "Repaint ordinal offset must be a non-negative safe integer.",
    );
};

const validInstant = (value: Date, label: string): Date => {
  const cloned = new Date(value.getTime());
  if (Number.isNaN(cloned.getTime()))
    throw new Error(`Repaint ${label} must be a valid instant.`);
  return cloned;
};

const nonBlank = (value: unknown, label: string): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  )
    throw new Error(`Repaint ${label} must be trimmed and non-empty.`);
  return value;
};

const uuid = (value: string, label: string): string => {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    ) === false
  )
    throw new Error(`Repaint ${label} must be a UUID v4.`);
  return value;
};

const contentDigest = (value: string, label: string): string => {
  if (/^sha256:[0-9a-f]{64}$/u.test(value) === false)
    throw new Error(`Repaint ${label} must be a canonical sha256 digest.`);
  return value;
};
