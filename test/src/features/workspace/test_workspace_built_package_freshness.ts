import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { builtOutputIsStale } from "../internal/builtPackageFreshness";

/**
 * A build older than its source is not the build a fixture may install.
 *
 * Three fixtures install a built workspace package into a generated consumer,
 * and two of them decided by asking whether `lib/index.js` existed. It exists
 * whenever anything was ever built there, so a build left by another branch was
 * used exactly as readily as one built from the source at hand.
 *
 * The cost is a diagnostic about the wrong thing. Adding one obligation on one
 * branch and running a fixture on another produced `obligations/core/common.md
 * H2 inventory changed without graph wiring`, naming an anchor the reader's own
 * source does not contain, so the search for what they broke starts in the
 * wrong file. It happened twice in one session before the cause was named.
 *
 * CI never meets it: the lane builds before it tests. The people who meet it
 * are the ones running these fixtures locally while moving between branches,
 * which is most of the work on them.
 *
 * Scenarios:
 *
 * 1. Output newer than every source file is current; output older than any one
 *    of them is stale, including one buried in a subdirectory, because a build
 *    answers for the whole tree it was made from.
 * 2. Absent output is stale rather than an error, which is the reading the two
 *    call sites already had and the one thing this must not change.
 * 3. A package with no `src` at all is not stale. Nothing can be newer than the
 *    build, and refusing here would refuse a shape the answer says nothing
 *    about.
 */
export const test_workspace_built_package_freshness = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-freshness-"));
  try {
    const packageRoot = path.join(root, "evidence");
    const nested = path.join(packageRoot, "src", "deep");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(packageRoot, "lib"), { recursive: true });
    const output = path.join(packageRoot, "lib", "index.js");
    const surface = path.join(packageRoot, "src", "surface.ts");
    const buried = path.join(nested, "buried.ts");
    fs.writeFileSync(surface, "export const surface = 1;\n", "utf8");
    fs.writeFileSync(buried, "export const buried = 2;\n", "utf8");
    fs.writeFileSync(output, "exports.surface = 1;\n", "utf8");

    // Stamped rather than slept for: a test that waits on a clock to observe an
    // ordering is a test that reports the clock's resolution.
    const stamp = (file: string, msAgo: number): void => {
      const when = new Date(Date.now() - msAgo);
      fs.utimesSync(file, when, when);
    };
    stamp(surface, 10_000);
    stamp(buried, 10_000);
    stamp(output, 5_000);
    const current = builtOutputIsStale({ output, packageRoot });

    stamp(buried, 1_000);
    const staleFromNested = builtOutputIsStale({ output, packageRoot });

    const empty = path.join(root, "no-sources");
    fs.mkdirSync(path.join(empty, "lib"), { recursive: true });
    const emptyOutput = path.join(empty, "lib", "index.js");
    fs.writeFileSync(emptyOutput, "exports.nothing = 1;\n", "utf8");

    TestValidator.equals(
      "a build older than any source is stale, and an absent one always is",
      {
        current,
        staleFromNested,
        absent: builtOutputIsStale({
          output: path.join(packageRoot, "lib", "missing.js"),
          packageRoot,
        }),
        withoutSources: builtOutputIsStale({
          output: emptyOutput,
          packageRoot: empty,
        }),
      },
      {
        current: false,
        staleFromNested: true,
        absent: true,
        withoutSources: false,
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
