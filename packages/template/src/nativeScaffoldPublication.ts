import koffi, { type LibraryHandle, type TypeObject } from "koffi";
import * as fs from "node:fs";
import * as path from "node:path";

import type { IScaffoldParentPublicationRequest } from "./scaffoldFileSnapshot";
import type { ScaffoldFilePublicationOutcome } from "./scaffoldPublication";

interface IBoundParent {
  close(): void;
  createExclusive(childName: string): ICreateResult;
  inspect(): { directory: boolean; identity: string };
  openResident(childName: string): IBoundChild;
}

/**
 * One child opened relative to a held parent, driven through whatever the
 * platform hands back: a POSIX descriptor served by `node:fs`, or a Windows
 * HANDLE served by kernel32. Node's own C runtime does not share descriptor
 * tables with `ucrtbase.dll`, so a Windows handle is never lowered to a CRT
 * descriptor; every byte, flush, inspection, and close goes through the
 * handle itself.
 */
interface IBoundChild {
  close(): void;
  read(
    target: Buffer,
    offset: number,
    length: number,
    position: number,
  ): number;
  status(): IBoundChildStatus;
  sync(): void;
  write(
    source: Buffer,
    offset: number,
    length: number,
    position: number,
  ): number;
}

interface IBoundChildStatus {
  link: boolean;
  links: bigint;
  regular: boolean;
  size: bigint;
  version: string;
}

interface INativeEnvironment {
  fileSystem: typeof fs;
  foreign: typeof koffi;
  platform: NodeJS.Platform;
  posixConstants(): IPosixConstants;
  posixLibrary(): IPosixLibrary;
  windowsLibrary(): IWindowsLibrary;
}

type ICreateResult =
  | { child: IBoundChild; status: "opened" }
  | { error: unknown; status: "partial" }
  | {
      error: unknown;
      reason: "create-failed" | "target-competitor";
      status: "refused";
    };

class ScaffoldParentChangedError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScaffoldParentChangedError";
  }
}

class ScaffoldCreatedSlotError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScaffoldCreatedSlotError";
  }
}

/**
 * Execute one scaffold publication with a native parent-handle-relative open.
 *
 * POSIX uses `openat`; Windows uses `NtCreateFile` with
 * `OBJECT_ATTRIBUTES.RootDirectory`. Both paths acquire and validate the
 * parent handle before an exclusive, no-follow child create, and every
 * resident comparison reopens the child relative to that same held parent.
 * The adapter never retries an absolute child pathname and never deletes a
 * partial result.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Publishes exact bytes only into the captured physical parent generation and verifies their resident identity.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Reuses the closed parent identity, child segment, and bytes through native create and readback.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Uses native exclusive creation and leaves an existing competitor unchanged.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Resolves the exact held-parent slot through success or explicit competitor refusal.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Distinguishes pre-create refusal from exact descriptor-bound partial state without cleanup.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Returns the captured parent and written extent required for explicit recovery.
 * @author Samchon
 */
export const publishNativeScaffoldFile = (
  request: IScaffoldParentPublicationRequest,
): ScaffoldFilePublicationOutcome =>
  publishNativeScaffoldFileWithEnvironment(request, NATIVE_ENVIRONMENT);

