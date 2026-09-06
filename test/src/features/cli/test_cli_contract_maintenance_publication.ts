import { TestValidator } from "@nestia/e2e";
import {
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
} from "automovie";

import { createContractMaintenanceHarness } from "../internal/contractMaintenanceHarness";

/**
 * Maintenance keeps original bytes and a publication receipt durable before
 * retiring a renamed source, with the baseline as the final file commit.
 *
 * Scenarios:
 * 1. A create, replacement, rename and unchanged target publish exact sources
 *    while archive and receipt events precede retirement and baseline commit.
 * 2. An already-published rename target needs no target replacement, while its
 *    source is still checked, archived and retired after the receipt.
 * 3. A TOC transaction uses its own durable commit record and supports an empty
 *    change population without manufacturing file writes.
 */
export const test_cli_contract_maintenance_publication = (): void => {
  const harness = createContractMaintenanceHarness({
    "automovie/contracts-baseline.json": "baseline-before",
    "docs/replace.md": "replace-before",
    "docs/rename.md": "rename-bytes",
    "docs/unchanged.md": "same",
  });
  const changes = [
    { path: "docs/new.md", before: null, after: "new-bytes" },
    {
      path: "docs/replace.md",
      before: harness.read("docs/replace.md"),
      after: "replace-after",
    },
    {
      path: "docs/rename.md",
      before: harness.read("docs/rename.md"),
      after: null,
    },
    { path: "docs/renamed.md", before: null, after: "rename-bytes" },
    {
      path: "docs/unchanged.md",
      before: harness.read("docs/unchanged.md"),
      after: "same",
    },
    {
      path: "automovie/contracts-baseline.json",
      before: harness.read("automovie/contracts-baseline.json"),
      after: "baseline-after",
    },
  ];
  const journal = prepareAutoMovieMaintenanceTransaction({
    kind: "contracts",
    rootIdentity: "root-1",
    baselinePath: "automovie/contracts-baseline.json",
    changes,
    receipts: [{ path: "automovie/receipt.json", source: "validated-receipt" }],
    io: harness.io,
  });
  TestValidator.equals(
    "preparation leaves every current source intact",
    changes.map(({ path }) => harness.read(path)?.source ?? null),
    changes.map(({ before }) => before?.source ?? null),
  );
  TestValidator.equals(
    "journal durably retains all exact predecessor bytes",
    JSON.parse(
      harness.read(
        `automovie/contract-migrations/${journal.id}/transaction.json`,
      )!.source,
    ).changes.map(
      (change: { before: { source: string } | null }) =>
        change.before?.source ?? null,
    ),
    journal.changes.map(({ before }) => before?.source ?? null),
  );
  const outcome = publishAutoMovieMaintenanceTransaction({
    journal,
    io: harness.io,
  });
  TestValidator.equals("all changes commit", outcome.status, "completed");
  TestValidator.equals(
    "published sources equal the approved successor",
    changes.map(({ path }) => harness.read(path)?.source ?? null),
    changes.map(({ after }) => after),
  );
  TestValidator.equals(
    "unchanged source retains its original generation",
    harness.read("docs/unchanged.md"),
    changes.find(({ path }) => path === "docs/unchanged.md")!.before,
  );
  const events = harness.events.filter(({ moment }) => moment === "before");
  const firstMutation = events.findIndex(
    ({ operation }) => operation === "replace",
  );
  const journalWrite = events.findIndex(
    ({ operation, path }) =>
      operation === "record" && path.endsWith("/transaction.json"),
  );
  const receipt = events.findIndex(
    ({ operation, path }) =>
      operation === "record" && path === "automovie/receipt.json",
  );
  const retirement = events.findIndex(
    ({ operation }) => operation === "retire",
  );
  const baseline = events.findIndex(
    ({ operation, path }) =>
      operation === "replace" && path === "automovie/contracts-baseline.json",
  );
  TestValidator.predicate(
    "journal precedes mutation, receipt precedes retirement, baseline follows retirement",
    journalWrite >= 0 &&
      journalWrite < firstMutation &&
      receipt < retirement &&
      retirement < baseline,
  );
  TestValidator.equals(
    "committed attempt clears the pending owner",
    { pending: harness.state.pending, finished: harness.state.finished },
    { pending: null, finished: "committed" },
  );

  const resume = createContractMaintenanceHarness({
    "docs/source.md": "same",
    "docs/target.md": "same",
  });
  const resumed = prepareAutoMovieMaintenanceTransaction({
    kind: "contracts",
    rootIdentity: "root-1",
    baselinePath: null,
    changes: [
      {
        path: "docs/source.md",
        before: resume.read("docs/source.md"),
        after: null,
      },
      {
        path: "docs/target.md",
        before: resume.read("docs/target.md"),
        after: "same",
      },
    ],
    receipts: [{ path: "automovie/resumed.json", source: "receipt" }],
    io: resume.io,
  });
  TestValidator.equals(
    "already-published target resumes",
    publishAutoMovieMaintenanceTransaction({ journal: resumed, io: resume.io })
      .status,
    "completed",
  );
  TestValidator.equals(
    "empty-write resume never rewrites target",
    resume.events.filter(({ operation }) => operation === "replace"),
    [],
  );
  TestValidator.equals(
    "retirement still occurs",
    resume.read("docs/source.md"),
    null,
  );

  const empty = createContractMaintenanceHarness({});
  const emptyJournal = prepareAutoMovieMaintenanceTransaction({
    kind: "toc",
    rootIdentity: "root-1",
    baselinePath: null,
    changes: [],
    receipts: [],
    io: empty.io,
  });
  TestValidator.equals(
    "empty TOC commits",
    publishAutoMovieMaintenanceTransaction({
      journal: emptyJournal,
      io: empty.io,
    }).status,
    "completed",
  );
  TestValidator.equals(
    "TOC has a durable commit marker",
    empty.read(
      `automovie/contract-migrations/${emptyJournal.id}/committed.json`,
    )!.source,
    `${emptyJournal.id}\n`,
  );
};
