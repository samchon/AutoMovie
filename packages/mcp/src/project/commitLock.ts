import fs from "node:fs";

/**
 * A short-lived, owner-identified commit lock guarding the project store's
 * optimistic-concurrency cycle (#1133, #1257).
 *
 * The lock file carries a per-acquire token. A lock older than 10 s belongs to
 * a crashed session and is broken — but reclaiming and releasing must both be
 * owner-aware, or two sessions can end up "holding" it at once and lose an
 * update:
 *
 * - **Reclaim is single-winner.** A stale lock is renamed aside before removal;
 *   only one session can rename a given file, so two never both break the same
 *   stale lock (the loser gets `ENOENT` and retries). A blind `rmSync` let both
 *   proceed — one deleting the other's just-created fresh lock.
 * - **Release is owner-checked.** {@link releaseCommitLock} deletes the lock only
 *   while it still holds this session's token; if a reclaimer judged ours stale
 *   and replaced it, the file now carries a different token and we leave it — a
 *   blind `rmSync` in a `finally` deleted the successor's lock.
 */

let lockNonce = 0;

const spinWait = (ms: number): void => {
  const end = Date.now() + ms;
  while (Date.now() < end); // bounded busy-wait: the store is synchronous
};

/**
 * Take the commit lock, returning the owner token to pass to
 * {@link releaseCommitLock}. Throws after ~2 s if a live lock never frees.
 */
export const acquireCommitLock = (lockPath: string): string => {
  const token = `${process.pid}.${(lockNonce++).toString(36)}.${Date.now().toString(36)}`;
  const deadline = Date.now() + 2_000;
  for (;;) {
    try {
      // Exclusive create AND write the token in one call: a reader (reclaim or
      // release) always sees a token, never an empty just-created lock.
      fs.writeFileSync(lockPath, token, { flag: "wx" });
      return token;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 10_000) {
          // Atomically claim the right to break the stale lock.
          const aside = `${lockPath}.stale.${token}`;
          fs.renameSync(lockPath, aside);
          fs.rmSync(aside, { force: true });
          continue;
        }
        /* c8 ignore start -- the lock vanishing between our EEXIST and this stat/rename is a real filesystem race, not reproducible from a synchronous in-process test */
      } catch {
        continue; // the holder released (or broke) it between our checks
      }
      /* c8 ignore stop */
      if (Date.now() > deadline)
        throw new Error(
          `the project commit lock is held by another session ("${lockPath}"); retry the call shortly`,
        );
      spinWait(2);
    }
  }
};

/**
 * Release the commit lock — but only if it still holds `token`. A reclaimer
 * that judged ours stale replaced the file with its own token; deleting it then
 * would delete the successor's lock (#1257). A vanished lock (already broken)
 * is a no-op.
 */
export const releaseCommitLock = (lockPath: string, token: string): void => {
  try {
    if (fs.readFileSync(lockPath, "utf8") === token)
      fs.rmSync(lockPath, { force: true });
  } catch {
    // already gone — nothing of ours to release
  }
};
