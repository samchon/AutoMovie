import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ICaptureExecutableSnapshot {
  descriptor: number;
  digest: `sha256:${string}`;
  directory: IPhysicalDirectory;
  identity: string;
  path: string;
}

interface IPhysicalDirectory {
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
  const opened = fs.fstatSync(expected.descriptor, { bigint: true });
  const resident = fs.lstatSync(expected.path, { bigint: true });
  if (
    opened.isFile() === false ||
    physicalVersion(opened) !== expected.identity ||
    resident.isSymbolicLink() ||
    resident.isFile() === false ||
    physicalVersion(resident) !== expected.identity
  )
    throw new Error(
      `Capture executable "${expected.path}" changed physical identity.`,
    );
  assertPhysicalDirectory(expected.directory, "capture executable directory");
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
  return { path: namespacePath, real, version };
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
