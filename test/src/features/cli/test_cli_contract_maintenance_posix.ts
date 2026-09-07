import { TestValidator } from "@nestia/e2e";
import {
  contractMaintenanceNativeForTesting,
  createWindowsMaintenanceNativeIO,
} from "automovie";
import * as fs from "node:fs";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";

/**
 * POSIX maintenance translates held-parent operations without a pathname
 * mutation fallback, retaining descriptor versions and explicit native errors.
 *
 * Scenarios:
 * 1. Linux and Darwin choose native no-replace/exchange effects, preserve BOM
 *    bytes and physical generations, and close each read and flush descriptor.
 * 2. Missing children are absent; other native failures, nonordinary children,
 *    multiple links, changed reads and invalid UTF-8 refuse before acceptance.
 * 3. Unsupported platforms refuse while Windows dispatch uses its own HANDLE
 *    adapter, never Node's POSIX descriptor operations.
 */
export const test_cli_contract_maintenance_posix = (): void => {
  type Environment = NonNullable<
    Parameters<typeof contractMaintenanceNativeForTesting.create>[0]
  >;
  const create = (platform: NodeJS.Platform) => {
    const state = {
      errno: 2,
      descriptor: 11,
      rename: 0,
      directory: true,
      regular: true,
      links: 1n,
      changed: false,
      invalid: false,
      afterFault: "",
    };
    const events: unknown[][] = [];
    let reads = 0;
    const fileSystem = {
      constants: { O_RDONLY: 0, O_DIRECTORY: 0x10000, O_NOFOLLOW: 0x20000 },
      openSync: (target: string, flags: number) => {
        events.push(["parent", target, flags]);
        return 10;
      },
      fstatSync: (descriptor: number) => {
        if (descriptor === 11) ++reads;
        return {
          dev: 7n,
          ino: 8n,
          size: 12n,
          mtimeNs: state.changed && reads > 1 ? 2n : 1n,
          nlink: state.afterFault === "links" && reads > 1 ? 2n : state.links,
          isDirectory: () => state.directory,
          isFile: () =>
            !(state.afterFault === "regular" && reads > 1) && state.regular,
        };
      },
      readFileSync: () =>
        state.invalid ? Buffer.from([0xff]) : Buffer.from("\ufeffcandidate"),
      closeSync: (descriptor: number) => {
        events.push(["close", descriptor]);
      },
      fsyncSync: (descriptor: number) => {
        events.push(["sync", descriptor]);
      },
    } as unknown as typeof fs;
    const input: Environment = {
      platform,
      fileSystem,
      foreign: {
        os: { errno: { ENOENT: 2 } },
        errno: () => state.errno,
        load: () => ({
          func: (declaration: string) =>
            declaration.includes("openat")
              ? (...args: unknown[]) => {
                  events.push(["openat", ...args]);
                  return state.descriptor;
                }
              : (...args: unknown[]) => {
                  events.push(["rename", ...args]);
                  return state.rename;
                },
        }),
      } as unknown as Environment["foreign"],
      windows: () => {
        throw new Error("not Windows");
      },
    };
    return { input, state, events };
  };
  for (const platform of ["linux", "darwin"] as const) {
    const model = create(platform);
    const io = contractMaintenanceNativeForTesting.create(model.input);
    TestValidator.equals(
      "ordinary held directory identity",
      io.parentIdentity(io.openParent("parent")),
      "7:8",
    );
    TestValidator.equals(
      "strict source and Unix modification version",
      io.read(10, "candidate"),
      {
        identity: "7:8",
        source: "\ufeffcandidate",
        version: "7:8:12:1",
      },
    );
    io.rename(10, "candidate", 12, "final", false);
    io.rename(10, "candidate", 12, "final", true);
    io.flushFile(10, "record");
    io.sync(10);
    io.close(10);
    TestValidator.equals(
      "platform-exclusive rename authorities",
      model.events
        .filter((event) => event[0] === "rename")
        .map((event) => event[5]),
      [platform === "linux" ? 1 : 4, 2],
    );
    TestValidator.equals(
      "read and flush both release child descriptor",
      model.events.filter((event) => event[0] === "close"),
      [
        ["close", 11],
        ["close", 11],
        ["close", 10],
      ],
    );
    TestValidator.predicate(
      "child open never follows a leaf",
      model.events
        .filter((event) => event[0] === "openat")
        .every((event) => (Number(event[3]) & 0x20000) === 0x20000),
    );
  }
  for (const fault of [
    "missing",
    "open",
    "parent",
    "regular",
    "links",
    "changed",
    "utf8",
    "rename",
    "flush",
    "after-regular",
    "after-links",
  ] as const) {
    const model = create("linux");
    model.state.descriptor = ["missing", "open", "flush"].includes(fault)
      ? -1
      : 11;
    model.state.errno = fault === "missing" ? 2 : 13;
    model.state.directory = fault !== "parent";
    model.state.regular = fault !== "regular";
    model.state.links = fault === "links" ? 2n : 1n;
    model.state.changed = fault === "changed";
    model.state.invalid = fault === "utf8";
    model.state.rename = fault === "rename" ? -1 : 0;
    model.state.afterFault = fault.startsWith("after-") ? fault.slice(6) : "";
    const io = contractMaintenanceNativeForTesting.create(model.input);
    if (fault === "missing")
      TestValidator.equals(
        "only ENOENT becomes absence",
        io.read(10, "candidate"),
        null,
      );
    else
      TestValidator.predicate(
        `${fault} is not accepted`,
        contractMaintenanceFailure(() => {
          if (fault === "parent") io.parentIdentity(10);
          else if (fault === "rename") io.rename(10, "a", 12, "b", false);
          else if (fault === "flush") io.flushFile(10, "record");
          else io.read(10, "candidate");
        }) instanceof Error,
      );
  }
  const windows = createWindowsMaintenanceNativeIO({
    openParent: () => 0,
    openChild: () => ({ handle: 0, status: 0 }),
    inspect: () => ({
      identity: "unused",
      attributes: 0x10,
      links: 1,
      size: 0n,
      modified: 0n,
    }),
    read: () => Buffer.alloc(0),
    rename: () => {},
    flush: () => {},
    close: () => {},
  });
  TestValidator.equals(
    "Windows dispatch is independent of POSIX",
    contractMaintenanceNativeForTesting.create({
      ...create("win32").input,
      windows: () => windows,
    }),
    windows,
  );
  TestValidator.predicate(
    "unsupported platform refuses before native calls",
    contractMaintenanceFailure(() =>
      contractMaintenanceNativeForTesting.create(create("freebsd").input),
    ) instanceof Error,
  );
};
