import {
  AutoMovieRepaintAttemptError,
  executeAutoMovieRepaintRequest,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = `sha256:${"2".repeat(64)}` as const;

/**
 * Every terminal repaint attempt is durable before execution advances.
 *
 * Scenarios:
 *
 * 1. A retryable failure is awaited by the durable observer before backoff and
 *    the next provider call, and observer refusal blocks that call.
 * 2. A timeout whose adapter ignores abort records an unknown outcome and never
 *    starts another provider call.
 */
export const test_production_repaint_attempt_durability =
  async (): Promise<void> => {
    const events: string[] = [];
    let calls = 0;
    const result = await executeAutoMovieRepaintRequest({
      productionId: "film",
      shot: "opening",
      requestId: "10000000-0000-4000-8000-000000000001",
      requestFingerprint: digest,
      compileFingerprint: digest,
      sourceRenderFingerprint: digest,
      adapterIdentity: JSON.stringify({
        execution: "local",
        model: "model",
        protocolVersion: "automovie.repaint-runtime.v1",
        provider: "provider",
        version: "revision",
      }),
      seed: 1,
      policy: {
        maximumAttempts: 2,
        attemptTimeoutMs: 100,
        maximumElapsedMs: 1_000,
        maximumCostUnits: 10,
        backoffMs: [0],
        retryableFailures: ["rate-limit"],
      },
      runtime: {
        now: () => new Date("2026-09-04T00:00:00.000Z"),
        attemptId: () =>
          `20000000-0000-4000-8000-${String(calls + 1).padStart(12, "0")}`,
        wait: async () => {
          events.push("backoff");
        },
      },
      execute: async () => {
        events.push(`provider-${++calls}`);
        if (calls === 1)
          throw new AutoMovieRepaintAttemptError("rate-limit", "retry later");
        return {
          value: "accepted",
          costUnits: 1,
          availableOutput: { digest, bytes: 4 },
        };
      },
      onAttempt: async (attempt) => {
        await Promise.resolve();
        events.push(`persist-${attempt.ordinal}`);
      },
    });
    let blockedCalls = 0;
    const blocked = await executeAutoMovieRepaintRequest({
      productionId: "film",
      shot: "opening",
      requestId: "10000000-0000-4000-8000-000000000002",
      requestFingerprint: digest,
      compileFingerprint: digest,
      sourceRenderFingerprint: digest,
      adapterIdentity: JSON.stringify({
        execution: "local",
        model: "model",
        protocolVersion: "automovie.repaint-runtime.v1",
        provider: "provider",
        version: "revision",
      }),
      seed: 1,
      policy: {
        maximumAttempts: 2,
        attemptTimeoutMs: 100,
        maximumElapsedMs: 1_000,
        maximumCostUnits: 10,
        backoffMs: [0],
        retryableFailures: ["rate-limit"],
      },
      runtime: {
        now: () => new Date("2026-09-04T00:00:00.000Z"),
        attemptId: () =>
          `30000000-0000-4000-8000-${String(blockedCalls + 1).padStart(12, "0")}`,
        wait: async () => undefined,
      },
      execute: async () => {
        ++blockedCalls;
        throw new AutoMovieRepaintAttemptError("rate-limit", "retry later");
      },
      onAttempt: async () => {
        throw new Error("journal refused");
      },
    });
    let unknownCalls = 0;
    const unknown = await executeAutoMovieRepaintRequest({
      productionId: "film",
      shot: "opening",
      requestId: "10000000-0000-4000-8000-000000000003",
      requestFingerprint: digest,
      compileFingerprint: digest,
      sourceRenderFingerprint: digest,
      adapterIdentity: JSON.stringify({
        execution: "local",
        model: "model",
        protocolVersion: "automovie.repaint-runtime.v1",
        provider: "provider",
        version: "revision",
      }),
      seed: 1,
      policy: {
        maximumAttempts: 2,
        attemptTimeoutMs: 1,
        maximumElapsedMs: 100,
        maximumCostUnits: 10,
        backoffMs: [0],
        retryableFailures: ["timeout"],
      },
      runtime: {
        now: () => new Date("2026-09-04T00:00:00.000Z"),
        attemptId: () => "40000000-0000-4000-8000-000000000001",
        wait: async () => undefined,
      },
      execute: async () => {
        ++unknownCalls;
        return new Promise<never>(() => undefined);
      },
      onAttempt: () => undefined,
    });
    TestValidator.equals(
      "durability and unknown-outcome boundaries precede every retry side effect",
      {
        stop: result.stop,
        events,
        blocked: { stop: blocked.stop, calls: blockedCalls },
        unknown: {
          stop: unknown.stop,
          calls: unknownCalls,
          retryable: unknown.attempts[0]?.failure?.retryable,
        },
      },
      {
        stop: "accepted",
        events: [
          "provider-1",
          "persist-1",
          "backoff",
          "provider-2",
          "persist-2",
        ],
        blocked: { stop: "observer-failed", calls: 1 },
        unknown: { stop: "outcome-unknown", calls: 1, retryable: false },
      },
    );
  };