const publishNativeScaffoldFileWithEnvironment = (
  request: IScaffoldParentPublicationRequest,
  environment: INativeEnvironment,
): ScaffoldFilePublicationOutcome => {
  if (
    request.childName.length === 0 ||
    request.childName === "." ||
    request.childName === ".." ||
    request.childName.includes("\0") ||
    request.childName.includes("/") ||
    request.childName.includes("\\") ||
    request.expectedParentIdentity.length === 0 ||
    request.bytes.some(
      (byte) => Number.isSafeInteger(byte) === false || byte < 0 || byte > 0xff,
    )
  )
    return Object.freeze({
      error: new Error("invalid native scaffold publication request"),
      reason: "create-failed" as const,
      status: "refused" as const,
    });
  let parent: IBoundParent;
  try {
    parent = openBoundParent(request, environment);
  } catch (error) {
    return Object.freeze({
      error,
      reason:
        error instanceof ScaffoldParentChangedError
          ? ("parent-changed" as const)
          : ("create-failed" as const),
      status: "refused" as const,
    });
  }

  let creation: ICreateResult;
  try {
    creation = parent.createExclusive(request.childName);
  } catch (error) {
    let failure = error;
    try {
      parent.close();
    } catch (closeError) {
      failure = combineFailures(failure, closeError, "scaffold parent close");
    }
    return Object.freeze({
      error: failure,
      reason: "create-failed" as const,
      status: "refused" as const,
    });
  }
  if (creation.status === "refused") {
    let error = creation.error;
    try {
      parent.close();
    } catch (closeError) {
      error = combineFailures(error, closeError, "scaffold parent close");
    }
    return Object.freeze({ ...creation, error });
  }
  if (creation.status === "partial") {
    let error = creation.error;
    try {
      parent.close();
    } catch (closeError) {
      error = combineFailures(error, closeError, "scaffold parent close");
    }
    return Object.freeze({
      bytesWritten: 0,
      error,
      parentIdentity: request.expectedParentIdentity,
      status: "partial",
    });
  }

  const source = Buffer.from(request.bytes);
  const child = creation.child;
  let bytesWritten = 0;
  let failure: unknown = undefined;
  let completedVersion: string | undefined;
  try {
    assertOrdinarySingleLink(child.status(), request.childName);
    while (bytesWritten < source.length) {
      const written = child.write(
        source,
        bytesWritten,
        source.length - bytesWritten,
        bytesWritten,
      );
      if (written === 0)
        throw new Error(
          `scaffold file stopped while written: ${request.childName}`,
        );
      bytesWritten += written;
    }
    child.sync();
    const completed = child.status();
    assertOrdinarySingleLink(completed, request.childName);
    if (completed.size !== BigInt(source.length))
      throw new Error(`scaffold file changed final size: ${request.childName}`);
    assertChildBytes(child, request.childName, source);
    completedVersion = completed.version;
    assertBoundResident(parent, request.childName, completedVersion);
  } catch (error) {
    failure = error;
  }

  try {
    child.close();
  } catch (closeError) {
    failure = combineFailures(
      failure,
      closeError,
      "created scaffold descriptor close",
    );
  }
  if (failure === undefined)
    try {
      assertBoundResident(parent, request.childName, completedVersion!);
    } catch (residentError) {
      failure = residentError;
    }
  try {
    parent.close();
  } catch (closeError) {
    failure = combineFailures(failure, closeError, "scaffold parent close");
  }

  return failure === undefined
    ? Object.freeze({
        parentIdentity: request.expectedParentIdentity,
        status: "completed",
      })
    : Object.freeze({
        bytesWritten,
        error: failure,
        parentIdentity: request.expectedParentIdentity,
        status: "partial",
      });
};

const openBoundParent = (
  request: IScaffoldParentPublicationRequest,
  environment: INativeEnvironment,
): IBoundParent => {
  const parent =
    environment.platform === "win32"
      ? openWindowsParent(request.parentPath, environment)
      : openPosixParent(request.parentPath, environment);
  try {
    const status = parent.inspect();
    if (
      status.directory === false ||
      status.identity !== request.expectedParentIdentity
    )
      throw new ScaffoldParentChangedError(
        `scaffold parent changed before native create: ${request.parentPath}`,
      );
    return parent;
  } catch (error) {
    try {
      parent.close();
    } catch (closeError) {
      if (error instanceof ScaffoldParentChangedError)
        throw new ScaffoldParentChangedError(error.message, {
          cause: combineFailures(
            error,
            closeError,
            "changed scaffold parent close",
          ),
        });
      throw combineFailures(error, closeError, "scaffold parent close");
    }
    throw error;
  }
};

