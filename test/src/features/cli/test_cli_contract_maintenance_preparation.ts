import { TestValidator } from "@nestia/e2e";
import { prepareAutoMovieMaintenanceTransaction } from "automovie";

import {
  contractMaintenanceFailure,
  createContractMaintenanceHarness,
} from "../internal/contractMaintenanceHarness";

/**
 * Preparation never gains authority from bytes observed after planning and
 * never mutates a current target when an archive or pending record fails.
 *
 * Scenarios:
 * 1. Duplicate slots, absent-source retirement and an omitted baseline refuse
 *    before mutation; a normal single creation remains admissible.
 * 2. Preexisting and during-staging competitors remain untouched, including
 *    a physically new resident containing the same bytes.
 * 3. Failed or incorrect archive bytes and a conflicting pending owner leave
 *    original files intact; caller mutation cannot change a prepared journal.
 */
export const test_cli_contract_maintenance_preparation = (): void => {
  const harness = createContractMaintenanceHarness({ "docs/one.md": "before" });
  const change = {
    path: "docs/one.md",
    before: harness.read("docs/one.md"),
    after: "after",
  };
  const base = {
    kind: "toc" as const,
    rootIdentity: "root-1",
    baselinePath: null,
    changes: [change],
    receipts: [],
    io: harness.io,
  };
  for (const props of [
    { ...base, changes: [change, change] },
    {
      ...base,
      changes: [{ path: "docs/absent.md", before: null, after: null }],
    },
    { ...base, baselinePath: "automovie/missing.json" },
    { ...base, changes: [{ ...change, before: null }] },
    {
      ...base,
      changes: [{ ...change, before: { ...change.before!, version: "older" } }],
    },
  ])
    TestValidator.predicate(
      "invalid preparation refuses",
      contractMaintenanceFailure(() =>
        prepareAutoMovieMaintenanceTransaction(props),
      ) instanceof Error,
    );
  TestValidator.equals(
    "invalid preparation leaves originals intact",
    harness.read(change.path)!.source,
    "before",
  );

  for (const event of ["stage", "record", "begin"] as const) {
    const attempt = createContractMaintenanceHarness({
      "docs/one.md": "before",
    });
    attempt.state.hook = (entry) => {
      if (entry.operation === event && entry.moment === "before")
        throw new Error(`${event} failed`);
    };
    TestValidator.predicate(
      `${event} failure is preserved`,
      contractMaintenanceFailure(() =>
        prepareAutoMovieMaintenanceTransaction({
          ...base,
          changes: [{ ...change, before: attempt.read(change.path) }],
          io: attempt.io,
        }),
      ) instanceof Error,
    );
    TestValidator.equals(
      `${event} failure leaves original bytes`,
      attempt.read(change.path)!.source,
      "before",
    );
  }
  const wrong = createContractMaintenanceHarness({ "docs/one.md": "before" });
  TestValidator.predicate(
    "wrong archive bytes refuse",
    contractMaintenanceFailure(() =>
      prepareAutoMovieMaintenanceTransaction({
        ...base,
        io: { ...wrong.io, stage: () => wrong.file("different") },
      }),
    ) instanceof Error,
  );

  const competitor = createContractMaintenanceHarness({
    "docs/one.md": "before",
  });
  const observed = competitor.read(change.path);
  competitor.state.hook = (entry) => {
    if (entry.operation === "stage" && entry.moment === "after")
      competitor.files.set(change.path, competitor.file("competitor"));
  };
  TestValidator.predicate(
    "competitor during archive writes refuses",
    contractMaintenanceFailure(() =>
      prepareAutoMovieMaintenanceTransaction({
        ...base,
        changes: [{ ...change, before: observed }],
        io: competitor.io,
      }),
    ) instanceof Error,
  );
  TestValidator.equals(
    "competitor bytes survive",
    competitor.read(change.path)!.source,
    "competitor",
  );

  const frozen = createContractMaintenanceHarness({ "docs/one.md": "before" });
  const mutable = {
    path: change.path,
    before: { ...frozen.read(change.path)! },
    after: "after",
  };
  const receipt = {
    path: "automovie/receipt.json",
    source: "approved-receipt",
  };
  frozen.state.hook = (event) => {
    if (event.operation === "stage") receipt.source = "changed-by-caller";
  };
  const journal = prepareAutoMovieMaintenanceTransaction({
    ...base,
    changes: [mutable],
    receipts: [receipt],
    io: frozen.io,
  });
  mutable.before.source = "edited-by-caller";
  mutable.after = "changed-successor";
  TestValidator.equals(
    "journal owns a stable copy of planner input",
    [journal.changes[0]!.before!.source, journal.changes[0]!.after],
    ["before", "after"],
  );
  TestValidator.equals(
    "receipt is fixed before the first IO effect",
    journal.receipts[0]!.source,
    "approved-receipt",
  );
  const other = createContractMaintenanceHarness({ "docs/one.md": "before" });
  other.state.pending = journal;
  TestValidator.predicate(
    "another pending attempt blocks preparation",
    contractMaintenanceFailure(() =>
      prepareAutoMovieMaintenanceTransaction({
        ...base,
        changes: [{ ...change, after: "another" }],
        io: other.io,
      }),
    ) instanceof Error,
  );
};
