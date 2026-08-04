import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ICaptureExecutableSnapshot {
  descriptor: number;
  /** Version read from this descriptor; compare only against another fstat. */
  descriptorVersion: string;
  digest: `sha256:${string}`;
  directory: IPhysicalDirectory;
  identity: string;
  maximumBytes: number | null;
  path: string;
  physicalIdentity: string;
}

interface IPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

/** Close a failed acquisition without discarding either failure. */
const throwCaptureExecutableSnapshotFailure = (
  failure: unknown,
  descriptor: number,
  operation: "creation" | "opening",
): never => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    throw new AggregateError(
      [failure, closeFailure],
      `Capture executable snapshot ${operation} and descriptor cleanup failed.`,
    );
  }
  throw failure;
};

/** Create private bytes and retain the exact descriptor opened with `wx+`. */
export const createCaptureExecutableSnapshot = (
  file: string,
  bytes: Uint8Array,
): ICaptureExecutableSnapshot => {
  const namespacePath = path.resolve(file);
  const before = physicalDirectory(
    path.dirname(namespacePath),
    "capture executable directory",
  );
  const descriptor = fs.openSync(namespacePath, "wx+");
  try {
    let position = 0;
    while (position < bytes.length) {
      const length = fs.writeSync(
        descriptor,
        bytes,
        position,
        bytes.length - position,
        position,
      );
      if (length === 0)
        throw new Error(`Capture executable "${namespacePath}" write stalled.`);
      position += length;
    }
    fs.fsyncSync(descriptor);
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false)
      throw new Error(`Capture executable "${namespacePath}" is not physical.`);
    const directory = physicalDirectory(
      path.dirname(namespacePath),
      "capture executable directory",
    );
    if (
      directory.path !== before.path ||
      directory.real !== before.real ||
      directory.identity !== before.identity
    )
      throw new Error(
        `Capture executable directory "${directory.path}" changed while created.`,
      );
    const resident = fs.lstatSync(namespacePath, { bigint: true });
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalFileIdentity(resident) !== physicalFileIdentity(opened)
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed while created.`,
      );
    const snapshot: ICaptureExecutableSnapshot = {
      descriptor,
      descriptorVersion: physicalVersion(opened),
      digest: digestDescriptor(descriptor, bytes.length),
      directory,
      identity: physicalVersion(resident),
      maximumBytes: bytes.length,
      path: namespacePath,
      physicalIdentity: physicalFileIdentity(opened),
    };
    assertCaptureExecutable(snapshot);
    return snapshot;
  } catch (error) {
    return throwCaptureExecutableSnapshotFailure(error, descriptor, "creation");
  }
};

/** Open and fingerprint one physical executable for a later launch boundary. */
export const openCaptureExecutable = (
  file: string,
  maximumBytes: number | null = null,
): ICaptureExecutableSnapshot => {
  if (
    maximumBytes !== null &&
    (Number.isSafeInteger(maximumBytes) === false || maximumBytes < 0)
  )
    throw new Error("Capture executable byte limit is invalid.");
  const namespacePath = path.resolve(file);
  const directory = physicalDirectory(
    path.dirname(namespacePath),
    "capture executable directory",
  );
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(
      `Capture executable "${namespacePath}" is not one physical file.`,
    );
  const identity = physicalVersion(linked);
  const descriptor = fs.openSync(namespacePath, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.isFile() === false ||
      physicalFileIdentity(opened) !== physicalFileIdentity(linked)
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed before open.`,
      );
    if (maximumBytes !== null && opened.size > BigInt(maximumBytes))
      throw new Error(
        `Capture executable "${namespacePath}" exceeds its maximum byte length.`,
      );
    const digest = digestDescriptor(descriptor, maximumBytes);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    const descriptorVersion = physicalVersion(opened);
    if (
      completed.isFile() === false ||
      physicalVersion(completed) !== descriptorVersion
    )
      throw new Error(
        `Capture executable "${namespacePath}" changed while hashed.`,
      );
    const snapshot: ICaptureExecutableSnapshot = {
      descriptor,
      descriptorVersion,
      digest,
      directory,
      identity,
      maximumBytes,
      path: namespacePath,
      physicalIdentity: physicalFileIdentity(opened),
    };
    assertCaptureExecutable(snapshot);
    return snapshot;
  } catch (error) {
    return throwCaptureExecutableSnapshotFailure(error, descriptor, "opening");
  }
};

/** Revalidate the open executable descriptor and its resident pathname. */
export const assertCaptureExecutable = (
  expected: ICaptureExecutableSnapshot,
): void => {
  assertCaptureExecutableDescriptor(expected);
  const resident = fs.lstatSync(expected.path, { bigint: true });
  if (
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== expected.identity
  )
    throw new Error(
      `Capture executable "${expected.path}" changed physical identity.`,
    );
  assertPhysicalDirectory(expected.directory, "capture executable directory");
};

