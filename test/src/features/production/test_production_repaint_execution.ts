import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintExecutionPolicy,
} from "@automovie/interface";
import {
  AutoMovieRepaintAttemptError,
  assertAutoMovieRepaintExecutionPolicy,
  canonicalAutoMovieRepaintRuntimeIdentity,
  executeAutoMovieRepaintRequest,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (value: string): AutoMovieContentDigest =>
  `sha256:${Buffer.from(value).toString("hex").padEnd(64, "0").slice(0, 64)}`;

const adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity({
  protocolVersion: "automovie.repaint-runtime.v1",
  provider: "fixed",
  model: "fixed",
  version: "1",
  execution: "local",
});

const nonError = (message: string): Error => message as unknown as Error;

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
  productionId?: string;
  shot?: string;
  requestId?: string;
  ordinalOffset?: number;
  requestFingerprint?: AutoMovieContentDigest;
  compileFingerprint?: AutoMovieContentDigest;
  sourceRenderFingerprint?: AutoMovieContentDigest;
  adapterIdentity?: string;
  seed?: number;
  attemptId?: () => string;
  signal?: AbortSignal;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  admitAttempt?: Parameters<
    typeof executeAutoMovieRepaintRequest
  >[0]["admitAttempt"];
}) => {
  let attempt = 0;
  let virtualElapsed = 0;
  const records: unknown[] = [];
  return executeAutoMovieRepaintRequest({
    productionId: props.productionId ?? "repaint-execution",
    shot: props.shot ?? "opening",
    requestId: props.requestId ?? "10000000-0000-4000-8000-000000000001",
    ...(props.ordinalOffset === undefined
      ? {}
      : { ordinalOffset: props.ordinalOffset }),
    requestFingerprint: props.requestFingerprint ?? digest("request"),
    compileFingerprint: props.compileFingerprint ?? digest("compile"),
    sourceRenderFingerprint: props.sourceRenderFingerprint ?? digest("source"),
    adapterIdentity: props.adapterIdentity ?? adapterIdentity,
    seed: props.seed ?? 41,
    policy: props.policy,
    signal: props.signal,
    runtime: {
      now:
        props.now ??
        (() =>
          new Date(Date.parse("2026-08-28T10:00:00.000Z") + virtualElapsed)),
      attemptId:
        props.attemptId ??
        (() =>
          `20000000-0000-4000-8000-${String(++attempt).padStart(12, "0")}`),
      wait: async (milliseconds, signal) => {
        await (props.wait?.(milliseconds, signal) ?? Promise.resolve());
        if (props.now === undefined) virtualElapsed += milliseconds;
      },
    },
    execute: props.calls,
    onAttempt: (record) => records.push(record),
    ...(props.admitAttempt === undefined
      ? {}
      : { admitAttempt: props.admitAttempt }),
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
 * 4. A dispatch admission the claim store refuses, throws on, or answers
 *    outside its contract stops the request before any provider call and
 *    carries the typed cause beside the stop reason; an acquired admission
 *    dispatches normally and carries no refusal.
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
    ordinalOffset: 0,
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
  let cancelledDuringRegistration = false;
  let registrationRemovals = 0;
  let registrationAttemptIds = 0;
  let registrationProviderCalls = 0;
  const registrationRaceSignal = {
    get aborted(): boolean {
      return cancelledDuringRegistration;
    },
    reason: "cancelled while registering",
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ): void => {
      cancelledDuringRegistration = true;
      if (typeof listener === "function") listener(new Event("abort"));
      else listener.handleEvent(new Event("abort"));
    },
    removeEventListener: (): void => {
      ++registrationRemovals;
    },
  } as unknown as AbortSignal;
  const cancelledDuringRegistrationResult = await execute({
    policy: policy(),
    signal: registrationRaceSignal,
    attemptId: () => {
      ++registrationAttemptIds;
      return "20000000-0000-4000-8000-000000000099";
    },
    calls: async () => {
      ++registrationProviderCalls;
      return {
        value: "unreachable",
        costUnits: 0,
        availableOutput: null,
      };
    },
  });
  TestValidator.equals(
    "cancellation during listener registration stops before attempt allocation",
    {
      stop: cancelledDuringRegistrationResult.result.stop,
      attempts: cancelledDuringRegistrationResult.result.attempts.length,
      attemptIds: registrationAttemptIds,
      providerCalls: registrationProviderCalls,
      removals: registrationRemovals,
    },
    {
      stop: "cancelled",
      attempts: 0,
      attemptIds: 0,
      providerCalls: 0,
      removals: 1,
    },
  );
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
  let failedWaitProviderCalls = 0;
  const failedWait = await execute({
    policy: policy({ maximumAttempts: 2, backoffMs: [1] }),
    wait: () => Promise.reject(new Error("backoff runtime unavailable")),
    calls: async () => {
      ++failedWaitProviderCalls;
      throw { status: 429 };
    },
  });
  const waitAbortController = new AbortController();
  let abortedWaitProviderCalls = 0;
  const waitCancelled = await execute({
    policy: policy({ maximumAttempts: 2, backoffMs: [1] }),
    signal: waitAbortController.signal,
    wait: () => {
      waitAbortController.abort("cancel during backoff");
      return Promise.reject(new Error("cancel during backoff"));
    },
    calls: async () => {
      ++abortedWaitProviderCalls;
      throw { status: 429 };
    },
  });
  let earlyWaitProviderCalls = 0;
  let earlyWaitAttemptIds = 0;
  const earlyWait = await execute({
    policy: policy({ maximumAttempts: 2, backoffMs: [10] }),
    now: () => new Date("2026-08-28T10:00:00.000Z"),
    attemptId: () => {
      ++earlyWaitAttemptIds;
      return "30000000-0000-4000-8000-000000000001";
    },
    wait: () => Promise.resolve(),
    calls: async () => {
      ++earlyWaitProviderCalls;
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
  const normalizedFailures = await Promise.all([
    execute({
      policy: policy({ maximumAttempts: 1, backoffMs: [] }),
      calls: async () => {
        const failure = new Error("placeholder");
        failure.message = "";
        throw failure;
      },
    }),
    execute({
      policy: policy({ maximumAttempts: 1, backoffMs: [] }),
      calls: async () => {
        throw new AutoMovieRepaintAttemptError(
          "provider-refusal",
          " padded provider refusal ",
        );
      },
    }),
  ]);
  TestValidator.equals(
    "terminal failure messages are nonblank and exactly trimmed",
    normalizedFailures.map(
      ({ result }) => result.attempts[0]?.failure?.message,
    ),
    ["Repaint provider failed without a message.", "padded provider refusal"],
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
      failedWait: {
        stop: failedWait.result.stop,
        attempts: failedWait.result.attempts.length,
        providerCalls: failedWaitProviderCalls,
      },
      waitCancelled: {
        stop: waitCancelled.result.stop,
        attempts: waitCancelled.result.attempts.length,
        providerCalls: abortedWaitProviderCalls,
      },
      earlyWait: {
        stop: earlyWait.result.stop,
        attempts: earlyWait.result.attempts.length,
        attemptIds: earlyWaitAttemptIds,
        providerCalls: earlyWaitProviderCalls,
      },
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
      failedWait: {
        stop: "backoff-failed",
        attempts: 1,
        providerCalls: 1,
      },
      waitCancelled: {
        stop: "cancelled",
        attempts: 1,
        providerCalls: 1,
      },
      earlyWait: {
        stop: "backoff-failed",
        attempts: 1,
        attemptIds: 1,
        providerCalls: 1,
      },
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
  const reversedAfterWait = await execute({
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
          "2026-08-28T10:00:00.500Z",
          "2026-08-28T10:00:00.499Z",
        ][Math.min(reversedAfterWaitReads++, 4)]!,
      ),
    attemptId: () =>
      `60000000-0000-4000-8000-${String(++reversedAfterWaitAttemptIds).padStart(
        12,
        "0",
      )}`,
    calls: async () => {
      ++reversedAfterWaitCalls;
      throw { status: 429, message: "retry after a clock rollback" };
    },
  });
  let reversedAtRetryStartAttemptIds = 0;
  let reversedAtRetryStartCalls = 0;
  let reversedAtRetryStartReads = 0;
  const reversedAtRetryStart = await execute({
    policy: policy({
      maximumAttempts: 2,
      backoffMs: [10],
      retryableFailures: ["rate-limit"],
    }),
    now: () =>
      new Date(
        [
          "2026-08-28T10:00:00.000Z",
          "2026-08-28T10:00:00.000Z",
          "2026-08-28T10:00:00.000Z",
          "2026-08-28T10:00:00.000Z",
          "2026-08-28T10:00:00.010Z",
          "2026-08-28T10:00:00.009Z",
        ][Math.min(reversedAtRetryStartReads++, 5)]!,
      ),
    attemptId: () => {
      ++reversedAtRetryStartAttemptIds;
      return "70000000-0000-4000-8000-000000000001";
    },
    calls: async () => {
      ++reversedAtRetryStartCalls;
      throw { status: 429, message: "retry after attempt-start rollback" };
    },
  });
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
        stop: reversedAfterWait.result.stop,
        attempts: reversedAfterWait.result.attempts.length,
        attemptIds: reversedAfterWaitAttemptIds,
        providerCalls: reversedAfterWaitCalls,
      },
      atRetryStart: {
        stop: reversedAtRetryStart.result.stop,
        attempts: reversedAtRetryStart.result.attempts.length,
        attemptIds: reversedAtRetryStartAttemptIds,
        providerCalls: reversedAtRetryStartCalls,
      },
    },
    {
      beforeProvider: {
        rejected: true,
        attemptIds: 0,
        providerCalls: 0,
      },
      afterWait: {
        stop: "backoff-failed",
        attempts: 1,
        attemptIds: 1,
        providerCalls: 1,
      },
      atRetryStart: {
        stop: "backoff-failed",
        attempts: 1,
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
  const candidateOutcome = () => ({
    value: "candidate",
    costUnits: 1,
    availableOutput: { digest: digest("candidate"), bytes: 4 },
  });
  let invalidIdentityProviderCalls = 0;
  const invalidIdentityMessages = await Promise.all(
    [
      { productionId: " " },
      { shot: 42 as unknown as string },
      { requestId: "not-a-request-id" },
      { requestFingerprint: "sha256:bad" as AutoMovieContentDigest },
      { compileFingerprint: "sha256:bad" as AutoMovieContentDigest },
      { sourceRenderFingerprint: "sha256:bad" as AutoMovieContentDigest },
      { adapterIdentity: "{" },
      {
        adapterIdentity: JSON.stringify({
          protocolVersion: "automovie.repaint-runtime.v1",
          provider: "fixed",
          model: "fixed",
          version: "1",
          execution: "local",
        }),
      },
      { seed: 1.5 },
      { ordinalOffset: -1 },
      { ordinalOffset: 1.5 },
      { ordinalOffset: Number.MAX_SAFE_INTEGER },
    ].map((override) =>
      rejectionMessage(() =>
        execute({
          ...override,
          policy: policy(),
          calls: async () => {
            ++invalidIdentityProviderCalls;
            return candidateOutcome();
          },
        }),
      ),
    ),
  );
  TestValidator.predicate(
    "immutable request identity refuses every malformed runtime fact before provider execution",
    invalidIdentityProviderCalls === 0 &&
      invalidIdentityMessages.every(
        (message) => message !== "Malformed execution unexpectedly resolved.",
      ),
  );

  const malformedOutcomes = await Promise.all(
    [
      null,
      { digest: "sha256:bad" as AutoMovieContentDigest, bytes: 1 },
      { digest: digest("candidate"), bytes: 0 },
      { digest: digest("candidate"), bytes: 1.5 },
    ].map((availableOutput) =>
      execute({
        policy: policy({ maximumAttempts: 1, backoffMs: [] }),
        calls: async () => ({
          value: "candidate",
          costUnits: 1,
          availableOutput,
        }),
      }),
    ),
  );
  TestValidator.equals(
    "null or malformed successful output disclosures close as invalid terminal attempts",
    malformedOutcomes.map(({ result }) => ({
      stop: result.stop,
      accepted: result.accepted,
      status: result.attempts[0]?.status,
      failure: result.attempts[0]?.failure?.class,
    })),
    malformedOutcomes.map(
      () =>
        ({
          stop: "not-retryable",
          accepted: null,
          status: "invalid",
          failure: "invalid-output",
        }) as const,
    ),
  );
  const hostileOutcomeValue = await execute({
    policy: policy({ maximumAttempts: 1, backoffMs: [] }),
    calls: async () =>
      Object.defineProperty(
        {
          costUnits: 2,
          availableOutput: { digest: digest("hostile-value"), bytes: 8 },
        },
        "value",
        {
          get: () => {
            throw new Error("hostile output value getter");
          },
        },
      ) as {
        value: string;
        costUnits: number;
        availableOutput: {
          digest: AutoMovieContentDigest;
          bytes: number;
        };
      },
  });
  TestValidator.equals(
    "an unreadable accepted value closes exactly one invalid terminal attempt",
    {
      stop: hostileOutcomeValue.result.stop,
      attempts: hostileOutcomeValue.result.attempts.length,
      status: hostileOutcomeValue.result.attempts[0]?.status,
      failure: hostileOutcomeValue.result.attempts[0]?.failure?.class,
      costUnits: hostileOutcomeValue.result.attempts[0]?.costUnits,
      output: hostileOutcomeValue.result.attempts[0]?.availableOutput,
    },
    {
      stop: "not-retryable",
      attempts: 1,
      status: "invalid",
      failure: "invalid-output",
      costUnits: 2,
      output: { digest: digest("hostile-value"), bytes: 8 },
    },
  );

  const nonStringMessage = new AutoMovieRepaintAttemptError(
    "provider-refusal",
    "placeholder",
  );
  nonStringMessage.message = null as unknown as string;
  const malformedDisclosures = [
    new AutoMovieRepaintAttemptError(
      "unsupported" as "provider-refusal",
      "unsupported class",
    ),
    new AutoMovieRepaintAttemptError(
      "provider-refusal",
      "invalid cost",
      Number.NaN,
    ),
    new AutoMovieRepaintAttemptError(
      "provider-refusal",
      "invalid partial output",
      1,
      { digest: digest("partial"), bytes: 0 },
    ),
    nonStringMessage,
  ];
  const malformedDisclosureResults = await Promise.all(
    malformedDisclosures.map((disclosure) =>
      execute({
        policy: policy({ maximumAttempts: 1, backoffMs: [] }),
        calls: async () => {
          throw disclosure;
        },
      }),
    ),
  );
  TestValidator.equals(
    "malformed failure disclosures still preserve one well-formed terminal attempt",
    malformedDisclosureResults.map(({ result }) => ({
      stop: result.stop,
      attempts: result.attempts.length,
      status: result.attempts[0]?.status,
      failure: result.attempts[0]?.failure?.class,
      costUnits: result.attempts[0]?.costUnits,
      availableOutput: result.attempts[0]?.availableOutput,
    })),
    malformedDisclosures.map(
      () =>
        ({
          stop: "not-retryable",
          attempts: 1,
          status: "invalid",
          failure: "invalid-output",
          costUnits: 0,
          availableOutput: null,
        }) as const,
    ),
  );
  const malformedCancelledController = new AbortController();
  const malformedCancelled = await execute({
    policy: policy({ maximumAttempts: 1, backoffMs: [] }),
    signal: malformedCancelledController.signal,
    calls: async () => {
      malformedCancelledController.abort("cancel malformed disclosure");
      throw new AutoMovieRepaintAttemptError(
        "provider-refusal",
        "invalid cost during cancellation",
        -1,
      );
    },
  });
  TestValidator.equals(
    "outer cancellation dominates malformed disclosure without losing terminal state",
    {
      stop: malformedCancelled.result.stop,
      status: malformedCancelled.result.attempts[0]?.status,
      failure: malformedCancelled.result.attempts[0]?.failure?.class,
      costUnits: malformedCancelled.result.attempts[0]?.costUnits,
    },
    {
      stop: "cancelled",
      status: "cancelled",
      failure: "cancelled",
      costUnits: 0,
    },
  );
  const hostileProviderRejections = await Promise.all(
    [
      new Proxy(
        {},
        {
          get: () => {
            throw new Error("hostile provider getter");
          },
          getPrototypeOf: () => {
            throw new Error("hostile provider prototype");
          },
        },
      ),
      {
        [Symbol.toPrimitive]: (): never => {
          throw new Error("hostile provider stringification");
        },
      },
    ].map((rejection) =>
      execute({
        policy: policy({ maximumAttempts: 1, backoffMs: [] }),
        calls: async () => {
          throw rejection;
        },
      }),
    ),
  );
  TestValidator.equals(
    "hostile provider rejection inspection cannot erase a started attempt",
    hostileProviderRejections.map(({ result }) => ({
      stop: result.stop,
      attempts: result.attempts.length,
      status: result.attempts[0]?.status,
      failure: result.attempts[0]?.failure?.class,
    })),
    hostileProviderRejections.map(
      () =>
        ({
          stop: "not-retryable",
          attempts: 1,
          status: "failed",
          failure: "internal",
        }) as const,
    ),
  );

  const postProviderClockFailures = await Promise.all(
    [
      {
        name: "successful output then invalid completion clock",
        completion: (): Date => new Date(Number.NaN),
        rejectProvider: false,
        expectedCostUnits: 1,
        expectedOutput: digest("candidate"),
      },
      {
        name: "successful output then backward completion clock",
        completion: (): Date => new Date("2026-08-28T09:59:59.999Z"),
        rejectProvider: false,
        expectedCostUnits: 1,
        expectedOutput: digest("candidate"),
      },
      {
        name: "provider rejection then invalid completion clock",
        completion: (): Date => new Date(Number.NaN),
        rejectProvider: true,
        expectedCostUnits: 0,
        expectedOutput: null,
      },
      {
        name: "successful output then hostile completion clock",
        completion: (): Date => {
          throw new Proxy(
            {},
            {
              getPrototypeOf: () => {
                throw new Error("hostile clock prototype");
              },
              get: () => {
                throw new Error("hostile clock stringification");
              },
            },
          );
        },
        rejectProvider: false,
        expectedCostUnits: 1,
        expectedOutput: digest("candidate"),
      },
    ].map(
      async ({
        name,
        completion,
        rejectProvider,
        expectedCostUnits,
        expectedOutput,
      }) => {
        let clockReads = 0;
        const execution = await execute({
          policy: policy({ maximumAttempts: 1, backoffMs: [] }),
          now: () =>
            clockReads++ < 3
              ? new Date("2026-08-28T10:00:00.000Z")
              : completion(),
          calls: async () => {
            if (rejectProvider) throw new Error("provider rejected");
            return candidateOutcome();
          },
        });
        return { name, execution, expectedCostUnits, expectedOutput };
      },
    ),
  );
  TestValidator.equals(
    "post-provider clock failure closes at the last valid instant without retry",
    postProviderClockFailures.map(({ name, execution: { result } }) => ({
      name,
      stop: result.stop,
      attempts: result.attempts.length,
      status: result.attempts[0]?.status,
      failure: result.attempts[0]?.failure?.class,
      retryable: result.attempts[0]?.failure?.retryable,
      costUnits: result.attempts[0]?.costUnits,
      output: result.attempts[0]?.availableOutput?.digest ?? null,
      startedAt: result.attempts[0]?.startedAt,
      completedAt: result.attempts[0]?.completedAt,
    })),
    postProviderClockFailures.map(
      ({ name, expectedCostUnits, expectedOutput }) => ({
        name,
        stop: "not-retryable" as const,
        attempts: 1,
        status: "failed" as const,
        failure: "internal" as const,
        retryable: false,
        costUnits: expectedCostUnits,
        output: expectedOutput,
        startedAt: "2026-08-28T10:00:00.000Z",
        completedAt: "2026-08-28T10:00:00.000Z",
      }),
    ),
  );
  const cancelledClockController = new AbortController();
  let cancelledClockReads = 0;
  const cancelledDuringCompletionClock = await execute({
    policy: policy({ maximumAttempts: 1, backoffMs: [] }),
    signal: cancelledClockController.signal,
    now: () => {
      if (cancelledClockReads++ < 3)
        return new Date("2026-08-28T10:00:00.000Z");
      cancelledClockController.abort("cancel during completion clock");
      return new Date(Number.NaN);
    },
    calls: async () => candidateOutcome(),
  });
  TestValidator.equals(
    "real cancellation dominates a simultaneous completion-clock failure",
    {
      stop: cancelledDuringCompletionClock.result.stop,
      attempts: cancelledDuringCompletionClock.result.attempts.length,
      status: cancelledDuringCompletionClock.result.attempts[0]?.status,
      failure:
        cancelledDuringCompletionClock.result.attempts[0]?.failure?.class,
      costUnits: cancelledDuringCompletionClock.result.attempts[0]?.costUnits,
      output:
        cancelledDuringCompletionClock.result.attempts[0]?.availableOutput
          ?.digest,
    },
    {
      stop: "cancelled",
      attempts: 1,
      status: "cancelled",
      failure: "cancelled",
      costUnits: 1,
      output: digest("candidate"),
    },
  );
  let malformedAttemptListenerRemovals = 0;
  const malformedAttemptSignal = {
    aborted: false,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => {
      ++malformedAttemptListenerRemovals;
    },
  } as unknown as AbortSignal;
  const malformedAttemptWithSignal = await rejectionMessage(() =>
    execute({
      policy: policy(),
      signal: malformedAttemptSignal,
      attemptId: () => " padded ",
      calls: async () => ({
        value: 1,
        costUnits: 0,
        availableOutput: null,
      }),
    }),
  );
  TestValidator.equals(
    "attempt-id refusal detaches a resident cancellation relay",
    {
      rejected: malformedAttemptWithSignal.includes(
        "attempt id must be trimmed",
      ),
      removals: malformedAttemptListenerRemovals,
    },
    { rejected: true, removals: 1 },
  );
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
        now: () => {
          if (instant++ === 0) return new Date("2026-08-28T10:00:00.000Z");
          throw nonError("clock unavailable");
        },
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      });
    }),
    rejectionMessage(() => {
      let instant = 0;
      const malformedClockError = new Error("placeholder");
      malformedClockError.message = null as unknown as string;
      return execute({
        policy: policy(),
        now: () => {
          if (instant++ === 0) return new Date("2026-08-28T10:00:00.000Z");
          throw malformedClockError;
        },
        calls: async () => ({ value: 1, costUnits: 0, availableOutput: null }),
      });
    }),
  ]);
  TestValidator.predicate(
    "invalid request, attempt, and pre-provider clock instants reject",
    malformedMessages[0]?.includes("UUID v4") === true &&
      malformedMessages[1]?.includes("trimmed") === true &&
      malformedMessages.some((message) => message.includes("valid instant")) &&
      malformedMessages.at(-1) ===
        "Repaint request elapsed clock observation failed without an inspectable message.",
  );

  let admittedProviderCalls = 0;
  const admitted = (
    admitAttempt: () => unknown,
  ): ReturnType<typeof execute<number>> =>
    execute<number>({
      policy: policy(),
      admitAttempt: admitAttempt as NonNullable<
        Parameters<typeof execute>[0]["admitAttempt"]
      >,
      calls: async () => {
        ++admittedProviderCalls;
        return {
          value: 1,
          costUnits: 1,
          availableOutput: { digest: digest("admitted"), bytes: 4 },
        };
      },
    });
  const [
    heldByOwner,
    closedByUnknownOutcome,
    movedPrefix,
    storeThrew,
    storeOutsideContract,
    storeWithoutOwner,
    acquired,
  ] = await Promise.all([
    admitted(() => ({ status: "already-active", ownerAttemptId: "owner-1" })),
    admitted(() => ({ status: "unknown-outcome", ownerAttemptId: "owner-2" })),
    admitted(() => ({ status: "prefix-changed" })),
    admitted(() => {
      throw new Error("claim store offline");
    }),
    admitted(() => ({ status: "granted" })),
    admitted(() => ({ status: "already-active", ownerAttemptId: " " })),
    admitted(async () => ({ status: "acquired" })),
  ]);
  const refusalOf = (
    outcome: Awaited<ReturnType<typeof execute<number>>>,
  ): unknown => ({
    stop: outcome.result.stop,
    attempts: outcome.result.attempts.length,
    records: outcome.records.length,
    accepted: outcome.result.accepted,
    claimRefusal: outcome.result.claimRefusal,
  });
  TestValidator.equals(
    "a refused, thrown, or malformed admission stops before the provider with its typed cause",
    {
      heldByOwner: refusalOf(heldByOwner),
      closedByUnknownOutcome: refusalOf(closedByUnknownOutcome),
      movedPrefix: refusalOf(movedPrefix),
      storeThrew: refusalOf(storeThrew),
      storeOutsideContract: refusalOf(storeOutsideContract),
      storeWithoutOwner: refusalOf(storeWithoutOwner),
      acquired: {
        stop: acquired.result.stop,
        attempts: acquired.result.attempts.length,
        claimRefusal: acquired.result.claimRefusal,
      },
      providerCalls: admittedProviderCalls,
    },
    {
      heldByOwner: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: { status: "already-active", ownerAttemptId: "owner-1" },
      },
      closedByUnknownOutcome: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: { status: "unknown-outcome", ownerAttemptId: "owner-2" },
      },
      movedPrefix: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: { status: "prefix-changed" },
      },
      storeThrew: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: {
          status: "admission-failed",
          message: "claim store offline",
        },
      },
      storeOutsideContract: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: {
          status: "admission-failed",
          message:
            "Repaint attempt claim store answered outside the admission contract.",
        },
      },
      storeWithoutOwner: {
        stop: "claim-refused",
        attempts: 0,
        records: 0,
        accepted: null,
        claimRefusal: {
          status: "admission-failed",
          message:
            "Repaint attempt claim store reported already-active without naming the owning attempt.",
        },
      },
      acquired: { stop: "accepted", attempts: 1, claimRefusal: null },
      providerCalls: 1,
    },
  );
};
