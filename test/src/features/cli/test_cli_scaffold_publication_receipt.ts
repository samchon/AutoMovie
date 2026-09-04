import {
  type ScaffoldFilePublicationOutcome,
  ScaffoldPublicationError,
  planScaffoldPublication,
  publishScaffoldCandidate,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Candidate publication stops on one exact receipt without cleanup or guesses.
 *
 * Scenarios:
 *
 * 1. A complete adapter result for every entry returns the complete prefix and
 *    calls the adapter once per planned file.
 * 2. Refusal before the first slot, refusal after a completed prefix, and a
 *    bound partial write return distinct candidate-wide outcomes.
 * 3. Missing parent identity and impossible partial byte counts are rejected as
 *    broken adapter contracts instead of being recorded as trustworthy state.
 */
export const test_cli_scaffold_publication_receipt = (): void => {
  const candidate = planScaffoldPublication({
    files: { "a.txt": "abc", "b.txt": "de" },
    root: "synthetic-publication-root",
  });
  const attempt = (
    outcomes: ScaffoldFilePublicationOutcome[],
  ): {
    calls: string[];
    receipt: ReturnType<typeof publishScaffoldCandidate>;
  } => {
    const calls: string[] = [];
    let index = 0;
    const receipt = publishScaffoldCandidate({
      candidate,
      publish: (entry) => {
        calls.push(entry.relative);
        return outcomes[index++]!;
      },
    });
    return { calls, receipt };
  };

  const completed = attempt([
    { status: "completed", parentIdentity: "parent-1" },
    { status: "completed", parentIdentity: "parent-1" },
  ]);
  TestValidator.equals(
    "a complete candidate records every exact completed entry",
    {
      calls: completed.calls,
      completed: completed.receipt.completed.map((result) => ({
        parent: result.parentIdentity,
        relative: result.entry.relative,
      })),
      failure: completed.receipt.failure,
      frozen:
        Object.isFrozen(completed.receipt) &&
        Object.isFrozen(completed.receipt.completed) &&
        completed.receipt.completed.every(Object.isFrozen),
      planned: completed.receipt.planned.map((entry) => entry.relative),
      status: completed.receipt.status,
    },
    {
      calls: ["a.txt", "b.txt"],
      completed: [
        { parent: "parent-1", relative: "a.txt" },
        { parent: "parent-1", relative: "b.txt" },
      ],
      failure: null,
      frozen: true,
      planned: ["a.txt", "b.txt"],
      status: "completed",
    },
  );
  const firstRefusal = attempt([
    {
      status: "refused",
      error: new Error("parent changed"),
      reason: "parent-changed",
    },
  ]);
  const laterRefusal = attempt([
    { status: "completed", parentIdentity: "parent-1" },
    {
      status: "refused",
      error: new Error("competitor"),
      reason: "target-competitor",
    },
  ]);
  const partial = attempt([
    {
      status: "partial",
      bytesWritten: 1,
      error: new Error("write stopped"),
      parentIdentity: "parent-1",
    },
  ]);
  TestValidator.predicate(
    "compatibility errors retain and project the exact receipt",
    (() => {
      const refused = new ScaffoldPublicationError(firstRefusal.receipt);
      const impossible = new ScaffoldPublicationError(completed.receipt);
      return (
        refused.receipt === firstRefusal.receipt &&
        refused.cause === firstRefusal.receipt.failure?.outcome.error &&
        refused.message.includes('"reason":"parent-changed"') &&
        impossible.receipt === completed.receipt &&
        impossible.message.includes("without a stopping entry")
      );
    })(),
  );
  TestValidator.equals(
    "zero-publication and partial outcomes remain distinct",
    [
      {
        completed: firstRefusal.receipt.completed.length,
        failed: firstRefusal.receipt.failure?.entry.relative,
        frozen:
          Object.isFrozen(firstRefusal.receipt) &&
          Object.isFrozen(firstRefusal.receipt.failure) &&
          Object.isFrozen(firstRefusal.receipt.failure?.outcome),
        status: firstRefusal.receipt.status,
      },
      {
        completed: laterRefusal.receipt.completed.length,
        failed: laterRefusal.receipt.failure?.entry.relative,
        status: laterRefusal.receipt.status,
      },
      {
        bytes:
          partial.receipt.failure?.outcome.status === "partial"
            ? partial.receipt.failure.outcome.bytesWritten
            : null,
        completed: partial.receipt.completed.length,
        status: partial.receipt.status,
      },
    ],
    [
      { completed: 0, failed: "a.txt", frozen: true, status: "refused" },
      { completed: 1, failed: "b.txt", status: "partial" },
      { bytes: 1, completed: 0, status: "partial" },
    ],
  );

  const invalid = (outcome: ScaffoldFilePublicationOutcome): string => {
    try {
      publishScaffoldCandidate({ candidate, publish: () => outcome });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  TestValidator.predicate(
    "impossible adapter receipts are refused",
    [
      invalid({ status: "completed", parentIdentity: "" }),
      invalid({
        status: "partial",
        bytesWritten: 0,
        error: "stopped",
        parentIdentity: "",
      }),
      invalid({
        status: "partial",
        bytesWritten: 0.5,
        error: "stopped",
        parentIdentity: "parent-1",
      }),
      invalid({
        status: "partial",
        bytesWritten: -1,
        error: "stopped",
        parentIdentity: "parent-1",
      }),
      invalid({
        status: "partial",
        bytesWritten: 4,
        error: "stopped",
        parentIdentity: "parent-1",
      }),
      invalid({
        error: "stopped",
        reason: "unknown",
        status: "refused",
      } as unknown as ScaffoldFilePublicationOutcome),
    ].every((message) => message !== "accepted"),
  );

  TestValidator.equals(
    "an empty candidate completes without calling the adapter",
    publishScaffoldCandidate({
      candidate: [],
      publish: () => {
        throw new Error("adapter must not be called");
      },
    }).status,
    "completed",
  );
};
