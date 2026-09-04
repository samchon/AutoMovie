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
  childAdoptionFails?: boolean;
  childCloseFails?: boolean;
  childIsFile?: boolean;
  childLinks?: bigint;
  closeFails?: ReadonlySet<number>;
  constantsMissing?: string;
  errno?: number;
  finalSizeDelta?: bigint;
  fsyncFails?: boolean;
  parentIdentity?: string;
  parentIsDirectory?: boolean;
  parentOpen?: "fail" | "invalid" | "ok";
  platform: NodeJS.Platform;
  read?: "mismatch" | "stop" | "success";
  residentIdentity?: string;
  residentOpenFails?: boolean;
  target?: "competitor" | "create-failed" | "ok";
  write?: "fail" | "stop" | "success";
}

interface IFakeNode {
  bytes: Buffer;
  directory: boolean;
  identity: string;
}

const request: IScaffoldParentPublicationRequest = {
  bytes: [1, 2, 3],
  childName: "entry.bin",
  expectedParentIdentity: "1:2",
  parentPath: "/owned/parent",
};

const execute = (scenario: INativeScenario) => {
  const nodes = new Map<number, IFakeNode>([
    [10, { bytes: Buffer.alloc(0), directory: true, identity: "1:2" }],
    [11, { bytes: Buffer.alloc(0), directory: false, identity: "1:3" }],
    [12, { bytes: Buffer.alloc(0), directory: false, identity: "1:3" }],
  ]);
  let errno = scenario.errno ?? 2;
  let childAdoptions = 0;
  const status = (descriptor: number) => {
    const node = nodes.get(descriptor)!;
    const identity =
      descriptor === 10
        ? (scenario.parentIdentity ?? node.identity)
        : descriptor === 12
          ? (scenario.residentIdentity ?? node.identity)
          : node.identity;
    const [device, inode] = identity.split(":").map(BigInt);
    const size =
      BigInt(node.bytes.length) +
      (descriptor === 11 ? (scenario.finalSizeDelta ?? 0n) : 0n);
    return {
      dev: device,
      ino: inode,
      isDirectory: () =>
        descriptor === 10
          ? (scenario.parentIsDirectory ?? true)
          : node.directory,
      isFile: () =>
        descriptor === 10 ? false : (scenario.childIsFile ?? true),
      isSymbolicLink: () => false,
      mtimeNs: 7n,
      nlink: scenario.childLinks ?? 1n,
      size,
    } as fs.BigIntStats;
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
    fstatSync: (descriptor: number) => status(descriptor),
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
      if (scenario.read === "stop") return 0;
      const source = nodes.get(descriptor === 12 ? 11 : descriptor)!.bytes;
      const read = Math.min(length, source.length - position);
      source.copy(buffer, offset, position, position + read);
      if (scenario.read === "mismatch" && read > 0) buffer[offset] ^= 0xff;
      return read;
    },
    writeSync: (
      descriptor: number,
      buffer: Buffer,
      offset: number,
      length: number,
    ) => {
      if (scenario.write === "fail") throw new Error("write failed");
      if (scenario.write === "stop") return 0;
      const written = Math.min(length, 2);
      const node = nodes.get(descriptor)!;
      node.bytes = Buffer.concat([
        node.bytes,
        buffer.subarray(offset, offset + written),
      ]);
      nodes.get(12)!.bytes = node.bytes;
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
  const posixOpen = callable(() => (scenario.parentOpen === "fail" ? -1 : 10));
  const posixOpenAt = callable((...arguments_: unknown[]) => {
    const flags = arguments_[2] as number;
    if ((flags & 0x40) !== 0) {
      if (scenario.target === "competitor") {
        errno = 17;
        return -1;
      }
      if (scenario.target === "create-failed") {
        errno = 13;
        return -1;
      }
      return 11;
    }
    if (scenario.residentOpenFails) return -1;
    return 12;
  });
  const createFile = callable(() =>
    scenario.parentOpen === "invalid" ? -1n : 100n,
  );
  const closeHandle = callable(() => !scenario.childCloseFails);
  const openOsHandle = callable((...arguments_: unknown[]) => {
    const handle = arguments_[0] as bigint;
    if (handle === 100n) return 10;
    childAdoptions++;
    if (scenario.childAdoptionFails && childAdoptions === 1) return -1;
    return childAdoptions === 1 ? 11 : 12;
  });
  const ntCreateFile = callable((...arguments_: unknown[]) => {
    const output = arguments_[0] as unknown[];
    const disposition = arguments_[7] as number;
    if (disposition === 2 && scenario.target === "competitor")
      return 0xc0000035 | 0;
    if (disposition === 2 && scenario.target === "create-failed") return -1;
    if (disposition === 1 && scenario.residentOpenFails) return -1;
    output[0] = 101n;
    return 0;
  });
  const library = (name: string | null) => ({
    func: (...arguments_: unknown[]) => {
      const declaration = arguments_.map(String).join(" ");
      if (name === null)
        return declaration.includes("openat") ? posixOpenAt : posixOpen;
      if (declaration.includes("CreateFileW")) return createFile;
      if (declaration.includes("CloseHandle")) return closeHandle;
      if (declaration.includes("GetLastError"))
        return callable(() => scenario.errno ?? 3);
      if (declaration.includes("_open_osfhandle")) return openOsHandle;
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

/**
 * Native publication maps injectable ABI and descriptor results to truthful
 * receipts without patching `node:fs` or depending on an OS race.
 */
export const test_cli_scaffold_native_adapter = (): void => {
  const cases: INativeScenario[] = [
    { platform: "linux", target: "ok" },
    { platform: "win32", target: "ok" },
    { errno: 40, parentOpen: "fail", platform: "linux" },
    { errno: 13, parentOpen: "fail", platform: "linux" },
    { parentIdentity: "1:9", platform: "linux" },
    { parentIsDirectory: false, platform: "linux" },
    { platform: "linux", target: "competitor" },
    { platform: "linux", target: "create-failed" },
    { parentOpen: "invalid", platform: "win32" },
    { errno: 5, parentOpen: "invalid", platform: "win32" },
    { platform: "win32", target: "competitor" },
    { platform: "win32", target: "create-failed" },
    { childAdoptionFails: true, platform: "win32", target: "ok" },
    {
      childAdoptionFails: true,
      childCloseFails: true,
      platform: "win32",
      target: "ok",
    },
    { childIsFile: false, platform: "linux", target: "ok" },
    { childLinks: 2n, platform: "linux", target: "ok" },
    { platform: "linux", target: "ok", write: "fail" },
    { platform: "linux", target: "ok", write: "stop" },
    { fsyncFails: true, platform: "linux", target: "ok" },
    { finalSizeDelta: 1n, platform: "linux", target: "ok" },
    { platform: "linux", read: "stop", target: "ok" },
    { platform: "linux", read: "mismatch", target: "ok" },
    { platform: "linux", residentIdentity: "1:9", target: "ok" },
    { platform: "linux", residentOpenFails: true, target: "ok" },
    { closeFails: new Set([11]), platform: "linux", target: "ok" },
    { closeFails: new Set([12]), platform: "linux", target: "ok" },
    { closeFails: new Set([10]), platform: "linux", target: "ok" },
    { constantsMissing: "O_NOFOLLOW", platform: "linux", target: "ok" },
    { constantsMissing: "O_CLOEXEC", platform: "linux", target: "ok" },
    { constantsMissing: "O_CLOEXEC", platform: "darwin", target: "ok" },
  ];
  const outcomes = cases.map(execute);
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
  TestValidator.predicate(
    "invalid native requests refuse before a platform capability is acquired",
    invalidRequests.every(
      (outcome) =>
        outcome.status === "refused" && outcome.reason === "create-failed",
    ),
  );
  TestValidator.equals(
    "positive adapters complete and pre-create competitors refuse",
    {
      linux: outcomes[0]!.first.status,
      posixCompetitor:
        outcomes[6]!.first.status === "refused"
          ? outcomes[6]!.first.reason
          : outcomes[6]!.first.status,
      windows: outcomes[1]!.first.status,
      windowsCompetitor:
        outcomes[10]!.first.status === "refused"
          ? outcomes[10]!.first.reason
          : outcomes[10]!.first.status,
      windowsPostCreateAdoption: outcomes[12]!.first.status,
    },
    {
      linux: "completed",
      posixCompetitor: "target-competitor",
      windows: "completed",
      windowsCompetitor: "target-competitor",
      windowsPostCreateAdoption: "partial",
    },
  );
};