const openPosixParent = (
  parentPath: string,
  environment: INativeEnvironment,
): IBoundParent => {
  const library = environment.posixLibrary();
  const constants = environment.posixConstants();
  const descriptor = library.open(
    parentPath,
    constants.O_RDONLY |
      constants.O_DIRECTORY |
      constants.O_NOFOLLOW |
      constants.O_CLOEXEC,
    0,
  );
  if (descriptor < 0) {
    const code = environment.foreign.errno();
    const error = nativeError("unable to open scaffold parent", code);
    if (
      code === environment.foreign.os.errno.ENOENT ||
      code === environment.foreign.os.errno.ENOTDIR ||
      code === environment.foreign.os.errno.ELOOP
    )
      throw new ScaffoldParentChangedError(error.message);
    throw error;
  }
  const parent: IBoundParent = {
    close: () => environment.fileSystem.closeSync(descriptor),
    createExclusive: (childName) => {
      const child = library.openat(
        descriptor,
        childName,
        constants.O_RDWR |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW |
          constants.O_CLOEXEC,
        0o600,
      );
      if (child >= 0)
        return { child: posixChild(environment, child), status: "opened" };
      const code = environment.foreign.errno();
      return {
        error: nativeError("unable to create scaffold child", code),
        reason:
          code === environment.foreign.os.errno.EEXIST
            ? "target-competitor"
            : "create-failed",
        status: "refused",
      };
    },
    inspect: () => {
      const status = environment.fileSystem.fstatSync(descriptor, {
        bigint: true,
      });
      return {
        directory: status.isDirectory(),
        identity: physicalIdentity(status),
      };
    },
    openResident: (childName) => {
      const child = library.openat(
        descriptor,
        childName,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_CLOEXEC,
        0,
      );
      if (child < 0)
        throw nativeError(
          "unable to reopen scaffold child",
          environment.foreign.errno(),
        );
      return posixChild(environment, child);
    },
  };
  return parent;
};

const posixChild = (
  environment: INativeEnvironment,
  descriptor: number,
): IBoundChild => ({
  close: () => environment.fileSystem.closeSync(descriptor),
  read: (target, offset, length, position) =>
    environment.fileSystem.readSync(
      descriptor,
      target,
      offset,
      length,
      position,
    ),
  status: () => {
    const status = environment.fileSystem.fstatSync(descriptor, {
      bigint: true,
    });
    return {
      link: status.isSymbolicLink(),
      links: status.nlink,
      regular: status.isFile(),
      size: status.size,
      version: physicalVersion(status),
    };
  },
  sync: () => environment.fileSystem.fsyncSync(descriptor),
  write: (source, offset, length, position) =>
    environment.fileSystem.writeSync(
      descriptor,
      source,
      offset,
      length,
      position,
    ),
});

interface IPosixLibrary {
  open(pathname: string, flags: number, mode: number): number;
  openat(
    directory: number,
    pathname: string,
    flags: number,
    mode: number,
  ): number;
}

const createPosixLibrary = (foreign: typeof koffi): IPosixLibrary => {
  const library = foreign.load(null);
  return {
    open: library.func(
      "int open(const char *pathname, int flags, uint32_t mode)",
    ) as IPosixLibrary["open"],
    openat: library.func(
      "int openat(int directory, const char *pathname, int flags, uint32_t mode)",
    ) as IPosixLibrary["openat"],
  };
};

interface IPosixConstants {
  O_CLOEXEC: number;
  O_CREAT: number;
  O_DIRECTORY: number;
  O_EXCL: number;
  O_NOFOLLOW: number;
  O_RDONLY: number;
  O_RDWR: number;
}

const requiredPosixConstants = (
  fileSystem: typeof fs,
  platform: NodeJS.Platform,
): IPosixConstants => {
  const constants = fileSystem.constants as unknown as Record<string, number>;
  const names = [
    "O_CLOEXEC",
    "O_CREAT",
    "O_DIRECTORY",
    "O_EXCL",
    "O_NOFOLLOW",
    "O_RDONLY",
    "O_RDWR",
  ] as const;
  for (const name of names)
    if (name !== "O_CLOEXEC" && typeof constants[name] !== "number")
      throw new Error(`supported POSIX runtime omitted ${name}`);
  const closeOnExec =
    constants.O_CLOEXEC ??
    (platform === "linux" || platform === "android" ? 0x00080000 : undefined);
  if (closeOnExec === undefined)
    throw new Error("supported POSIX runtime omitted O_CLOEXEC");
  return {
    O_CLOEXEC: closeOnExec,
    O_CREAT: constants.O_CREAT!,
    O_DIRECTORY: constants.O_DIRECTORY!,
    O_EXCL: constants.O_EXCL!,
    O_NOFOLLOW: constants.O_NOFOLLOW!,
    O_RDONLY: constants.O_RDONLY!,
    O_RDWR: constants.O_RDWR!,
  };
};

