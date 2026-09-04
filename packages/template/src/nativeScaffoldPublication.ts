import koffi, { type LibraryHandle, type TypeObject } from "koffi";
import * as fs from "node:fs";
import * as path from "node:path";

import type { IScaffoldParentPublicationRequest } from "./scaffoldFileSnapshot";
import type { ScaffoldFilePublicationOutcome } from "./scaffoldPublication";

interface IBoundParent {
  close(): void;
  createExclusive(childName: string): ICreateResult;
  openResident(childName: string): number;
}

type ICreateResult =
  | { descriptor: number; status: "opened" }
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
): ScaffoldFilePublicationOutcome => {
  let parent: IBoundParent;
  try {
    parent = openBoundParent(request);
  } catch (error) {
    return Object.freeze({
      error,
      reason:
        error instanceof ScaffoldParentChangedError
          ? "parent-changed"
          : "create-failed",
      status: "refused",
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
      reason: "create-failed",
      status: "refused",
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
  const descriptor = creation.descriptor;
  let bytesWritten = 0;
  let failure: unknown | undefined;
  let completedVersion: string | undefined;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLink(opened, request.childName);
    while (bytesWritten < source.length) {
      const written = fs.writeSync(
        descriptor,
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
    fs.fsyncSync(descriptor);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLink(completed, request.childName);
    if (completed.size !== BigInt(source.length))
      throw new Error(`scaffold file changed final size: ${request.childName}`);
    assertDescriptorBytes(descriptor, request.childName, source);
    completedVersion = physicalVersion(completed);
    assertBoundResident(parent, request.childName, completedVersion);
  } catch (error) {
    failure = error;
  }

  try {
    fs.closeSync(descriptor);
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
): IBoundParent => {
  const parent =
    process.platform === "win32"
      ? openWindowsParent(request.parentPath)
      : openPosixParent(request.parentPath);
  try {
    const status = fs.fstatSync(parentDescriptor(parent), { bigint: true });
    if (
      status.isDirectory() === false ||
      physicalIdentity(status) !== request.expectedParentIdentity
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

const PARENT_DESCRIPTOR = Symbol("parentDescriptor");
type ParentWithDescriptor = IBoundParent & { [PARENT_DESCRIPTOR]: number };

const parentDescriptor = (parent: IBoundParent): number =>
  (parent as ParentWithDescriptor)[PARENT_DESCRIPTOR];

const openPosixParent = (parentPath: string): IBoundParent => {
  const library = posixLibrary();
  const constants = requiredPosixConstants();
  const descriptor = library.open(
    parentPath,
    constants.O_RDONLY |
      constants.O_DIRECTORY |
      constants.O_NOFOLLOW |
      constants.O_CLOEXEC,
    0,
  );
  if (descriptor < 0) {
    const code = koffi.errno();
    const error = nativeError("unable to open scaffold parent", code);
    if (
      code === koffi.os.errno.ENOENT ||
      code === koffi.os.errno.ENOTDIR ||
      code === koffi.os.errno.ELOOP
    )
      throw new ScaffoldParentChangedError(error.message);
    throw error;
  }
  const parent: ParentWithDescriptor = {
    [PARENT_DESCRIPTOR]: descriptor,
    close: () => fs.closeSync(descriptor),
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
      if (child >= 0) return { descriptor: child, status: "opened" };
      const code = koffi.errno();
      return {
        error: nativeError("unable to create scaffold child", code),
        reason:
          code === koffi.os.errno.EEXIST
            ? "target-competitor"
            : "create-failed",
        status: "refused",
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
        throw nativeError("unable to reopen scaffold child", koffi.errno());
      return child;
    },
  };
  return parent;
};

interface IPosixLibrary {
  open(pathname: string, flags: number, mode: number): number;
  openat(
    directory: number,
    pathname: string,
    flags: number,
    mode: number,
  ): number;
}

let POSIX_LIBRARY: IPosixLibrary | undefined;
const posixLibrary = (): IPosixLibrary => {
  if (POSIX_LIBRARY !== undefined) return POSIX_LIBRARY;
  const library = koffi.load(null);
  POSIX_LIBRARY = {
    open: library.func(
      "int open(const char *pathname, int flags, uint32_t mode)",
    ) as IPosixLibrary["open"],
    openat: library.func(
      "int openat(int directory, const char *pathname, int flags, uint32_t mode)",
    ) as IPosixLibrary["openat"],
  };
  return POSIX_LIBRARY;
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

const requiredPosixConstants = (): IPosixConstants => {
  const constants = fs.constants as unknown as Record<string, number>;
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
    (process.platform === "linux" || process.platform === "android"
      ? 0x00080000
      : undefined);
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

const openWindowsParent = (parentPath: string): IBoundParent => {
  const windows = windowsLibrary();
  const raw = windows.createFile(
    path.toNamespacedPath(parentPath),
    0x00100081,
    0x7,
    null,
    0x3,
    0x02200000,
    null,
  );
  if (invalidWindowsHandle(raw, windows.handleType)) {
    const code = windows.getLastError();
    if (code === 2 || code === 3 || code === 4390)
      throw new ScaffoldParentChangedError(
        nativeError("unable to open scaffold parent", code).message,
      );
    throw nativeError("unable to open scaffold parent", code);
  }
  const descriptor = windows.openOsHandle(raw, 0x8000);
  if (descriptor < 0) {
    const code = koffi.errno();
    windows.closeHandle(raw);
    throw nativeError("unable to adopt scaffold parent handle", code);
  }
  const openChild = (
    childName: string,
    disposition: number,
  ): { descriptor?: number; status: number } => {
    const nameBytes = Buffer.from(`${childName}\0`, "utf16le");
    const unicode = {
      Buffer: nameBytes,
      Length: nameBytes.length - 2,
      MaximumLength: nameBytes.length,
    };
    const attributes = {
      Attributes: 0x40,
      Length: koffi.sizeof(windows.objectAttributesType),
      ObjectName: unicode,
      RootDirectory: raw,
      SecurityDescriptor: null,
      SecurityQualityOfService: null,
    };
    const output: unknown[] = [null];
    const ioStatus = { Information: 0n, Status: 0n };
    const status = windows.ntCreateFile(
      output,
      0x00100183,
      attributes,
      ioStatus,
      null,
      0x80,
      0x7,
      disposition,
      0x00200060,
      null,
      0,
    );
    if (status < 0) return { status };
    const childRaw = output[0];
    const childDescriptor = windows.openOsHandle(childRaw, 0x8002);
    if (childDescriptor < 0) {
      const code = koffi.errno();
      let error: unknown = nativeError(
        "unable to adopt scaffold child handle",
        code,
      );
      if (windows.closeHandle(childRaw) === false)
        error = combineFailures(
          error,
          nativeError(
            "unable to close unadopted scaffold child",
            windows.getLastError(),
          ),
          "unadopted scaffold child",
        );
      if (disposition === 0x2)
        throw new ScaffoldCreatedSlotError(
          "scaffold slot was created before descriptor adoption failed",
          { cause: error },
        );
      throw error;
    }
    return { descriptor: childDescriptor, status };
  };
  const parent: ParentWithDescriptor = {
    [PARENT_DESCRIPTOR]: descriptor,
    close: () => fs.closeSync(descriptor),
    createExclusive: (childName) => {
      let created: { descriptor?: number; status: number };
      try {
        created = openChild(childName, 0x2);
      } catch (error) {
        if (error instanceof ScaffoldCreatedSlotError)
          return { error, status: "partial" };
        return { error, reason: "create-failed", status: "refused" };
      }
      if (created.descriptor !== undefined)
        return { descriptor: created.descriptor, status: "opened" };
      return {
        error: nativeError("unable to create scaffold child", created.status),
        reason:
          created.status === (0xc0000035 | 0)
            ? "target-competitor"
            : "create-failed",
        status: "refused",
      };
    },
    openResident: (childName) => {
      const opened = openChild(childName, 0x1);
      if (opened.descriptor === undefined)
        throw nativeError("unable to reopen scaffold child", opened.status);
      return opened.descriptor;
    },
  };
  return parent;
};

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
  getLastError(): number;
  handleType: TypeObject;
  ntCreateFile: ReturnType<LibraryHandle["func"]>;
  objectAttributesType: TypeObject;
  openOsHandle(handle: unknown, flags: number): number;
}

let WINDOWS_LIBRARY: IWindowsLibrary | undefined;
const windowsLibrary = (): IWindowsLibrary => {
  if (WINDOWS_LIBRARY !== undefined) return WINDOWS_LIBRARY;
  const kernel = koffi.load("kernel32.dll");
  const runtime = koffi.load("ucrtbase.dll");
  const ntdll = koffi.load("ntdll.dll");
  const handleType = koffi.pointer(
    "AutoMovieScaffoldHandle",
    koffi.opaque("AutoMovieScaffoldHandleValue"),
  );
  const unicodeType = koffi.struct("AutoMovieScaffoldUnicodeString", {
    Length: "uint16_t",
    MaximumLength: "uint16_t",
    Buffer: "void *",
  });
  const objectAttributesType = koffi.struct(
    "AutoMovieScaffoldObjectAttributes",
    {
      Length: "uint32_t",
      RootDirectory: handleType,
      ObjectName: koffi.pointer(unicodeType),
      Attributes: "uint32_t",
      SecurityDescriptor: "void *",
      SecurityQualityOfService: "void *",
    },
  );
  const ioStatusType = koffi.struct("AutoMovieScaffoldIoStatusBlock", {
    Status: "intptr_t",
    Information: "uintptr_t",
  });
  WINDOWS_LIBRARY = {
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
      handleType,
    ]) as IWindowsLibrary["createFile"],
    getLastError: kernel.func(
      "uint32_t __stdcall GetLastError(void)",
    ) as IWindowsLibrary["getLastError"],
    handleType,
    ntCreateFile: ntdll.func("NtCreateFile", "int32_t", [
      koffi.out(koffi.pointer(handleType)),
      "uint32_t",
      koffi.pointer(objectAttributesType),
      koffi.out(koffi.pointer(ioStatusType)),
      "int64_t *",
      "uint32_t",
      "uint32_t",
      "uint32_t",
      "uint32_t",
      "void *",
      "uint32_t",
    ]),
    objectAttributesType,
    openOsHandle: runtime.func(
      "int _open_osfhandle(intptr_t handle, int flags)",
    ) as IWindowsLibrary["openOsHandle"],
  };
  return WINDOWS_LIBRARY;
};

const invalidWindowsHandle = (
  handle: unknown,
  handleType: TypeObject,
): boolean =>
  handle === null ||
  BigInt.asIntN(koffi.sizeof(handleType) * 8, koffi.address(handle)) === -1n;

const assertBoundResident = (
  parent: IBoundParent,
  childName: string,
  expectedVersion: string,
): void => {
  const descriptor = parent.openResident(childName);
  let failure: unknown | undefined;
  try {
    const status = fs.fstatSync(descriptor, { bigint: true });
    assertOrdinarySingleLink(status, childName);
    if (physicalVersion(status) !== expectedVersion)
      throw new Error(
        `scaffold resident changed descriptor generation: ${childName}`,
      );
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (closeError) {
      if (failure === undefined) throw closeError;
      throw combineFailures(
        failure,
        closeError,
        "resident scaffold descriptor close",
      );
    }
  }
};

const assertDescriptorBytes = (
  descriptor: number,
  childName: string,
  bytes: Buffer,
): void => {
  const readback = Buffer.alloc(bytes.length);
  let offset = 0;
  while (offset < readback.length) {
    const read = fs.readSync(
      descriptor,
      readback,
      offset,
      readback.length - offset,
      offset,
    );
    if (read === 0)
      throw new Error(`scaffold file stopped during readback: ${childName}`);
    offset += read;
  }
  if (readback.equals(bytes) === false)
    throw new Error(`scaffold file changed during readback: ${childName}`);
};

const assertOrdinarySingleLink = (
  status: fs.BigIntStats,
  childName: string,
): void => {
  if (
    status.isSymbolicLink() ||
    status.isFile() === false ||
    status.nlink !== 1n
  )
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

const combineFailures = (
  first: unknown | undefined,
  second: unknown,
  resource: string,
): unknown =>
  first === undefined
    ? second
    : new AggregateError(
        [...(first instanceof AggregateError ? first.errors : [first]), second],
        `${resource} failed after publication failure`,
      );
