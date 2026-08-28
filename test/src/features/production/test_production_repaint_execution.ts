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
  signal?: AbortSignal;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}) => {
  let attempt = 0;
  const records: unknown[] = [];
  return executeAutoMovieRepaintRequest({
    productionId: "repaint-execution",
    shot: "opening",
    requestId: "10000000-0000-4000-8000-000000000001",
    requestFingerprint: digest("request"),
    compileFingerprint: digest("compile"),
    sourceRenderFingerprint: digest("source"),
    adapterIdentity: '{"provider":"fixed"}',
    seed: 41,
    policy: props.policy,
    signal: props.signal,
    runtime: {
      now: props.now ?? (() => new Date("2026-08-28T10:00:00.000Z")),
      attemptId: () =>
        `20000000-0000-4000-8000-${String(++attempt).padStart(12, "0")}`,
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
    policy({ maximumElapsedMs: 0 }),
    policy({ attemptTimeoutMs: 10_001 }),
    policy({ maximumCostUnits: -1 }),
    policy({ backoffMs: [0] }),
    policy({ backoffMs: [0, -1] }),
    policy({ retryableFailures: ["timeout", "timeout"] }),
    policy({ retryableFailures: ["unsupported" as "timeout"] }),
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
};
