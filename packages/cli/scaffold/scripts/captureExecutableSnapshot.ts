import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ICaptureExecutableSnapshot {
  descriptor: number;
  digest: `sha256:${string}`;
  directory: IPhysicalDirectory;
  identity: string;
  path: string;
  physicalIdentity: string;
}

interface IPhysicalDirectory {
  identity: string;
  path: string;
  real: string;
  version: string;
}

/** Open and fingerprint one physical executable for a later launch boundary. */
export const openCaptureExecutable = (
  file: string,
): ICaptureExecutableSnapshot => {
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
    if (opened.isFile() === false || physicalVersion(opened) !== identity)
      throw new Error(
        `Capture executable "${namespacePath}" changed before open.`,
      );
    const digest = digestDescriptor(descriptor);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    if (completed.isFile() === false || physicalVersion(completed) !== identity)
      throw new Error(
        `Capture executable "${namespacePath}" changed while hashed.`,
      );
    const snapshot: ICaptureExecutableSnapshot = {
      descriptor,
      digest,
      directory,
      identity,
      path: namespacePath,
      physicalIdentity: physicalFileIdentity(opened),
    };
    assertCaptureExecutable(snapshot);
    return snapshot;
  } catch (error) {
    fs.closeSync(descriptor);
    throw error;
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
    physicalVersion(opened) !== expected.identity ||
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
  if (digestDescriptor(expected.descriptor) !== expected.digest)
    throw new Error(
      `Capture executable "${expected.path}" changed open descriptor bytes.`,
    );
  const completed = fs.fstatSync(expected.descriptor, { bigint: true });
  if (
    completed.isFile() === false ||
    physicalVersion(completed) !== expected.identity
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

const digestDescriptor = (descriptor: number): `sha256:${string}` => {
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let position = 0;
  for (;;) {
    const length = fs.readSync(descriptor, chunk, 0, chunk.length, position);
    if (length === 0) break;
    hash.update(chunk.subarray(0, length));
    position += length;
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

const physicalFileIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}`;
