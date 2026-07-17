import { acquireCommitLock, releaseCommitLock } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The commit lock is owner-identified (#1257): a stale reclaim is single-winner
 * and a release only deletes the lock while it still holds this session's
 * token. A blind reclaim let two sessions both break one stale lock, and a
 * blind `finally` rmSync let one session delete a successor's lock — either way
 * two sessions "held" it at once and could lose an update the #1133 guard
 * exists to prevent. The concurrent interleavings are not reproducible from a
 * synchronous in-process test, but the ownership LOGIC each defence rests on
 * is.
 *
 * Scenarios:
 *
 * 1. Acquiring an unheld lock writes this session's token and returns it.
 * 2. A second acquire on a live (fresh) lock is refused after the bounded wait.
 * 3. A lock older than 10 s is reclaimed: the acquire succeeds and the file now
 *    carries the new token, not the stale one.
 * 4. Release deletes the lock ONLY when it still holds our token; a lock a
 *    reclaimer replaced with a foreign token is left for its owner; an already
 *    vanished lock is a no-op.
 */
export const test_mcp_commit_lock = (): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-lock-"));
  try {
    const lockPath = path.join(dir, "revision.lock");

    // 1. acquire an unheld lock
    const token = acquireCommitLock(lockPath);
    TestValidator.predicate(
      "acquiring an unheld lock returns a non-empty token",
      token.length > 0,
    );
    TestValidator.equals(
      "the lock file holds our token",
      fs.readFileSync(lockPath, "utf8"),
      token,
    );

    // 2. a second acquire on the live lock is refused after the bounded wait
    TestValidator.predicate(
      "a live lock is refused with the retry prompt",
      throws(
        () => acquireCommitLock(lockPath),
        ["held by another session", "retry"],
      ),
    );

    // 4a. release with a FOREIGN token leaves the lock in place (a reclaimer
    // replaced ours) — the core owner-check: we must not delete a successor's.
    releaseCommitLock(lockPath, "some-other-session-token");
    TestValidator.equals(
      "release with a foreign token leaves the lock untouched",
      fs.readFileSync(lockPath, "utf8"),
      token,
    );

    // 4b. release with OUR token deletes it
    releaseCommitLock(lockPath, token);
    TestValidator.equals(
      "release with our token removes the lock",
      fs.existsSync(lockPath),
      false,
    );

    // 4c. releasing an already-vanished lock is a no-op (no throw)
    releaseCommitLock(lockPath, token);
    TestValidator.equals(
      "releasing a vanished lock is a no-op",
      fs.existsSync(lockPath),
      false,
    );

    // 3. a stale (>10 s) lock is reclaimed on acquire
    fs.writeFileSync(lockPath, "stale-crashed-session-token", { flag: "w" });
    const stale = new Date(Date.now() - 20_000);
    fs.utimesSync(lockPath, stale, stale);
    const fresh = acquireCommitLock(lockPath);
    TestValidator.equals(
      "a stale lock is reclaimed and now holds the new token",
      fs.readFileSync(lockPath, "utf8"),
      fresh,
    );
    releaseCommitLock(lockPath, fresh);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/** True when `task` throws an error whose message contains every fragment. */
const throws = (task: () => void, fragments: string[]): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    const message = String((error as Error).message);
    return fragments.every((fragment) => message.includes(fragment));
  }
};
