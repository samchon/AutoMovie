import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  buildScratchDirectory,
  preserveBuildScratchCleanup,
} from "./BuildScratchDirectory";
import { type ITgzModule, loadBuildModule } from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

/**
 * The pack boundary sends a destination containing a space to the real `pnpm
 * pack` and gets the tarball back at that exact path.
 *
 * `spawnSync` needs `shell: true` on Windows because `pnpm` is a `.CMD` shim
 * Node refuses to execute directly, and a shell invocation discards the
 * argument array: Node joins the command and its arguments with single spaces
 * and hands `cmd.exe` one string. Measured on this repository before the quote
 * was added, `--pack-destination <dir>/dest with space` reached `pnpm` as
 * `--pack-destination <dir>/dest` plus two stray positionals, and the result was
 * worse than a crash: exit status 0 and a reported tarball written to the
 * truncated path. Every downstream check in `packWorkspace` then passed while
 * the bytes sat outside the requested directory, and a checkout under
 * `C:\\Users\\John Doe` would have written outside the repository entirely.
 *
 * The case is not Windows-only. On POSIX the argument array survives, so the
 * same spaced destination must work without the quote, which is what makes the
 * quote conditional rather than unconditional: quoting a POSIX argument would
 * make the quotes part of the path.
 *
 * Scenarios:
 *
 * 1. `shellArgument` wraps a value for a shell invocation and leaves it alone
 *    otherwise, which is the whole conditional.
 * 2. A real `pnpm pack` of a minimal package into a destination whose path
 *    contains a space exits zero and reports a tarball.
 * 3. The reported path is inside the spaced destination, not a truncation of
 *    it. This is the assertion the defect failed: the old code also reported a
 *    path and also exited zero.
 * 4. The reported tarball is physically present, and `read` returns its bytes,
 *    so the digest a sandbox is pinned by is taken over the file that exists.
 * 5. `remove` clears the destination and `makeDirectory` recreates it, in the
 *    order `packWorkspace` relies on to keep a previous run's tarballs out of
 *    this run's specifier set.
 * 6. `rename` moves the reported tarball to its digest-named sibling and
 *    `write` reaches standard output, so the boundary object has no member that
 *    only exists on paper.
 */
const assertBuildTgzWindowsShellBoundary = async (): Promise<void> => {
  const { packWorkspaceDependencies, shellArgument } =
    await loadBuildModule<ITgzModule>("tgz.ts");
  const scratch = buildScratchDirectory("shell-boundary");
  let failure: { error: unknown } | undefined;
  try {
    const source = path.join(scratch, "package");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, "package.json"),
      `${JSON.stringify(
        {
          name: "automovie-shell-boundary-probe",
          private: false,
          version: "1.0.0",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const destination = path.join(scratch, "dest with space");
    packWorkspaceDependencies.remove(destination);
    const clearedBeforeCreate = fs.existsSync(destination) === false;
    packWorkspaceDependencies.makeDirectory(destination);

    const packed = packWorkspaceDependencies.pack(source, destination);
    const reported = packed.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.endsWith(".tgz"));
    const produced = reported[0] ?? "";
    const renamed = path.join(destination, "renamed.tgz");
    if (produced !== "" && fs.existsSync(produced))
      packWorkspaceDependencies.rename(produced, renamed);
    const written = packWorkspaceDependencies.write("");

    TestValidator.equals(
      "the pack boundary honours a destination containing a space",
      namedFacts([
        ["remove cleared the destination", () => clearedBeforeCreate],
        [
          "makeDirectory recreated the destination",
          () => fs.existsSync(destination),
        ],
        ["pack succeeded", () => packed.status === 0],
        ["pack reported exactly one tarball", () => reported.length === 1],
        [
          "the tarball is inside the spaced destination",
          () => path.dirname(produced) === destination,
        ],
        [
          "the reported tarball was present and readable",
          () =>
            packWorkspaceDependencies.exists(renamed) && renamed !== produced,
        ],
        [
          "read returns the renamed tarball's own bytes",
          () =>
            packWorkspaceDependencies.read(renamed).byteLength ===
            fs.statSync(renamed).size,
        ],
        ["write reaches standard output", () => written === true],
        [
          "quoting is applied only for a shell invocation",
          () =>
            shellArgument(destination, true) === `"${destination}"` &&
            shellArgument(destination, false) === destination,
        ],
      ]),
      {
        "quoting is applied only for a shell invocation": true,
        "remove cleared the destination": true,
        "makeDirectory recreated the destination": true,
        "pack succeeded": true,
        "pack reported exactly one tarball": true,
        "the tarball is inside the spaced destination": true,
        "the reported tarball was present and readable": true,
        "read returns the renamed tarball's own bytes": true,
        "write reaches standard output": true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveBuildScratchCleanup(failure, scratch);
  }
};

/** Exercise the pack boundary against a destination containing a space through a runner that can load the build tools. */
export const test_build_tgz_windows_shell_boundary = (): void => {
  runBuildScenarioChild(__filename, "test_build_tgz_windows_shell_boundary");
};

runWhenBuildScenarioChild(
  "test_build_tgz_windows_shell_boundary",
  assertBuildTgzWindowsShellBoundary,
);
