import { TestValidator } from "@nestia/e2e";
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * A namespace fence needs no home directory, and two homes name one lock.
 *
 * `rootNamespaceLock` used to derive its coordination root from the caller's
 * home. Two things followed, and they were found in that order.
 *
 * The first was that reading the home at module scope made the whole package
 * unimportable where that syscall is denied — not degraded, not partly
 * working: the import threw before any of the surface existed, taking every
 * scaffold script with it. That environment is the one an authoring agent works
 * in, where the call fails as `uv_os_get_passwd returned ENOMEM` while
 * gigabytes are free, naming a resource that is not the problem.
 *
 * The second is worse and was measured afterwards. A home is **per user**, and
 * two accounts reaching one project computed the same coordinate under two
 * different roots — the identical `production-id-…` file resident in two
 * profiles on one host, with an operation blocked from one side succeeding from
 * the other. A fence both sides can compute and neither can see is not a fence.
 *
 * Both are answered by the same change: the coordinates live inside the project
 * they fence, and nothing in the module reads a home at all. So the property
 * here is no longer "a lease refuses by naming the capability" — it is that a
 * lease **works** with no home, and that two different homes produce **one**
 * lock path.
 *
 * The denial is reproduced by replacing both readers in a child process rather
 * than by a sandbox, because what has to hold is a property of this module and
 * not of anyone's environment.
 *
 * Scenarios:
 *
 * 1. With `os.homedir()` and `os.userInfo()` both throwing, the package imports
 *    and its surface is present, so nothing is paid for by a caller that never
 *    fences.
 * 2. In that same state a lease is **taken**, not refused. A module that needed
 *    a home would fail here, and a module that merely deferred reading one
 *    would fail at exactly this line.
 * 3. Every lock the lease holds is inside the project root. That is the fence
 *    two accounts can both see, and the one place neither can be denied.
 * 4. Two probes reporting two different home directories name the **same** lock
 *    paths for one root. This is the cross-account invariant reduced to
 *    something one machine can measure: what a home is does not enter into it.
 */
export const test_mcp_import_without_passwd = (): void => {
  const denied = probe("both", "/nowhere/one");
  const partial = probe("passwd-only", "/nowhere/one");
  const intact = probe("none", "/nowhere/one");
  // One root for the pair that differs only in its home. Two roots would differ
  // in their lock paths for a reason that has nothing to do with homes.
  const shared = sharedRoot();
  const here = probe("none", "/nowhere/one", shared);
  const elsewhere = probe("none", "/nowhere/two", shared);
  fs.rmSync(path.dirname(shared), { recursive: true, force: true });

  TestValidator.equals(
    "the package imports and fences where no home can be read",
    namedFacts([
      ["it imports", () => denied.imported === true],
      ["its surface is there", () => denied.surface === true],
      // The point of the whole change: no home, and the lease still happens.
      ["the lease is taken rather than refused", () => denied.leased === true],
      ["nothing refused", () => denied.refusal === ""],
      [
        "every lock it held is inside the project",
        () =>
          denied.locks.length > 0 &&
          denied.locks.every((lock) => insideRoot(lock, denied.root)),
      ],
    ]),
    {
      "it imports": true,
      "its surface is there": true,
      "the lease is taken rather than refused": true,
      "nothing refused": true,
      "every lock it held is inside the project": true,
    },
  );

  TestValidator.equals(
    "what the home directory is does not enter into where the lock goes",
    namedFacts([
      // The counter-case for scenario 1: the readers are what that case
      // removed, so an intact run must behave the same rather than differently.
      ["an intact run leases", () => intact.leased === true],
      [
        "losing only the passwd entry changes nothing",
        () => partial.leased === true,
      ],
      [
        "two different homes name the same locks",
        () =>
          here.locks.length > 0 &&
          here.locks.join(" ") === elsewhere.locks.join(" "),
      ],
      // Stated separately from the equality above, because two runs that both
      // fenced somewhere outside the project would also be equal to each other.
      [
        "and those locks are the project's own",
        () => elsewhere.locks.every((lock) => insideRoot(lock, elsewhere.root)),
      ],
    ]),
    {
      "an intact run leases": true,
      "losing only the passwd entry changes nothing": true,
      "two different homes name the same locks": true,
      "and those locks are the project's own": true,
    },
  );
};

interface IProbe {
  imported: boolean;
  surface: boolean;
  leased: boolean;
  refusal: string;
  root: string;
  locks: string[];
}

/**
 * A project root two probes share, so their homes are the only difference.
 *
 * Its own directory rather than one of the probes', because a probe removes its
 * directory when it is done and the second run needs the first's root to still
 * be there.
 */
