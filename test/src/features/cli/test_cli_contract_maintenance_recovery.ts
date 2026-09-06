import { TestValidator } from "@nestia/e2e";
import {
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
  recoverAutoMovieMaintenanceTransaction,
} from "automovie";

import { createContractMaintenanceHarness } from "../internal/contractMaintenanceHarness";

/**
 * Recovery restores only generations owned by the interrupted transaction,
 * and preserves a pending journal when a competitor or root move intervenes.
 *
 * Scenarios:
 * 1. Interrupt after target displacement, activation, retirement or baseline
 *    displacement; replay restores the predecessor, including an absent
 *    baseline whose exact source is retained in its displacement archive.
 * 2. A competitor with different identity or bytes is retained and reported;
 *    root replacement refuses every recovery mutation.
 * 3. A recovery mutation or completion failure retains the pending journal,
 *    and a second recovery succeeds when the original failure is removed.
 */
export const test_cli_contract_maintenance_recovery = (): void => {
  for (const position of [
    "prepared",
    "displaced",
    "published",
    "retired",
    "baseline-displaced",
    "baseline-published",
  ] as const) {
    const harness = createContractMaintenanceHarness({
      "docs/item.md": "old",
      "docs/retire.md": "rename",
      "automovie/baseline.json": "old-baseline",
    });
    const journal = prepareAutoMovieMaintenanceTransaction({
      kind: "contracts",
      rootIdentity: "root-1",
      baselinePath: "automovie/baseline.json",
      changes: [
        {
          path: "docs/item.md",
          before: harness.read("docs/item.md"),
          after: "new",
        },
        {
          path: "docs/retire.md",
          before: harness.read("docs/retire.md"),
          after: null,
        },
        {
          path: "automovie/baseline.json",
          before: harness.read("automovie/baseline.json"),
          after: "new-baseline",
        },
      ],
      receipts: [{ path: "automovie/receipt.json", source: "receipt" }],
      io: harness.io,
    });
    const item = journal.changes.find(({ path }) => path === "docs/item.md")!;
    const baseline = journal.changes.find(
      ({ path }) => path === "automovie/baseline.json",
    )!;
    const retired = journal.changes.find(
      ({ path }) => path === "docs/retire.md",
    )!;
    if (position === "displaced")
      harness.io.retire(
        item.path,
        item.before!,
        `${item.successor!.path}.displaced`,
      );
    if (
      [
        "published",
        "retired",
        "baseline-displaced",
        "baseline-published",
      ].includes(position)
    )
      harness.io.replace(item.path, item.before, item.successor!);
    if (
      ["retired", "baseline-displaced", "baseline-published"].includes(position)
    ) {
      harness.io.record("automovie/receipt.json", "receipt");
      harness.io.retire(
        retired.path,
        retired.before!,
        `automovie/contract-migrations/${journal.id}/retired/${retired.path}`,
      );
    }
    if (position === "baseline-displaced")
      harness.io.retire(
        baseline.path,
        baseline.before!,
        `${baseline.successor!.path}.displaced`,
      );
    if (position === "baseline-published")
      harness.io.replace(baseline.path, baseline.before, baseline.successor!);
    const result = recoverAutoMovieMaintenanceTransaction({
      journal,
      io: harness.io,
    });
    const committed = position === "baseline-published";
    TestValidator.equals(
      `${position} recovers its exact phase`,
      result.status,
      committed ? "completed" : "rolled-back",
    );
    TestValidator.equals(
      `${position} preserves the selected bytes`,
      [
        harness.read(item.path)?.source,
        harness.read(baseline.path)?.source,
        harness.read(retired.path)?.source ?? null,
      ],
      committed
        ? ["new", "new-baseline", null]
        : ["old", "old-baseline", "rename"],
    );
  }

  for (const kind of [
    "identity",
    "bytes",
    "version",
    "root",
    "restore",
    "finish",
  ] as const) {
    const harness = createContractMaintenanceHarness({ "docs/item.md": "old" });
    const journal = prepareAutoMovieMaintenanceTransaction({
      kind: "toc",
      rootIdentity: "root-1",
      baselinePath: null,
      changes: [
        {
          path: "docs/item.md",
          before: harness.read("docs/item.md"),
          after: "new",
        },
      ],
      receipts: [],
      io: harness.io,
    });
    const change = journal.changes[0]!;
    harness.io.replace(change.path, change.before, change.successor!);
    if (kind === "identity")
      harness.files.set(change.path, harness.file("new"));
    if (kind === "bytes")
      harness.files.set(change.path, {
        ...harness.read(change.path)!,
        source: "competitor",
      });
    if (kind === "version")
      harness.files.set(change.path, {
        ...harness.read(change.path)!,
        version: "competitor-version",
      });
    if (kind === "root") harness.state.rootIdentity = "root-2";
    if (kind === "restore" || kind === "finish")
      harness.state.hook = (event) => {
        if (event.operation === (kind === "restore" ? "replace" : "finish"))
          throw new Error("recovery failed");
      };
    const result = recoverAutoMovieMaintenanceTransaction({
      journal,
      io: harness.io,
    });
    TestValidator.equals(
      `${kind} keeps recovery explicit`,
      result.status,
      "recovery-required",
    );
    TestValidator.predicate(
      `${kind} retains its pending journal and diagnostics`,
      harness.state.pending?.id === journal.id &&
        result.recoveryErrors.length > 0,
    );
    if (kind === "restore" || kind === "finish") {
      harness.state.hook = () => {};
      TestValidator.equals(
        `${kind} can recover on a later invocation`,
        recoverAutoMovieMaintenanceTransaction({ journal, io: harness.io })
          .status,
        "rolled-back",
      );
    }
  }

  const preflight = createContractMaintenanceHarness({ "docs/item.md": "old" });
  const pending = prepareAutoMovieMaintenanceTransaction({
    kind: "toc",
    rootIdentity: "root-1",
    baselinePath: null,
    changes: [
      {
        path: "docs/item.md",
        before: preflight.read("docs/item.md"),
        after: "new",
      },
    ],
    receipts: [],
    io: preflight.io,
  });
  preflight.files.set(
    "docs/item.md",
    preflight.file("competitor-before-publication"),
  );
  TestValidator.equals(
    "plan-bound preflight never adopts competitor",
    publishAutoMovieMaintenanceTransaction({
      journal: pending,
      io: preflight.io,
    }).status,
    "recovery-required",
  );
  TestValidator.equals(
    "competitor remains current",
    preflight.read("docs/item.md")!.source,
    "competitor-before-publication",
  );
  const sameBaseline = createContractMaintenanceHarness({
    "automovie/baseline.json": "same",
  });
  const unchanged = prepareAutoMovieMaintenanceTransaction({
    kind: "contracts",
    rootIdentity: "root-1",
    baselinePath: "automovie/baseline.json",
    changes: [
      {
        path: "automovie/baseline.json",
        before: sameBaseline.read("automovie/baseline.json"),
        after: "same",
      },
    ],
    receipts: [],
    io: sameBaseline.io,
  });
  sameBaseline.io.record(
    `automovie/contract-migrations/${unchanged.id}/committed.json`,
    `${unchanged.id}\n`,
  );
  sameBaseline.files.set(
    "automovie/baseline.json",
    sameBaseline.file("competitor"),
  );
  TestValidator.equals(
    "marker commit cannot conceal a changed unchanged-baseline generation",
    recoverAutoMovieMaintenanceTransaction({
      journal: unchanged,
      io: sameBaseline.io,
    }).status,
    "recovery-required",
  );
};
