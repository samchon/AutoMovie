import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { type ITgzModule, loadBuildModule } from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * The root `build:tgz` command targets the repository cache and only runs when
 * this module is the process entry.
 *
 * The entry guard is the part that has to be exercised rather than read. A
 * module-scope comparison is only ever taken one way inside a test run, so a
 * guard that never fires and a guard that always fires produce the same green;
 * this repository has already shipped a CI job that reported success having run
 * zero steps and a lint claim that selected no host. Taking the entry as a
 * parameter is what makes both answers observable without spawning a process
 * for each.
 *
 * Scenarios:
 *
 * 1. `buildTgz` packs into `node_modules/.cache/automovie-tgz` under the root it
 *    is given, and returns the `.tarballs` directory inside it. The cache root
 *    matters: it is gitignored, so a pack cannot leave tracked residue.
 * 2. The reported message names that same returned directory, so the line a
 *    reader copies is the line the function returned.
 * 3. Omitting the writer exercises the default, which reaches real standard
 *    output; the pack is still injected, so no tarball is produced.
 * 4. `isProcessEntry` is true only for the file that equals the entry after
 *    resolution, and a relative spelling of the same path still matches.
 * 5. `isProcessEntry` is false for a different file, and false rather than
 *    throwing when the host started Node with no script path at all.
 * 6. `buildTgzCli` runs its command when the entry matches and does not when it
 *    does not, which is the branch a bare module-scope `if` hides.
 */
const assertBuildTgzCommandEntry = async (): Promise<void> => {
  const { buildTgz, buildTgzCli, isProcessEntry } =
    await loadBuildModule<ITgzModule>("tgz.ts");
  const root = path.join(ROOT, "node_modules", ".cache", "entry-root");
  const cache = path.join(root, "node_modules", ".cache", "automovie-tgz");
  const targets: string[] = [];
  const messages: string[] = [];
  const output = buildTgz(
    root,
    (target) => {
      targets.push(target);
      return {};
    },
    (message) => messages.push(message),
  );

  const defaulted: string[] = [];
  buildTgz(root, (target) => {
    defaulted.push(target);
    return {};
  });

  const ran: string[] = [];
  buildTgzCli(false, () => ran.push("skipped"));
  buildTgzCli(true, () => ran.push("ran"));

  const entry = path.join(ROOT, "build", "tgz.ts");
  TestValidator.equals(
    "build:tgz targets the repository cache behind an observable entry guard",
    namedFacts([
      ["packs into the cache", () => targets.join() === cache],
      [
        "returns the tarball directory",
        () => output === path.join(cache, ".tarballs"),
      ],
      [
        "reports the directory it returned",
        () => messages.join() === `TGZ packages built under ${output}\n`,
      ],
      ["default writer is exercised", () => defaulted.join() === cache],
      ["entry matches itself", () => isProcessEntry(entry, entry) === true],
      [
        "entry matches an unresolved spelling",
        () =>
          isProcessEntry(
            path.join(ROOT, "build", "..", "build", "tgz.ts"),
            entry,
          ) === true,
      ],
      [
        "entry rejects another file",
        () =>
          isProcessEntry(path.join(ROOT, "build", "experimental.ts"), entry) ===
          false,
      ],
      [
        "entry rejects a missing script path",
        () => isProcessEntry(undefined, entry) === false,
      ],
      ["cli runs only on the entry", () => ran.join() === "ran"],
    ]),
    {
      "packs into the cache": true,
      "returns the tarball directory": true,
      "reports the directory it returned": true,
      "default writer is exercised": true,
      "entry matches itself": true,
      "entry matches an unresolved spelling": true,
      "entry rejects another file": true,
      "entry rejects a missing script path": true,
      "cli runs only on the entry": true,
    },
  );
};

/** Exercise the root pack command and its entry guard through a runner that can load the build tools. */
export const test_build_tgz_command_entry = (): void => {
  runBuildScenarioChild(__filename, "test_build_tgz_command_entry");
};

runWhenBuildScenarioChild(
  "test_build_tgz_command_entry",
  assertBuildTgzCommandEntry,
);
