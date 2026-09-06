import koffi, { type TypeObject } from "koffi";
import * as path from "node:path";

import type { IAutoMovieMaintenanceNativeIO } from "./contractMaintenanceNative";
import type { IAutoMovieMaintenanceFile } from "./contractMaintenanceTransaction";

interface IWindowsInformation {
  identity: string;
  attributes: number;
  links: number;
  size: bigint;
  modified: bigint;
}

interface IWindowsMaintenanceCalls {
  openParent(path: string): unknown;
  openChild(parent: unknown, name: string): { handle: unknown; status: number };
  inspect(handle: unknown): IWindowsInformation;
  read(handle: unknown, size: number): Buffer;
  rename(handle: unknown, parent: unknown, name: string): void;
  flush(handle: unknown): void;
  close(handle: unknown): void;
}

interface IParent {
  handle: unknown;
  children: Map<string, unknown>;
}

/**
 * Windows source-handle movement with exclusive destination authority.
 * Child handles deny write and delete sharing and remain held from inspection
 * through rename, flush and verification. `RootDirectory` binds both child
 * acquisition and destination naming; no child operation reopens an absolute
 * path. FileRenameInformation uses ReplaceIfExists=false.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains the exact approved Windows source handle and refuses occupied destinations without unlinking competitors.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Implements preserving source-to-archive and candidate activation through parent-relative native handles.
 */
export const createWindowsMaintenanceNativeIO = (
  calls: IWindowsMaintenanceCalls = windowsCalls(),
): IAutoMovieMaintenanceNativeIO => {
  const parents = new Map<number, IParent>();
  let next = 0;
  const owner = (token: number): IParent => {
    const parent = parents.get(token);
    if (parent === undefined)
      throw new Error("Maintenance Windows parent handle is not held.");
    return parent;
  };
  const readChild = (
    parent: IParent,
    name: string,
  ): IAutoMovieMaintenanceFile | null => {
    let handle = parent.children.get(name);
    if (handle === undefined) {
      const opened = calls.openChild(parent.handle, name);
      if (
        opened.status === (0xc0000034 | 0) ||
        opened.status === (0xc000003a | 0)
      )
        return null;
      if (opened.status < 0)
        throw new Error(
          `Maintenance Windows child open failed with NTSTATUS ${opened.status}.`,
        );
      handle = opened.handle;
      parent.children.set(name, handle);
    }
    const before = calls.inspect(handle);
    if ((before.attributes & 0x410) !== 0 || before.links !== 1)
      throw new Error(
        "Maintenance Windows source is not one ordinary single-link file.",
      );
    const source = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(calls.read(handle, Number(before.size)));
    const after = calls.inspect(handle);
    const version = (info: IWindowsInformation): string =>
      `${info.identity}:${info.size}:${info.modified}`;
    if (
      (after.attributes & 0x410) !== 0 ||
      after.links !== 1 ||
      version(before) !== version(after)
    )
      throw new Error(
        "Maintenance Windows source changed during its held read.",
      );
    return { identity: after.identity, source, version: version(after) };
  };
  return {
    openParent: (target) => {
      const token = ++next;
      parents.set(token, {
        handle: calls.openParent(target),
        children: new Map(),
      });
      return token;
    },
    parentIdentity: (token) => {
      const info = calls.inspect(owner(token).handle);
      if ((info.attributes & 0x410) !== 0x10)
        throw new Error(
          "Maintenance Windows parent is linked or not a directory.",
        );
      return info.identity;
    },
    read: (token, name) => readChild(owner(token), name),
    rename: (sourceToken, sourceName, targetToken, targetName, exchange) => {
      if (exchange)
        throw new Error(
          "Windows maintenance requires preserving displacement followed by exclusive activation.",
        );
      const source = owner(sourceToken);
      const target = owner(targetToken);
      const handle = source.children.get(sourceName);
      if (handle === undefined)
        throw new Error(
          "Maintenance Windows source was not inspected through its held handle.",
        );
      calls.rename(handle, target.handle, targetName);
      source.children.delete(sourceName);
      target.children.set(targetName, handle);
      calls.flush(handle);
    },
    sync: (token) => {
      const parent = owner(token);
      for (const handle of parent.children.values()) calls.flush(handle);
      calls.flush(parent.handle);
    },
    flushFile: (token, name) => {
      const parent = owner(token);
      if (readChild(parent, name) === null)
        throw new Error("Maintenance Windows record disappeared before flush.");
      calls.flush(parent.children.get(name));
    },
    close: (token) => {
      const parent = owner(token);
      parents.delete(token);
      const failures: unknown[] = [];
      for (const handle of [...parent.children.values(), parent.handle])
        try {
          calls.close(handle);
        } catch (error) {
          failures.push(error);
        }
      if (failures.length !== 0)
        throw new AggregateError(
          failures,
          "Maintenance Windows handle close failed.",
        );
    },
  };
};