const sharedRoot = (): string => {
  const cache = path.resolve(__dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(
    path.join(cache, "automovie-passwd-shared-"),
  );
  const root = path.join(directory, "root");
  fs.mkdirSync(root);
  return root;
};

/** Whether one lock path is the project root's own rather than somewhere else. */
const insideRoot = (lock: string, root: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(lock));
  return (
    relative.startsWith("..") === false && path.isAbsolute(relative) === false
  );
};

/**
 * Import the package in a child whose home-directory readers are removed.
 *
 * A child process, because the replacement has to be in place before the module
 * evaluates and this suite has already imported it. `deny` selects which
 * readers throw, so the same script covers the denial, the passwd-only case and
 * the untouched control without three copies of the harness. `home` is what the
 * untouched readers answer, so two runs can differ in nothing else.
 */
const probe = (
  deny: "both" | "passwd-only" | "none",
  home: string,
  shared?: string,
): IProbe => {
  // The readers to remove, chosen here rather than compared inside the probe:
  // a literal comparison against an interpolated constant is a type error the
  // launcher refuses, and a list says the same thing without one.
  const removed: ReadonlyArray<"userInfo" | "homedir"> =
    deny === "both"
      ? ["userInfo", "homedir"]
      : deny === "passwd-only"
        ? ["userInfo"]
        : [];
  // Each probe fences its own directory. A lease is a file that outlives the
  // process that took it, so probes sharing one root would leave the later ones
  // refused by the earlier ones' leftovers -- which is how this case first
  // failed, and is the separate defect `#1994` names.
  const cache = path.resolve(__dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, "automovie-passwd-"));
  const root = shared ?? path.join(directory, "root");
  if (shared === undefined) fs.mkdirSync(root);
  const script = `
    const os = require("node:os");
    const fail = (name: "userInfo" | "homedir"): void => {
      (os as unknown as Record<string, () => never>)[name] = (): never => {
        throw Object.assign(new Error("uv_os_get_passwd returned ENOMEM"), {
          code: "ENOMEM",
        });
      };
    };
    for (const name of ${JSON.stringify(removed)} as ReadonlyArray<"userInfo" | "homedir">)
      fail(name);
    (os as unknown as { homedir: () => string }).homedir = (): string =>
      ${JSON.stringify(home)};
    const out = {
      imported: false,
      surface: false,
      leased: false,
      refusal: "",
      root: ${JSON.stringify(root)},
      locks: [] as string[],
    };
    import("@automovie/mcp")
      .then((mcp) => {
        out.imported = true;
        out.surface = typeof mcp.AutoMovieProductionProject === "function";
        try {
          const lease = mcp.acquireProductionRootNamespace(${JSON.stringify(root)});
          out.leased = true;
          out.locks = lease.locks
            .map((lock: { path: string }) => lock.path)
            .sort((left: string, right: string) =>
              left < right ? -1 : left > right ? 1 : 0,
            );
          // Released rather than dropped, so a passing run leaves the project
          // as it found it.
          mcp.releaseProductionRootNamespace(lease);
        } catch (error) {
          out.refusal = error instanceof Error ? error.message : String(error);
        }
      })
      .catch((error: unknown) => {
        out.refusal = error instanceof Error ? error.message : String(error);
      })
      .finally(() => console.log("PROBE" + JSON.stringify(out)));
  `;
  // Written to a file and run through the launcher this suite itself uses,
  // rather than through `-e`: the module under test is TypeScript and an
  // inline script needs a loader that resolves it. Same runner as the parent
  // means the child resolves the same way.
  // Under the test package rather than the system temporary directory: the
  // launcher looks for a tsconfig starting from the script it is given, and a
  // system path has none above it. This is the same reason
  // `test_mcp_guide_snippet_compilation` writes its scratch modules here.
  const file = path.join(directory, "probe.ts");
  fs.writeFileSync(file, script, "utf8");
  let run: SpawnSyncReturns<string>;
  try {
    run = spawnSync(
      process.execPath,
      [
        path.resolve(
          __dirname,
          "../../../node_modules/ttsc/lib/launcher/ttsx.js",
        ),
        file,
      ],
      { cwd: path.resolve(__dirname, "../../.."), encoding: "utf8" },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const line = run.stdout
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith("PROBE"));
  if (line === undefined)
    throw new Error(
      `The import probe printed no result, so this case measured nothing. stderr: ${run.stderr.slice(0, 400)}`,
    );
  return JSON.parse(line.slice("PROBE".length)) as IProbe;
};
