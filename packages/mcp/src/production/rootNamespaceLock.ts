import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";

const currentUser = os.userInfo();
const userCoordinate = crypto
  .createHash("sha256")
  .update(`${currentUser.username}\0${currentUser.uid}`)
  .digest("hex")
  .slice(0, 16);
const COORDINATION_ROOT = path.join(
  os.tmpdir(),
  `automovie-root-locks-${userCoordinate}`,
);

/** Held namespace reservation for one physical production project root. */
export interface IAutoMovieProductionRootNamespaceLease {
  root: string;
  lockPath: string;
  token: string;
  device: number;
  inode: number;
}

const coordinatePath = (kind: "create" | "root", namespace: string): string => {
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
  const lockPath = coordinatePath("create", physical);
  const token = acquireCommitLock(lockPath);
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
    releaseCommitLock(lockPath, token);
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
  const identity = fs.statSync(root);
  const lockPath = coordinatePath("root", root);
  const token = acquireCommitLock(lockPath);
  const lease: IAutoMovieProductionRootNamespaceLease = {
    root,
    lockPath,
    token,
    device: identity.dev,
    inode: identity.ino,
  };
  try {
    assertProductionRootNamespaceLease(lease);
    assertRequestedRootIdentity(rootDirectory, lease);
    return lease;
  } catch (error) {
    releaseCommitLock(lockPath, token);
    throw error;
  }
};

/**
 * Reserve one existing physical project root.
 *
 * The durable namespace lock lives inside the project, so a writable project
 * never requires write access to its parent.
 */
export const acquireProductionRootNamespace = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease =>
  acquireExistingRoot(path.resolve(rootDirectory));

/**
 * Reserve one physical project root, creating it when it is still absent.
 *
 * Missing parents and the root itself are created through already-resolved
 * physical parents under short sibling creation locks before the project-owned
 * namespace reservation takes over.
 */
export const acquireOrCreateProductionRootNamespace = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease => {
  const root = path.resolve(rootDirectory);
  const linked = lstatOrNull(root);
  if (linked !== null) return acquireExistingRoot(root);
  const parentReal = ensureDirectory(path.dirname(root));
  const physical = path.join(parentReal, path.basename(root));
  const lockPath = coordinatePath("create", physical);
  const token = acquireCommitLock(lockPath);
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
    releaseCommitLock(lockPath, token);
  }
};

/** Verify that a held lease still names the same directory and lock token. */
export const assertProductionRootNamespaceLease = (
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  const linked = lstatOrNull(lease.root);
  const current =
    linked === null || linked.isSymbolicLink() || linked.isDirectory() === false
      ? null
      : fs.statSync(lease.root);
  const lock = lstatOrNull(lease.lockPath);
  if (
    current === null ||
    current.dev !== lease.device ||
    current.ino !== lease.inode ||
    lock === null ||
    lock.isSymbolicLink() ||
    lock.isFile() === false ||
    fs.readFileSync(lease.lockPath, "utf8") !== lease.token
  )
    throw new Error(
      `Production project root identity changed while "${lease.lockPath}" was held. No unfenced project mutation is allowed.`,
    );
};

/** Release one held physical-root namespace reservation. */
export const releaseProductionRootNamespace = (
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  releaseCommitLock(lease.lockPath, lease.token);
};

const assertRequestedRootIdentity = (
  requestedRoot: string,
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  const linked = lstatOrNull(requestedRoot);
  const current =
    linked === null || linked.isSymbolicLink() || linked.isDirectory() === false
      ? null
      : fs.statSync(requestedRoot);
  if (
    current === null ||
    current.dev !== lease.device ||
    current.ino !== lease.inode
  )
    throw new Error(
      `Requested production root "${requestedRoot}" changed physical identity during namespace acquisition. No project state was initialized.`,
    );
};

const lstatOrNull = (file: string): fs.Stats | null => {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
