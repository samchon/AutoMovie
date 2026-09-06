import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieMaintenanceNativeIO,
  type IAutoMovieMaintenanceRenameRequest,
  renameAutoMovieMaintenanceFile,
  syncAutoMovieMaintenanceDirectory,
  syncAutoMovieMaintenanceFile,
} from "automovie";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";

/**
 * Native maintenance retains captured parent authority through the complete
 * no-replace move, verification, synchronization and descriptor cleanup.
 *
 * Scenarios:
 * 1. An exclusive move and a preserving exchange retain exact physical file
 *    identities; malformed child names, changed parents and competitors refuse.
 * 2. Open, move, sync, readback and close failures retain their causes and
 *    release every successfully acquired parent, even after another close fails.
 * 3. A standalone directory sync verifies the captured parent before flushing.
 */
export const test_cli_contract_maintenance_native = (): void => {
  const file = {
    identity: "source-id",
    source: "candidate",
    version: "source-version",
  };
  const before = { identity: "old-id", source: "old", version: "old-version" };
  const request: IAutoMovieMaintenanceRenameRequest = {
    source: {
      parent: {
        path: "source-parent",
        real: "source-parent",
        identity: "source-parent-id",
      },
      name: "candidate",
      file,
    },
    target: {
      parent: {
        path: "target-parent",
        real: "target-parent",
        identity: "target-parent-id",
      },
      name: "final",
      file: null,
    },
  };
  const create = () => {
    let next = 0;
    const parents = new Map<number, string>();
    const files = new Map<string, typeof file>([
      ["source-parent/candidate", file],
    ]);
    const closed: number[] = [];
    const synced: number[] = [];
    const io: IAutoMovieMaintenanceNativeIO = {
      openParent: (path) => {
        const handle = ++next;
        parents.set(handle, path);
        return handle;
      },
      parentIdentity: (handle) => `${parents.get(handle)}-id`,
      read: (parent, name) =>
        files.get(`${parents.get(parent)}/${name}`) ?? null,
      rename: (source, sourceName, target, targetName, exchange) => {
        const from = `${parents.get(source)}/${sourceName}`;
        const to = `${parents.get(target)}/${targetName}`;
        const resident = files.get(to);
        if (!exchange && resident !== undefined)
          throw new Error("occupied target");
        files.set(to, files.get(from)!);
        if (exchange) files.set(from, resident!);
        else files.delete(from);
      },
      sync: (parent) => {
        synced.push(parent);
      },
      flushFile: (parent) => {
        synced.push(parent);
      },
      close: (parent) => {
        closed.push(parent);
      },
    };
    return { io, files, closed, synced };
  };
  for (const exchange of [false, true]) {
    const model = create();
    if (exchange) model.files.set("target-parent/final", before);
    renameAutoMovieMaintenanceFile(
      {
        ...request,
        target: { ...request.target, file: exchange ? before : null },
      },
      model.io,
    );
    TestValidator.equals(
      "target retains the candidate physical generation",
      model.files.get("target-parent/final"),
      file,
    );
    TestValidator.equals(
      "source retains displaced predecessor only for exchange",
      model.files.get("source-parent/candidate") ?? null,
      exchange ? before : null,
    );
    TestValidator.equals("both held parents are synced", model.synced, [1, 2]);
    TestValidator.equals(
      "both held parents close in reverse acquisition order",
      model.closed,
      [2, 1],
    );
  }
  for (const name of ["", ".", "..", "a/b", "a\\b", "a\0b", "a:b"])
    TestValidator.predicate(
      "invalid native segment refuses before acquiring parents",
      contractMaintenanceFailure(() =>
        renameAutoMovieMaintenanceFile(
          { ...request, source: { ...request.source, name } },
          create().io,
        ),
      ) instanceof Error,
    );
  for (const side of ["source", "target"] as const) {
    const model = create();
    TestValidator.predicate(
      "changed captured parent refuses",
      contractMaintenanceFailure(() =>
        renameAutoMovieMaintenanceFile(
          {
            ...request,
            [side]: {
              ...request[side],
              parent: { ...request[side].parent, identity: "different" },
            },
          },
          model.io,
        ),
      ) instanceof Error,
    );
    TestValidator.equals(
      "parent refusal closes both handles",
      model.closed,
      [2, 1],
    );
  }
  for (const field of ["identity", "source", "version"] as const) {
    const model = create();
    model.files.set("source-parent/candidate", {
      ...file,
      [field]: "different",
    });
    TestValidator.predicate(
      `${field} competitor is refused`,
      contractMaintenanceFailure(() =>
        renameAutoMovieMaintenanceFile(request, model.io),
      ) instanceof Error,
    );
  }
  const occupied = create();
  occupied.files.set("target-parent/final", before);
  TestValidator.predicate(
    "destination competitor survives",
    contractMaintenanceFailure(() =>
      renameAutoMovieMaintenanceFile(request, occupied.io),
    ) instanceof Error,
  );
  TestValidator.equals(
    "competitor was not deleted",
    occupied.files.get("target-parent/final"),
    before,
  );

  for (const operation of [
    "open",
    "source-open",
    "rename",
    "sync",
    "target-readback",
    "source-readback",
    "close",
    "combined-close",
    "undefined",
  ] as const) {
    const model = create();
    let moved = false;
    const io: IAutoMovieMaintenanceNativeIO = {
      ...model.io,
      openParent: (path) => {
        if (operation === "source-open") throw new Error("source open failed");
        if (operation === "open" && path === "target-parent")
          throw new Error("open failed");
        return model.io.openParent(path);
      },
      rename: (...args) => {
        if (operation === "undefined") {
          // eslint-disable-next-line typescript/only-throw-error -- the native boundary must retain an undefined host failure as its cause
          throw undefined;
        }
        if (operation === "rename" || operation === "combined-close")
          throw new Error("move failed");
        model.io.rename(...args);
        moved = true;
      },
      sync: (parent) => {
        if (operation === "sync") throw new Error("sync failed");
        model.io.sync(parent);
      },
      read: (parent, name) =>
        moved &&
        ((operation === "target-readback" && name === "final") ||
          (operation === "source-readback" && name === "candidate"))
          ? before
          : model.io.read(parent, name),
      close: (parent) => {
        model.io.close(parent);
        if (operation === "close" || operation === "combined-close")
          throw new Error("close failed");
      },
    };
    const error = contractMaintenanceFailure(() =>
      renameAutoMovieMaintenanceFile(request, io),
    );
    TestValidator.predicate(
      `${operation} remains a failure`,
      error instanceof Error,
    );
    if (operation === "undefined")
      TestValidator.predicate(
        "undefined move failure remains an explicit cause",
        error instanceof Error &&
          Object.hasOwn(error, "cause") &&
          error.cause === undefined,
      );
    TestValidator.equals(
      `${operation} releases every acquired parent`,
      model.closed,
      operation === "source-open" ? [] : operation === "open" ? [1] : [2, 1],
    );
  }
  const sync = create();
  syncAutoMovieMaintenanceDirectory(request.source.parent, sync.io);
  TestValidator.equals(
    "standalone parent sync holds then closes one generation",
    { synced: sync.synced, closed: sync.closed },
    { synced: [1], closed: [1] },
  );
  TestValidator.predicate(
    "standalone sync refuses changed parent",
    contractMaintenanceFailure(() =>
      syncAutoMovieMaintenanceDirectory(
        { ...request.source.parent, identity: "different" },
        create().io,
      ),
    ) instanceof Error,
  );
  const reused = create();
  syncAutoMovieMaintenanceFile(request.source, reused.io);
  TestValidator.equals(
    "reused record flush precedes directory sync and close",
    { synced: reused.synced, closed: reused.closed },
    { synced: [1, 1], closed: [1] },
  );
  for (const fault of [
    "name",
    "parent",
    "before",
    "after",
    "flush",
    "close",
    "combined",
    "undefined",
  ] as const) {
    const model = create();
    let flushed = false;
    const io: IAutoMovieMaintenanceNativeIO = {
      ...model.io,
      parentIdentity: (parent) =>
        fault === "parent" ? "wrong" : model.io.parentIdentity(parent),
      read: (parent, name) =>
        fault === "before" || (fault === "after" && flushed)
          ? before
          : model.io.read(parent, name),
      flushFile: () => {
        if (fault === "undefined") {
          // eslint-disable-next-line typescript/only-throw-error -- the reused-record boundary must retain an undefined flush failure as its cause
          throw undefined;
        }
        if (fault === "flush" || fault === "combined")
          throw new Error("flush failed");
        flushed = true;
      },
      close: (parent) => {
        model.io.close(parent);
        if (fault === "close" || fault === "combined")
          throw new Error("close failed");
      },
    };
    const error = contractMaintenanceFailure(() =>
      syncAutoMovieMaintenanceFile(
        {
          ...request.source,
          name: fault === "name" ? "../outside" : request.source.name,
        },
        io,
      ),
    );
    TestValidator.predicate(
      `${fault} reused record refuses`,
      error instanceof Error,
    );
    if (fault === "undefined")
      TestValidator.predicate(
        "undefined flush failure remains an explicit cause",
        error instanceof Error &&
          Object.hasOwn(error, "cause") &&
          error.cause === undefined,
      );
    TestValidator.equals(
      `${fault} reused record closes its held parent`,
      model.closed,
      fault === "name" ? [] : [1],
    );
    if (fault === "combined")
      TestValidator.equals(
        "flush and close failures both survive",
        (error as AggregateError).errors.length,
        2,
      );
  }
};