const openWindowsParent = (
  parentPath: string,
  environment: INativeEnvironment,
): IBoundParent => {
  const windows = environment.windowsLibrary();
  const raw = windows.createFile(
    path.toNamespacedPath(parentPath),
    0x00100081,
    0x7,
    null,
    0x3,
    0x02200000,
    null,
  );
  if (invalidWindowsHandle(environment.foreign, raw, windows.handleType)) {
    const code = windows.getLastError();
    if (code === 2 || code === 3 || code === 4390)
      throw new ScaffoldParentChangedError(
        nativeError("unable to open scaffold parent", code).message,
      );
    throw nativeError("unable to open scaffold parent", code);
  }
  const openChild = (
    childName: string,
    disposition: number,
  ): { handle?: unknown; status: number } => {
    const nameBytes = Buffer.from(`${childName}\0`, "utf16le");
    const unicode = {
      Buffer: nameBytes,
      Length: nameBytes.length - 2,
      MaximumLength: nameBytes.length,
    };
    const attributes = {
      Attributes: 0x40,
      Length: environment.foreign.sizeof(windows.objectAttributesType),
      ObjectName: unicode,
      RootDirectory: raw,
      SecurityDescriptor: null,
      SecurityQualityOfService: null,
    };
    const output: unknown[] = [null];
    const ioStatus = { Information: 0n, Status: 0n };
    // The exclusive create holds read and write access and lets a later
    // reader share the file; a resident reopen asks for read access only and
    // tolerates the still-open writer, so the pre-close identity check does
    // not trip a sharing violation on itself.
    const creating = disposition === 0x2;
    const status = windows.ntCreateFile(
      output,
      creating ? 0x00100183 : 0x00100081,
      attributes,
      ioStatus,
      null,
      0x80,
      creating ? 0x1 : 0x3,
      disposition,
      0x00200060,
      null,
      0,
    );
    if (status < 0) return { status };
    const childRaw = output[0];
    if (
      invalidWindowsHandle(environment.foreign, childRaw, windows.handleType)
    ) {
      const error = new Error(
        "native create returned an invalid scaffold child",
      );
      // A successful create that yields no usable handle has still reserved
      // the slot, so the caller learns about a created slot, not a clean miss.
      if (disposition === 0x2)
        throw new ScaffoldCreatedSlotError(
          "scaffold slot was created before its handle could be bound",
          { cause: error },
        );
      throw error;
    }
    return { handle: childRaw, status };
  };
  const parent: IBoundParent = {
    close: () => {
      if (windows.closeHandle(raw) === false)
        throw nativeError(
          "unable to close scaffold parent",
          windows.getLastError(),
        );
    },
    createExclusive: (childName) => {
      let created: { handle?: unknown; status: number };
      try {
        created = openChild(childName, 0x2);
      } catch (error) {
        if (error instanceof ScaffoldCreatedSlotError)
          return { error, status: "partial" };
        return { error, reason: "create-failed", status: "refused" };
      }
      if (created.handle !== undefined)
        return {
          child: windowsChild(windows, created.handle),
          status: "opened",
        };
      return {
        error: nativeError("unable to create scaffold child", created.status),
        reason:
          created.status === (0xc0000035 | 0)
            ? "target-competitor"
            : "create-failed",
        status: "refused",
      };
    },
    inspect: () => windows.inspectParent(raw),
    openResident: (childName) => {
      const opened = openChild(childName, 0x1);
      if (opened.handle === undefined)
        throw nativeError("unable to reopen scaffold child", opened.status);
      return windowsChild(windows, opened.handle);
    },
  };
  return parent;
};

