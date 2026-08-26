import {
  acquireCommitLock,
  acquireProductionRootNamespace,
  releaseCommitLock,
  releaseProductionRootNamespace,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * A lock nobody can be holding is taken back; every other lock is named.
 *
 * A session that ends abnormally leaves its commit lock behind, and nothing in
 * the product ever removed it: every later command refused, told the operator
 * to verify by hand that no commit was running, and waited. For a product whose
 * thesis is that a coding agent drives the authoring, that is not a recovery
 * path — the agent that died is the one that would have to notice, and its
 * replacement meets advice it cannot act on, about a process nobody checks.
 *
 * The lock always recorded its owner and nothing ever read it back. What makes
 * reading it safe is one asymmetry: a live process always occupies its own
 * process id, so an id **nothing holds** cannot belong to a running owner. That
 * direction is proof. The other direction is not, because ids are reused, so a
 * held id is refused rather than believed — and on this machine that is not
 * pedantry, since a second campaign runs identically shaped processes beside
 * this one.
 *
 * Two more cases are refused for reasons the product can state rather than
 * guess. A lock written on another host is unreadable from this one's process
 * table, and the coordination root lives under the user's home directory, which
 * a roaming or network profile shares across machines. A lock this build cannot
 * parse — including one an older build wrote — is attributed to nobody, and
 * keeps the original manual instruction, because there it is the honest one.
 *
 * The last case is the one that cost the most in the field. One dead session
 * left **three** locks, and the refusal named one at a time, so clearing the
 * named file and retrying earned another full timeout and another refusal, with
 * nothing saying a set existed.
 *
 * Scenarios:
 *
 * 1. A lock whose owner's id is held by nothing is taken over, in place, well
 *    inside the contention deadline, leaving no staging file behind.
 * 2. A lock whose owner's id is held is refused, named, and left untouched. The
 *    id used is this process's own, so it is held for certain.
 * 3. A lock recorded on another host is refused and left untouched **even
 *    though its id is absent here**, which is the case a bare liveness check
 *    would get wrong.
 * 4. A lock this build cannot read is refused, left untouched, and keeps the
 *    manual recovery instruction.
 * 5. A refusal on a set of coordinates names every held member and says that
 *    clearing one is not enough.
 * 6. A transfer whose rename is held once still lands, inside the same wait.
 *    One attempt would have spent the whole deadline and then refused with "it
 *    should have been reclaimed automatically", which is the least useful thing
 *    this could say about a collision it could simply have retried.
 */
export const test_production_commit_lock_dead_owner = (): void => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-dead-owner-"),
  );
  try {
    const shape = tokenShape(path.join(directory, "shape.lock"));
    const gone = departedPid();

    const reclaimed = path.join(directory, "reclaimed.lock");
    fs.writeFileSync(reclaimed, shape({ pid: gone }), { flag: "wx" });
    const started = Date.now();
    const token = acquireCommitLock(reclaimed);
    const elapsed = Date.now() - started;
    TestValidator.equals(
      "a lock whose owner's id is held by nothing is taken over",
      namedFacts([
        ["the acquire returned a token", () => token.length > 0],
        [
          "the file now carries it",
          () => fs.readFileSync(reclaimed, "utf8") === token,
        ],
        // Well inside the 2 s contention deadline: a reclaim that only
        // happened after the wait expired would be a timeout with a different
        // ending, not a recovery.
        ["it did not wait the contention out", () => elapsed < 1_000],
        [
          "no staging file was left behind",
          () => fs.existsSync(`${reclaimed}.reclaim`) === false,
        ],
      ]),
      {
        "the acquire returned a token": true,
        "the file now carries it": true,
        "it did not wait the contention out": true,
        "no staging file was left behind": true,
      },
    );
    releaseCommitLock(reclaimed, token);

    TestValidator.equals(
      "a lock whose owner's id is held is refused, named, and left alone",
      refusal(directory, "live.lock", shape({ pid: process.pid }), [
        `process ${process.pid} on this host`,
        "still running",
        "retry shortly",
      ]),
      { refused: true, said: true, untouched: true },
    );

    TestValidator.equals(
      "a lock recorded on another host is refused even with its id absent",
      refusal(
        directory,
        "elsewhere.lock",
        shape({ host: `${os.hostname()}-not-this-one`, pid: gone }),
        [
          `on host "${os.hostname()}-not-this-one"`,
          "cannot say whether that session is still running",
        ],
      ),
      { refused: true, said: true, untouched: true },
    );

    TestValidator.equals(
      "a lock this build cannot read keeps the manual instruction",
      refusal(directory, "legacy.lock", "12345.0.abcdef", [
        "records no owner this build can read",
        "verify that no AutoMovie commit is running",
        "remove that lock file manually",
      ]),
      { refused: true, said: true, untouched: true },
    );

    TestValidator.equals(
      "a refusal on a set names every held member",
      namedFacts(setRefusal(directory, shape({ pid: process.pid }))),
      {
        "more than one coordinate is fenced": true,
        "it says clearing one is not enough": true,
        "every held coordinate is named": true,
      },
    );

    TestValidator.equals(
      "a transfer held once still lands inside the wait",
      namedFacts(collidingReclaim(directory, shape({ pid: gone }))),
      {
        "the transfer was attempted more than once": true,
        "the lock was taken anyway": true,
        "inside the contention deadline": true,
        "and no staging file was left behind": true,
      },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

/**
 * A writer for lock files in whatever shape this build actually writes.
 *
 * Taken from a real acquire and patched rather than spelled out here: the token
 * encoding is the product's own business, and a test that re-implements it
 * passes just as happily when the two drift apart.
 */
const tokenShape = (
  probe: string,
): ((patch: Record<string, unknown>) => string) => {
  const token = acquireCommitLock(probe);
  const raw = fs.readFileSync(probe, "utf8");
  releaseCommitLock(probe, token);
  const brace = raw.indexOf("{");
  if (brace === -1)
    throw new Error("the commit lock no longer records a readable owner");
  const prefix = raw.slice(0, brace);
  const body = JSON.parse(raw.slice(brace)) as Record<string, unknown>;
  return (patch) => `${prefix}${JSON.stringify({ ...body, ...patch })}`;
};

/**
 * A process id nothing holds.
 *
 * Drawn from a child that has already exited rather than invented, because an
 * invented id can collide with something running and would make this case pass
 * or fail for a reason it is not about.
 */
const departedPid = (): number => {
  const child = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  if (child.pid === undefined)
    throw new Error("the probe child reported no process id");
  return child.pid;
};

/** The three facts a refusal case asserts, measured in one place. */
const refusal = (
  directory: string,
  name: string,
  planted: string,
  fragments: readonly string[],
): { refused: boolean; said: boolean; untouched: boolean } => {
  const lockPath = path.join(directory, name);
  fs.writeFileSync(lockPath, planted, { flag: "wx" });
  let message: string | null = null;
  try {
    releaseCommitLock(lockPath, acquireCommitLock(lockPath));
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  return {
    refused: message !== null,
    said:
      message !== null &&
      fragments.every((fragment) => message.includes(fragment)),
    untouched: fs.readFileSync(lockPath, "utf8") === planted,
  };
};

/**
 * Hold the transfer's rename once, and see whether the acquire still lands.
 *
 * The transfer renames onto the resident path, and on Windows a rename onto an
 * existing path fails outright while anything else holds a handle on it —
 * `#1989` measured exactly that, transiently, on this product's own atomic
 * publish. A scanner reading the lock the moment it is taken back is enough.
 *
 * `EPERM` rather than an invented code, because that is the one that was
 * measured, and the retry must be reached by the error the platform actually
 * raises rather than by a broad catch.
 */
const collidingReclaim = (
  directory: string,
  planted: string,
): ReadonlyArray<[string, () => boolean]> => {
  const lockPath = path.join(directory, "collided.lock");
  fs.writeFileSync(lockPath, planted, { flag: "wx" });
  const native = fs.renameSync;
  let attempts = 0;
  let token: string | null = null;
  let elapsed = Number.MAX_SAFE_INTEGER;
  try {
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (path.resolve(to.toString()) !== path.resolve(lockPath))
        return native(from, to);
      attempts += 1;
      if (attempts === 1)
        throw Object.assign(
          new Error(`EPERM: operation not permitted, rename to ${lockPath}`),
          { code: "EPERM" },
        );
      return native(from, to);
    }) as typeof fs.renameSync;
    const started = Date.now();
    token = acquireCommitLock(lockPath);
    elapsed = Date.now() - started;
  } catch {
    // Left null, which the facts below read as the acquire having failed.
  } finally {
    fs.renameSync = native;
  }
  if (token !== null) releaseCommitLock(lockPath, token);
  return [
    ["the transfer was attempted more than once", () => attempts > 1],
    ["the lock was taken anyway", () => token !== null],
    ["inside the contention deadline", () => elapsed < 2_000],
    [
      "and no staging file was left behind",
      () => fs.existsSync(`${lockPath}.reclaim`) === false,
    ],
  ];
};

/**
 * The set case, driven through the namespace lease that fences several at once.
 *
 * The coordinates are learned from a real lease rather than recomputed here,
 * because their paths are sha256 digests of the root's identity and a test that
 * derives them again is asserting its own arithmetic.
 */
const setRefusal = (
  directory: string,
  planted: string,
): ReadonlyArray<[string, () => boolean]> => {
  const root = path.join(directory, "project");
  fs.mkdirSync(root);
  const lease = acquireProductionRootNamespace(root);
  const coordinates = lease.locks.map((lock) => lock.path);
  releaseProductionRootNamespace(lease);
  for (const lockPath of coordinates)
    fs.writeFileSync(lockPath, planted, { flag: "wx" });
  let message = "";
  try {
    releaseProductionRootNamespace(acquireProductionRootNamespace(root));
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  } finally {
    for (const lockPath of coordinates) fs.rmSync(lockPath, { force: true });
  }
  return [
    ["more than one coordinate is fenced", () => coordinates.length > 1],
    [
      "it says clearing one is not enough",
      () => message.includes("clearing the one named above is not enough"),
    ],
    [
      "every held coordinate is named",
      () => coordinates.every((lockPath) => message.includes(lockPath)),
    ],
  ];
};
