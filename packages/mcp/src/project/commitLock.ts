import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * A short-lived, owner-identified commit lock guarding the project store's
 * optimistic-concurrency cycle (#1133, #1257).
 *
 * The lock file carries a per-acquire token. Ownership is fail-closed: only the
 * owner removes it, and age never authorizes another session to steal it. An
 * mtime-based reclaimer cannot prove the holder died, and a stat-then-rename
 * sequence can move a NEW owner's file if the path changes between those calls.
 * A lock left by a crash therefore requires explicit operator recovery after
 * verifying that no commit process is alive.
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
 * - **Namespace retirement is explicit.** An owner that atomically removes the
 *   namespace containing its lock may retire every matching process-local
 *   nesting level without following the now-stale resident path.
 */

let lockNonce = 0;

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

const lockIdentity = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}`;

const readCommitLockSnapshot = (
  lockPath: string,
): ICommitLockSnapshot | null => {
  const linked = fs.lstatSync(lockPath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false) return null;
  const linkedIdentity = lockIdentity(linked);
  const descriptor = fs.openSync(lockPath, "r");
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
    try {
      const current = fs.fstatSync(residentDescriptor, { bigint: true });
      if (
        current.isFile() === false ||
        lockIdentity(current) !== lockIdentity(opened)
      )
        return null;
    } finally {
      fs.closeSync(residentDescriptor);
    }
    return { identity: lockIdentity(opened), token };
  } finally {
    fs.closeSync(descriptor);
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
 * Take the commit lock, returning the owner token to pass to
 * {@link releaseCommitLock}. Throws after ~2 s if the lock never frees.
 */
export const acquireCommitLock = (lockPath: string): string => {
  const current = held.get(lockPath);
  if (current !== undefined) {
    ++current.depth;
    return current.token;
  }
  const token = `${process.pid}.${(lockNonce++).toString(36)}.${Date.now().toString(36)}`;
  const deadline = Date.now() + 2_000;
  for (;;) {
    try {
      // Exclusive create admits only one owner. The token is fully written
      // before this acquire returns, and contenders never inspect its contents.
      fs.writeFileSync(lockPath, token, { flag: "wx" });
      held.set(lockPath, { token, depth: 1 });
      return token;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() > deadline)
        throw new Error(
          `the project commit lock is held by another session ("${lockPath}"); retry shortly, or if a crashed process left it behind, verify that no AutoMovie commit is running and remove that lock file manually`,
        );
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
  if (current !== undefined && current.token === token) {
    if (options.retire !== true && --current.depth !== 0) return;
    held.delete(lockPath);
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
    }
  } catch {
    // already gone, nothing of ours to release
  }
};
