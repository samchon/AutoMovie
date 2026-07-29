import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";

const currentUser = os.userInfo();
const COORDINATION_ROOT = path.join(
  currentUser.homedir,
  ".automovie-root-locks",
);

/** Held namespace reservation for one physical production project root. */
export interface IAutoMovieProductionRootNamespaceLease {
  root: string;
  locks: ReadonlyArray<{ path: string; token: string }>;
  device: string;
  inode: string;
}

const coordinatePath = (
  kind: "create-path" | "create-id" | "root-path" | "root-id",
  namespace: string,
): string => {
  ensureCoordinationRoot();
  // Case-folding can only over-coordinate distinct POSIX paths; it also makes
  // aliases of one case-insensitive Windows namespace share the same fence.
  const canonical = path.normalize(namespace).toLowerCase();
  const digest = crypto
    .createHash("sha256")
    .update(`${kind}\0${canonical}`)
    .digest("hex");
  return path.join(COORDINATION_ROOT, `${kind}-${digest}.lock`);
};

const ensureCoordinationRoot = (): void => {
  try {
    fs.mkdirSync(COORDINATION_ROOT, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const linked = fs.lstatSync(COORDINATION_ROOT);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `AutoMovie root-lock coordination path "${COORDINATION_ROOT}" is not a physical directory.`,
    );
  fs.chmodSync(COORDINATION_ROOT, 0o700);
};

const acquireCoordinates = (
  paths: readonly string[],
): Array<{ path: string; token: string }> => {
  const leases: Array<{ path: string; token: string }> = [];
  try {
    for (const lockPath of [...new Set(paths)].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    )) {
      leases.push({ path: lockPath, token: acquireCommitLock(lockPath) });
    }
    return leases;
  } catch (error) {
    for (const lease of leases.reverse())
      releaseCommitLock(lease.path, lease.token);
    throw error;
  }
};

const releaseCoordinates = (
  leases: readonly { path: string; token: string }[],
): void => {
  for (const lease of [...leases].reverse())
    releaseCommitLock(lease.path, lease.token);
};

const creationCoordinates = (
  parentReal: string,
  childName: string,
  parentIdentity: fs.BigIntStats,
): string[] => {
  return [
    coordinatePath("create-path", path.join(parentReal, childName)),
    coordinatePath(
      "create-id",
      `${parentIdentity.dev}\0${parentIdentity.ino}\0${childName.toLowerCase()}`,
    ),
  ];
};

const acquireCreationCoordinates = (
  parentReal: string,
  childName: string,
): Array<{ path: string; token: string }> => {
  const parentIdentity = fs.statSync(parentReal, { bigint: true });
  const locks = acquireCoordinates(
    creationCoordinates(parentReal, childName, parentIdentity),
  );
  try {
    const current = physicalDirectoryIdentityOrNull(parentReal);
    if (
      current === null ||
      current.dev !== parentIdentity.dev ||
      current.ino !== parentIdentity.ino
    )
      throw new Error(
        `Production project parent "${parentReal}" changed physical identity during namespace acquisition. No child was created.`,
      );
    return locks;
  } catch (error) {
    releaseCoordinates(locks);
    throw error;
  }
};

const ensureDirectory = (directory: string): string => {
  const linked = lstatOrNull(directory);
  if (linked !== null) {
    if (fs.statSync(directory).isDirectory() === false)
      throw new Error(
        `Production project parent "${directory}" is not a directory.`,
      );
    return fs.realpathSync(directory);
  }
  const parent = path.dirname(directory);
  if (parent === directory)
    throw new Error(
      `Production project parent "${directory}" does not exist as a physical directory.`,
    );
  const parentReal = ensureDirectory(parent);
  const physical = path.join(parentReal, path.basename(directory));
  const locks = acquireCreationCoordinates(
    parentReal,
    path.basename(directory),
  );
  try {
    const current = lstatOrNull(physical);
    if (current === null) fs.mkdirSync(physical);
    else if (
      current.isSymbolicLink() ||
      fs.statSync(physical).isDirectory() === false
    )
      throw new Error(
        `Production project parent "${directory}" is not a physical directory.`,
      );
    return fs.realpathSync(physical);
  } finally {
    releaseCoordinates(locks);
  }
};

