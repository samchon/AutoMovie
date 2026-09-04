import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IAutoMovieLocalProcessOwner,
  currentAutoMovieLocalProcessOwner,
  isAutoMovieLocalProcessOwner,
  observeAutoMovieLocalProcessOwner,
} from "./localProcessOwner";

/**
 * A short-lived, owner-identified commit lock guarding the project store's
 * optimistic-concurrency cycle (#1133, #1257).
 *
 * The lock file carries a per-acquire token. Ownership is fail-closed: only the
 * owner removes it, and age never authorizes another session to steal it. An
 * mtime-based reclaimer cannot prove the holder died, and a stat-then-rename
 * sequence can move a NEW owner's file if the path changes between those calls.
 * A lock is taken back only where the recorded owner is proven gone, and every
 * other lock is refused with the owner it names.
 *
 * - **Release is owner-checked.** {@link releaseCommitLock} deletes the lock only
 *   while it still holds this session's token. A foreign token is another
 *   session's lock and is never removed.
 * - **Acquisition is re-entrant inside one process.** A guarded commit runs the
 *   compiler's read-only input-snapshot confirmation, which commits its own
 *   snapshot, so one single-threaded process reaches the same lock twice. That
 *   is the same holder rather than a second session; without counting it the
 *   process waits out its own timeout and reports itself as the contender. The
 *   cross-session law is untouched: a foreign token is still never stolen, and
 *   the file is removed only when the outermost release runs.
 * - **A dead owner is proven, never assumed.** The token records the host,
 *   process id, and process generation that took the lock. An id nothing holds
 *   on this host cannot belong to a running owner, so two observations of that
 *   one case authorize reclaim. Every other case is refused and named: an id
 *   that *is* held proves nothing, since ids are reused, and a lock written on
 *   another host says nothing about this host's process table at all. Age still
 *   authorizes nothing.
 * - **Denial is not contention.** A lock the filesystem refuses to let this
 *   process create is refused at once, naming the path, rather than waiting out
 *   a deadline for a file it may never be allowed to make and then reporting an
 *   owner that does not exist.
 * - **Namespace retirement is explicit.** An owner that atomically removes the
 *   namespace containing its lock may retire every matching process-local
 *   nesting level without following the now-stale resident path.
 */

let lockNonce = 0;

/**
 * How many times one acquire may try to take back a lock it proved dead.
 *
 * More than one because the transfer can fail for a reason that is neither the
 * owner being alive nor the caller being wrong -- a handle held on the resident
 * path -- and fewer than many because a reclaim that keeps failing is waiting on
 * that handle, which retrying does not close.
 */
const COMMIT_LOCK_RECLAIM_ATTEMPTS = 3;

/** Pause between those attempts, so they span the wait rather than crowd it. */
const COMMIT_LOCK_RECLAIM_PAUSE_MS = 500;

/** Locks this process holds, with their nesting depth. */
const held = new Map<string, { token: string; depth: number }>();

const waitBuffer = new Int32Array(
  new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
);

const waitForRelease = (ms: number): void => {
  Atomics.wait(waitBuffer, 0, 0, ms);
};

interface ICommitLockSnapshot {
  identity: string;
  token: string;
}

interface ICommitLockDescriptorFailure {
  error: unknown;
}

/**
 * Aggregate of one lock-read failure and the descriptor cleanup that followed.
 */
export class CommitLockDescriptorCleanupError extends AggregateError {}

/**
 * Close one lock-read descriptor without letting the close replace the read
 * failure it happened under.
 *
 * The lock reader is the evidence source for every acquisition and release
 * decision, so a caller that sees only `EBADF` has lost the identity or token
 * mismatch that actually occurred. A close failure with no read failure in
 * flight is itself the failure and propagates unchanged.
 */
