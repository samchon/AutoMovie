import { acquireCommitLock, releaseCommitLock } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The commit lock is owner-identified and fail-closed (#1257/#1252): a release
 * deletes only this session's token, and age never authorizes a different
 * session to steal the path. A stale timestamp proves neither process death nor
 * file identity; automatic stat-then-rename reclaim can move a fresh successor
 * that appeared between the calls and recreate the lost-update race the lock
 * exists to prevent.
 *
 * Scenarios:
 *
 * 1. Acquiring an unheld lock writes this session's token and returns it.
 * 2. A second acquire on a live (fresh) lock is refused after the bounded wait.
 * 3. A lock older than 10 s is still refused and remains byte-identical. After an
 *    operator explicitly removes it, acquisition succeeds normally.
 * 4. Release deletes the lock ONLY when it still holds our token; a foreign
 *    owner's lock is left untouched; an already vanished lock is a no-op.
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

    // 4a. release with a FOREIGN token leaves the lock in place, the core
    // owner-check: we must not delete another session's lock.
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

    // 3. an old mtime is not authority to steal another owner's lock
    fs.writeFileSync(lockPath, "stale-crashed-session-token", { flag: "w" });
    const stale = new Date(Date.now() - 20_000);
    fs.utimesSync(lockPath, stale, stale);
    TestValidator.predicate(
      "an old lock is refused with the explicit recovery condition",
      throws(
        () => acquireCommitLock(lockPath),
        ["held by another session", "verify", "remove", "manually"],
      ),
    );
    TestValidator.equals(
      "an old lock is never stolen or rewritten automatically",
      fs.readFileSync(lockPath, "utf8"),
      "stale-crashed-session-token",
    );
    fs.rmSync(lockPath);
    const fresh = acquireCommitLock(lockPath);
    TestValidator.equals(
      "explicit recovery allows a normal owner-identified acquire",
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
