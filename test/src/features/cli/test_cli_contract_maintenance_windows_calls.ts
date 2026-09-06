import { TestValidator } from "@nestia/e2e";
import { contractMaintenanceWindowsForTesting } from "automovie";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";

/**
 * The Windows adapter owns exact HANDLE flags, FILETIME normalization and
 * complete-read/rename outcomes; foreign-library behavior is injected, trusted.
 *
 * Scenarios:
 * 1. Parent and relative child acquisition preserve native authority, FILETIME
 *    becomes Unix nanoseconds, partial reads complete, and rename forbids replace.
 * 2. Empty reads need no ReadFile call; null and both invalid-handle widths,
 *    API failures, early EOF and failed NT rename remain explicit errors.
 * 3. Repeated adapters and same-width rename records reuse their declarations.
 */
export const test_cli_contract_maintenance_windows_calls = (): void => {
  type Foreign = NonNullable<
    Parameters<typeof contractMaintenanceWindowsForTesting.calls>[0]
  >;
  const events: { name: string; args: unknown[] }[] = [];
  const state = {
    fail: "",
    invalid: 0n,
    nullHandle: false,
    eof: false,
    chunk: 2,
    encoded: null as unknown,
  };
  const invoke = (name: string, args: unknown[]): unknown => {
    events.push({ name, args });
    if (name === "GetLastError") return 5;
    if (name === "CreateFileW")
      return state.nullHandle ? null : { handle: "parent" };
    if (name === "NtCreateFile") {
      (args[0] as unknown[])[0] = "child";
      return -1;
    }
    if (name === "NtSetInformationFile") return state.fail === name ? -1 : 0;
    if (name === state.fail) return false;
    if (name === "GetFileInformationByHandle") {
      const time = 116444736000000001n;
      Object.assign(args[1] as object, {
        volume: 7,
        indexHigh: 1,
        indexLow: 2,
        sizeHigh: 0,
        sizeLow: 3,
        links: 1,
        attributes: 0x80,
        write: { high: Number(time >> 32n), low: Number(time & 0xffffffffn) },
      });
    }
    if (name === "ReadFile") {
      const count = state.eof ? 0 : Math.min(Number(args[2]), state.chunk);
      (args[1] as Buffer).fill(0x61, 0, count);
      (args[3] as number[])[0] = count;
    }
    return true;
  };
  const foreign = {
    load: () => ({
      func: (...declaration: unknown[]) => {
        const name =
          declaration.length === 1
            ? String(declaration[0]).match(/([A-Za-z0-9_]+)\(/u)![1]!
            : String(declaration[1]);
        return (...args: unknown[]) => invoke(name, args);
      },
    }),
    struct: (...args: unknown[]) => {
      events.push({ name: "struct", args });
      return {};
    },
    pointer: (type: unknown) => type,
    out: (type: unknown) => type,
    array: (_type: unknown, length: number) => length,
    sizeof: () => 64,
    address: () => state.invalid,
    encode: (_buffer: Buffer, _type: unknown, value: unknown) => {
      state.encoded = value;
    },
  } as unknown as Foreign;
  const calls = contractMaintenanceWindowsForTesting.calls(foreign);
  TestValidator.equals(
    "adapter declarations are cached",
    contractMaintenanceWindowsForTesting.calls(foreign),
    calls,
  );
  const parent = calls.openParent("parent");
  const child = calls.openChild(parent, "child");
  TestValidator.equals(
    "NTSTATUS is preserved for protocol adjudication",
    child,
    { handle: "child", status: -1 },
  );
  const create = events.find((event) => event.name === "NtCreateFile")!;
  TestValidator.equals(
    "relative root is the exact held parent",
    (create.args[2] as { RootDirectory: unknown }).RootDirectory,
    parent,
  );
  TestValidator.equals(
    "existing source opens without write/delete sharing",
    create.args[6],
    1,
  );
  TestValidator.equals(
    "native identity and FILETIME normalize independently",
    calls.inspect("child"),
    {
      identity: "7:4294967298",
      attributes: 0x80,
      links: 1,
      size: 3n,
      modified: 100n,
    },
  );
  TestValidator.equals(
    "partial native reads complete exactly",
    calls.read("child", 5).toString(),
    "aaaaa",
  );
  const reads = events.filter((event) => event.name === "ReadFile").length;
  TestValidator.equals(
    "empty source returns exact empty bytes",
    calls.read("child", 0).length,
    0,
  );
  TestValidator.equals(
    "empty source performs no byte read",
    events.filter((event) => event.name === "ReadFile").length,
    reads,
  );
  calls.rename("child", parent, "target");
  const structs = events.filter((event) => event.name === "struct").length;
  calls.rename("child", parent, "target");
  TestValidator.equals(
    "same-size rename declaration reused",
    events.filter((event) => event.name === "struct").length,
    structs,
  );
  const rename = state.encoded as {
    ReplaceIfExists: number;
    RootDirectory: unknown;
    FileNameLength: number;
    FileName: number[];
  };
  TestValidator.equals(
    "rename has no competitor replacement authority",
    rename.ReplaceIfExists,
    0,
  );
  TestValidator.equals(
    "rename remains parent-relative",
    rename.RootDirectory,
    parent,
  );
  TestValidator.equals(
    "rename carries exact UTF-16 bytes",
    Buffer.from(rename.FileName).toString("utf16le"),
    "target",
  );
  calls.flush("child");
  calls.close("child");
  for (const invalid of [0xffffffffn, 0xffffffffffffffffn]) {
    state.invalid = invalid;
    TestValidator.predicate(
      "invalid native parent handle refuses",
      contractMaintenanceFailure(() => calls.openParent("parent")) instanceof
        Error,
    );
  }
  state.invalid = 0n;
  state.nullHandle = true;
  TestValidator.predicate(
    "null native parent handle refuses",
    contractMaintenanceFailure(() => calls.openParent("parent")) instanceof
      Error,
  );
  state.nullHandle = false;
  for (const fail of [
    "GetFileInformationByHandle",
    "SetFilePointerEx",
    "ReadFile",
    "NtSetInformationFile",
    "FlushFileBuffers",
    "CloseHandle",
  ]) {
    state.fail = fail;
    TestValidator.predicate(
      `${fail} failure survives`,
      contractMaintenanceFailure(() => {
        if (fail === "GetFileInformationByHandle") calls.inspect("child");
        else if (fail === "SetFilePointerEx" || fail === "ReadFile")
          calls.read("child", 3);
        else if (fail === "NtSetInformationFile")
          calls.rename("child", parent, "target");
        else if (fail === "FlushFileBuffers") calls.flush("child");
        else calls.close("child");
      }) instanceof Error,
    );
  }
  state.fail = "";
  state.eof = true;
  TestValidator.predicate(
    "early EOF cannot approve partial bytes",
    contractMaintenanceFailure(() => calls.read("child", 3)) instanceof Error,
  );
};