const closeCommitLockDescriptor = (
  descriptor: number,
  failure: ICommitLockDescriptorFailure | undefined,
  lockPath: string,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new CommitLockDescriptorCleanupError(
      [
        ...(failure.error instanceof CommitLockDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Commit-lock descriptor cleanup failed after the read failed: ${lockPath}.`,
    );
  }
};

const lockIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}`;

const readCommitLockSnapshot = (
  lockPath: string,
): ICommitLockSnapshot | null => {
  const linked = fs.lstatSync(lockPath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false) return null;
  const linkedIdentity = lockIdentity(linked);
  const descriptor = fs.openSync(lockPath, "r");
  let failure: ICommitLockDescriptorFailure | undefined;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (opened.isFile() === false) return null;
    const token = fs.readFileSync(descriptor, "utf8");
    const resident = fs.lstatSync(lockPath, { bigint: true });
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      lockIdentity(resident) !== linkedIdentity
    )
      return null;
    const residentDescriptor = fs.openSync(lockPath, "r");
    let residentFailure: ICommitLockDescriptorFailure | undefined;
    try {
      const current = fs.fstatSync(residentDescriptor, { bigint: true });
      if (
        current.isFile() === false ||
        lockIdentity(current) !== lockIdentity(opened)
      )
        return null;
    } catch (error) {
      residentFailure = { error };
      throw error;
    } finally {
      closeCommitLockDescriptor(residentDescriptor, residentFailure, lockPath);
    }
    return { identity: lockIdentity(opened), token };
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeCommitLockDescriptor(descriptor, failure, lockPath);
  }
};

const restoreQuarantinedLock = (quarantine: string, lockPath: string): void => {
  try {
    fs.linkSync(quarantine, lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    try {
      fs.copyFileSync(quarantine, lockPath, fs.constants.COPYFILE_EXCL);
    } catch {
      return;
    }
  }
  try {
    fs.rmSync(quarantine, { force: true });
  } catch {
    // The canonical foreign lock is restored; an extra hard link or backup
    // is fail-closed evidence and must not endanger the resident owner.
  }
};

/**
 * Take this process's ownership back when a release could not remove the file.
 *
 * The entry is restored only while the resident lock still carries this
 * session's token, so a successor written by another session is never adopted.
 * The lock stays re-entrant for this process and the next release retries the
 * removal, which turns a permanent fence into a retry.
 */
const reclaimCommitLock = (lockPath: string, token: string): void => {
  try {
    const resident = readCommitLockSnapshot(lockPath);
    if (resident !== null && resident.token === token)
      held.set(lockPath, { token, depth: 1 });
  } catch {
    // nothing resident to reclaim
  }
};

/**
 * Take the commit lock, returning the owner token to pass to
 * {@link releaseCommitLock}. Throws after ~2 s if the lock never frees.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery Reclaims only an unchanged lock whose local owner is proved absent twice.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-stale-claim-recovery Keeps malformed, remote-host, occupied-or-reused, and unavailable owner observations fail-closed.
 */
export const acquireCommitLock = (lockPath: string): string => {
  const current = held.get(lockPath);
  if (current !== undefined) {
    ++current.depth;
    return current.token;
  }
  const token = commitLockToken();
  const deadline = Date.now() + 2_000;
  let reclaims = 0;
  let nextReclaim = Date.now();
  for (;;) {
    try {
      // Exclusive create admits only one owner. The token is fully written
      // before this acquire returns, and contenders never read it to decide
      // whether they may proceed -- only to say who is in the way.
      fs.writeFileSync(lockPath, token, { flag: "wx" });
      held.set(lockPath, { token, depth: 1 });
      return token;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES")
        throw deniedCommitLockError(lockPath, error);
      if (code !== "EEXIST") throw error;
      // A few attempts, spaced, rather than one. The transfer renames onto the
      // resident path, and a rename onto an existing path fails outright on
      // Windows while anything else holds a handle on it -- `#1989` measured
      // exactly that, transiently, on this product's own atomic publish. One
      // attempt meant one such collision cost the caller the whole deadline and
      // then a refusal reading "it should have been reclaimed automatically",
      // which is the least useful thing this could say.
      //
      // Spaced, because a reclaim that keeps failing is a handle somebody is
      // holding, and retrying it every two milliseconds would spend the deadline
      // on renames instead of on waiting for that handle to close.
      if (
        reclaims < COMMIT_LOCK_RECLAIM_ATTEMPTS &&
        Date.now() >= nextReclaim
      ) {
        ++reclaims;
        nextReclaim = Date.now() + COMMIT_LOCK_RECLAIM_PAUSE_MS;
        if (reclaimDeadCommitLock(lockPath, token)) {
          held.set(lockPath, { token, depth: 1 });
          return token;
        }
      }
      if (Date.now() > deadline) throw contendedCommitLockError(lockPath);
      waitForRelease(2);
    }
  }
};

/**
 * Release the commit lock, but only if the exact resident file still holds
 * `token`. The verified file is moved to a unique same-directory quarantine and
 * identified again before deletion, so a replacement between verification and
 * mutation is restored without clobbering a successor. A vanished lock is a
 * no-op. Pass `unlink: false` after a namespace-identity failure to release
 * only this process's re-entrant ownership without following the resident path
 * into a replacement root. Pass `retire: true` only when the owning operation
 * removed the complete lock namespace; this invalidates every matching nesting
 * level and always returns without resident-path I/O because none can still own
 * the deleted physical lock.
 */
export const releaseCommitLock = (
  lockPath: string,
  token: string,
  options: { unlink?: boolean; retire?: boolean } = {},
): void => {
  const current = held.get(lockPath);
  let owned = false;
  if (current !== undefined && current.token === token) {
    if (options.retire !== true && --current.depth !== 0) return;
    held.delete(lockPath);
    owned = true;
  }
  if (options.retire === true || options.unlink === false) return;
  try {
    const observed = readCommitLockSnapshot(lockPath);
    if (observed === null || observed.token !== token) return;
    const quarantine = path.join(
      path.dirname(lockPath),
      `.automovie-lock-release-${process.pid}-${randomUUID()}`,
    );
    try {
      fs.renameSync(lockPath, quarantine);
    } catch {
      // The ownership entry is already gone and the resident lock still holds
      // this session's token, so returning here leaves the file with no owner
      // anywhere: every later acquisition of this coordinate, including one
      // from this very process, waits out its deadline and reports itself as a
      // foreign holder. One transient EPERM would fence the namespace until
      // somebody deleted the file by hand.
      if (owned) reclaimCommitLock(lockPath, token);
      return;
    }
    try {
      const moved = readCommitLockSnapshot(quarantine);
      if (
        moved !== null &&
        moved.identity === observed.identity &&
        moved.token === token
      )
        fs.rmSync(quarantine, { force: true });
      else restoreQuarantinedLock(quarantine, lockPath);
    } catch {
      restoreQuarantinedLock(quarantine, lockPath);
      if (owned) reclaimCommitLock(lockPath, token);
    }
  } catch {
    // already gone, nothing of ours to release
  }
};

/**
 * What a lock file records about the session that took it.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Records the complete local process generation and acquisition time behind the claim.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Makes PID reuse distinguishable from exact same-process ownership.
 */
export interface IAutoMovieCommitLockOwner extends IAutoMovieLocalProcessOwner {
  /**
   * Host the owner ran on.
   *
   * The coordination root lives under the user's home directory, and a roaming
   * or network home is reachable from more than one machine, so a process id
   * read here is only meaningful beside the host it was drawn on.
   */
  /** When the lock was taken, in epoch milliseconds. */
  at: number;
}

/**
 * Whether the recorded owner can still be committing.
 *
 * Only `absent` authorizes anything, and it is proof rather than inference: a
 * live process always occupies its own id, so an id nothing holds cannot belong
 * to a running owner. `occupied-or-reused` is deliberately not read as
 * "alive" -- ids are reused, and on a machine running more than one workload
 * the id may now belong to something entirely unrelated. `elsewhere` is the shared-home case, where
 * this host's process table answers a question about a different host.
 * `unknown` is a lock this version cannot read, including one written by an
 * older build, and it is refused like every other unproven case.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery Separates affirmative absence from every state that cannot authorize takeover.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-stale-claim-recovery Preserves generation-aware recovery observations without collapsing them to PID liveness.
 */
export type AutoMovieCommitLockOwnerState =
  | "same-owner"
  | "absent"
  | "occupied-or-reused"
  | "elsewhere"
  | "unknown";

/**
 * A lock as it stands right now, for a refusal that names who is in the way.
 *
 * Modelled as a union rather than an owner beside a state, because only one
 * pairing of the two is reachable in each arm: a file whose owner this build
 * cannot read is exactly the `unknown` case, and every other state was reached
 * by reading one. Stating that in the type is what keeps a reader from writing
 * a branch that cannot run.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Makes the observed owner and its recovery-authorizing state queryable.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Returns a typed, sanitized owner observation for operator diagnostics.
 */
export type IAutoMovieCommitLockHolder =
  | {
      /** The lock file inspected. */
      path: string;
      /** The owner the file records. */
      owner: IAutoMovieCommitLockOwner;
      /** What can be proven about that owner. */
      state: Exclude<AutoMovieCommitLockOwnerState, "unknown">;
    }
  | {
      /** The lock file inspected. */
      path: string;
      /** Validated owner when only its process observation failed. */
      owner: IAutoMovieCommitLockOwner | null;
      /** Nothing can be proven, so nothing is authorized. */
      state: "unknown";
      /** Sanitized failure class for a target-safe refusal. */
      reason:
        | "invalid-owner"
        | "lock-read-unavailable"
        | "process-query-unavailable";
    };

const OWNER_PREFIX = "automovie-commit-lock:";

/**
 * A token that is unique per acquire and readable by whoever is blocked on it.
 *
 * The uniqueness is what release checks; the recorded owner is what a refusal
 * reports and what a reclaim proves. Both live in one string because the lock
 * file is one exclusive create and a second file would not be written under the
 * same guarantee.
 */
const commitLockToken = (): string => {
  const owner = currentAutoMovieLocalProcessOwner();
  return `${OWNER_PREFIX}${JSON.stringify({
    ...owner,
    at: Date.now(),
    nonce: (lockNonce++).toString(36),
  })}`;
};

const readCommitLockOwner = (
  token: string,
): IAutoMovieCommitLockOwner | null => {
  if (token.startsWith(OWNER_PREFIX) === false) return null;
  try {
    const value: unknown = JSON.parse(token.slice(OWNER_PREFIX.length));
    if (typeof value !== "object" || value === null) return null;
    const { host, pid, generation, at } = value as Record<string, unknown>;
    if (typeof at !== "number" || Number.isSafeInteger(at) === false || at < 0)
      return null;
    const owner = { host, pid, generation };
    if (isAutoMovieLocalProcessOwner(owner) === false) return null;
    return { ...owner, at };
  } catch {
    return null;
  }
};

const commitLockOwnerState = (
  owner: IAutoMovieCommitLockOwner,
): ReturnType<typeof observeAutoMovieLocalProcessOwner> =>
  observeAutoMovieLocalProcessOwner({
    owner,
    current: currentAutoMovieLocalProcessOwner(),
    query: (pid, signal) => process.kill(pid, signal),
  });

interface ICommitLockInspection {
  holder: IAutoMovieCommitLockHolder;
  snapshot: ICommitLockSnapshot | null;
}

const inspectCommitLockSnapshot = (
  lockPath: string,
): ICommitLockInspection | null => {
  let resident: ICommitLockSnapshot | null;
  try {
    resident = readCommitLockSnapshot(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return {
      holder: {
        path: lockPath,
        owner: null,
        state: "unknown",
        reason: "lock-read-unavailable",
      },
      snapshot: null,
    };
  }
  if (resident === null) {
    try {
      fs.lstatSync(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    }
    return {
      holder: {
        path: lockPath,
        owner: null,
        state: "unknown",
        reason: "lock-read-unavailable",
      },
      snapshot: null,
    };
  }
  const owner = readCommitLockOwner(resident.token);
  if (owner === null)
    return {
      holder: {
        path: lockPath,
        owner: null,
        state: "unknown",
        reason: "invalid-owner",
      },
      snapshot: resident,
    };
  const observation = commitLockOwnerState(owner);
  return {
    holder:
      observation.state === "unknown"
        ? {
            path: lockPath,
            owner,
            state: "unknown",
            reason: observation.reason,
          }
        : { path: lockPath, owner, state: observation.state },
    snapshot: resident,
  };
};

/**
 * Who holds `lockPath` right now, or `null` when nobody does.
 *
 * Exported so an operation fencing several coordinates can report the whole set
 * it is standing behind. Clearing the one lock an error happens to name does
 * not clear the condition when a single dead session left three, and a caller
 * that learns them one refusal at a time pays a full timeout for each.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Exposes the full owner generation and observation behind a commit refusal.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Keeps absent storage distinct from unreadable or malformed claim state.
 */
export const inspectCommitLock = (
  lockPath: string,
): IAutoMovieCommitLockHolder | null =>
  inspectCommitLockSnapshot(lockPath)?.holder ?? null;

/**
 * One sentence describing a lock's holder, in the words its reader can act on.
 */
export const describeCommitLockHolder = (
  holder: IAutoMovieCommitLockHolder,
): string => {
  if (holder.state === "unknown")
    return holder.owner === null
      ? `"${holder.path}" has no trustworthy owner observation (${holder.reason})`
      : `"${holder.path}" records process ${holder.owner.pid} on this host, but its owner state is unknown (${holder.reason})`;
  const owner = holder.owner;
  const taken = ` taken ${Math.max(0, Math.round((Date.now() - owner.at) / 1000))}s ago`;
  switch (holder.state) {
    case "same-owner":
      return `"${holder.path}" is held by this process generation${taken}`;
    case "occupied-or-reused":
      return `"${holder.path}" records process ${owner.pid} on this host${taken}; that id is occupied, but the process table cannot prove it is the recorded generation`;
    case "absent":
      return `"${holder.path}" is held by process ${owner.pid} on this host${taken}, and no process holds that id, so the session that took it is gone`;
    case "elsewhere":
      return `"${holder.path}" is held by process ${owner.pid} on host "${owner.host}"${taken}; this host's process table cannot say whether that session is still running`;
  }
};

/**
 * The refusal a lock that cannot be written at all ends with.
 *
 * Contention and denial are different failures and only one of them is this
 * loop's business. Waiting out a deadline for a file the process may never
 * create spends two seconds to arrive at the same answer, and the answer it
 * arrived at named an owner that does not exist.
 *
 * Measured twice on one campaign, one step apart. First the coordination
 * directory refused a `chmod`; that was fixed, and the very next turn the same
 * environment refused the **lock file's own write** — `EPERM`, errno -4048,
 * from the exclusive create, with the guard rethrowing it unhandled because it
 * tolerated `EEXIST` and nothing else. Every command that reaches `open()` died
 * on an errno with no owner and no path explained.
 *
 * The condition is real and is not the caller's to fix from inside: a sandboxed
 * agent whose resolved home is an account it cannot write to reaches a
 * coordination root it can neither create in nor take a lock in. What it can
 * act on is being told which capability is missing and where, which is what
 * this says. Where that path should be instead is `#2012`.
 */
const deniedCommitLockError = (lockPath: string, cause: unknown): Error =>
  new Error(
    `AutoMovie cannot write the commit lock at "${lockPath}": the filesystem refused it (${(cause as NodeJS.ErrnoException).code}). This is a permission on that path rather than another session holding it, so waiting will not clear it. The lock lives under this account's home directory; grant this process write access there, or run it as the account that owns it.`,
    { cause },
  );

/**
 * The refusal a contended acquire ends with, naming the holder and its state.
 *
 * The advice differs by state on purpose. Telling an operator to "verify that
 * no AutoMovie commit is running" is correct and unactionable when the reader
 * is the agent this product is built to be driven by: it has no way to verify
 * that beyond the very process table the product declined to consult.
 */
const contendedCommitLockError = (lockPath: string): Error => {
  const holder = inspectCommitLock(lockPath);
  if (holder === null)
    return new Error(
      `the project commit lock at "${lockPath}" could not be taken and could not be read, so who holds it is unknown; retry shortly`,
    );
  return new Error(
    `the project commit lock is held by another session: ${describeCommitLockHolder(holder)}; ${COMMIT_LOCK_ADVICE[holder.state]}`,
  );
};

/**
 * What the reader can do about each state, in the words that state permits.
 *
 * Only `unknown` keeps the original instruction to verify by hand and remove
 * the file, because only there is the product genuinely unable to say anything
 * about the owner. Telling every reader to "verify that no AutoMovie commit is
 * running" was correct and unactionable for the reader this product is built
 * for: an agent has no way to verify that beyond the very process table the
 * product used to decline to consult.
 */
const COMMIT_LOCK_ADVICE: Record<AutoMovieCommitLockOwnerState, string> = {
  "same-owner": "retry after this process finishes its owning operation",
  "occupied-or-reused":
    "retry shortly; PID occupancy does not authorize reclaim",
  absent:
    "it should have been reclaimed automatically, so if this repeats, remove that file",
  elsewhere:
    "retry shortly, and if it never frees, verify on that host that no AutoMovie commit is running and remove that lock file manually",
  unknown:
    "retry shortly, or if a crashed process left it behind, verify that no AutoMovie commit is running and remove that lock file manually",
};

/**
 * Take over a lock whose owner is proven gone, or leave it exactly as it was.
 *
 * The transfer is a rename onto the resident path rather than a delete followed
 * by a create, so the lock file never ceases to exist and no third party can
 * win the exclusive create in a gap. The staging file doubles as the exclusion
 * between reclaimers: its own `wx` create admits one, and a second contender
 * falls back to waiting, which is what it would have been doing anyway.
 *
 * The resident token is read again inside that exclusion and the reclaim is
 * abandoned if it moved, because between the failed acquire and here the lock
 * may have been released and retaken by a live session.
 *
 * A crash between the staging create and the rename leaves the staging file
 * behind and blocks later reclaims of this one coordinate. That degrades to the
 * refusal, which now names the coordinate, rather than to a wrong reclaim.
 */
const reclaimDeadCommitLock = (lockPath: string, token: string): boolean => {
  const observed = inspectCommitLockSnapshot(lockPath);
  if (
    observed === null ||
    observed.snapshot === null ||
    observed.holder.state !== "absent"
  )
    return false;
  const staging = `${lockPath}.reclaim`;
  try {
    fs.writeFileSync(staging, token, { flag: "wx" });
  } catch {
    return false;
  }
  try {
    const resident = inspectCommitLockSnapshot(lockPath);
    if (
      resident === null ||
      resident.snapshot === null ||
      resident.holder.state !== "absent" ||
      resident.snapshot.identity !== observed.snapshot.identity ||
      resident.snapshot.token !== observed.snapshot.token
    ) {
      fs.rmSync(staging, { force: true });
      return false;
    }
    fs.renameSync(staging, lockPath);
    return true;
  } catch {
    try {
      fs.rmSync(staging, { force: true });
    } catch {
      // The resident lock is untouched either way; a staging file left behind
      // costs a later reclaim, not correctness.
    }
    return false;
  }
};