const cached = new WeakMap<typeof koffi, IWindowsMaintenanceCalls>();

const windowsCalls = (
  foreign: typeof koffi = koffi,
): IWindowsMaintenanceCalls => {
  const previous = cached.get(foreign);
  if (previous !== undefined) return previous;
  const kernel = foreign.load("kernel32.dll");
  const ntdll = foreign.load("ntdll.dll");
  const unicode = foreign.struct("AutoMovieMaintenanceUnicode", {
    Length: "uint16_t",
    MaximumLength: "uint16_t",
    Buffer: "void *",
  });
  const attributes = foreign.struct("AutoMovieMaintenanceObjectAttributes", {
    Length: "uint32_t",
    RootDirectory: "void *",
    ObjectName: foreign.pointer(unicode),
    Attributes: "uint32_t",
    SecurityDescriptor: "void *",
    SecurityQualityOfService: "void *",
  });
  const ioStatus = foreign.struct("AutoMovieMaintenanceIoStatus", {
    Status: "intptr_t",
    Information: "uintptr_t",
  });
  const fileTime = foreign.struct("AutoMovieMaintenanceFileTime", {
    low: "uint32_t",
    high: "uint32_t",
  });
  const information = foreign.struct("AutoMovieMaintenanceFileInformation", {
    attributes: "uint32_t",
    creation: fileTime,
    access: fileTime,
    write: fileTime,
    volume: "uint32_t",
    sizeHigh: "uint32_t",
    sizeLow: "uint32_t",
    links: "uint32_t",
    indexHigh: "uint32_t",
    indexLow: "uint32_t",
  });
  const createFile = kernel.func(
    "void * __stdcall CreateFileW(str16 path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)",
  );
  const lastError = kernel.func("uint32_t __stdcall GetLastError(void)");
  const close = kernel.func("bool __stdcall CloseHandle(void *handle)");
  const flush = kernel.func("bool __stdcall FlushFileBuffers(void *handle)");
  const inspect = kernel.func(
    "__stdcall",
    "GetFileInformationByHandle",
    "bool",
    ["void *", foreign.out(foreign.pointer(information))],
  );
  const create = ntdll.func("__stdcall", "NtCreateFile", "int32_t", [
    foreign.out(foreign.pointer("void *")),
    "uint32_t",
    foreign.pointer(attributes),
    foreign.out(foreign.pointer(ioStatus)),
    "int64_t *",
    "uint32_t",
    "uint32_t",
    "uint32_t",
    "uint32_t",
    "void *",
    "uint32_t",
  ]);
  const setInformation = ntdll.func(
    "__stdcall",
    "NtSetInformationFile",
    "int32_t",
    [
      "void *",
      foreign.out(foreign.pointer(ioStatus)),
      "void *",
      "uint32_t",
      "uint32_t",
    ],
  );
  const seek = kernel.func(
    "bool __stdcall SetFilePointerEx(void *handle, int64_t distance, void *position, uint32_t method)",
  );
  const read = kernel.func("__stdcall", "ReadFile", "bool", [
    "void *",
    "void *",
    "uint32_t",
    foreign.out(foreign.pointer("uint32_t")),
    "void *",
  ]);
  const renameTypes = new Map<number, TypeObject>();
  const checked = (success: boolean, operation: string): void => {
    if (!success)
      throw new Error(
        `${operation} failed with Windows error ${Number(lastError())}.`,
      );
  };
  const combine = (high: number, low: number): bigint =>
    (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
  const calls: IWindowsMaintenanceCalls = {
    openParent: (target) => {
      const handle: unknown = createFile(
        path.toNamespacedPath(target),
        0xc0100080,
        0x7,
        null,
        3,
        0x82200000,
        null,
      );
      if (
        handle === null ||
        foreign.address(handle) === 0xffffffffffffffffn ||
        foreign.address(handle) === 0xffffffffn
      )
        throw new Error(
          `Maintenance Windows parent open failed with error ${Number(lastError())}.`,
        );
      return handle;
    },
    openChild: (parent, name) => {
      const bytes = Buffer.from(`${name}\0`, "utf16le");
      const output: unknown[] = [null];
      const status = Number(
        create(
          output,
          0x0013019f,
          {
            Length: foreign.sizeof(attributes),
            RootDirectory: parent,
            ObjectName: {
              Length: bytes.length - 2,
              MaximumLength: bytes.length,
              Buffer: bytes,
            },
            Attributes: 0x1040,
            SecurityDescriptor: null,
            SecurityQualityOfService: null,
          },
          { Status: 0n, Information: 0n },
          null,
          0x80,
          0x1,
          0x1,
          0x00200062,
          null,
          0,
        ),
      );
      return { handle: output[0], status };
    },
    inspect: (handle) => {
      const time = { low: 0, high: 0 };
      const output = {
        attributes: 0,
        creation: { ...time },
        access: { ...time },
        write: { ...time },
        volume: 0,
        sizeHigh: 0,
        sizeLow: 0,
        links: 0,
        indexHigh: 0,
        indexLow: 0,
      };
      checked(
        Boolean(inspect(handle, output)),
        "Maintenance Windows information",
      );
      return {
        identity: `${BigInt(output.volume >>> 0)}:${combine(output.indexHigh, output.indexLow)}`,
        attributes: output.attributes,
        links: output.links,
        size: combine(output.sizeHigh, output.sizeLow),
        modified:
          (combine(output.write.high, output.write.low) - 116444736000000000n) *
          100n,
      };
    },
    read: (handle, size) => {
      checked(Boolean(seek(handle, 0n, null, 0)), "Maintenance Windows seek");
      const output = Buffer.alloc(size);
      let offset = 0;
      while (offset < size) {
        const count = [0];
        checked(
          Boolean(
            read(
              handle,
              output.subarray(offset),
              Math.min(size - offset, 0xffffffff),
              count,
              null,
            ),
          ),
          "Maintenance Windows read",
        );
        if (count[0] === 0)
          throw new Error("Maintenance Windows file ended during readback.");
        offset += count[0]!;
      }
      return output;
    },
    rename: (handle, parent, name) => {
      const units = [...Buffer.from(name, "utf16le")];
      let type = renameTypes.get(units.length);
      if (type === undefined) {
        type = foreign.struct({
          ReplaceIfExists: "uint32_t",
          RootDirectory: "void *",
          FileNameLength: "uint32_t",
          FileName: foreign.array("uint8_t", units.length),
        });
        renameTypes.set(units.length, type);
      }
      const buffer = Buffer.alloc(foreign.sizeof(type));
      foreign.encode(buffer, type, {
        ReplaceIfExists: 0,
        RootDirectory: parent,
        FileNameLength: units.length,
        FileName: units,
      });
      const result = Number(
        setInformation(
          handle,
          { Status: 0n, Information: 0n },
          buffer,
          buffer.length,
          10,
        ),
      );
      if (result < 0)
        throw new Error(
          `Maintenance Windows exclusive rename failed with NTSTATUS ${result}.`,
        );
    },
    flush: (handle) =>
      checked(Boolean(flush(handle)), "Maintenance Windows flush"),
    close: (handle) =>
      checked(Boolean(close(handle)), "Maintenance Windows close"),
  };
  cached.set(foreign, calls);
  return calls;
};

/**
 * Injectable Windows foreign-call adapter for pure handle-protocol tests.
 * @internal
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Makes native read, rename, flush and cleanup failures independently observable.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Exposes adapter-owned handle flags, generation normalization and complete-read transitions without an OS fixture.
 */
export const contractMaintenanceWindowsForTesting = { calls: windowsCalls };
