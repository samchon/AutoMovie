import {
  AutoMovieProductionProject,
  type IAutoMovieRepaintAttemptClaim,
  assertAutoMovieRepaintAttemptClaim,
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

const REQUEST_A = "40000000-0000-4000-8000-000000000001";
const REQUEST_B = "40000000-0000-4000-8000-000000000002";
const requestFingerprint = `sha256:${"a".repeat(64)}` as const;

/**
 * The project-owned claim store serializes provider dispatch per request.
 *
 * Scenarios:
 *
 * 1. The first exact next-attempt claim is acquired and persisted; a second
 *    claim on the same prefix is refused as held by the first attempt, and a
 *    foreign settlement cannot close it.
 * 2. Settlement is idempotent for the same fact and refuses a contradicting
 *    fact; the next claim generation is admitted only after settlement.
 * 3. A moved journal prefix, wrong ordinal, foreign production, skipped
 *    generation, changed request fingerprint, or changed shot is refused as a
 *    moved prefix without touching the stored claim.
 * 4. An unknown provider outcome closes the request prefix to every later
 *    generation, while an independent request stays admissible.
 * 5. A malformed stored claim refuses admission and settlement instead of being
 *    read as absent, a vanished claim refuses settlement, and a malformed claim
 *    identity is refused before any store access.
 */
export const test_production_repaint_attempt_claim = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const prefixDigest = (requestId: string) =>
      digestAutoMovieBytes(
        canonicalAutoMovieJsonBytes(project.repaintRequestAttempts(requestId)),
      );
    const claim = (
      overrides: Partial<IAutoMovieRepaintAttemptClaim> = {},
    ): IAutoMovieRepaintAttemptClaim => ({
      version: 1,
      productionId: project.productionId,
      shot: "opening",
      requestId: REQUEST_A,
      requestFingerprint,
      attemptOrdinal: 1,
      attemptId: "attempt-1",
      prefixDigest: prefixDigest(REQUEST_A),
      generation: 1,
      claimedAt: "2026-09-05T00:00:00.000Z",
      ...overrides,
    });
    const claimsRoot = path.dirname(
      project.trackedStatePath("renditions/claims/placeholder.json"),
    );
    const storedClaimFiles = (): string[] =>
      fs.existsSync(claimsRoot)
        ? fs.readdirSync(claimsRoot).sort(compareCodeUnits)
        : [];

    const first = project.acquireRepaintAttemptClaim(claim());
    const filesAfterFirst = storedClaimFiles();
    const held = project.acquireRepaintAttemptClaim(
      claim({ attemptId: "attempt-1-duplicate" }),
    );
    const foreignSettlement = throwsError(
      () =>
        project.settleRepaintAttemptClaim(
          claim({ attemptId: "attempt-1-duplicate" }),
          "fulfilled",
        ),
      "lost ownership",
    );
    const settled = project.settleRepaintAttemptClaim(claim(), "fulfilled");
    const settledAgain = project.settleRepaintAttemptClaim(
      claim(),
      "fulfilled",
    );
    const contradicted = throwsError(
      () => project.settleRepaintAttemptClaim(claim(), "rejected"),
      "lost ownership",
    );
    // Judged against the fulfilled first claim: a skipped generation, a changed
    // request fingerprint, or a changed shot is a moved prefix, not a new attempt.
    const movedAfterSettlement = {
      skippedGeneration: project.acquireRepaintAttemptClaim(
        claim({ attemptId: "attempt-x", generation: 3 }),
      ),
      fingerprint: project.acquireRepaintAttemptClaim(
        claim({
          attemptId: "attempt-x",
          generation: 2,
          requestFingerprint: `sha256:${"c".repeat(64)}`,
        }),
      ),
      shot: project.acquireRepaintAttemptClaim(
        claim({ attemptId: "attempt-x", generation: 2, shot: "answer" }),
      ),
    };
    const second = project.acquireRepaintAttemptClaim(
      claim({ attemptId: "attempt-2", generation: 2 }),
    );
    const moved = {
      prefix: project.acquireRepaintAttemptClaim(
        claim({
          attemptId: "attempt-x",
          generation: 3,
          prefixDigest: `sha256:${"b".repeat(64)}`,
        }),
      ),
      ordinal: project.acquireRepaintAttemptClaim(
        claim({ attemptId: "attempt-x", generation: 3, attemptOrdinal: 2 }),
      ),
      production: project.acquireRepaintAttemptClaim(
        claim({
          attemptId: "attempt-x",
          generation: 3,
          productionId: "another-production",
        }),
      ),
    };
    const unknown = project.settleRepaintAttemptClaim(
      claim({ attemptId: "attempt-2", generation: 2 }),
      "unknown-outcome",
    );
    const closed = project.acquireRepaintAttemptClaim(
      claim({ attemptId: "attempt-3", generation: 3 }),
    );
    const independent = project.acquireRepaintAttemptClaim(
      claim({
        requestId: REQUEST_B,
        prefixDigest: prefixDigest(REQUEST_B),
        attemptId: "attempt-b",
      }),
    );
    const filesAfterIndependent = storedClaimFiles();

    const storedA = filesAfterFirst[0]!;
    fs.writeFileSync(path.join(claimsRoot, storedA), "{}");
    const malformedAcquire = throwsError(
      () =>
        project.acquireRepaintAttemptClaim(
          claim({ attemptId: "attempt-3", generation: 3 }),
        ),
      "malformed",
    );
    const malformedSettle = throwsError(
      () =>
        project.settleRepaintAttemptClaim(
          claim({ attemptId: "attempt-2", generation: 2 }),
          "unknown-outcome",
        ),
      "lost ownership",
    );
    fs.rmSync(path.join(claimsRoot, storedA));
    const vanishedSettle = throwsError(
      () => project.settleRepaintAttemptClaim(claim(), "fulfilled"),
      "disappeared before settlement",
    );
    const malformedIdentity = throwsError(
      () => assertAutoMovieRepaintAttemptClaim(claim({ attemptOrdinal: 0 })),
      "identity is malformed",
    );
    const malformedInstant = throwsError(
      () =>
        project.acquireRepaintAttemptClaim(
          claim({ claimedAt: "2026-09-05T00:00:00Z" }),
        ),
      "exact UTC instant",
    );

    TestValidator.equals(
      "the claim store admits one exact next attempt per request and settles truthfully",
      namedFacts([
        ["firstAcquired", () => first.status === "acquired"],
        ["firstPersisted", () => filesAfterFirst.length === 1],
        [
          "duplicateHeldByFirst",
          () =>
            held.status === "already-active" &&
            held.ownerAttemptId === "attempt-1",
        ],
        ["foreignSettlementRefused", () => foreignSettlement],
        ["settlementIdempotent", () => settled > 0 && settledAgain >= settled],
        ["contradictingSettlementRefused", () => contradicted],
        ["nextGenerationAcquired", () => second.status === "acquired"],
        [
          "movedPrefixRefused",
          () =>
            moved.prefix.status === "prefix-changed" &&
            moved.ordinal.status === "prefix-changed" &&
            moved.production.status === "prefix-changed",
        ],
        ["unknownOutcomeSettled", () => unknown > 0],
        [
          "movedIdentityRefusedAfterSettlement",
          () =>
            movedAfterSettlement.skippedGeneration.status ===
              "prefix-changed" &&
            movedAfterSettlement.fingerprint.status === "prefix-changed" &&
            movedAfterSettlement.shot.status === "prefix-changed",
        ],
        [
          "requestClosedByUnknownOutcome",
          () =>
            closed.status === "unknown-outcome" &&
            closed.ownerAttemptId === "attempt-2",
        ],
        [
          "independentRequestAdmitted",
          () =>
            independent.status === "acquired" &&
            filesAfterIndependent.length === 2,
        ],
        ["malformedStoredClaimRefusesAdmission", () => malformedAcquire],
        ["malformedStoredClaimRefusesSettlement", () => malformedSettle],
        ["vanishedClaimRefusesSettlement", () => vanishedSettle],
        ["malformedIdentityRefused", () => malformedIdentity],
        ["malformedInstantRefused", () => malformedInstant],
      ]),
      {
        firstAcquired: true,
        firstPersisted: true,
        duplicateHeldByFirst: true,
        foreignSettlementRefused: true,
        settlementIdempotent: true,
        contradictingSettlementRefused: true,
        nextGenerationAcquired: true,
        movedPrefixRefused: true,
        unknownOutcomeSettled: true,
        movedIdentityRefusedAfterSettlement: true,
        requestClosedByUnknownOutcome: true,
        independentRequestAdmitted: true,
        malformedStoredClaimRefusesAdmission: true,
        malformedStoredClaimRefusesSettlement: true,
        vanishedClaimRefusesSettlement: true,
        malformedIdentityRefused: true,
        malformedInstantRefused: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
