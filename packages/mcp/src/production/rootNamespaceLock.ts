import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieProductionOwnedFile } from "./productionRenderJob";

const currentUser = os.userInfo();
const COORDINATION_ROOT = path.join(
  currentUser.homedir,
  ".automovie-root-locks",
);

/**
 * Held namespace reservation for one physical production project root.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source transactions an explicit capability representing the physical root they have fenced.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries path, identity, and token state as a typed lease checked by package code.
 */
export interface IAutoMovieProductionRootNamespaceLease {
  /**
   * Canonical physical root reserved by this lease.
   *
   * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Names the exact protected namespace.
   * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Binds the lease to its physical claim scope.
   */
  root: string;
  /**
   * Fenced coordinate locks held for the namespace.
   *
   * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-late-writer-fencing Carries the tokens that reject late writers.
   * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-fencing-late-writer Delivers every acquired fence with the lease.
   */
  locks: ReadonlyArray<{ path: string; token: string }>;
  /**
   * Physical device identity included in the namespace claim.
   *
   * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Prevents aliases from becoming separate owners.
   * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Grounds the claim in physical identity.
   */
  device: string;
  /**
   * Physical inode identity included in the namespace claim.
   *
   * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Prevents path aliases from escaping one scope.
   * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Completes the physical root identity.
   */
  inode: string;
}

const coordinatePath = (
  kind:
    | "create-path"
    | "create-id"
    | "root-path"
    | "root-id"
    | "production-path"
    | "production-id",
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

// One fenced operation can invoke another inside the same process -- a guarded
// commit runs the read-only compiler gate -- so a coordinate is reached twice.
// The commit lock counts that nesting itself, which is why these stay direct
// calls rather than a second depth map over the same paths.
const acquireCoordinate = (
  lockPath: string,
): { path: string; token: string } => ({
  path: lockPath,
  token: acquireCommitLock(lockPath),
});

const releaseCoordinate = (lease: { path: string; token: string }): void => {
  releaseCommitLock(lease.path, lease.token);
};

const acquireCoordinates = (
  paths: readonly string[],
): Array<{ path: string; token: string }> => {
  const leases: Array<{ path: string; token: string }> = [];
  try {
    for (const lockPath of [...new Set(paths)].sort(compareCodeUnits)) {
      leases.push(acquireCoordinate(lockPath));
    }
    return leases;
  } catch (error) {
    for (const lease of leases.reverse()) releaseCoordinate(lease);
    throw error;
  }
};

const releaseCoordinates = (
  leases: readonly { path: string; token: string }[],
): void => {
  for (const lease of [...leases].reverse()) releaseCoordinate(lease);
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
  productionId?: string,
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
  const locks =
    productionId === undefined
      ? acquireCoordinates([
          coordinatePath("root-path", root),
          coordinatePath("root-id", `${device}\0${inode}`),
        ])
      : acquireCoordinates([
          coordinatePath("production-path", `${root}\0${productionId}`),
          coordinatePath(
            "production-id",
            `${device}\0${inode}\0${productionId}`,
          ),
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows a source operation to reserve an existing production root before reading or mutating it.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Coordinates path and physical-identity locks outside the project through deterministic filesystem code.
 */
export const acquireProductionRootNamespace = (
  rootDirectory: string,
  productionId?: string,
): IAutoMovieProductionRootNamespaceLease =>
  acquireExistingRoot(path.resolve(rootDirectory), productionId);

/**
 * Reserve one physical project root, creating it when it is still absent.
 *
 * Missing parents and the root itself are created through already-resolved
 * physical parents under short external creation locks before the stable path
 * and physical-identity reservations take over.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows bootstrap code to create and reserve a missing root without racing aliases or parent replacement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Encodes parent creation locking and stable-root fencing in a reusable source operation.
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

/**
 * Verify that a held lease still names the same directory and lock token.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets every mutation checkpoint prove its held root and namespace token are still current.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Performs identity and fence revalidation locally before package code continues.
 */
export const assertProductionRootNamespaceLease = (
  lease: IAutoMovieProductionRootNamespaceLease,
): void => {
  const current = physicalDirectoryIdentityOrNull(lease.root);
  const invalidLock = lease.locks.find((leaseLock) => {
    const lock = lstatOrNull(leaseLock.path);
    if (lock === null || lock.isSymbolicLink() || lock.isFile() === false)
      return true;
    const root = path.dirname(leaseLock.path);
    try {
      return (
        Buffer.from(
          readAutoMovieProductionOwnedFile({
            root,
            directory: root,
            relative: path.basename(leaseLock.path),
          }),
        ).toString("utf8") !== leaseLock.token
      );
    } catch {
      return true;
    }
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

/**
 * Release one held physical-root namespace reservation.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets callers deterministically surrender the exact path and identity reservations held by a lease.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Owns token-checked lock cleanup in package code independently of MCP lifecycle.
 */
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
