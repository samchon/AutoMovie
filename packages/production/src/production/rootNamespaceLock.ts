import crypto from "node:crypto";
import type { BigIntStats, Stats } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  acquireCommitLock,
  describeCommitLockHolder,
  inspectCommitLock,
  releaseCommitLock,
} from "../project/commitLock";
import { autoMovieFileSystem as fileSystem } from "../project/fileSystem";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieProductionOwnedFile } from "./productionRenderJob";

/**
 * Where this machine keeps its root-namespace fences, resolved on first use.
 *
 * Resolved lazily, and that is the whole point of the indirection. This was a
 * module-scope `os.userInfo()`, and the package barrel re-exports this module,
 * so importing `@automovie/production` at all evaluated it. Where that syscall is
 * denied the package could not be imported — not degraded, not partly working:
 * the import threw before any of the surface existed, and every scaffold script
 * that reaches the package went with it. That environment is the one an
 * authoring agent actually works in, where the call fails as
 * `uv_os_get_passwd returned ENOMEM` with gigabytes free, naming a resource
 * that is not the problem. A caller that never takes a lease now never asks.
 *
 * `os.homedir()` is tried first because it is the datum this actually needs and
 * it prefers the environment before consulting a passwd database. The passwd
 * entry is the fallback rather than the source.
 *
 * What it must never do is choose a different path when neither answers. Two
 * processes disagreeing about where the coordination root lives is precisely
 * the state these locks exist to prevent, so an unresolvable home is a refusal
 * naming the capability rather than a temporary directory nobody else will look
 * in.
 *
 * {@link AUTOMOVIE_COORDINATION_ROOT_VARIABLE} overrides the home entirely, and
 * exists because the home does not always satisfy the one invariant this path
 * has: **two processes reaching one project must compute the same path**. It
 * fails that in two measured ways. On one machine `os.homedir()` resolved to
 * `CodexSandboxOffline` for an authoring agent and to `samch` for the process
 * driving it, so both computed the same coordinate under different roots and
 * fenced nothing — the same name, two directories, no exclusion. On another the
 * account owned the home and the sandbox denied the write regardless, because
 * its writable roots are the workdir and the temporary directories while the
 * home sits outside both. That is the arrangement this product is built around,
 * so the default is wrong for its own target environment often enough to need a
 * way out.
 *
 * The override is a path and not a switch: it moves the root, it never disables
 * the fence. An operator pointing both processes at one directory satisfies the
 * invariant by configuration, which is the only thing available while no path is
 * both machine-global and writable by every account that runs this product. That
 * larger question is `#2012` and this does not settle it.
 *
 * A relative override is refused rather than resolved, because it would resolve
 * against each process's own working directory and reintroduce exactly the
 * divergence it was set to remove.
 */
const coordinationRoot = (): string => {
  if (resolvedCoordinationRoot !== null) return resolvedCoordinationRoot;
  const configured = process.env[AUTOMOVIE_COORDINATION_ROOT_VARIABLE];
  if (configured !== undefined && configured.trim().length !== 0) {
    const value = configured.trim();
    if (path.isAbsolute(value) === false)
      throw new Error(
        `${AUTOMOVIE_COORDINATION_ROOT_VARIABLE} is "${value}", which is not an absolute path. A relative coordination root resolves against each process's own working directory, so two processes fencing one project would compute two directories and exclude nothing. State an absolute path both processes can reach, or unset the variable to use this account's home.`,
      );
    resolvedCoordinationRoot = value;
    return resolvedCoordinationRoot;
  }
  const home = ((): string => {
    for (const read of [
      () => os.homedir(),
      () => os.userInfo().homedir,
    ] as const)
      try {
        const value = read();
        if (typeof value === "string" && value.length !== 0) return value;
      } catch {
        continue;
      }
    throw new Error(
      "AutoMovie cannot resolve this account's home directory, so it cannot name the root-lock coordination path every process on this machine has to agree on. Neither os.homedir() nor os.userInfo() answered, which a sandbox that withholds the passwd database does. Grant that access or run outside the sandbox; a fallback path would let two processes fence against different roots, which is what these locks exist to prevent.",
    );
  })();
  resolvedCoordinationRoot = path.join(home, ".automovie-root-locks");
  return resolvedCoordinationRoot;
};

let resolvedCoordinationRoot: string | null = null;

/**
 * Environment variable naming the root-lock coordination directory.
 *
 * Exported so a refusal, a guide, and a test all spell it the same way; the
 * message an operator reads is the only instruction they get, and a variable
 * misspelled in one of three places is a variable that does nothing.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Names the operator-supplied coordination root every process fencing one project must agree on.
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-concurrent-runs-locking Makes duplicate acquisition, stale ownership, fencing, bounded waiting, and immutable reuse share one physical root-lock namespace.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Fixes the environment variable that selects the coordination root the lock identity is computed under.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-concurrent-ownership-contract Carries the single coordination namespace used by duplicate-job, stale-claim, fencing, deadlock, immutable-result, and publication ownership checks.
 */
