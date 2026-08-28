import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintExecutionPolicy,
} from "@automovie/interface";
import {
  AutoMovieRepaintAttemptError,
  assertAutoMovieRepaintExecutionPolicy,
  executeAutoMovieRepaintRequest,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (value: string): AutoMovieContentDigest => `sha256:${value}`;

const policy = (
  override: Partial<IAutoMovieRepaintExecutionPolicy> = {},
): IAutoMovieRepaintExecutionPolicy => ({
  maximumAttempts: 3,
  attemptTimeoutMs: 1_000,
  maximumElapsedMs: 10_000,
  maximumCostUnits: 5,
  backoffMs: [10, 20],
  retryableFailures: ["rate-limit", "timeout", "transport"],
  ...override,
});

const messageOf = (operation: () => unknown): string | null => {
  try {
    operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const execute = <T>(props: {
  policy: IAutoMovieRepaintExecutionPolicy;
  calls: (signal: AbortSignal) => Promise<{
    value: T;
    costUnits: number;
    availableOutput: { digest: AutoMovieContentDigest; bytes: number } | null;
  }>;
  now?: () => Date;
  requestId?: string;
  attemptId?: () => string;
  signal?: AbortSignal;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}) => {
  let attempt = 0;
  const records: unknown[] = [];
  return executeAutoMovieRepaintRequest({
    productionId: "repaint-execution",
    shot: "opening",
    requestId: props.requestId ?? "10000000-0000-4000-8000-000000000001",
    requestFingerprint: digest("request"),
    compileFingerprint: digest("compile"),
    sourceRenderFingerprint: digest("source"),
    adapterIdentity: '{"provider":"fixed"}',
    seed: 41,
    policy: props.policy,
    signal: props.signal,
    runtime: {
      now: props.now ?? (() => new Date("2026-08-28T10:00:00.000Z")),
      attemptId:
        props.attemptId ??
        (() =>
          `20000000-0000-4000-8000-${String(++attempt).padStart(12, "0")}`),
      wait: props.wait ?? (() => Promise.resolve()),
    },
    execute: props.calls,
    onAttempt: (record) => records.push(record),
  }).then((result) => ({ result, records }));
};

/**
 * Repaint execution is bounded, retry-classified, and candidate-only.
 *
 * Scenarios:
 *
 * 1. Policy validation rejects every malformed budget and retry vocabulary.
 * 2. A rate limit retries with the same request id, distinct attempt ids, and
 *    deterministic backoff, then stops on the first accepted candidate.
 * 3. Provider refusal, invalid partial output, timeout, cancellation, elapsed
 *    exhaustion, and cost exhaustion all close without a candidate.
 */
export const test_production_repaint_execution = async (): Promise<void> => {
  const invalid = [
    policy({ maximumAttempts: 0, backoffMs: [] }),
    policy({ attemptTimeoutMs: 0 }),
    policy({
      attemptTimeoutMs: 2_147_483_648,
      maximumElapsedMs: 2_147_483_648,
    }),
    policy({ maximumElapsedMs: 0 }),
    policy({ attemptTimeoutMs: 10_001 }),
    policy({ maximumCostUnits: -1 }),
    policy({ backoffMs: [0] }),
    policy({ backoffMs: [0, -1] }),
    policy({ backoffMs: [0, 2_147_483_648] }),
    policy({ retryableFailures: ["timeout", "timeout"] }),
    policy({ retryableFailures: ["unsupported" as "timeout"] }),
    ...["invalid-output", "cancelled", "input-stale", "budget-exhausted"].map(
      (failureClass) =>
        policy({ retryableFailures: [failureClass as "timeout"] }),
    ),
  ];
  TestValidator.predicate(
    "malformed repaint execution policies are refused",
    invalid.every(
      (candidate) =>
        messageOf(() => assertAutoMovieRepaintExecutionPolicy(candidate)) !==
        null,
    ),
  );

  const waits: number[] = [];
  let calls = 0;
  const retried = await execute({
    policy: policy(),
    wait: (milliseconds) => {
      waits.push(milliseconds);
      return Promise.resolve();
    },
    calls: async () => {
      calls += 1;
      if (calls === 1) throw { status: 429, message: "slow down" };
      return {
        value: "candidate",
        costUnits: 1,
        availableOutput: { digest: digest("candidate"), bytes: 4 },
      };
    },
  });
  TestValidator.equals(
    "retry keeps request identity and stops on accepted candidate",
    {
      stop: retried.result.stop,
      accepted: retried.result.accepted?.value,
      calls,
      waits,
      requestIds: retried.result.attempts.map((attempt) => attempt.requestId),
      attemptIds: retried.result.attempts.map((attempt) => attempt.attemptId),
      states: retried.result.attempts.map((attempt) => attempt.status),
      recorded: retried.records,
    },
    {
      stop: "accepted",
      accepted: "candidate",
      calls: 2,
      waits: [10],
      requestIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000001",
      ],
      attemptIds: [
        "20000000-0000-4000-8000-000000000001",
        "20000000-0000-4000-8000-000000000002",
      ],
      states: ["failed", "succeeded"],
      recorded: retried.result.attempts,
    },
  );

  const refused = await execute({
    policy: policy(),
    calls: async () => {
      throw new Error("provider says no");
    },
  });
  const invalidOutput = await execute({
    policy: policy(),
    calls: async () => {
      throw new AutoMovieRepaintAttemptError(
        "invalid-output",
        "partial mp4",
        1,
        { digest: digest("partial"), bytes: 2 },
      );
    },
  });
  const cost = await execute({
    policy: policy({
      maximumAttempts: 1,
      maximumCostUnits: 1,
      backoffMs: [],
    }),
    calls: async () => ({
      value: "too expensive",
      costUnits: 2,
      availableOutput: { digest: digest("expensive"), bytes: 3 },
    }),
  });
  const cancelledController = new AbortController();
  cancelledController.abort("user");
  const cancelled = await execute({
    policy: policy(),
    signal: cancelledController.signal,
    calls: async () => ({
      value: "unreachable",
      costUnits: 0,
      availableOutput: null,
    }),
  });
  const timedOut = await execute({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 1,
      backoffMs: [],
    }),
    calls: (signal) =>
      new Promise((resolve, reject) => {
        void resolve;
        signal.addEventListener(
          "abort",
          () => reject(new Error("adapter observed abort")),
          { once: true },
        );
      }),
  });
  const elapsed = await execute({
    policy: policy(),
    now: (() => {
      let instant = 0;
      return () =>
        new Date(Date.parse("2026-08-28T10:00:00.000Z") + instant++ * 20_000);
    })(),
    calls: async () => ({
      value: "unreachable",
      costUnits: 0,
      availableOutput: null,
    }),
  });
  TestValidator.equals(
    "every bounded refusal closes without a candidate",
    {
      provider: [
        refused.result.stop,
        refused.result.attempts[0]?.failure?.class,
      ],
      invalid: [
        invalidOutput.result.stop,
        invalidOutput.result.attempts[0]?.status,
        invalidOutput.result.attempts[0]?.availableOutput,
      ],
      cost: [
        cost.result.stop,
        cost.result.attempts[0]?.failure?.class,
        cost.result.attempts[0]?.availableOutput,
      ],
      cancelled: [cancelled.result.stop, cancelled.result.attempts.length],
      timeout: [
        timedOut.result.stop,
        timedOut.result.attempts[0]?.failure?.class,
      ],
      elapsed: [elapsed.result.stop, elapsed.result.attempts.length],
    },
    {
      provider: ["not-retryable", "provider-refusal"],
      invalid: [
        "not-retryable",
        "invalid",
        { digest: digest("partial"), bytes: 2 },
      ],
      cost: [
        "cost-exhausted",
        "budget-exhausted",
        { digest: digest("expensive"), bytes: 3 },
      ],
      cancelled: ["cancelled", 0],
      timeout: ["attempts-exhausted", "timeout"],
      elapsed: ["elapsed-exhausted", 0],
    },
  );

  const zeroBudget = await execute({
    policy: policy({ maximumCostUnits: 0 }),
    calls: async () => ({
      value: "unreachable",
      costUnits: 0,
      availableOutput: null,
    }),
  });
  const retryCost = await execute({
    policy: policy({
      maximumAttempts: 2,
      maximumCostUnits: 1,
      backoffMs: [1],
      retryableFailures: ["timeout"],
    }),
    calls: async () => {
      throw new AutoMovieRepaintAttemptError("timeout", "retry", 1);
    },
  });
  const backoffElapsed = await execute({
    policy: policy({
      maximumAttempts: 2,
      maximumElapsedMs: 100,
      attemptTimeoutMs: 100,
      backoffMs: [100],
      retryableFailures: ["rate-limit"],
    }),
    calls: async () => {
      throw { status: 429 };
    },
  });
  const waitCancelled = await execute({
    policy: policy({ maximumAttempts: 2, backoffMs: [1] }),
    wait: () => Promise.reject(new Error("cancel during backoff")),
    calls: async () => {
      throw { status: 429 };
    },
  });
  const classifiedCancelled = await execute({
    policy: policy(),
    calls: async () => {
      throw new AutoMovieRepaintAttemptError("cancelled", "cancelled");
    },
  });
  const classifiedStale = await execute({
    policy: policy(),
    calls: async () => {
      throw new AutoMovieRepaintAttemptError("input-stale", "stale");
    },
  });
  const liveController = new AbortController();
  const cancelledDuringAttempt = await execute({
    policy: policy(),
    signal: liveController.signal,
    calls: (signal) =>
      new Promise((resolve, reject) => {
        void resolve;
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
        queueMicrotask(() => liveController.abort("user"));
      }),
  });
  const invalidCostResults = await Promise.all(
    [Number.NaN, -1].map((costUnits) =>
      execute({
        policy: policy({ maximumAttempts: 1, backoffMs: [] }),
        calls: async () => ({
          value: "bad cost",
          costUnits,
          availableOutput: null,
        }),
      }),
    ),
  );
  const transported = await Promise.all(
    [
      { name: "FetchError", message: "fetch" },
      { code: "ECONNRESET", message: "reset", costUnits: 1 },
      { code: "ETIMEDOUT" },
    ].map((failure) =>
      execute({
        policy: policy({ maximumAttempts: 1, backoffMs: [] }),
        calls: async () => {
          throw failure;
        },
      }),
    ),
  );
  const resolvedOnTimeout = await execute<string>({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 1,
      backoffMs: [],
    }),
    calls: (signal) =>
      new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () =>
            resolve({
              value: "must not be accepted",
              costUnits: 2,
              availableOutput: {
                digest: digest("resolved-during-timeout"),
                bytes: 5,
              },
            }),
          { once: true },
        );
      }),
  });
  const outerAbort = new AbortController();
  const resolvedOnOuterAbort = await execute<string>({
    policy: policy({ maximumAttempts: 1, backoffMs: [] }),
    signal: outerAbort.signal,
    calls: (signal) =>
      new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () =>
            resolve({
              value: "must not be accepted",
              costUnits: 3,
              availableOutput: {
                digest: digest("resolved-during-cancellation"),
                bytes: 7,
              },
            }),
          { once: true },
        );
        queueMicrotask(() => outerAbort.abort("cancelled"));
      }),
  });
  const rejectedOnTimeout = await execute<string>({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 1,
      backoffMs: [],
    }),
    calls: (signal) =>
      new Promise((resolve, reject) => {
        void resolve;
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new AutoMovieRepaintAttemptError(
                "provider-refusal",
                "adapter disclosed a partial output while aborting",
                4,
                {
                  digest: digest("rejected-during-timeout"),
                  bytes: 9,
                },
              ),
            ),
          { once: true },
        );
      }),
  });
  let completionClockReads = 0;
  const elapsedAtCompletion = await execute<string>({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 100,
      backoffMs: [],
    }),
    now: () =>
      new Date(
        completionClockReads++ < 3
          ? "2026-08-28T10:00:00.000Z"
          : "2026-08-28T10:00:00.100Z",
      ),
    calls: async () => ({
      value: "must not be accepted",
      costUnits: 5,
      availableOutput: {
        digest: digest("completed-at-timeout"),
        bytes: 11,
      },
    }),
  });
  let preProviderClockReads = 0;
  let preProviderAttemptIds = 0;
  let preProviderCalls = 0;
  const elapsedBeforeProvider = await execute<string>({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 100,
      maximumElapsedMs: 100,
      backoffMs: [],
    }),
    now: () =>
      new Date(
        [
          "2026-08-28T10:00:00.000Z",
          "2026-08-28T10:00:00.050Z",
          "2026-08-28T10:00:00.100Z",
        ][Math.min(preProviderClockReads++, 2)]!,
      ),
    attemptId: () => {
      ++preProviderAttemptIds;
      return "40000000-0000-4000-8000-000000000001";
    },
    calls: async () => {
      ++preProviderCalls;
      return {
        value: "must not execute",
        costUnits: 0,
        availableOutput: null,
      };
    },
  });
  let rejectedClockReads = 0;
  const elapsedAtRejection = await execute<string>({
    policy: policy({
      maximumAttempts: 1,
      attemptTimeoutMs: 100,
      backoffMs: [],
    }),
    now: () =>
      new Date(
        rejectedClockReads++ < 3
          ? "2026-08-28T10:00:00.000Z"
          : "2026-08-28T10:00:00.100Z",
      ),
    calls: async () => {
      throw new AutoMovieRepaintAttemptError(
        "provider-refusal",
        "adapter disclosed a partial output at the deadline",
        6,
        { digest: digest("rejected-at-deadline"), bytes: 13 },
      );
    },
  });
  TestValidator.equals(
    "every terminal retry boundary preserves its exact stop class",
    {
      zeroBudget: zeroBudget.result.stop,
      retryCost: retryCost.result.stop,
      backoffElapsed: backoffElapsed.result.stop,
      waitCancelled: waitCancelled.result.stop,
      classifiedCancelled: classifiedCancelled.result.stop,
      classifiedStale: classifiedStale.result.attempts[0]?.status,
      cancelledDuringAttempt: cancelledDuringAttempt.result.stop,
      invalidCosts: invalidCostResults.map(({ result }) => result.stop),
      transported: transported.map(
        ({ result }) => result.attempts[0]?.failure?.class,
      ),
      resolvedOnTimeout: {
        stop: resolvedOnTimeout.result.stop,
        accepted: resolvedOnTimeout.result.accepted,
        failure: resolvedOnTimeout.result.attempts[0]?.failure?.class,
        costUnits: resolvedOnTimeout.result.attempts[0]?.costUnits,
        availableOutput:
          resolvedOnTimeout.result.attempts[0]?.availableOutput?.digest,
      },
      resolvedOnOuterAbort: {
        stop: resolvedOnOuterAbort.result.stop,
        accepted: resolvedOnOuterAbort.result.accepted,
        failure: resolvedOnOuterAbort.result.attempts[0]?.failure?.class,
        costUnits: resolvedOnOuterAbort.result.attempts[0]?.costUnits,
        availableOutput:
          resolvedOnOuterAbort.result.attempts[0]?.availableOutput?.digest,
      },
      rejectedOnTimeout: {
        stop: rejectedOnTimeout.result.stop,
        accepted: rejectedOnTimeout.result.accepted,
        failure: rejectedOnTimeout.result.attempts[0]?.failure?.class,
        costUnits: rejectedOnTimeout.result.attempts[0]?.costUnits,
        availableOutput:
          rejectedOnTimeout.result.attempts[0]?.availableOutput?.digest,
      },
      elapsedAtCompletion: {
        stop: elapsedAtCompletion.result.stop,
        accepted: elapsedAtCompletion.result.accepted,
        failure: elapsedAtCompletion.result.attempts[0]?.failure?.class,
        costUnits: elapsedAtCompletion.result.attempts[0]?.costUnits,
        availableOutput:
          elapsedAtCompletion.result.attempts[0]?.availableOutput?.digest,
      },
      elapsedBeforeProvider: {
        stop: elapsedBeforeProvider.result.stop,
        attempts: elapsedBeforeProvider.result.attempts.length,
        attemptIds: preProviderAttemptIds,
        providerCalls: preProviderCalls,
      },
      elapsedAtRejection: {
        stop: elapsedAtRejection.result.stop,
        accepted: elapsedAtRejection.result.accepted,
        failure: elapsedAtRejection.result.attempts[0]?.failure?.class,
        costUnits: elapsedAtRejection.result.attempts[0]?.costUnits,
        availableOutput:
          elapsedAtRejection.result.attempts[0]?.availableOutput?.digest,
      },
    },
    {
      zeroBudget: "cost-exhausted",
      retryCost: "cost-exhausted",
      backoffElapsed: "elapsed-exhausted",
      waitCancelled: "cancelled",
      classifiedCancelled: "cancelled",
      classifiedStale: "stale",
      cancelledDuringAttempt: "cancelled",
      invalidCosts: ["not-retryable", "not-retryable"],
      transported: ["transport", "transport", "transport"],
      resolvedOnTimeout: {
        stop: "attempts-exhausted",
        accepted: null,
        failure: "timeout",
        costUnits: 2,
        availableOutput: digest("resolved-during-timeout"),
      },
      resolvedOnOuterAbort: {
        stop: "cancelled",
        accepted: null,
        failure: "cancelled",
        costUnits: 3,
        availableOutput: digest("resolved-during-cancellation"),
      },
      rejectedOnTimeout: {
        stop: "attempts-exhausted",
        accepted: null,
        failure: "timeout",
        costUnits: 4,
        availableOutput: digest("rejected-during-timeout"),
      },
      elapsedAtCompletion: {
        stop: "attempts-exhausted",
        accepted: null,
        failure: "timeout",
        costUnits: 5,
        availableOutput: digest("completed-at-timeout"),
      },
      elapsedBeforeProvider: {
        stop: "elapsed-exhausted",
        attempts: 0,
        attemptIds: 0,
        providerCalls: 0,
      },
      elapsedAtRejection: {
        stop: "attempts-exhausted",
        accepted: null,
        failure: "timeout",
        costUnits: 6,
        availableOutput: digest("rejected-at-deadline"),
      },
    },
  );

  let reversedBeforeProviderAttemptIds = 0;
  let reversedBeforeProviderCalls = 0;
  let reversedBeforeProviderReads = 0;
  let reversedBeforeProviderMessage: string | null = null;
  try {
    await execute({
      policy: policy({ maximumAttempts: 1, backoffMs: [] }),
      now: () =>
        new Date(
          reversedBeforeProviderReads++ === 0
            ? "2026-08-28T10:00:01.000Z"
            : "2026-08-28T10:00:00.000Z",
        ),
      attemptId: () => {
        ++reversedBeforeProviderAttemptIds;
        return "50000000-0000-4000-8000-000000000001";
      },
      calls: async () => {
        ++reversedBeforeProviderCalls;
        return {
          value: "must not execute",
          costUnits: 0,
          availableOutput: null,
        };
      },
    });
  } catch (error) {
    reversedBeforeProviderMessage =
      error instanceof Error ? error.message : String(error);
  }

  let reversedAfterWaitAttemptIds = 0;
  let reversedAfterWaitCalls = 0;
  let reversedAfterWaitReads = 0;
  let reversedAfterWaitMessage: string | null = null;
  try {
    await execute({
      policy: policy({
        maximumAttempts: 2,
        backoffMs: [1],
        retryableFailures: ["rate-limit"],
      }),
      now: () =>
        new Date(
          [
            "2026-08-28T10:00:00.000Z",
            "2026-08-28T10:00:00.000Z",
            "2026-08-28T10:00:00.000Z",
            "2026-08-28T10:00:01.000Z",
            "2026-08-28T10:00:00.999Z",
          ][Math.min(reversedAfterWaitReads++, 4)]!,
        ),
      attemptId: () =>
        `60000000-0000-4000-8000-${String(
          ++reversedAfterWaitAttemptIds,
        ).padStart(12, "0")}`,
      calls: async () => {
        ++reversedAfterWaitCalls;
        throw { status: 429, message: "retry after a clock rollback" };
      },
    });
  } catch (error) {
    reversedAfterWaitMessage =
      error instanceof Error ? error.message : String(error);
  }
  TestValidator.equals(
    "backward clocks reject before allocating or starting another provider attempt",
    {
      beforeProvider: {
        rejected: reversedBeforeProviderMessage?.includes(
          "precedes the previous runtime clock observation",
        ),
        attemptIds: reversedBeforeProviderAttemptIds,
        providerCalls: reversedBeforeProviderCalls,
      },
      afterWait: {
        rejected: reversedAfterWaitMessage?.includes(
          "precedes the previous runtime clock observation",
        ),
        attemptIds: reversedAfterWaitAttemptIds,
        providerCalls: reversedAfterWaitCalls,
      },
    },
    {
      beforeProvider: {
        rejected: true,
        attemptIds: 0,
        providerCalls: 0,
      },
      afterWait: {
        rejected: true,
        attemptIds: 1,
        providerCalls: 1,
      },
    },
  );

  const rejectionMessage = async (
    operation: () => Promise<unknown>,
  ): Promise<string> => {
    try {
      await operation();
      throw new Error("Malformed execution unexpectedly resolved.");
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const malformedMessages = await Promise.all([
    rejectionMessage(() =>
      execute({
        policy: policy(),
        requestId: " ",
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      }),
    ),
    rejectionMessage(() =>
      execute({
        policy: policy(),
        attemptId: () => " padded ",
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      }),
    ),
    rejectionMessage(() =>
      execute({
        policy: policy(),
        now: () => new Date(Number.NaN),
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      }),
    ),
    rejectionMessage(() => {
      let instant = 0;
      return execute({
        policy: policy(),
        now: () =>
          instant++ < 2
            ? new Date("2026-08-28T10:00:00.000Z")
            : new Date(Number.NaN),
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      });
    }),
    rejectionMessage(() => {
      let instant = 0;
      return execute({
        policy: policy(),
        now: () =>
          new Date(
            instant++ === 2
              ? "2026-08-28T10:00:01.000Z"
              : "2026-08-28T10:00:00.000Z",
          ),
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      });
    }),
  ]);
  TestValidator.predicate(
    "invalid request, attempt, and reversed completion instants reject",
    malformedMessages.some((message) => message.includes("valid instant")) &&
      malformedMessages.some((message) => message.includes("precedes")),
  );
};