const windowsChild = (
  windows: IWindowsLibrary,
  handle: unknown,
): IBoundChild => {
  const seek = (position: number): void => {
    if (windows.setFilePointer(handle, position) === false)
      throw nativeError(
        "unable to position scaffold child",
        windows.getLastError(),
      );
  };
  return {
    close: () => {
      if (windows.closeHandle(handle) === false)
        throw nativeError(
          "unable to close scaffold child",
          windows.getLastError(),
        );
    },
    read: (target, offset, length, position) => {
      seek(position);
      const read = windows.readFile(
        handle,
        target.subarray(offset, offset + length),
        length,
      );
      if (read === null)
        throw nativeError(
          "unable to read scaffold child",
          windows.getLastError(),
        );
      return read;
    },
    status: () => {
      const information = windows.inspectFile(handle);
      const reparse = (information.attributes & 0x400) !== 0;
      return {
        link: reparse,
        links: BigInt(information.links),
        regular: reparse === false && (information.attributes & 0x10) === 0,
        size: information.size,
        version: `${information.identity}:${information.size}:${information.lastWrite}`,
      };
    },
    sync: () => {
      if (windows.flushFileBuffers(handle) === false)
        throw nativeError(
          "unable to flush scaffold child",
          windows.getLastError(),
        );
    },
    write: (source, offset, length, position) => {
      seek(position);
      const written = windows.writeFile(
        handle,
        source.subarray(offset, offset + length),
        length,
      );
      if (written === null)
        throw nativeError(
          "unable to write scaffold child",
          windows.getLastError(),
        );
      return written;
    },
  };
};

interface IWindowsFileInformation {
  attributes: number;
  identity: string;
  lastWrite: bigint;
  links: number;
  size: bigint;
}

interface IWindowsLibrary {
  closeHandle(handle: unknown): boolean;
  createFile(
    pathname: string,
    access: number,
    share: number,
    security: unknown,
    disposition: number,
    flags: number,
    template: unknown,
  ): unknown;
  flushFileBuffers(handle: unknown): boolean;
  getLastError(): number;
  handleType: TypeObject;
  inspectFile(handle: unknown): IWindowsFileInformation;
  inspectParent(handle: unknown): { directory: boolean; identity: string };
  ntCreateFile: ReturnType<LibraryHandle["func"]>;
  objectAttributesType: TypeObject;
  readFile(handle: unknown, target: Buffer, length: number): number | null;
  setFilePointer(handle: unknown, position: number): boolean;
  writeFile(handle: unknown, source: Buffer, length: number): number | null;
}

