import { TestValidator } from "@nestia/e2e";
import {
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
  recoverAutoMovieMaintenanceTransaction,
} from "automovie";

import { createContractMaintenanceHarness } from "../internal/contractMaintenanceHarness";

/**
 * Verification and recovery do not adopt an unowned generation at a phase
 * boundary, even when another part of the transaction has already advanced.
 *
 * Scenarios:
 * 1. An initially absent baseline restores absence before publication and
 *    commits by its first activation; a same-byte baseline uses a final marker.
 * 2. Changed target readback, baseline readback, committed successor and restored
 *    predecessor remain recovery-required with competitors and marker retained.
 * 3. A rollback interrupted between displacement and activation can recover
 *    from its successor displacement proof; an unexplained gap cannot.
 */
export const test_cli_contract_maintenance_boundaries = (): void => {
  for (const publish of [false, true]) {
    const model = createContractMaintenanceHarness({});
    const journal = prepareAutoMovieMaintenanceTransaction({
      kind: "contracts",
      rootIdentity: "root-1",
      baselinePath: "automovie/baseline.json",
      changes: [
        {
          path: "automovie/baseline.json",
          before: null,
          after: "first-baseline",
        },
      ],
      receipts: [],
      io: model.io,
    });
    const result = publish
      ? publishAutoMovieMaintenanceTransaction({ journal, io: model.io })
      : recoverAutoMovieMaintenanceTransaction({ journal, io: model.io });
    TestValidator.equals(
      "first-baseline boundary retains commit meaning",
      result.status,
      publish ? "completed" : "rolled-back",
    );
    TestValidator.equals(
      "unpublished first baseline restores absence",
      model.read("automovie/baseline.json")?.source ?? null,
      publish ? "first-baseline" : null,
    );
  }
  for (const fault of [
    "successor-readback",
    "baseline-readback",
    "committed-successor",
    "restored-predecessor",
    "baseline-competitor",
    "unexplained-gap",
    "rollback-gap",
  ] as const) {
    const model = createContractMaintenanceHarness({
      "docs/item.md": "old",
      "automovie/baseline.json": "old-baseline",
    });
    const journal = prepareAutoMovieMaintenanceTransaction({
      kind: "contracts",
      rootIdentity: "root-1",
      baselinePath: "automovie/baseline.json",
      changes: [
        {
          path: "docs/item.md",
          before: model.read("docs/item.md"),
          after: "new",
        },
        {
          path: "automovie/baseline.json",
          before: model.read("automovie/baseline.json"),
          after: "new-baseline",
        },
      ],
      receipts: [{ path: "automovie/receipt.json", source: "receipt" }],
      io: model.io,
    });
    const item = journal.changes.find(
      (change) => change.path === "docs/item.md",
    )!;
    const baseline = journal.changes.find(
      (change) => change.path === "automovie/baseline.json",
    )!;
    if (fault === "successor-readback" || fault === "baseline-readback") {
      model.state.hook = (event) => {
        if (
          event.operation === "replace" &&
          event.moment === "after" &&
          event.path ===
            (fault === "successor-readback" ? item.path : baseline.path)
        )
          model.files.set(event.path, model.file("competitor"));
      };
      TestValidator.equals(
        `${fault} refuses publication`,
        publishAutoMovieMaintenanceTransaction({ journal, io: model.io })
          .status,
        "recovery-required",
      );
      TestValidator.equals(
        `${fault} competitor is retained`,
        model.read(fault === "successor-readback" ? item.path : baseline.path)!
          .source,
        "competitor",
      );
    } else {
      model.io.replace(item.path, item.before, item.successor!);
      if (fault === "committed-successor") {
        model.io.record("automovie/receipt.json", "receipt");
        model.io.replace(baseline.path, baseline.before, baseline.successor!);
        model.files.set(item.path, model.file("competitor"));
      }
      if (fault === "baseline-competitor")
        model.files.set(baseline.path, model.file("old-baseline"));
      if (fault === "restored-predecessor")
        model.state.hook = (event) => {
          if (event.operation === "replace" && event.moment === "after")
            model.files.set(event.path, model.file("competitor"));
        };
      if (fault === "unexplained-gap" || fault === "rollback-gap") {
        const published = model.read(item.path)!;
        model.files.delete(item.path);
        model.files.delete(`${item.successor!.path}.displaced`);
        if (fault === "rollback-gap")
          model.files.set(`${item.predecessor!.path}.displaced`, published);
      }
      const result = recoverAutoMovieMaintenanceTransaction({
        journal,
        io: model.io,
      });
      TestValidator.equals(
        `${fault} has an ownership-aware result`,
        result.status,
        fault === "rollback-gap" ? "rolled-back" : "recovery-required",
      );
      if (fault === "rollback-gap")
        TestValidator.equals(
          "rollback displacement proof restores exact bytes",
          model.read(item.path)!.source,
          "old",
        );
    }
    TestValidator.equals(
      `${fault} retains only unresolved pending attempts`,
      model.state.pending !== null,
      fault !== "rollback-gap",
    );
  }
};