/** Revalidate the exact open descriptor bytes without consulting its pathname. */
export const assertCaptureExecutableDescriptor = (
  expected: ICaptureExecutableSnapshot,
): void => {
  const opened = fs.fstatSync(expected.descriptor, { bigint: true });
  if (
    opened.isFile() === false ||
    physicalVersion(opened) !== expected.descriptorVersion ||
    physicalFileIdentity(opened) !== expected.physicalIdentity
  )
    throw new Error(
      `Capture executable "${expected.path}" changed open descriptor bytes.`,
    );
};

/** Rehash the exact open descriptor when byte-for-byte publication requires it. */
export const assertCaptureExecutableBytes = (
  expected: ICaptureExecutableSnapshot,
): void => {
  assertCaptureExecutableDescriptor(expected);
  if (
    digestDescriptor(expected.descriptor, expected.maximumBytes) !==
    expected.digest
  )
    throw new Error(
      `Capture executable "${expected.path}" changed open descriptor bytes.`,
    );
  const completed = fs.fstatSync(expected.descriptor, { bigint: true });
  if (
    completed.isFile() === false ||
    physicalVersion(completed) !== expected.descriptorVersion
  )
    throw new Error(
      `Capture executable "${expected.path}" changed while revalidated.`,
    );
};

/** Verify that one atomic rename published the same open file at a new path. */
export const assertRelocatedCaptureExecutable = (
  expected: ICaptureExecutableSnapshot,
  file: string,
): void => {
  assertCaptureExecutableBytes(expected);
  const destination = path.resolve(file);
  const directory = physicalDirectory(
    path.dirname(destination),
    "capture executable directory",
  );
  const resident = fs.lstatSync(destination, { bigint: true });
  if (
    directory.path !== expected.directory.path ||
    directory.real !== expected.directory.real ||
    directory.identity !== expected.directory.identity ||
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== expected.identity
  )
    throw new Error(
      `Capture executable "${expected.path}" was not relocated exactly.`,
    );
};

/** Remove a private staged path only while it still names the captured inode. */
export const removeCaptureExecutableIfResident = (
  expected: ICaptureExecutableSnapshot,
  file = expected.path,
): boolean => {
  try {
    const destination = path.resolve(file);
    const directory = physicalDirectory(
      path.dirname(destination),
      "capture executable directory",
    );
    const resident = fs.lstatSync(destination, { bigint: true });
    if (
      directory.path !== expected.directory.path ||
      directory.real !== expected.directory.real ||
      directory.identity !== expected.directory.identity ||
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      physicalFileIdentity(resident) !== expected.physicalIdentity
    )
      return false;
    fs.rmSync(destination, { force: true });
    return true;
  } catch {
    return false;
  }
};

/** Close a capture executable snapshot after launch verification. */
export const closeCaptureExecutable = (
  snapshot: ICaptureExecutableSnapshot,
): void => fs.closeSync(snapshot.descriptor);

const digestDescriptor = (
  descriptor: number,
  maximumBytes: number | null = null,
): `sha256:${string}` => {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let position = 0;
  for (;;) {
    const capacity =
      maximumBytes === null
        ? chunk.length
        : Math.min(chunk.length, maximumBytes - position + 1);
    if (capacity <= 0)
      throw new Error("Capture executable exceeds its maximum byte length.");
    const length = fs.readSync(descriptor, chunk, 0, capacity, position);
    if (length === 0) break;
    hash.update(chunk.subarray(0, length));
    position += length;
    if (maximumBytes !== null && position > maximumBytes)
      throw new Error("Capture executable exceeds its maximum byte length.");
  }
  return `sha256:${hash.digest("hex")}`;
};

const physicalDirectory = (
  directory: string,
  label: string,
): IPhysicalDirectory => {
  const namespacePath = path.resolve(directory);
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} "${namespacePath}" is not physical.`);
  const real = fs.realpathSync(namespacePath);
  const status = fs.statSync(real, { bigint: true });
  const version = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    version !== physicalVersion(linked)
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    identity: physicalFileIdentity(status),
    path: namespacePath,
    real,
    version,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (current.real !== expected.real || current.version !== expected.version)
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const physicalVersion = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

// A pathname stat and a descriptor stat do not agree on every field: Windows
// reads the volume serial through a different API for each, so one resident,
// unmodified file can report two devices. The file id is what both sources
// agree on, so every cross-source comparison binds by it.
const physicalFileIdentity = (status: fs.BigIntStats): string =>
  `${status.ino}`;