const createWindowsLibrary = (foreign: typeof koffi): IWindowsLibrary => {
  const kernel = foreign.load("kernel32.dll");
  const ntdll = foreign.load("ntdll.dll");
  const handleType = foreign.pointer(
    "AutoMovieScaffoldHandle",
    foreign.opaque("AutoMovieScaffoldHandleValue"),
  );
  const unicodeType = foreign.struct("AutoMovieScaffoldUnicodeString", {
    Length: "uint16_t",
    MaximumLength: "uint16_t",
    Buffer: "void *",
  });
  const objectAttributesType = foreign.struct(
    "AutoMovieScaffoldObjectAttributes",
    {
      Length: "uint32_t",
      RootDirectory: handleType,
      ObjectName: foreign.pointer(unicodeType),
      Attributes: "uint32_t",
      SecurityDescriptor: "void *",
      SecurityQualityOfService: "void *",
    },
  );
  const ioStatusType = foreign.struct("AutoMovieScaffoldIoStatusBlock", {
    Status: "intptr_t",
    Information: "uintptr_t",
  });
  const fileTimeType = foreign.struct("AutoMovieScaffoldFileTime", {
    dwLowDateTime: "uint32_t",
    dwHighDateTime: "uint32_t",
  });
  const fileInformationType = foreign.struct(
    "AutoMovieScaffoldFileInformation",
    {
      dwFileAttributes: "uint32_t",
      ftCreationTime: fileTimeType,
      ftLastAccessTime: fileTimeType,
      ftLastWriteTime: fileTimeType,
      dwVolumeSerialNumber: "uint32_t",
      nFileSizeHigh: "uint32_t",
      nFileSizeLow: "uint32_t",
      nNumberOfLinks: "uint32_t",
      nFileIndexHigh: "uint32_t",
      nFileIndexLow: "uint32_t",
    },
  );
  const getFileInformation = kernel.func(
    "__stdcall",
    "GetFileInformationByHandle",
    "bool",
    [handleType, foreign.out(foreign.pointer(fileInformationType))],
  ) as (handle: unknown, information: Record<string, unknown>) => boolean;
  const getLastError = kernel.func(
    "uint32_t __stdcall GetLastError(void)",
  ) as IWindowsLibrary["getLastError"];
  const transferCount = foreign.out(foreign.pointer("uint32_t"));
  const writeFileNative = kernel.func("__stdcall", "WriteFile", "bool", [
    handleType,
    "void *",
    "uint32_t",
    transferCount,
    "void *",
  ]) as (
    handle: unknown,
    source: Buffer,
    length: number,
    written: number[],
    overlapped: null,
  ) => boolean;
  const readFileNative = kernel.func("__stdcall", "ReadFile", "bool", [
    handleType,
    "void *",
    "uint32_t",
    transferCount,
    "void *",
  ]) as (
    handle: unknown,
    target: Buffer,
    length: number,
    read: number[],
    overlapped: null,
  ) => boolean;
  const setFilePointerNative = kernel.func(
    "__stdcall",
    "SetFilePointerEx",
    "bool",
    [handleType, "int64_t", "void *", "uint32_t"],
  ) as (
    handle: unknown,
    distance: bigint,
    newPointer: null,
    method: number,
  ) => boolean;
  const dword = (value: unknown): number => Number(value) >>> 0;
  const readInformation = (
    handle: unknown,
    label: string,
  ): Record<string, unknown> => {
    const zeroTime = { dwHighDateTime: 0, dwLowDateTime: 0 };
    const information: Record<string, unknown> = {
      dwFileAttributes: 0,
      dwVolumeSerialNumber: 0,
      ftCreationTime: { ...zeroTime },
      ftLastAccessTime: { ...zeroTime },
      ftLastWriteTime: { ...zeroTime },
      nFileIndexHigh: 0,
      nFileIndexLow: 0,
      nFileSizeHigh: 0,
      nFileSizeLow: 0,
      nNumberOfLinks: 0,
    };
    if (getFileInformation(handle, information) === false)
      throw nativeError(`unable to inspect ${label}`, getLastError());
    return information;
  };
  const identityOf = (information: Record<string, unknown>): string => {
    const volume = BigInt(dword(information.dwVolumeSerialNumber));
    const fileIndex =
      (BigInt(dword(information.nFileIndexHigh)) << 32n) |
      BigInt(dword(information.nFileIndexLow));
    return `${volume}:${fileIndex}`;
  };
  return {
    closeHandle: kernel.func("__stdcall", "CloseHandle", "bool", [
      handleType,
    ]) as IWindowsLibrary["closeHandle"],
    createFile: kernel.func("__stdcall", "CreateFileW", handleType, [
      "str16",
      "uint32_t",
      "uint32_t",
      "void *",
      "uint32_t",
      "uint32_t",
      "void *",
    ]) as IWindowsLibrary["createFile"],
    flushFileBuffers: kernel.func("__stdcall", "FlushFileBuffers", "bool", [
      handleType,
    ]) as IWindowsLibrary["flushFileBuffers"],
    getLastError,
    handleType,
    inspectFile: (handle) => {
      const information = readInformation(handle, "scaffold child");
      const lastWrite = information.ftLastWriteTime as {
        dwHighDateTime: unknown;
        dwLowDateTime: unknown;
      };
      return {
        attributes: dword(information.dwFileAttributes),
        identity: identityOf(information),
        lastWrite:
          (BigInt(dword(lastWrite.dwHighDateTime)) << 32n) |
          BigInt(dword(lastWrite.dwLowDateTime)),
        links: dword(information.nNumberOfLinks),
        size:
          (BigInt(dword(information.nFileSizeHigh)) << 32n) |
          BigInt(dword(information.nFileSizeLow)),
      };
    },
    inspectParent: (handle) => {
      const information = readInformation(handle, "scaffold parent");
      return {
        directory: (dword(information.dwFileAttributes) & 0x10) !== 0,
        identity: identityOf(information),
      };
    },
    ntCreateFile: ntdll.func("__stdcall", "NtCreateFile", "int32_t", [
      foreign.out(foreign.pointer(handleType)),
      "uint32_t",
      foreign.pointer(objectAttributesType),
      foreign.out(foreign.pointer(ioStatusType)),
      "int64_t *",
      "uint32_t",
      "uint32_t",
      "uint32_t",
      "uint32_t",
      "void *",
      "uint32_t",
    ]),
    objectAttributesType,
    readFile: (handle, target, length) => {
      const read = [0];
      return readFileNative(handle, target, length, read, null) === false
        ? null
        : read[0]!;
    },
    setFilePointer: (handle, position) =>
      setFilePointerNative(handle, BigInt(position), null, 0),
    writeFile: (handle, source, length) => {
      const written = [0];
      return writeFileNative(handle, source, length, written, null) === false
        ? null
        : written[0]!;
    },
  };
};

