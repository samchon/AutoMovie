import { TestValidator } from "@nestia/e2e";
import {
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
} from "automovie";

import {
  createContractMaintenanceHarness,
  failContractMaintenanceEvent,
} from "../internal/contractMaintenanceHarness";

/**
 * Every pre-commit failure retains or restores all predecessor bytes, including
 * faults reported after a physical operation has already completed.
 *
 * Scenarios:
 * 1. Each target replacement, receipt, retirement and baseline event fails
 *    before its effect and after its effect; recovery preserves the exact
 *    original or recognizes a baseline that already committed.
 * 2. A delivery TOC commit-marker and finish failure distinguish an uncommitted
 *    change from a durably committed change without inventing a baseline.
 */
export const test_cli_contract_maintenance_failures = (): void => {
  for (const [operation, path] of [
    ["replace", "docs/create.md"],
    ["replace", "docs/replace.md"],
    ["displace", "docs/replace.md"],
    ["record", "automovie/receipt.json"],
    ["retire", "docs/source.md"],
    ["replace", "automovie/baseline.json"],
    ["displace", "automovie/baseline.json"],
  ] as const)
    for (const moment of ["before", "after"] as const) {
      const harness = createContractMaintenanceHarness({
        "automovie/baseline.json": "old-baseline",
        "docs/replace.md": "old",
        "docs/source.md": "rename",
      });
      const original = Object.fromEntries(harness.files);
      const journal = prepareAutoMovieMaintenanceTransaction({
        kind: "contracts",
        rootIdentity: "root-1",
        baselinePath: "automovie/baseline.json",
        changes: [
          { path: "docs/create.md", before: null, after: "new" },
          {
            path: "docs/replace.md",
            before: harness.read("docs/replace.md"),
            after: "replacement",
          },
          {
            path: "docs/source.md",
            before: harness.read("docs/source.md"),
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
      const fired = failContractMaintenanceEvent(
        harness,
        operation,
        path,
        moment,
      );
      const outcome = publishAutoMovieMaintenanceTransaction({
        journal,
        io: harness.io,
      });
      const committed =
        operation === "replace" &&
        path === "automovie/baseline.json" &&
        moment === "after";
      const label = `${operation} ${path} ${moment}`;
      TestValidator.predicate(`${label} really injects its fault`, fired());
      TestValidator.equals(
        `${label} has an explicit recovered outcome`,
        outcome.status,
        committed ? "completed" : "rolled-back",
      );
      TestValidator.predicate(
        `${label} preserves original diagnostic`,
        outcome.error instanceof Error,
      );
      if (!committed)
        TestValidator.equals(
          `${label} restores original bytes and absence`,
          [...Object.keys(original), "docs/create.md"].map(
            (target) => harness.read(target)?.source ?? null,
          ),
          [...Object.values(original).map(({ source }) => source), null],
        );
      TestValidator.equals(
        `${label} resolves the pending attempt`,
        harness.state.pending,
        null,
      );
    }

  for (const unchangedBaseline of [false, true])
    for (const operation of ["record", "finish"] as const)
      for (const moment of ["before", "after"] as const) {
        const harness = createContractMaintenanceHarness({
          "docs/index.md": "old",
          ...(unchangedBaseline ? { "automovie/baseline.json": "same" } : {}),
        });
        const journal = prepareAutoMovieMaintenanceTransaction({
          kind: "toc",
          rootIdentity: "root-1",
          baselinePath: unchangedBaseline ? "automovie/baseline.json" : null,
          changes: [
            {
              path: "docs/index.md",
              before: harness.read("docs/index.md"),
              after: "new",
            },
            ...(unchangedBaseline
              ? [
                  {
                    path: "automovie/baseline.json",
                    before: harness.read("automovie/baseline.json"),
                    after: "same",
                  },
                ]
              : []),
          ],
          receipts: [],
          io: harness.io,
        });
        const path =
          operation === "record"
            ? `automovie/contract-migrations/${journal.id}/committed.json`
            : journal.id;
        const fired = failContractMaintenanceEvent(
          harness,
          operation,
          path,
          moment,
        );
        const result = publishAutoMovieMaintenanceTransaction({
          journal,
          io: harness.io,
        });
        TestValidator.predicate(`${operation} ${moment} fault fired`, fired());
        const committed = operation === "finish" || moment === "after";
        TestValidator.equals(
          `${operation} ${moment} respects the durable TOC commit`,
          result.status,
          committed ? "completed" : "rolled-back",
        );
        TestValidator.equals(
          `${operation} ${moment} preserves the proper TOC generation`,
          harness.read("docs/index.md")!.source,
          committed ? "new" : "old",
        );
      }
};
