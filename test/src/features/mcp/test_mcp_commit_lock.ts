import { acquireCommitLock, releaseCommitLock } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const mutableFs = fs as {
  lstatSync: typeof fs.lstatSync;
};

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
 * 2. A nested acquire inside one process shares the owner token and survives its
 *    inner release, because a guarded commit runs the compiler's own snapshot
 *    commit and that is the same holder rather than a second session. A lock
 *    another session holds is still refused after the bounded wait.
 * 3. A lock older than 10 s is still refused and remains byte-identical. After an
 *    operator explicitly removes it, acquisition succeeds normally.
 * 4. Release vacates the canonical lock ONLY when it still holds our token,
 *    retains the isolated owner evidence, leaves a foreign owner's lock
 *    untouched, and treats an already vanished lock as a no-op.
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

    // 2. a nested acquire inside one process is the same holder, not a second
    //    session: it shares the owner token, and the file survives every
    //    release but the outermost one.
    const nested = acquireCommitLock(lockPath);
    TestValidator.equals(
      "a nested acquire shares the owner token",
      nested,
      token,
    );
    releaseCommitLock(lockPath, nested);
    TestValidator.equals(
      "an inner release leaves the lock held",
      fs.readFileSync(lockPath, "utf8"),
      token,
    );

    // 2b. a lock another session holds is refused after the bounded wait
    const foreignPath = path.join(dir, "foreign.lock");
    fs.writeFileSync(foreignPath, "another-session-token", { flag: "wx" });
    TestValidator.predicate(
      "a live foreign lock is refused with the retry prompt",
      throws(
        () => acquireCommitLock(foreignPath),
        ["held by another session", "retry"],
      ),
    );

    // 4a. release with a FOREIGN token leaves the lock in place. The core
    // owner-check: we must not delete another session's lock.
    releaseCommitLock(lockPath, "some-other-session-token");
    TestValidator.equals(
      "release with a foreign token leaves the lock untouched",
      fs.readFileSync(lockPath, "utf8"),
      token,
    );

    // 4b. release with OUR token vacates it and retains exact evidence
    const evidenceBeforeRelease = new Set(fs.readdirSync(dir));
    releaseCommitLock(lockPath, token);
    const retainedOwner = fs
      .readdirSync(dir)
      .filter((entry) => evidenceBeforeRelease.has(entry) === false)
      .find((entry) => entry.startsWith(".automovie-lock-release-"));
    TestValidator.equals(
      "release with our token removes the lock",
      fs.existsSync(lockPath),
      false,
    );
    TestValidator.predicate(
      "release retains the exact owner token as private evidence",
      retainedOwner !== undefined &&
        fs.readFileSync(path.join(dir, retainedOwner), "utf8") === token,
    );

    const releaseRacePath = path.join(dir, "release-race.lock");
    const releaseRaceParked = `${releaseRacePath}.owner-parked`;
    const releaseRaceToken = acquireCommitLock(releaseRacePath);
    const foreignToken = "successor-session-token";
    const nativeRename = fs.renameSync;
    const nativeRm = fs.rmSync;
    let releaseTargetSwapped = false;
    const swapReleaseTarget = (): void => {
      releaseTargetSwapped = true;
      nativeRename(releaseRacePath, releaseRaceParked);
      fs.writeFileSync(releaseRacePath, foreignToken);
    };
    fs.renameSync = ((oldPath, newPath) => {
      if (
        releaseTargetSwapped === false &&
        path.resolve(oldPath.toString()) === path.resolve(releaseRacePath) &&
        path.basename(newPath.toString()).startsWith(".automovie-lock-release-")
      )
        swapReleaseTarget();
      return nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    try {
      releaseCommitLock(releaseRacePath, releaseRaceToken);
    } finally {
      fs.renameSync = nativeRename;
    }
    TestValidator.predicate(
      "release cannot delete a foreign lock swapped in after owner verification",
      releaseTargetSwapped &&
        fs.existsSync(releaseRacePath) &&
        fs.readFileSync(releaseRacePath, "utf8") === foreignToken,
    );
    nativeRm(releaseRacePath, { force: true });
    nativeRm(releaseRaceParked, { force: true });
    const reacquiredRaceToken = acquireCommitLock(releaseRacePath);
    TestValidator.predicate(
      "a raced release permits a genuinely fresh owner",
      reacquiredRaceToken !== releaseRaceToken &&
        fs.existsSync(releaseRacePath) &&
        fs.readFileSync(releaseRacePath, "utf8") === reacquiredRaceToken,
    );
    releaseCommitLock(releaseRacePath, reacquiredRaceToken);
    TestValidator.equals(
      "a raced release clears its process-local ownership",
      fs.existsSync(releaseRacePath),
      false,
    );

    exerciseRejectedSnapshots(dir);
    exerciseQuarantineRecovery(dir);
    exerciseReleaseFailures(dir);
    TestValidator.equals(
      "release defenses retain private evidence outside the canonical lock slots",
      fs
        .readdirSync(dir)
        .some((entry) => entry.startsWith(".automovie-lock-release-")),
      true,
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

type LockStatusMutation = "identity" | "non-file" | "symlink";

const mutateLockStatus = (
  status: fs.BigIntStats,
  mutation: LockStatusMutation,
): fs.BigIntStats =>
  new Proxy(status, {
    get: (target, property, receiver): unknown => {
      if (mutation === "identity" && property === "ino") return target.ino + 1n;
      if (mutation === "non-file" && property === "isFile")
        return (): boolean => false;
      if (mutation === "symlink" && property === "isSymbolicLink")
        return (): boolean => true;
      return Reflect.get(target, property, receiver);
    },
  });

const exerciseRejectedSnapshots = (dir: string): void => {
  const variants: Array<{
    name: string;
    source: "fstat" | "lstat";
    call: number;
    mutation: LockStatusMutation;
  }> = [
    { name: "linked-symlink", source: "lstat", call: 1, mutation: "symlink" },
    { name: "linked-non-file", source: "lstat", call: 1, mutation: "non-file" },
    { name: "opened-non-file", source: "fstat", call: 1, mutation: "non-file" },
    { name: "opened-swap", source: "fstat", call: 1, mutation: "identity" },
    { name: "resident-symlink", source: "lstat", call: 2, mutation: "symlink" },
    {
      name: "resident-non-file",
      source: "lstat",
      call: 2,
      mutation: "non-file",
    },
    { name: "resident-swap", source: "lstat", call: 2, mutation: "identity" },
    {
      name: "current-non-file",
      source: "fstat",
      call: 2,
      mutation: "non-file",
    },
    { name: "current-swap", source: "fstat", call: 2, mutation: "identity" },
  ];
  for (const variant of variants) {
    const lockPath = path.join(dir, `snapshot-${variant.name}.lock`);
    const token = `snapshot-${variant.name}-token`;
    fs.writeFileSync(lockPath, token);
    const nativeLstat = fs.lstatSync;
    const nativeFstat = fs.fstatSync;
    let lstatCalls = 0;
    let fstatCalls = 0;
    mutableFs.lstatSync = ((target, options) => {
      const status = nativeLstat(target, options);
      if (path.resolve(target.toString()) !== path.resolve(lockPath))
        return status;
      ++lstatCalls;
      return variant.source === "lstat" && variant.call === lstatCalls
        ? mutateLockStatus(status as fs.BigIntStats, variant.mutation)
        : status;
    }) as typeof fs.lstatSync;
    fs.fstatSync = ((descriptor, options) => {
      const status = nativeFstat(descriptor, options);
      ++fstatCalls;
      return variant.source === "fstat" && variant.call === fstatCalls
        ? mutateLockStatus(status as fs.BigIntStats, variant.mutation)
        : status;
    }) as typeof fs.fstatSync;
    try {
      releaseCommitLock(lockPath, token);
    } finally {
      mutableFs.lstatSync = nativeLstat;
      fs.fstatSync = nativeFstat;
    }
    TestValidator.equals(
      `release rejects the ${variant.name} snapshot`,
      fs.readFileSync(lockPath, "utf8"),
      token,
    );
    fs.rmSync(lockPath);
  }
};

type QuarantineRecoveryMode =
  | "copy-failure"
  | "copy-success"
  | "exact"
  | "moved-null"
  | "moved-throw"
  | "successor";

const exerciseQuarantineRecovery = (dir: string): void => {
  const modes: QuarantineRecoveryMode[] = [
    "successor",
    "copy-success",
    "copy-failure",
    "moved-null",
    "moved-throw",
    "exact",
  ];
  for (const mode of modes) {
    const lockPath = path.join(dir, `recovery-${mode}.lock`);
    const token = `recovery-${mode}-token`;
    const replacement = `replacement-${mode}-token`;
    fs.writeFileSync(lockPath, token);
    const nativeRename = fs.renameSync;
    const nativeLink = fs.linkSync;
    const nativeCopy = fs.copyFileSync;
    const nativeLstat = fs.lstatSync;
    let quarantine: string | undefined;
    let quarantineLstatCalls = 0;
    let exclusiveCopyObserved = false;
    fs.renameSync = ((oldPath, newPath) => {
      nativeRename(oldPath, newPath);
      if (
        path.resolve(oldPath.toString()) === path.resolve(lockPath) &&
        path.basename(newPath.toString()).startsWith(".automovie-lock-release-")
      ) {
        quarantine = newPath.toString();
        if (
          mode === "successor" ||
          mode === "copy-success" ||
          mode === "copy-failure"
        )
          fs.writeFileSync(quarantine, replacement);
        if (mode === "successor") fs.writeFileSync(lockPath, replacement);
      }
    }) as typeof fs.renameSync;
    fs.linkSync = ((existingPath, newPath) => {
      if (
        quarantine !== undefined &&
        path.resolve(existingPath.toString()) === path.resolve(quarantine) &&
        path.resolve(newPath.toString()) === path.resolve(lockPath) &&
        (mode === "copy-success" || mode === "copy-failure")
      )
        throw Object.assign(new Error("hard link unavailable"), {
          code: "EPERM",
        });
      nativeLink(existingPath, newPath);
    }) as typeof fs.linkSync;
    fs.copyFileSync = ((source, destination, flags) => {
      if (
        quarantine !== undefined &&
        path.resolve(source.toString()) === path.resolve(quarantine) &&
        path.resolve(destination.toString()) === path.resolve(lockPath)
      )
        exclusiveCopyObserved = flags === fs.constants.COPYFILE_EXCL;
      if (
        mode === "copy-failure" &&
        quarantine !== undefined &&
        path.resolve(source.toString()) === path.resolve(quarantine) &&
        path.resolve(destination.toString()) === path.resolve(lockPath)
      )
        throw Object.assign(new Error("exclusive copy unavailable"), {
          code: "EPERM",
        });
      nativeCopy(source, destination, flags);
    }) as typeof fs.copyFileSync;
    mutableFs.lstatSync = ((target, options) => {
      const status = nativeLstat(target, options);
      if (
        quarantine !== undefined &&
        path.resolve(target.toString()) === path.resolve(quarantine)
      ) {
        ++quarantineLstatCalls;
        if (quarantineLstatCalls === 1 && mode === "moved-null")
          return mutateLockStatus(status as fs.BigIntStats, "symlink");
        if (quarantineLstatCalls === 1 && mode === "moved-throw")
          throw new Error("quarantine inspection failed");
      }
      return status;
    }) as typeof fs.lstatSync;
    try {
      releaseCommitLock(lockPath, token);
    } finally {
      fs.renameSync = nativeRename;
      fs.linkSync = nativeLink;
      fs.copyFileSync = nativeCopy;
      mutableFs.lstatSync = nativeLstat;
    }
    const expectedResident =
      mode === "successor" || mode === "copy-success"
        ? replacement
        : mode === "copy-failure"
          ? undefined
          : mode === "exact"
            ? undefined
            : token;
    TestValidator.equals(
      `quarantine recovery preserves the ${mode} resident`,
      fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8") : undefined,
      expectedResident,
    );
    TestValidator.equals(
      `quarantine recovery retains exact evidence for ${mode}`,
      quarantine !== undefined && fs.existsSync(quarantine),
      true,
    );
    if (mode === "copy-success" || mode === "copy-failure")
      TestValidator.equals(
        `quarantine recovery uses exclusive copy for ${mode}`,
        exclusiveCopyObserved,
        true,
      );
    fs.rmSync(lockPath, { force: true });
    if (quarantine !== undefined) fs.rmSync(quarantine, { force: true });
  }
};

const exerciseReleaseFailures = (dir: string): void => {
  const renamePath = path.join(dir, "release-rename-failure.lock");
  const renameToken = "release-rename-failure-token";
  fs.writeFileSync(renamePath, renameToken);
  const nativeRename = fs.renameSync;
  fs.renameSync = ((oldPath, newPath) => {
    if (
      path.resolve(oldPath.toString()) === path.resolve(renamePath) &&
      path.basename(newPath.toString()).startsWith(".automovie-lock-release-")
    )
      throw new Error("quarantine rename failed");
    nativeRename(oldPath, newPath);
  }) as typeof fs.renameSync;
  try {
    releaseCommitLock(renamePath, renameToken);
  } finally {
    fs.renameSync = nativeRename;
  }
  TestValidator.equals(
    "a failed quarantine rename leaves the owner lock resident",
    fs.readFileSync(renamePath, "utf8"),
    renameToken,
  );
  fs.rmSync(renamePath);

  const snapshotPath = path.join(dir, "release-snapshot-failure.lock");
  const snapshotToken = "release-snapshot-failure-token";
  fs.writeFileSync(snapshotPath, snapshotToken);
  const nativeLstat = fs.lstatSync;
  mutableFs.lstatSync = ((target, options) => {
    if (path.resolve(target.toString()) === path.resolve(snapshotPath))
      throw new Error("initial snapshot failed");
    return nativeLstat(target, options);
  }) as typeof fs.lstatSync;
  try {
    releaseCommitLock(snapshotPath, snapshotToken);
  } finally {
    mutableFs.lstatSync = nativeLstat;
  }
  TestValidator.equals(
    "a failed initial snapshot leaves the owner lock resident",
    fs.readFileSync(snapshotPath, "utf8"),
    snapshotToken,
  );
  fs.rmSync(snapshotPath);
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
