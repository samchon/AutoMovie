import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireCommitLock,
  describeCommitLockHolder,
  inspectCommitLock,
  releaseCommitLock,
} from "../project/commitLock";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieProductionOwnedFile } from "./productionRenderJob";

/**
 * Held namespace reservation for one physical production project root.
 */
export interface IAutoMovieProductionRootNamespaceLease {
  /**
   * Canonical physical root reserved by this lease.
   */
  root: string;
  /**
   * Fenced coordinate locks held for the namespace.
   */
  locks: ReadonlyArray<{ path: string; token: string }>;
  /**
   * Physical device identity included in the namespace claim.
   */
  device: string;
  /**
   * Physical inode identity included in the namespace claim.
   */
  inode: string;
}

/**
 * Where one project's namespace fences live: inside the project they fence.
 *
 * They used to live under the caller's home directory, and that is a per-user
 * path standing in for a per-machine one. Two accounts reaching one project
 * then computed the **same coordinate under different roots** and fenced
 * nothing — measured on one host as `production-id-1927a1d0….lock` resident in
 * two profiles at once, with an operation blocked from one side succeeding from
 * the other. That is the arrangement this product is built for: an authoring
 * agent inside a sandbox account, driven from outside it.
 *
 * A directory inside the root agrees for exactly the population that has to
 * agree — every process that can reach the project — and needs no cross-user
 * permission, no machine-global location and no cleanup owner. The objection
 * this design was written against, that neither the project nor its parent
 * should own transient lock bytes, is one the product already declines to
 * honour: `revision.lock` has always lived under `.automovie/productions`, and
 * the scaffold's ignore rules already cover everything below `.automovie` that
 * is not explicitly kept.
 *
 * Both coordinates stay. Aliases of one root differ in their path digest and
 * agree in their identity digest, so two spellings still collide on the second
 * — the same fence as before, in a place both callers can see.
 */
const coordinatePath = (
  kind: "root-path" | "root-id" | "production-path" | "production-id",
  namespace: string,
  lockRoot: string,
): string => {
  const directory = ensureCoordinateDirectory(lockRoot);
  // Case-folding can only over-coordinate distinct POSIX paths; it also makes
  // aliases of one case-insensitive Windows namespace share the same fence.
  const canonical = path.normalize(namespace).toLowerCase();
  const digest = crypto
    .createHash("sha256")
    .update(`${kind}\0${canonical}`)
    .digest("hex");
  return path.join(directory, `${kind}-${digest}.lock`);
};

const ensureCoordinateDirectory = (lockRoot: string): string => {
  const directory = path.join(lockRoot, AUTOMOVIE_NAMESPACE_LOCK_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  const linked = fs.lstatSync(directory);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `AutoMovie namespace lock path "${directory}" is not a physical directory.`,
    );
  return directory;
};

/**
 * The namespace lock directory's path relative to a project root.
 *
 * Under `.automovie` because the scaffold's ignore rules keep only the entries
 * they name there, so a transient lock is already ignored without a rule being
 * written for it.
 */
const AUTOMOVIE_NAMESPACE_LOCK_DIRECTORY = path.join(".automovie", "locks");

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
    throw contendedCoordinatesError(paths, error);
  }
};

/**
 * The refusal a contended coordinate set ends with, naming every lock held.
 *
 * One abnormally ended session leaves a lock on each coordinate it fenced — the
 * measured case left three, across the namespace coordinates and the revision
 * lock together — and an acquire fails on whichever it reaches first. A caller told about only that one clears it, retries, pays another full
 * timeout, and is refused by the next, with nothing anywhere saying a set
 * exists. Three rounds of that read as a fix that did not work.
 *
 * The survey costs one stat per coordinate, at the moment the operation is
 * already failing, and it is skipped entirely when at most one is held, because
 * then the underlying refusal already says everything there is to say.
 */
