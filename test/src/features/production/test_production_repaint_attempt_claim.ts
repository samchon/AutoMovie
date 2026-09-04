import {
  AutoMovieRepaintUnknownOutcomeError,
  IAutoMovieRepaintAttemptClaim,
  executeClaimedAutoMovieRepaintAttempt,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = `sha256:${"1".repeat(64)}` as const;
const claim = (requestId: string): IAutoMovieRepaintAttemptClaim => ({
  version: 1,
  productionId: "film",
  shot: "opening",
  requestId,
  requestFingerprint: digest,
  attemptOrdinal: 2,
  attemptId: `${requestId}-attempt`,
  prefixDigest: digest,
  generation: 1,
  claimedAt: "2026-09-04T00:00:00.000Z",
});

/**
 * Request claims prevent duplicate external repaint side effects.
 *
 * Scenarios:
 *
 * 1. One acquired request dispatches and settles while the duplicate and stale
 *    prefix paths never call the provider.
 * 2. Different request identities remain independent and an unknown external
 *    outcome is durably settled without being reported as retryable success.
 */
export const test_production_repaint_attempt_claim =
  async (): Promise<void> => {
    let calls = 0;
    const settlements: string[] = [];
    const completed = await executeClaimedAutoMovieRepaintAttempt({
      claim: claim("request-a"),
      acquire: () => ({ status: "acquired" }),
      execute: async () => ++calls,
      settle: async (_claim, settlement) => {
        settlements.push(settlement);
      },
    });
    const duplicate = await executeClaimedAutoMovieRepaintAttempt({
      claim: claim("request-a"),
      acquire: () => ({ status: "already-active", ownerAttemptId: "owner" }),
      execute: async () => ++calls,
      settle: () => settlements.push("unexpected"),
    });
    const changed = await executeClaimedAutoMovieRepaintAttempt({
      claim: claim("request-a"),
      acquire: () => ({ status: "prefix-changed" }),
      execute: async () => ++calls,
      settle: () => settlements.push("unexpected"),
    });
    const independent = await executeClaimedAutoMovieRepaintAttempt({
      claim: claim("request-b"),
      acquire: () => ({ status: "acquired" }),
      execute: async () => ++calls,
      settle: (_claim, settlement) => settlements.push(settlement),
    });
    const unknown = await executeClaimedAutoMovieRepaintAttempt({
      claim: claim("request-c"),
      acquire: () => ({ status: "acquired" }),
      execute: async () => {
        ++calls;
        throw new AutoMovieRepaintUnknownOutcomeError("adapter ignored abort");
      },
      settle: (_claim, settlement) => settlements.push(settlement),
    });
    TestValidator.equals(
      "only acquired independent claims dispatch and every dispatch settles truthfully",
      {
        completed,
        duplicate,
        changed,
        independent,
        unknown,
        calls,
        settlements,
      },
      {
        completed: { status: "completed", value: 1 },
        duplicate: { status: "already-active", ownerAttemptId: "owner" },
        changed: { status: "prefix-changed" },
        independent: { status: "completed", value: 2 },
        unknown: { status: "unknown-outcome" },
        calls: 3,
        settlements: ["fulfilled", "fulfilled", "unknown-outcome"],
      },
    );
  };
