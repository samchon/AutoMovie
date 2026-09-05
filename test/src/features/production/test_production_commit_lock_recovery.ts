import {
  acquireCommitLock,
  currentAutoMovieLocalProcessOwner,
  describeCommitLockHolder,
  inspectCommitLock,
  releaseCommitLock,
  withAutoMovieLocalProcessQuery,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

/** A lock token whose recorded process generation is not this session's. */
const deadOwnerToken = (): string =>
  `automovie-commit-lock:${JSON.stringify({
    ...currentAutoMovieLocalProcessOwner(),
    generation: "33333333-3333-4333-8333-333333333333",
    at: 0,
    nonce: "0",
  })}`;

/**
 * Commit-lock recovery never adopts a successor and never fences forever.
 *
 * Every filesystem fault is injected through the production storage seam over
 * the real temporary directory, so the lock file the code reasons about is the
 * one on disk and only the named call misbehaves.
 *
 * Scenarios:
 *
 * 1. A holder description names the process for the same-owner and
 *    occupied-or-reused states.
 * 2. Inspection reports a lock it cannot read as unknown, and a non-file lock
 *    that vanishes during the read as absent.
 * 3. A release whose quarantined copy no longer carries this session's token
 *    restores the resident lock by hard link, by exclusive copy when linking is
 *    refused, or leaves an existing resident alone, and a refused cleanup of
 *    the quarantine never endangers the restored lock.
 * 4. A dead-owner reclaim is abandoned when the resident token moves between
 *    the outer and the staged inspection, and a failed transfer whose staging
 *    cleanup also fails still leaves the resident lock untouched.
 */
export const test_production_commit_lock_recovery = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-lock-recovery-"),
  );
  try {
    const owner = { ...currentAutoMovieLocalProcessOwner(), at: 0 };
    TestValidator.equals(
      "holder descriptions name the recorded process by state",
      {
        unreadableOwner: describeCommitLockHolder({
          path: "dark.lock",
          owner: null,
          state: "unknown",
          reason: "lock-read-unavailable",
        }),
        queryUnavailable: describeCommitLockHolder({
          path: "probe.lock",
          owner,
          state: "unknown",
          reason: "process-query-unavailable",
        }),
        sameOwner: describeCommitLockHolder({
          path: "same.lock",
          owner,
          state: "same-owner",
        }).startsWith('"same.lock" is held by this process generation'),
        occupied: describeCommitLockHolder({
          path: "busy.lock",
          owner,
          state: "occupied-or-reused",
        }).includes(`records process ${owner.pid} on this host taken`),
      },
      {
        unreadableOwner:
          '"dark.lock" has no trustworthy owner observation (lock-read-unavailable)',
        queryUnavailable: `"probe.lock" records process ${owner.pid} on this host, but its owner state is unknown (process-query-unavailable)`,
        sameOwner: true,
        occupied: true,
      },
    );

    const unreadable = path.join(root, "unreadable.lock");
    fs.writeFileSync(unreadable, "token");
    const readFault = createTestFileSystem({
      lstatSync: (() => {
        throw platformError("EIO");
      }) as typeof fs.lstatSync,
    });
    const vanishing = path.join(root, "vanishing.lock");
    fs.mkdirSync(vanishing);
    let vanishingStats = 0;
    const vanishFault = createTestFileSystem({
      lstatSync: ((...args: unknown[]) => {
        if (String(args[0]) === vanishing && ++vanishingStats === 2)
          throw platformError("ENOENT");
        return Reflect.apply(fs.lstatSync, fs, args);
      }) as typeof fs.lstatSync,
    });
    TestValidator.equals(
      "an unreadable lock is unknown and a vanishing non-file lock is absent",
      {
        unreadable: withTestFileSystem(readFault.fileSystem, () =>
          inspectCommitLock(unreadable),
        ),
        vanishing: withTestFileSystem(vanishFault.fileSystem, () =>
          inspectCommitLock(vanishing),
        ),
      },
      {
        unreadable: {
          path: unreadable,
          owner: null,
          state: "unknown",
          reason: "lock-read-unavailable",
        },
        vanishing: null,
      },
    );

    const quarantineName = ".automovie-lock-release-";
    // The reader opens every lock by descriptor, so the second descriptor read
    // of one release is the quarantine comparison; answering it with a foreign
    // token makes the release treat its own moved lock as somebody else's.
    const releaseWith = (
      name: string,
      faults: Partial<typeof fs>,
    ): { resident: string | null; quarantines: number } => {
      const lockPath = path.join(root, name);
      const token = acquireCommitLock(lockPath);
      let reads = 0;
      const fileSystem = createTestFileSystem({
        readFileSync: ((...args: unknown[]) =>
          typeof args[0] === "number" && ++reads === 2
            ? "foreign-token"
            : Reflect.apply(
                fs.readFileSync,
                fs,
                args,
              )) as typeof fs.readFileSync,
        ...faults,
      }).fileSystem;
      withTestFileSystem(fileSystem, () => releaseCommitLock(lockPath, token));
      const quarantines = fs
        .readdirSync(root)
        .filter((entry) => entry.startsWith(quarantineName));
      for (const entry of quarantines)
        fs.rmSync(path.join(root, entry), { force: true });
      const resident = fs.existsSync(lockPath)
        ? fs.readFileSync(lockPath, "utf8") === token
          ? "own-token"
          : "other"
        : null;
      if (fs.existsSync(lockPath)) fs.rmSync(lockPath, { force: true });
      return { resident, quarantines: quarantines.length };
    };
    const refuse = (code: string) => () => {
      throw platformError(code);
    };
    TestValidator.equals(
      "a quarantined lock that no longer proves this session is restored, not deleted",
      {
        linked: releaseWith("restore-link.lock", {}),
        copied: releaseWith("restore-copy.lock", {
          linkSync: refuse("EPERM") as typeof fs.linkSync,
        }),
        residentKept: releaseWith("restore-exists.lock", {
          linkSync: refuse("EEXIST") as typeof fs.linkSync,
        }),
        copyRefused: releaseWith("restore-refused.lock", {
          linkSync: refuse("EPERM") as typeof fs.linkSync,
          copyFileSync: refuse("EACCES") as typeof fs.copyFileSync,
        }),
        cleanupRefused: releaseWith("restore-cleanup.lock", {
          rmSync: ((...args: unknown[]) => {
            if (String(args[0]).includes(quarantineName))
              throw platformError("EBUSY");
            return Reflect.apply(fs.rmSync, fs, args);
          }) as typeof fs.rmSync,
        }),
      },
      {
        linked: { resident: "own-token", quarantines: 0 },
        copied: { resident: "own-token", quarantines: 0 },
        residentKept: { resident: null, quarantines: 1 },
        copyRefused: { resident: null, quarantines: 1 },
        cleanupRefused: { resident: "own-token", quarantines: 1 },
      },
    );

    // Once the reclaim has staged its own token, every descriptor read of the
    // resident lock answers a token that is not the one observed before staging.
    const moved = path.join(root, "moved.lock");
    fs.writeFileSync(moved, deadOwnerToken());
    let staged = false;
    const movedFault = createTestFileSystem({
      writeFileSync: ((...args: unknown[]) => {
        if (String(args[0]).endsWith(".reclaim")) staged = true;
        return Reflect.apply(fs.writeFileSync, fs, args);
      }) as typeof fs.writeFileSync,
      readFileSync: ((...args: unknown[]) => {
        const content = Reflect.apply(fs.readFileSync, fs, args) as string;
        if (typeof args[0] === "number" && staged) {
          staged = false;
          return `${content}-moved`;
        }
        return content;
      }) as typeof fs.readFileSync,
    });
    const acquireUnder = (fileSystem: typeof fs, lockPath: string): string => {
      try {
        withAutoMovieLocalProcessQuery(
          () => {
            throw platformError("ESRCH");
          },
          () =>
            withTestFileSystem(fileSystem, () => acquireCommitLock(lockPath)),
        );
        return "acquired";
      } catch (error) {
        return (error as Error).message;
      }
    };
    const movedRefusal = acquireUnder(movedFault.fileSystem, moved);
    const transfer = path.join(root, "transfer.lock");
    fs.writeFileSync(transfer, deadOwnerToken());
    const transferFault = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (String(args[0]).endsWith(".reclaim")) throw platformError("EPERM");
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
      rmSync: ((...args: unknown[]) => {
        if (String(args[0]).endsWith(".reclaim")) throw platformError("EBUSY");
        return Reflect.apply(fs.rmSync, fs, args);
      }) as typeof fs.rmSync,
    });
    const transferRefusal = acquireUnder(transferFault.fileSystem, transfer);
    TestValidator.equals(
      "a moved token or a failed transfer abandons the reclaim and keeps the resident lock",
      {
        movedRefusal: movedRefusal.includes("held by another session"),
        movedResident: fs.readFileSync(moved, "utf8") === deadOwnerToken(),
        movedStaging: fs.existsSync(`${moved}.reclaim`),
        transferRefusal: transferRefusal.includes("held by another session"),
        transferResident:
          fs.readFileSync(transfer, "utf8") === deadOwnerToken(),
      },
      {
        movedRefusal: true,
        movedResident: true,
        movedStaging: false,
        transferRefusal: true,
        transferResident: true,
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