const createNativeEnvironment = (props: {
  fileSystem: typeof fs;
  foreign: typeof koffi;
  platform: NodeJS.Platform;
}): INativeEnvironment => {
  let posix: IPosixLibrary | undefined;
  let windows: IWindowsLibrary | undefined;
  return {
    fileSystem: props.fileSystem,
    foreign: props.foreign,
    platform: props.platform,
    posixConstants: () =>
      requiredPosixConstants(props.fileSystem, props.platform),
    posixLibrary: () => (posix ??= createPosixLibrary(props.foreign)),
    windowsLibrary: () => (windows ??= createWindowsLibrary(props.foreign)),
  };
};

const NATIVE_ENVIRONMENT = createNativeEnvironment({
  fileSystem: fs,
  foreign: koffi,
  platform: process.platform,
});

/** @internal Injectable native boundary used only by semantic unit tests. */
export const nativeScaffoldPublicationForTesting = {
  createEnvironment: createNativeEnvironment,
  publish: publishNativeScaffoldFileWithEnvironment,
};

const invalidWindowsHandle = (
  foreign: typeof koffi,
  handle: unknown,
  handleType: TypeObject,
): boolean =>
  handle === null ||
  BigInt.asIntN(foreign.sizeof(handleType) * 8, foreign.address(handle)) ===
    -1n;

const assertBoundResident = (
  parent: IBoundParent,
  childName: string,
  expectedVersion: string,
): void => {
  const resident = parent.openResident(childName);
  let failure: unknown = undefined;
  try {
    const status = resident.status();
    assertOrdinarySingleLink(status, childName);
    if (status.version !== expectedVersion)
      throw new Error(
        `scaffold resident changed descriptor generation: ${childName}`,
      );
  } catch (error) {
    failure = error;
  }
  try {
    resident.close();
  } catch (closeError) {
    failure = combineFailures(
      failure,
      closeError,
      "resident scaffold descriptor close",
    );
  }
  if (failure !== undefined) throw nativeFailure(failure);
};

const assertChildBytes = (
  child: IBoundChild,
  childName: string,
  bytes: Buffer,
): void => {
  const readback = Buffer.alloc(bytes.length);
  let offset = 0;
  while (offset < readback.length) {
    const read = child.read(readback, offset, readback.length - offset, offset);
    if (read === 0)
      throw new Error(`scaffold file stopped during readback: ${childName}`);
    offset += read;
  }
  if (readback.equals(bytes) === false)
    throw new Error(`scaffold file changed during readback: ${childName}`);
};

const assertOrdinarySingleLink = (
  status: IBoundChildStatus,
  childName: string,
): void => {
  if (status.link || status.regular === false || status.links !== 1n)
    throw new Error(
      `scaffold file is not one ordinary single-link file: ${childName}`,
    );
};

const physicalIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}:${status.ino}`;

const physicalVersion = (status: fs.BigIntStats): string =>
  `${physicalIdentity(status)}:${status.size}:${status.mtimeNs}`;

const nativeError = (message: string, code: number): Error =>
  new Error(`${message} (native code ${code})`);

const nativeFailure = (failure: unknown): Error =>
  failure instanceof Error
    ? failure
    : new Error("Native scaffold publication failed.", { cause: failure });

const combineFailures = (
  first: unknown,
  second: unknown,
  resource: string,
): unknown =>
  first === undefined
    ? second
    : new AggregateError(
        [...(first instanceof AggregateError ? first.errors : [first]), second],
        `${resource} failed after publication failure`,
      );
