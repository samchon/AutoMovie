import { TestValidator } from "@nestia/e2e";
import {
  createAutoMovieMaintenanceTransactionIO,
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
  readAutoMoviePendingMaintenance,
} from "automovie";
import { createHash } from "node:crypto";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";
import { createContractMaintenanceRuntimeHarness } from "../internal/contractMaintenanceRuntimeHarness";

/**
 * The physical adapter stages and syncs immutable records, preserves each
 * displaced source, and authenticates its pending journal before recovery.
 *
 * Scenarios:
 * 1. Contracts, TOC and reference-client operations retain their separate
 *    pending/archive namespaces and publish through preserving exclusive moves.
 * 2. Existing equal records are flushed again, while a different record,
 *    invalid path, lost stage, write failure and changed parent refuse.
 * 3. Pending corruption, missing journals, mismatched identities and completion
 *    competitors retain the active marker rather than overwriting it.
 */
export const test_cli_contract_maintenance_runtime = (): void => {
  for (const kind of ["contracts", "toc", "reference-clients"] as const) {
    const harness = createContractMaintenanceRuntimeHarness();
    harness.put("config.json", "original-secret");
    const io = createAutoMovieMaintenanceTransactionIO(
      harness.observe(["config.json"]),
      kind,
      harness.physical,
    );
    TestValidator.equals(
      "no pending attempt is absent",
      readAutoMoviePendingMaintenance(io, kind),
      null,
    );
    const before = io.read("config.json");
    const journal = prepareAutoMovieMaintenanceTransaction({
      kind,
      rootIdentity: harness.root.identity,
      baselinePath: null,
      changes: [{ path: "config.json", before, after: "successor" }],
      receipts: [],
      io,
    });
    TestValidator.equals(
      "pending journal resolves its full bytes",
      readAutoMoviePendingMaintenance(io, kind),
      journal,
    );
    const namespace =
      kind === "reference-clients"
        ? "automovie/reference-client-maintenance"
        : "automovie/contract-migrations";
    TestValidator.predicate(
      "archive uses the operation namespace",
      harness.files.has(`${namespace}/${journal.id}/transaction.json`),
    );
    io.stage(
      `${namespace}/${journal.id}/transaction.json`,
      harness.files.get(`${namespace}/${journal.id}/transaction.json`)!.source,
    );
    TestValidator.predicate(
      "reused immutable bytes are flushed",
      harness.events.some((event) => event.startsWith("sync-file:")),
    );
    TestValidator.equals(
      "physical adapter commits",
      publishAutoMovieMaintenanceTransaction({ journal, io }).status,
      "completed",
    );
    TestValidator.equals(
      "native token used descriptor device identity",
      before!.identity.startsWith("volume:"),
      true,
    );
    TestValidator.equals(
      "predecessor is preserved in displacement archive",
      harness.files.get(`${journal.changes[0]!.successor!.path}.displaced`)!
        .source,
      "original-secret",
    );
    TestValidator.equals(
      "successor is current",
      io.read("config.json")!.source,
      "successor",
    );
    TestValidator.equals(
      "committed pending marker is archived",
      readAutoMoviePendingMaintenance(io, kind),
      null,
    );
    io.finish(journal, "committed");
  }

  const harness = createContractMaintenanceRuntimeHarness();
  harness.put("config.json", "original");
  const io = createAutoMovieMaintenanceTransactionIO(
    harness.observe(["config.json"]),
    "contracts",
    harness.physical,
  );
  for (const invalid of [
    "",
    "../escape",
    "docs//invalid",
    "docs/./invalid",
    "a\\b",
    "a\0b",
    "C:/outside",
  ])
    TestValidator.predicate(
      "unsafe maintenance path refuses",
      contractMaintenanceFailure(() => io.read(invalid)) instanceof Error,
    );
  TestValidator.predicate(
    "wrong root identity refuses",
    contractMaintenanceFailure(() => io.assertRoot("other-root")) instanceof
      Error,
  );
  TestValidator.predicate(
    "resident record with other bytes refuses",
    contractMaintenanceFailure(() =>
      io.stage("config.json", "other"),
    ) instanceof Error,
  );
  for (const failure of ["refused", "lost", "different"] as const) {
    const model = createContractMaintenanceRuntimeHarness();
    const physical = {
      ...model.physical,
      write:
        failure === "refused"
          ? () => ({
              status: "refused" as const,
              reason: "create-failed" as const,
              error: new Error("write refused"),
            })
          : model.physical.write,
    };
    model.state.hook = (event) => {
      if (event.startsWith("sync:")) {
        if (failure === "lost") model.files.delete("record.json");
        if (failure === "different") model.put("record.json", "competitor");
      }
    };
    const adapter = createAutoMovieMaintenanceTransactionIO(
      model.observe([]),
      "contracts",
      physical,
    );
    TestValidator.predicate(
      `${failure} stage is not reported durable`,
      contractMaintenanceFailure(() =>
        adapter.stage("record.json", "candidate"),
      ) instanceof Error,
    );
  }
  const journal = prepareAutoMovieMaintenanceTransaction({
    kind: "contracts",
    rootIdentity: harness.root.identity,
    baselinePath: null,
    changes: [],
    receipts: [],
    io,
  });
  const pendingPath = "automovie/contract-maintenance.pending.json";
  const originalPending = harness.files.get(pendingPath)!;
  const journalPath = `automovie/contract-migrations/${journal.id}/transaction.json`;
  const originalJournal = harness.files.get(journalPath)!;
  harness.files.delete(journalPath);
  TestValidator.predicate(
    "missing journal refuses",
    contractMaintenanceFailure(() =>
      readAutoMoviePendingMaintenance(io),
    ) instanceof Error,
  );
  harness.files.set(journalPath, {
    ...originalJournal,
    source: `${originalJournal.source}\n`,
  });
  TestValidator.predicate(
    "changed journal digest refuses",
    contractMaintenanceFailure(() =>
      readAutoMoviePendingMaintenance(io),
    ) instanceof Error,
  );
  harness.files.set(journalPath, originalJournal);
  for (const difference of [{ id: "a".repeat(64) }, { kind: "toc" as const }]) {
    const changed = `${JSON.stringify({ ...journal, ...difference }, null, 2)}\n`;
    harness.files.set(journalPath, { ...originalJournal, source: changed });
    harness.files.set(pendingPath, {
      ...originalPending,
      source: JSON.stringify({
        ...JSON.parse(originalPending.source),
        journalDigest: createHash("sha256").update(changed).digest("hex"),
      }),
    });
    TestValidator.predicate(
      "matching digest does not approve another journal identity",
      contractMaintenanceFailure(() =>
        readAutoMoviePendingMaintenance(io),
      ) instanceof Error,
    );
  }
  harness.files.set(journalPath, originalJournal);
  harness.files.set(pendingPath, originalPending);
  for (const change of [
    { id: "bad-id" },
    { kind: "reference-clients" },
    { rootIdentity: "different" },
  ]) {
    const marker = { ...JSON.parse(originalPending.source), ...change };
    harness.files.set(pendingPath, {
      ...originalPending,
      source: JSON.stringify(marker),
    });
    TestValidator.predicate(
      "pending identity mismatch refuses",
      contractMaintenanceFailure(() =>
        readAutoMoviePendingMaintenance(io),
      ) instanceof Error,
    );
    TestValidator.predicate(
      "completion never retires another marker",
      contractMaintenanceFailure(() =>
        io.finish(journal, "restored"),
      ) instanceof Error,
    );
  }
  harness.files.delete(pendingPath);
  TestValidator.predicate(
    "unrecorded pending disappearance refuses",
    contractMaintenanceFailure(() => io.finish(journal, "restored")) instanceof
      Error,
  );
  harness.files.set(pendingPath, originalPending);
  TestValidator.predicate(
    "wrong operation namespace cannot begin",
    contractMaintenanceFailure(() =>
      io.begin({ ...journal, kind: "reference-clients" }),
    ) instanceof Error,
  );
  const changedParent = createContractMaintenanceRuntimeHarness();
  const adapter = createAutoMovieMaintenanceTransactionIO(
    changedParent.observe([]),
    "contracts",
    {
      ...changedParent.physical,
      observe: (props) => ({
        ...changedParent.physical.observe(props),
        directories: [{ ...changedParent.root, identity: "competitor-root" }],
      }),
    },
  );
  TestValidator.predicate(
    "a fresh observation cannot replace a cached parent generation",
    contractMaintenanceFailure(() => adapter.read("file.json")) instanceof
      Error,
  );
};
