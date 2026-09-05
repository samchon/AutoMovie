import {
  type IScaffoldParentPublicationRequest,
  nativeScaffoldPublicationForTesting,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";

type NativeEnvironmentProps = Parameters<
  typeof nativeScaffoldPublicationForTesting.createEnvironment
>[0];

interface INativeScenario {
  childCloseFails?: boolean;
  childHandleInvalid?: boolean;
  childInspectFails?: boolean;
  childIsFile?: boolean;
  childIsLink?: boolean;
  childLinks?: bigint;
  closeFails?: ReadonlySet<number>;
  constantsMissing?: string;
  createThrows?: boolean;
  errno?: number;
  finalSizeDelta?: bigint;
  fsyncFails?: boolean;
  parentIdentity?: string;
  parentCloseFails?: boolean;
  parentFstatFails?: boolean;
  parentIsDirectory?: boolean;
  parentOpen?: "fail" | "invalid" | "null" | "ok";
  platform: NodeJS.Platform;
  read?: "fail" | "mismatch" | "stop" | "success";
  residentCloseFails?: boolean;
  residentHandleInvalid?: boolean;
  residentIdentity?: string;
  residentInspectThrowsValue?: boolean;
  residentOpenFails?: boolean;
  residentVersionChangesAfterClose?: boolean;
  seekFails?: boolean;
  target?: "competitor" | "create-failed" | "ok";
  write?: "fail" | "stop" | "success";
}

interface IFakeNode {
  bytes: Buffer;
  directory: boolean;
  identity: string;
}

const PARENT = 10;
const CREATED = 11;
const RESIDENT = 12;
const PARENT_HANDLE = 100n;
const CREATED_HANDLE = 101n;
const RESIDENT_HANDLE = 102n;

const request: IScaffoldParentPublicationRequest = {
  bytes: [1, 2, 3],
  childName: "entry.bin",
  expectedParentIdentity: "1:2",
  parentPath: "/owned/parent",
};

const execute = (scenario: INativeScenario) => {
  const nodes = new Map<number, IFakeNode>([
    [PARENT, { bytes: Buffer.alloc(0), directory: true, identity: "1:2" }],
    [CREATED, { bytes: Buffer.alloc(0), directory: false, identity: "1:3" }],
    [RESIDENT, { bytes: Buffer.alloc(0), directory: false, identity: "1:3" }],
  ]);
  let errno = scenario.errno ?? 2;
  const identityOf = (descriptor: number): string => {
    const node = nodes.get(descriptor)!;
    return descriptor === PARENT
      ? (scenario.parentIdentity ?? node.identity)
      : descriptor === RESIDENT
        ? (scenario.residentIdentity ?? node.identity)
        : node.identity;
  };
  const sizeOf = (descriptor: number): bigint =>
    BigInt(nodes.get(descriptor)!.bytes.length) +
    (descriptor === CREATED ? (scenario.finalSizeDelta ?? 0n) : 0n);
  let residentInspections = 0;
  const residentMoved = (descriptor: number): boolean => {
    if (descriptor === RESIDENT) residentInspections++;
    return (
      descriptor === RESIDENT &&
      scenario.residentVersionChangesAfterClose === true &&
      residentInspections >= 2
    );
  };
  const status = (descriptor: number) => {
    const node = nodes.get(descriptor)!;
    const [device, inode] = identityOf(descriptor).split(":").map(BigInt);
    const moved = residentMoved(descriptor);
    return {
      dev: device,
      ino: inode,
      isDirectory: () =>
        descriptor === PARENT
          ? (scenario.parentIsDirectory ?? true)
          : node.directory,
      isFile: () =>
        descriptor === PARENT ? false : (scenario.childIsFile ?? true),
      isSymbolicLink: () =>
        descriptor === PARENT ? false : (scenario.childIsLink ?? false),
      mtimeNs: moved ? 8n : 7n,
      nlink: scenario.childLinks ?? 1n,
      size: sizeOf(descriptor),
    } as fs.BigIntStats;
  };
  const appendWritten = (
    descriptor: number,
    buffer: Buffer,
    offset: number,
    length: number,
  ): number => {
    if (scenario.write === "fail") return -1;
    if (scenario.write === "stop") return 0;
    const written = Math.min(length, 2);
    const node = nodes.get(descriptor)!;
    node.bytes = Buffer.concat([
      node.bytes,
      buffer.subarray(offset, offset + written),
    ]);
    nodes.get(RESIDENT)!.bytes = node.bytes;
    return written;
  };
  const readBack = (
    descriptor: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ): number => {
    if (scenario.read === "fail") return -1;
    if (scenario.read === "stop") return 0;
    const source = nodes.get(
      descriptor === RESIDENT ? CREATED : descriptor,
    )!.bytes;
    const read = Math.min(length, source.length - position);
    source.copy(buffer, offset, position, position + read);
    if (scenario.read === "mismatch" && read > 0) buffer[offset] ^= 0xff;
    return read;
  };
  const fileSystem = {
    closeSync: (descriptor: number) => {
      if (scenario.closeFails?.has(descriptor))
        throw new Error(`close ${descriptor}`);
    },
    constants: {
      O_CLOEXEC: 0x80000,
      O_CREAT: 0x40,
      O_DIRECTORY: 0x10000,
      O_EXCL: 0x80,
      O_NOFOLLOW: 0x20000,
      O_RDONLY: 0,
      O_RDWR: 2,
    } as Record<string, number>,
    fstatSync: (descriptor: number) => {
      if (descriptor === PARENT && scenario.parentFstatFails)
        throw new Error("parent fstat failed");
      if (descriptor !== PARENT && scenario.childInspectFails)
        throw new Error("child fstat failed");
      if (descriptor === RESIDENT && scenario.residentInspectThrowsValue) {
        // The adapter must wrap a thrown non-Error value; a native binding
        // that rejects with a bare string is exactly that value.
        const value: unknown = "resident inspection failed without an Error";
        throw value;
      }
      return status(descriptor);
    },
    fsyncSync: () => {
      if (scenario.fsyncFails) throw new Error("sync failed");
    },
    readSync: (
      descriptor: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
    ) => {
      const read = readBack(descriptor, buffer, offset, length, position);
      if (read < 0) throw new Error("read failed");
      return read;
    },
    writeSync: (
      descriptor: number,
      buffer: Buffer,
      offset: number,
      length: number,
    ) => {
      const written = appendWritten(descriptor, buffer, offset, length);
      if (written < 0) throw new Error("write failed");
      return written;
    },
  } as unknown as typeof fs;
  if (scenario.constantsMissing !== undefined)
    delete (fileSystem.constants as unknown as Record<string, number>)[
      scenario.constantsMissing
    ];

  const callable = (implementation: (...arguments_: unknown[]) => unknown) =>
    Object.assign(implementation, {
      async: () => undefined,
      info: { arguments: [], name: "fake", result: {} },
    });
  const posixOpen = callable(() =>
    scenario.parentOpen === "fail" ? -1 : PARENT,
  );
  const posixOpenAt = callable((...arguments_: unknown[]) => {
    const flags = arguments_[2] as number;
    if ((flags & 0x40) !== 0) {
      if (scenario.createThrows) throw new Error("create threw");
      if (scenario.target === "competitor") {
        errno = 17;
        return -1;
      }
      if (scenario.target === "create-failed") {
        errno = 13;
        return -1;
      }
      return CREATED;
    }
    if (scenario.residentOpenFails) return -1;
    return RESIDENT;
  });
  const descriptorOf = (handle: unknown): number =>
    handle === PARENT_HANDLE
      ? PARENT
      : handle === CREATED_HANDLE
        ? CREATED
        : RESIDENT;
  const createFile = callable(() =>
    scenario.parentOpen === "invalid"
      ? -1n
      : scenario.parentOpen === "null"
        ? null
        : PARENT_HANDLE,
  );
  const closeHandle = callable((...arguments_: unknown[]) =>
    arguments_[0] === PARENT_HANDLE
      ? !scenario.parentCloseFails
      : arguments_[0] === CREATED_HANDLE
        ? !scenario.childCloseFails
        : !scenario.residentCloseFails,
  );
  const ntCreateFile = callable((...arguments_: unknown[]) => {
    const output = arguments_[0] as unknown[];
    const disposition = arguments_[7] as number;
    if (disposition === 2 && scenario.createThrows)
      throw new Error("create threw");
    if (disposition === 2 && scenario.target === "competitor")
      return 0xc0000035 | 0;
    if (disposition === 2 && scenario.target === "create-failed") return -1;
    if (disposition === 1 && scenario.residentOpenFails) return -1;
    if (disposition === 2)
      output[0] = scenario.childHandleInvalid ? null : CREATED_HANDLE;
    else output[0] = scenario.residentHandleInvalid ? -1n : RESIDENT_HANDLE;
    return 0;
  });
  const getFileInformation = callable((...arguments_: unknown[]) => {
    const descriptor = descriptorOf(arguments_[0]);
    if (descriptor === PARENT && scenario.parentFstatFails) return false;
    if (descriptor !== PARENT && scenario.childInspectFails) return false;
    const information = arguments_[1] as Record<string, unknown>;
    const [volume, fileIndex] = identityOf(descriptor).split(":").map(Number);
    const node = nodes.get(descriptor)!;
    const directory =
      descriptor === PARENT
        ? (scenario.parentIsDirectory ?? true)
        : node.directory || scenario.childIsFile === false;
    information.dwFileAttributes =
      (directory ? 0x10 : 0x20) |
      (descriptor !== PARENT && scenario.childIsLink ? 0x400 : 0);
    information.dwVolumeSerialNumber = volume!;
    information.nFileIndexHigh = Math.floor(fileIndex! / 0x1_0000_0000);
    information.nFileIndexLow = fileIndex! >>> 0;
    information.nNumberOfLinks =
      descriptor === PARENT ? 1 : Number(scenario.childLinks ?? 1n);
    const size = descriptor === PARENT ? 0n : sizeOf(descriptor);
    information.nFileSizeHigh = Number(size >> 32n);
    information.nFileSizeLow = Number(size & 0xffff_ffffn);
    information.ftLastWriteTime = {
      dwHighDateTime: 0,
      dwLowDateTime: residentMoved(descriptor) ? 8 : 7,
    };
    return true;
  });
  const pointers = new Map<unknown, number>();
  const setFilePointer = callable((...arguments_: unknown[]) => {
    if (scenario.seekFails) return false;
    pointers.set(arguments_[0], Number(arguments_[1]));
    return true;
  });
  const writeFile = callable((...arguments_: unknown[]) => {
    const [handle, buffer, length, written] = arguments_ as [
      unknown,
      Buffer,
      number,
      number[],
    ];
    const count = appendWritten(descriptorOf(handle), buffer, 0, length);
    if (count < 0) return false;
    written[0] = count;
    return true;
  });
  const readFile = callable((...arguments_: unknown[]) => {
    const [handle, buffer, length, read] = arguments_ as [
      unknown,
      Buffer,
      number,
      number[],
    ];
    const count = readBack(
      descriptorOf(handle),
      buffer,
      0,
      length,
      pointers.get(handle) ?? 0,
    );
    if (count < 0) return false;
    read[0] = count;
    return true;
  });
  const flushFileBuffers = callable(() => !scenario.fsyncFails);
  const library = (name: string | null) => ({
    func: (...arguments_: unknown[]) => {
      const declaration = arguments_.map(String).join(" ");
      if (name === null)
        return declaration.includes("openat") ? posixOpenAt : posixOpen;
      if (declaration.includes("CreateFileW")) return createFile;
      if (declaration.includes("CloseHandle")) return closeHandle;
      if (declaration.includes("GetFileInformationByHandle"))
        return getFileInformation;
      if (declaration.includes("GetLastError"))
        return callable(() => scenario.errno ?? 3);
      if (declaration.includes("WriteFile")) return writeFile;
      if (declaration.includes("ReadFile")) return readFile;
      if (declaration.includes("SetFilePointerEx")) return setFilePointer;
      if (declaration.includes("FlushFileBuffers")) return flushFileBuffers;
      return ntCreateFile;
    },
  });
  const type = {
    alignment: 8,
    disposable: false,
    name: "fake",
    primitive: "Pointer",
    size: 8,
  };
  const foreign = {
    address: (handle: unknown) => BigInt(handle as bigint),
    errno: () => errno,
    load: library,
    opaque: () => type,
    os: { errno: { EEXIST: 17, ELOOP: 40, ENOENT: 2, ENOTDIR: 20 } },
    out: () => type,
    pointer: () => type,
    sizeof: () => 8,
    struct: () => type,
  } as unknown as NativeEnvironmentProps["foreign"];
  const environment = nativeScaffoldPublicationForTesting.createEnvironment({
    fileSystem,
    foreign,
    platform: scenario.platform,
  });
  return {
    environment,
    first: nativeScaffoldPublicationForTesting.publish(request, environment),
    second:
      scenario.target === "ok" &&
      scenario.parentOpen !== "fail" &&
      scenario.parentOpen !== "invalid"
        ? nativeScaffoldPublicationForTesting.publish(request, environment)
        : null,
  };
};

/** The same behavioral matrix, run once per platform capability. */
const perPlatform = (
  platforms: readonly NodeJS.Platform[],
  scenario: Omit<INativeScenario, "platform">,
  outcome: string,
): Array<{ outcome: string; scenario: INativeScenario }> =>
  platforms.map((platform) => ({
    outcome,
    scenario: { ...scenario, platform },
  }));

/**
 * Native publication maps injectable ABI and descriptor results to truthful
 * receipts without patching `node:fs` or depending on an OS race.
 *
 * Scenarios:
 *
 * 1. Both platforms complete a clean publication and refuse a pre-create
 *    competitor or create failure by name; an invalid request refuses before
 *    any capability is acquired.
 * 2. A parent that cannot be opened, is not a directory, or changed identity
 *    is a parent-changed refusal on both platforms.
 * 3. After the slot exists, every defect is a partial outcome carrying the
 *    exact written extent: a child that is not one ordinary single-link file,
 *    a write that fails or stops, a failed flush, a changed size, a readback
 *    that fails, stops, or differs, a resident that cannot be reopened,
 *    inspected, or matched, a resident whose generation moves only after the
 *    created descriptor closed, a resident inspection that fails with a
 *    non-Error value, and a child, resident, or parent close failure, including
 *    a parent close failure stacked on an earlier child close failure or on a
 *    failed parent inspection.
 * 4. Windows never lowers a HANDLE to a C-runtime descriptor: bytes, flush,
 *    inspection, seek, and readback all travel through kernel32 on the handle,
 *    and an invalid child or resident handle is reported as the created slot
 *    or a partial result rather than adopted.
 */
export const test_cli_scaffold_native_adapter = (): void => {
  const both: readonly NodeJS.Platform[] = ["linux", "win32"];
  const matrix: Array<{ outcome: string; scenario: INativeScenario }> = [
    ...perPlatform(both, { target: "ok" }, "completed"),
    {
      outcome: "refused:parent-changed",
      scenario: { errno: 40, parentOpen: "fail", platform: "linux" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: { errno: 2, parentOpen: "fail", platform: "linux" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: { errno: 20, parentOpen: "fail", platform: "linux" },
    },
    {
      outcome: "refused:create-failed",
      scenario: { errno: 13, parentOpen: "fail", platform: "linux" },
    },
    ...perPlatform(both, { parentIdentity: "1:9" }, "refused:parent-changed"),
    ...perPlatform(
      both,
      { parentIsDirectory: false },
      "refused:parent-changed",
    ),
    ...perPlatform(both, { parentFstatFails: true }, "refused:create-failed"),
    ...perPlatform(both, { target: "competitor" }, "refused:target-competitor"),
    ...perPlatform(both, { target: "create-failed" }, "refused:create-failed"),
    ...perPlatform(
      both,
      { createThrows: true, target: "ok" },
      "refused:create-failed",
    ),
    {
      outcome: "refused:parent-changed",
      scenario: { parentOpen: "invalid", platform: "win32" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: { errno: 2, parentOpen: "invalid", platform: "win32" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: { errno: 4390, parentOpen: "invalid", platform: "win32" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: { parentOpen: "null", platform: "win32" },
    },
    {
      outcome: "refused:create-failed",
      scenario: { errno: 5, parentOpen: "invalid", platform: "win32" },
    },
    {
      outcome: "partial:0",
      scenario: { childHandleInvalid: true, platform: "win32", target: "ok" },
    },
    ...perPlatform(
      both,
      { childInspectFails: true, target: "ok" },
      "partial:0",
    ),
    ...perPlatform(both, { childIsFile: false, target: "ok" }, "partial:0"),
    ...perPlatform(both, { childIsLink: true, target: "ok" }, "partial:0"),
    ...perPlatform(both, { childLinks: 2n, target: "ok" }, "partial:0"),
    ...perPlatform(both, { target: "ok", write: "fail" }, "partial:0"),
    ...perPlatform(both, { target: "ok", write: "stop" }, "partial:0"),
    {
      outcome: "partial:0",
      scenario: { platform: "win32", seekFails: true, target: "ok" },
    },
    ...perPlatform(both, { fsyncFails: true, target: "ok" }, "partial:3"),
    ...perPlatform(both, { finalSizeDelta: 1n, target: "ok" }, "partial:3"),
    ...perPlatform(both, { read: "fail", target: "ok" }, "partial:3"),
    ...perPlatform(both, { read: "stop", target: "ok" }, "partial:3"),
    ...perPlatform(both, { read: "mismatch", target: "ok" }, "partial:3"),
    ...perPlatform(
      both,
      { residentIdentity: "1:9", target: "ok" },
      "partial:3",
    ),
    ...perPlatform(
      both,
      { residentOpenFails: true, target: "ok" },
      "partial:3",
    ),
    ...perPlatform(
      both,
      { residentVersionChangesAfterClose: true, target: "ok" },
      "partial:3",
    ),
    {
      outcome: "partial:3",
      scenario: {
        platform: "linux",
        residentInspectThrowsValue: true,
        target: "ok",
      },
    },
    {
      outcome: "partial:0",
      scenario: {
        closeFails: new Set([CREATED, PARENT]),
        platform: "linux",
        target: "ok",
        write: "fail",
      },
    },
    {
      outcome: "refused:create-failed",
      scenario: {
        closeFails: new Set([PARENT]),
        parentFstatFails: true,
        platform: "linux",
      },
    },
    {
      outcome: "refused:create-failed",
      scenario: {
        parentCloseFails: true,
        parentFstatFails: true,
        platform: "win32",
      },
    },
    {
      outcome: "partial:3",
      scenario: {
        platform: "win32",
        residentHandleInvalid: true,
        target: "ok",
      },
    },
    {
      outcome: "partial:3",
      scenario: {
        closeFails: new Set([CREATED]),
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "partial:3",
      scenario: {
        closeFails: new Set([RESIDENT]),
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "partial:3",
      scenario: {
        closeFails: new Set([PARENT]),
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "partial:3",
      scenario: { childCloseFails: true, platform: "win32", target: "ok" },
    },
    {
      outcome: "partial:3",
      scenario: { platform: "win32", residentCloseFails: true, target: "ok" },
    },
    {
      outcome: "partial:3",
      scenario: { parentCloseFails: true, platform: "win32", target: "ok" },
    },
    {
      outcome: "refused:parent-changed",
      scenario: {
        parentCloseFails: true,
        parentIdentity: "1:9",
        platform: "win32",
      },
    },
    {
      outcome: "refused:parent-changed",
      scenario: {
        closeFails: new Set([PARENT]),
        parentIdentity: "1:9",
        platform: "linux",
      },
    },
    {
      outcome: "refused:target-competitor",
      scenario: {
        closeFails: new Set([PARENT]),
        platform: "linux",
        target: "competitor",
      },
    },
    {
      outcome: "partial:0",
      scenario: {
        childHandleInvalid: true,
        parentCloseFails: true,
        platform: "win32",
        target: "ok",
      },
    },
    {
      outcome: "refused:create-failed",
      scenario: {
        closeFails: new Set([PARENT]),
        createThrows: true,
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "refused:create-failed",
      scenario: {
        constantsMissing: "O_NOFOLLOW",
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "completed",
      scenario: {
        constantsMissing: "O_CLOEXEC",
        platform: "linux",
        target: "ok",
      },
    },
    {
      outcome: "completed",
      scenario: {
        constantsMissing: "O_CLOEXEC",
        platform: "android",
        target: "ok",
      },
    },
    {
      outcome: "refused:create-failed",
      scenario: {
        constantsMissing: "O_CLOEXEC",
        platform: "darwin",
        target: "ok",
      },
    },
  ];
  const outcomes = matrix.map(({ scenario }) => execute(scenario));
  const summarize = (outcome: (typeof outcomes)[number]["first"]): string =>
    outcome.status === "refused"
      ? `${outcome.status}:${outcome.reason}`
      : outcome.status === "partial"
        ? `${outcome.status}:${outcome.bytesWritten}`
        : outcome.status;
  const invalidRequests = [
    { ...request, childName: "" },
    { ...request, childName: "." },
    { ...request, childName: ".." },
    { ...request, childName: "bad\0name" },
    { ...request, childName: "bad/name" },
    { ...request, childName: "bad\\name" },
    { ...request, expectedParentIdentity: "" },
    { ...request, bytes: [-1] },
    { ...request, bytes: [0.5] },
    { ...request, bytes: [256] },
  ].map((invalid) =>
    nativeScaffoldPublicationForTesting.publish(
      invalid,
      outcomes[0]!.environment,
    ),
  );
  TestValidator.predicate(
    "semantic native scenarios produce only closed outcome classes",
    outcomes.every(
      ({ first, second }) =>
        ["completed", "partial", "refused"].includes(first.status) &&
        (second === null ||
          ["completed", "partial", "refused"].includes(second.status)),
    ),
  );
  TestValidator.equals(
    "every native branch preserves its exact effect class on both platforms",
    outcomes.map(({ first }, index) => ({
      platform: matrix[index]!.scenario.platform,
      outcome: summarize(first),
    })),
    matrix.map(({ outcome, scenario }) => ({
      platform: scenario.platform,
      outcome,
    })),
  );
  TestValidator.predicate(
    "invalid native requests refuse before a platform capability is acquired",
    invalidRequests.every(
      (outcome) =>
        outcome.status === "refused" && outcome.reason === "create-failed",
    ),
  );
};