const contendedCoordinatesError = (
  paths: readonly string[],
  cause: unknown,
): unknown => {
  const holders = [...new Set(paths)]
    .sort(compareCodeUnits)
    .map((lockPath) => inspectCommitLock(lockPath))
    .filter((holder) => holder !== null);
  if (holders.length < 2 || cause instanceof Error === false) return cause;
  return new Error(
    `${cause.message}\n\nThis operation fences ${new Set(paths).size} coordinates and ${holders.length} of them are held, so clearing the one named above is not enough:\n${holders
      .map((holder) => `- ${describeCommitLockHolder(holder)}`)
      .join("\n")}`,
    { cause },
  );
};

const releaseCoordinates = (
  leases: readonly { path: string; token: string }[],
): void => {
  for (const lease of [...leases].reverse()) releaseCoordinate(lease);
};

/**
 * Create one directory by acting on the attempt, not by looking first.
 *
 * A root that does not exist has nowhere inside it to hold a lock, which is the
 * one case the in-project coordinates cannot serve. It does not need them:
 * `mkdir` on an existing path fails `EEXIST` **atomically, at the filesystem**,
 * so two processes racing to create one directory cannot both win it, with or
 * without a lock. What the removed coordinates added was that the look-then-
 * create sequence could not be interleaved — and a sequence with no look in it
 * cannot be interleaved either.
 *
 * The parent's physical identity is still checked, after rather than before. A
 * parent swapped mid-flight is what that check exists to catch, and catching it
 * afterwards catches the same swap; the difference is that the child now
 * definitely exists when the question is asked, so the answer is about what was
 * actually created.
 *
 * @returns the created or existing child's canonical path.
 */
const createDirectoryUnder = (
  parentReal: string,
  childName: string,
  describe: string,
): string => {
  const parentIdentity = fs.statSync(parentReal, { bigint: true });
  const physical = path.join(parentReal, childName);
  try {
    fs.mkdirSync(physical);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const current = lstatOrNull(physical);
    if (
      current === null ||
      current.isSymbolicLink() ||
      fs.statSync(physical).isDirectory() === false
    )
      throw new Error(`${describe} is not a physical directory.`);
  }
  const settled = physicalDirectoryIdentityOrNull(parentReal);
  if (
    settled === null ||
    settled.dev !== parentIdentity.dev ||
    settled.ino !== parentIdentity.ino
  )
    throw new Error(
      `Production project parent "${parentReal}" changed physical identity during namespace acquisition.`,
    );
  return fs.realpathSync(physical);
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
  return createDirectoryUnder(
    ensureDirectory(parent),
    path.basename(directory),
    `Production project parent "${directory}"`,
  );
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
          coordinatePath("root-path", root, root),
          coordinatePath("root-id", `${device}\0${inode}`, root),
        ])
      : acquireCoordinates([
          coordinatePath("production-path", `${root}\0${productionId}`, root),
          coordinatePath(
            "production-id",
            `${device}\0${inode}\0${productionId}`,
            root,
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
 */
export const acquireOrCreateProductionRootNamespace = (
  rootDirectory: string,
): IAutoMovieProductionRootNamespaceLease => {
  const root = path.resolve(rootDirectory);
  const linked = lstatOrNull(root);
  if (linked !== null) return acquireExistingRoot(root);
  const physical = createDirectoryUnder(
    ensureDirectory(path.dirname(root)),
    path.basename(root),
    `Production project root "${root}"`,
  );
  // The lease is taken after the root exists, which is what makes an in-project
  // coordinate possible at all: the winner of the creation is the first caller
  // able to fence inside it, and a loser meets that fence rather than a second
  // creation.
  const lease = acquireExistingRoot(physical);
  try {
    assertRequestedRootIdentity(root, lease);
    return lease;
  } catch (error) {
    releaseProductionRootNamespace(lease);
    throw error;
  }
};

/**
 * Verify that a held lease still names the same directory and lock token.
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
