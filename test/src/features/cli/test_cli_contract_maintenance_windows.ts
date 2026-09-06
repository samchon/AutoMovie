import { TestValidator } from "@nestia/e2e";
import { createWindowsMaintenanceNativeIO } from "automovie";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";

/**
 * Windows maintenance retains the exact opened source handle from approval
 * through exclusive activation and releases every retained child on failure.
 *
 * Scenarios:
 * 1. Parent-relative child reads preserve BOM bytes and reuse one held handle;
 *    activation transfers that handle, flushes it and leaves the source absent.
 * 2. Missing names and paths are absent, while access failure, linked parents,
 *    nonregular children, multiple links and changed read generations refuse.
 * 3. Uninspected sources, exchange requests, invalid UTF-8, missing records and
 *    close failures are explicit; cleanup still visits all retained handles.
 */
export const test_cli_contract_maintenance_windows = (): void => {
  type Calls = NonNullable<
    Parameters<typeof createWindowsMaintenanceNativeIO>[0]
  >;
  const create = () => {
    const source = Buffer.from("\ufeffcandidate");
    const files = new Map<string, unknown>([["from/candidate", "child"]]);
    const events: string[] = [];
    const state = {
      status: 0,
      attributes: 0x80,
      links: 1,
      parentAttributes: 0x10,
      changed: false,
      invalid: false,
      closeFailure: false,
      afterFault: "",
    };
    let inspected = 0;
    const calls: Calls = {
      openParent: (name) => name,
      openChild: (parent, name) => {
        events.push(`open:${String(parent)}/${name}`);
        return {
          handle: files.get(`${String(parent)}/${name}`),
          status:
            state.status ||
            (files.has(`${String(parent)}/${name}`) ? 0 : 0xc0000034 | 0),
        };
      },
      inspect: (handle) => {
        if (handle === "child") ++inspected;
        return {
          identity: String(handle),
          attributes:
            handle === "child"
              ? state.afterFault === "attributes" && inspected > 1
                ? 0x410
                : state.attributes
              : state.parentAttributes,
          links:
            state.afterFault === "links" && inspected > 1 ? 2 : state.links,
          size: BigInt(source.length),
          modified:
            handle === "child" && state.changed && inspected > 1 ? 2n : 1n,
        };
      },
      read: () => (state.invalid ? Buffer.from([0xff]) : source),
      rename: (handle, parent, name) => {
        files.delete("from/candidate");
        files.set(`${String(parent)}/${name}`, handle);
        events.push(`rename:${String(handle)}->${String(parent)}/${name}`);
      },
      flush: (handle) => {
        events.push(`flush:${String(handle)}`);
      },
      close: (handle) => {
        events.push(`close:${String(handle)}`);
        if (state.closeFailure) throw new Error("close failed");
      },
    };
    return {
      io: createWindowsMaintenanceNativeIO(calls),
      state,
      events,
      files,
    };
  };
  const good = create();
  const from = good.io.openParent("from");
  const to = good.io.openParent("to");
  TestValidator.equals(
    "held directory identity",
    good.io.parentIdentity(from),
    "from",
  );
  TestValidator.equals(
    "source preserves BOM",
    good.io.read(from, "candidate")!.source,
    "\ufeffcandidate",
  );
  good.io.read(from, "candidate");
  TestValidator.equals(
    "repeated reads reuse source handle",
    good.events.filter((event) => event === "open:from/candidate").length,
    1,
  );
  good.io.rename(from, "candidate", to, "final", false);
  TestValidator.equals(
    "original slot is absent",
    good.io.read(from, "candidate"),
    null,
  );
  TestValidator.equals(
    "target retains approved handle identity",
    good.io.read(to, "final")!.identity,
    "child",
  );
  good.io.flushFile(to, "final");
  good.io.sync(from);
  good.io.sync(to);
  good.io.close(from);
  good.io.close(to);
  TestValidator.equals(
    "transferred child closes once",
    good.events.filter((event) => event === "close:child").length,
    1,
  );
  TestValidator.predicate(
    "released token is no longer held",
    contractMaintenanceFailure(() => good.io.parentIdentity(from)) instanceof
      Error,
  );
  for (const status of [0xc0000034 | 0, 0xc000003a | 0, 0xc0000022 | 0]) {
    const model = create();
    model.state.status = status;
    const parent = model.io.openParent("from");
    if (status === (0xc0000022 | 0))
      TestValidator.predicate(
        "nonmissing NTSTATUS refuses",
        contractMaintenanceFailure(() =>
          model.io.read(parent, "candidate"),
        ) instanceof Error,
      );
    else
      TestValidator.equals(
        "missing child is absent",
        model.io.read(parent, "candidate"),
        null,
      );
    model.io.close(parent);
  }
  for (const attributes of [0x80, 0x410]) {
    const model = create();
    model.state.parentAttributes = attributes;
    const parent = model.io.openParent("from");
    TestValidator.predicate(
      "linked or nondirectory parent refuses",
      contractMaintenanceFailure(() =>
        model.io.parentIdentity(parent),
      ) instanceof Error,
    );
    model.io.close(parent);
  }
  for (const fault of [
    "directory",
    "link",
    "hardlink",
    "changed",
    "utf8",
    "after-attributes",
    "after-links",
  ] as const) {
    const model = create();
    model.state.attributes =
      fault === "directory" ? 0x10 : fault === "link" ? 0x400 : 0x80;
    model.state.links = fault === "hardlink" ? 2 : 1;
    model.state.changed = fault === "changed";
    model.state.invalid = fault === "utf8";
    model.state.afterFault = fault.startsWith("after-") ? fault.slice(6) : "";
    const parent = model.io.openParent("from");
    TestValidator.predicate(
      `${fault} child refuses`,
      contractMaintenanceFailure(() =>
        model.io.read(parent, "candidate"),
      ) instanceof Error,
    );
    model.io.close(parent);
    TestValidator.equals(
      "rejected child handle is retained for cleanup",
      model.events.filter((event) => event.startsWith("close:")),
      ["close:child", "close:from"],
    );
  }
  const refusal = create();
  const parent = refusal.io.openParent("from");
  for (const exchange of [false, true])
    TestValidator.predicate(
      "uninspected source or forbidden exchange refuses",
      contractMaintenanceFailure(() =>
        refusal.io.rename(parent, "candidate", parent, "final", exchange),
      ) instanceof Error,
    );
  TestValidator.predicate(
    "missing record cannot be flushed",
    contractMaintenanceFailure(() =>
      refusal.io.flushFile(parent, "missing"),
    ) instanceof Error,
  );
  refusal.io.read(parent, "candidate");
  refusal.state.closeFailure = true;
  const error = contractMaintenanceFailure(() => refusal.io.close(parent));
  TestValidator.equals(
    "all child and parent close failures survive",
    error instanceof AggregateError ? error.errors.length : 0,
    2,
  );
  TestValidator.equals(
    "close continues after first failure",
    refusal.events.filter((event) => event.startsWith("close:")),
    ["close:child", "close:from"],
  );
};
