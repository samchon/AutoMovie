import {
  acquireCommitLock,
  acquireProductionRootNamespace,
  releaseProductionRootNamespace,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * A coordination root this process did not make is used, not re-permissioned.
 *
 * The lease prepares a per-user coordination directory before it computes a
 * coordinate. It created that directory with mode `0o700` and then applied the
 * same mode again, unconditionally, on **every** call — so a directory it had
 * not created, or could not write to, ended the process instead of being used.
 *
 * Two benchmark sandboxes measured it, and neither was an ownership problem the
 * caller could have fixed. In one, `os.homedir()` resolved to another account's
 * profile and `chmod` refused on a directory belonging to somebody else. In the
 * other the account **did** own the directory and the sandbox denied the write
 * regardless, because its writable roots are the workdir and the temporary
 * directories while the home sits outside both — which is every sandboxed
 * authoring agent, the arrangement this product is built around. Both ended as
 * `EPERM: operation not permitted, chmod`, thrown from `open()`, which `design`,
 * `compile`, `lint`, `render`, `review-status` and `verify` all cross.
 *
 * The crash landed during directory preparation, **before any lock was read**,
 * so the refusals that name a lock's owner and its liveness never ran. A reader
 * got an errno where an owner should have been.
 *
 * A directory somebody else made is theirs to permission. What the lease needs
 * from it is that it exists and is a physical directory, and that is still
 * checked. Whether this belongs in a per-user path at all is the larger
 * question and stays open on `#2012`; this is the part that turns a fatal crash
 * into a working lease.
 *
 * Scenarios:
 *
 * 1. Taking and releasing a lease calls `chmod` **no times at all**. The
 *    assertion is on the absence of the call rather than on tolerating its
 *    failure, because a caught `EPERM` would still be a mode this process has
 *    no business enforcing on a directory it did not create.
 * 2. The lease still works while `chmod` is denied outright, which is the
 *    environment both sandboxes were actually in.
 * 3. A lock the filesystem refuses to create at all is refused **immediately**,
 *    naming the path and saying that waiting will not clear it. Fixing the
 *    directory moved the same denial one step in, onto the lock file's own
 *    exclusive create, where the guard tolerated a collision and rethrew a
 *    permission unhandled — an errno with no owner and no path explained, after
 *    a caller had already spent the full contention deadline waiting for a file
 *    it may never be allowed to make.
 *
 * What this case does **not** cover: that preparation still refuses a
 * coordination root which is a file rather than a directory. That check is
 * unchanged and remains in the module, but reaching it needs control over
 * `os.homedir()` before the module caches its answer, which this suite has
 * already imported. It is covered where that control exists, in
 * `test_mcp_import_without_passwd`'s child process.
 */
export const test_mcp_namespace_lock_foreign_root = (): void => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-foreign-root-"),
  );
  const nativeChmod = fs.chmodSync;
  let chmods = 0;
  try {
    const root = path.join(directory, "project");
    fs.mkdirSync(root);
    fs.chmodSync = ((...args: Parameters<typeof fs.chmodSync>) => {
      chmods += 1;
      // Denied rather than merely counted, so the case measures the
      // environment both sandboxes reported and not a friendlier one.
      throw Object.assign(
        new Error(`EPERM: operation not permitted, chmod '${String(args[0])}'`),
        { code: "EPERM" },
      );
    }) as typeof fs.chmodSync;

    const lease = ((): unknown => {
      try {
        return acquireProductionRootNamespace(root);
      } catch (error) {
        return error;
      }
    })();
    const taken =
      typeof lease === "object" && lease !== null && "locks" in lease;
    if (taken)
      releaseProductionRootNamespace(
        lease as Parameters<typeof releaseProductionRootNamespace>[0],
      );

    TestValidator.equals(
      "a lease uses the coordination root rather than re-permissioning it",
      namedFacts([
        ["the lease was taken", () => taken === true],
        ["and it did not refuse", () => lease instanceof Error === false],
        // The whole defect in one number. Any call here is a mode being
        // enforced on a directory this process did not create.
        ["chmod was never called", () => chmods === 0],
      ]),
      {
        "the lease was taken": true,
        "and it did not refuse": true,
        "chmod was never called": true,
      },
    );
    const denied = path.join(directory, "denied.lock");
    const nativeWrite = fs.writeFileSync;
    let refusal = "";
    let waited = Number.MAX_SAFE_INTEGER;
    try {
      fs.writeFileSync = ((
        target: fs.PathOrFileDescriptor,
        ...rest: unknown[]
      ) => {
        if (path.resolve(String(target)) !== path.resolve(denied))
          return (nativeWrite as (...args: unknown[]) => void)(target, ...rest);
        throw Object.assign(
          new Error(`EPERM: operation not permitted, open '${denied}'`),
          { code: "EPERM" },
        );
      }) as typeof fs.writeFileSync;
      const started = Date.now();
      try {
        acquireCommitLock(denied);
      } catch (error) {
        refusal = error instanceof Error ? error.message : String(error);
      }
      waited = Date.now() - started;
    } finally {
      fs.writeFileSync = nativeWrite;
    }

    TestValidator.equals(
      "a lock the filesystem will not let this process create is refused, not waited out",
      namedFacts([
        ["it refused", () => refusal.length > 0],
        ["it names the path", () => refusal.includes(denied)],
        [
          "it says waiting will not help",
          () => refusal.includes("waiting will not clear it"),
        ],
        [
          "it distinguishes denial from contention",
          () => refusal.includes("rather than another session holding it"),
        ],
        // The deadline is two seconds. Spending it on a file this process may
        // never be allowed to create is the cost the old guard paid before
        // reporting an owner that does not exist.
        ["and it did not spend the deadline", () => waited < 500],
      ]),
      {
        "it refused": true,
        "it names the path": true,
        "it says waiting will not help": true,
        "it distinguishes denial from contention": true,
        "and it did not spend the deadline": true,
      },
    );
  } finally {
    fs.chmodSync = nativeChmod;
    fs.rmSync(directory, { recursive: true, force: true });
  }
};