export const AUTOMOVIE_COORDINATION_ROOT_VARIABLE =
  "AUTOMOVIE_COORDINATION_ROOT";

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
  return path.join(coordinationRoot(), `${kind}-${digest}.lock`);
};

/**
 * Make the coordination root usable, without enforcing a mode it may not own.
 *
 * The mode is set when this call creates the directory, and only then. It used
 * to be re-applied unconditionally on every call, which meant a directory this
 * process did not create — or could not write to — killed the process instead
 * of being used.
 *
 * Two benchmark sandboxes measured that, and neither was an ownership problem
 * the caller could fix:
 *
 * - one where `os.homedir()` resolved to another account's profile, so
 *   `chmod` refused on a directory that belonged to somebody else;
 * - one where the account **did** own it and the sandbox denied the write
 *   anyway, because its writable roots are the workdir and the temporary
 *   directories while the home is elsewhere. That is every sandboxed authoring
 *   agent, which is the arrangement this product is built around.
 *
 * Both produced `EPERM: operation not permitted, chmod` from `open()`, which
 * every project command crosses, and the process died during directory
 * preparation — before any lock was read, so the refusals that name a lock's
 * owner never got the chance to run.
 *
 * A directory somebody else made is theirs to permission. What this needs from
 * it is that it exists and is a physical directory, which is still checked and
 * still refused. Whether the coordination root belongs in a per-user path at
 * all is a separate and larger question, recorded in `#2012`; this is the part
 * that turns a fatal crash into a working lease.
 */
const ensureCoordinationRoot = (): void => {
  try {
    fileSystem.mkdirSync(coordinationRoot(), { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const linked = fileSystem.lstatSync(coordinationRoot());
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `AutoMovie root-lock coordination path "${coordinationRoot()}" is not a physical directory.`,
    );
  // Asked here rather than discovered at the lock file's own `open()`. The
  // later refusal names the file and says waiting will not clear it, which is
  // true and leaves the reader holding an errno about a path they never chose.
  // A sandbox whose writable roots are the workdir and the temporary
  // directories fails this every time, and the only useful thing to say is
  // where to move the root to.
  try {
    fileSystem.accessSync(coordinationRoot(), fileSystem.constants.W_OK);
  } catch (error) {
    throw new Error(
      `AutoMovie cannot write the root-lock coordination directory "${coordinationRoot()}", so it cannot fence this project against another process. This is the account's home by default, which a sandbox that admits only its workdir and the temporary directories does not grant. Set ${AUTOMOVIE_COORDINATION_ROOT_VARIABLE} to an absolute directory every process working on this project can write, and set it identically for all of them: two processes fencing against two directories exclude nothing.`,
      { cause: error },
    );
  }
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
    throw contendedCoordinatesError(paths, error);
  }
};

/**
 * The refusal a contended coordinate set ends with, naming every lock held.
 *
 * One abnormally ended session leaves a lock on each coordinate it fenced — the
 * measured case left three, across the user-global coordination root and the
 * in-tree revision lock together — and an acquire fails on whichever it reaches
 * first. A caller told about only that one clears it, retries, pays another full
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

const creationCoordinates = (
  parentReal: string,
  childName: string,
  parentIdentity: BigIntStats,
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
  const parentIdentity = fileSystem.statSync(parentReal, { bigint: true });
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
    if (fileSystem.statSync(directory).isDirectory() === false)
      throw new Error(
        `Production project parent "${directory}" is not a directory.`,
      );
    return fileSystem.realpathSync(directory);
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
    if (current === null) fileSystem.mkdirSync(physical);
    else if (
      current.isSymbolicLink() ||
      fileSystem.statSync(physical).isDirectory() === false
    )
      throw new Error(
        `Production project parent "${directory}" is not a physical directory.`,
      );
    return fileSystem.realpathSync(physical);
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
  const root = fileSystem.realpathSync(rootDirectory);
  const identity = fileSystem.statSync(root, { bigint: true });
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
  const parentReal = ensureDirectory(path.dirname(root));
  const physical = path.join(parentReal, path.basename(root));
  const locks = acquireCreationCoordinates(parentReal, path.basename(root));
  try {
    const current = lstatOrNull(physical);
    if (current === null) fileSystem.mkdirSync(physical);
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
): BigIntStats | null => {
  const linked = lstatOrNull(directory);
  return linked === null ||
    linked.isSymbolicLink() ||
    linked.isDirectory() === false
    ? null
    : fileSystem.statSync(directory, { bigint: true });
};

const lstatOrNull = (file: string): Stats | null => {
  try {
    return fileSystem.lstatSync(file);
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
