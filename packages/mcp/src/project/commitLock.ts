import fs from "node:fs";

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
 * Release the commit lock, but only if it still holds `token`. Deleting a
 * foreign token would delete another session's lock (#1257). A vanished lock is
 * a no-op. Pass `unlink: false` after a namespace-identity failure to release
 * only this process's re-entrant ownership without following the resident path
 * into a replacement root. Pass `retire: true` only when the owning operation
 * removed the complete lock namespace; this invalidates every matching nesting
 * level because none can still own the deleted physical lock.
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
  if (options.unlink === false) return;
  try {
    if (fs.readFileSync(lockPath, "utf8") === token)
      fs.rmSync(lockPath, { force: true });
  } catch {
    // already gone, nothing of ours to release
  }
};