const acquireExistingRoot = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease => {
  const linked = lstatOrNull(rootDirectory);
  if (
    linked === null ||
    linked.isSymbolicLink() ||
    linked.isDirectory() === false
  )
    throw new Error(
      `Production project root "${rootDirectory}" is not a physical directory.`,
    );
  const root = fs.realpathSync(rootDirectory);
  const identity = fs.statSync(root, { bigint: true });
  const device = identity.dev.toString();
  const inode = identity.ino.toString();
  const locks = acquireCoordinates([
    coordinatePath("root-path", root),
    coordinatePath("root-id", `${device}\0${inode}`),
  ]);
  const lease: IAutoMovieProductionRootNamespaceLease = {
    root,
    locks,
    device,
    inode,
  };
  try {
    assertProductionRootNamespaceLease(lease);
    assertRequestedRootIdentity(rootDirectory, lease);
    return lease;
  } catch (error) {
    releaseProductionRootNamespace(lease);
    throw error;
  }
};

/**
 * Reserve one existing physical project root.
 *
 * Path and physical-identity locks live in a current-user coordination
 * directory, so neither the project nor its parent owns transient lock bytes.
 */
export const acquireProductionRootNamespace = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease =>
  acquireExistingRoot(path.resolve(rootDirectory));

/**
 * Reserve one physical project root, creating it when it is still absent.
 *
 * Missing parents and the root itself are created through already-resolved
 * physical parents under short external creation locks before the stable path
 * and physical-identity reservations take over.
 */
export const acquireOrCreateProductionRootNamespace = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease => {
  const root = path.resolve(rootDirectory);
  const linked = lstatOrNull(root);
  if (linked !== null) return acquireExistingRoot(root);
  const parentReal = ensureDirectory(path.dirname(root));
  const physical = path.join(parentReal, path.basename(root));
  const locks = acquireCreationCoordinates(parentReal, path.basename(root));
  try {
    const current = lstatOrNull(physical);
    if (current === null) fs.mkdirSync(physical);
    else if (current.isSymbolicLink() || current.isDirectory() === false)
      throw new Error(
        `Production project root "${root}" is not a physical directory.`,
      );
    const lease = acquireExistingRoot(physical);
    try {
      assertRequestedRootIdentity(root, lease);
      return lease;
    } catch (error) {
      releaseProductionRootNamespace(lease);
      throw error;
    }
  } finally {
    releaseCoordinates(locks);
  }
};

/** Verify that a held lease still names the same directory and lock token. */
export const assertProductionRootNamespaceLease = (
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  const current = physicalDirectoryIdentityOrNull(lease.root);
  const invalidLock = lease.locks.find((leaseLock) => {
    const lock = lstatOrNull(leaseLock.path);
    return (
      lock === null ||
      lock.isSymbolicLink() ||
      lock.isFile() === false ||
      fs.readFileSync(leaseLock.path, "utf8") !== leaseLock.token
    );
  });
  if (
    current === null ||
    current.dev.toString() !== lease.device ||
    current.ino.toString() !== lease.inode ||
    invalidLock !== undefined
  )
    throw new Error(
      `Production project root identity or namespace fence changed while "${lease.root}" was held. No unfenced project mutation is allowed.`,
    );
};

/** Release one held physical-root namespace reservation. */
export const releaseProductionRootNamespace = (
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  releaseCoordinates(lease.locks);
};

const assertRequestedRootIdentity = (
  requestedRoot: string,
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  const current = physicalDirectoryIdentityOrNull(requestedRoot);
  if (
    current === null ||
    current.dev.toString() !== lease.device ||
    current.ino.toString() !== lease.inode
  )
    throw new Error(
      `Requested production root "${requestedRoot}" changed physical identity during namespace acquisition. No project state was initialized.`,
    );
};

const physicalDirectoryIdentityOrNull = (
  directory: string,
): fs.BigIntStats | null => {
  const linked = lstatOrNull(directory);
  return linked === null ||
    linked.isSymbolicLink() ||
    linked.isDirectory() === false
    ? null
    : fs.statSync(directory, { bigint: true });
};

const lstatOrNull = (file: string): fs.Stats | null => {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    // `ENOENT` is an absent name; `ENOTDIR` is an absent path, because some
    // ancestor is a file. Both mean nothing is here, and both have to reach
    // the parent walk that names which ancestor is wrong. Surfacing the raw
    // errno instead would answer "not a directory" about a path the caller
    // never named.
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return null;
    throw error;
  }
};
