import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  type IZeroJavaScriptDependencies,
  ZERO_JAVASCRIPT_ROOT,
  ZeroJavaScriptError,
  assertZeroJavaScript,
  findAuthoredJavaScript,
  isProcessEntry,
  runZeroJavaScript,
  setZeroJavaScriptExitCode,
  zeroJavaScriptCli,
  zeroJavaScriptDependencies,
} from "../../integrity/zeroJavaScript";
import { namedFacts } from "../internal/predicates";

const ROOT = path.resolve(__dirname, "../../../..");

const listing = (
  files: readonly string[],
  present: readonly string[] = files,
): IZeroJavaScriptDependencies => ({
  list: () => files,
  isFile: (_root, relative) => present.includes(relative),
});

const captureRun = (
  dependencies: IZeroJavaScriptDependencies,
): { code: number; error: string; output: string } => {
  let output = "";
  let error = "";
  const code = runZeroJavaScript(
    ROOT,
    dependencies,
    { write: (message) => (output += message) },
    { write: (message) => (error += message) },
  );
  return { code, error, output };
};

/**
 * The repository rejects every authored JavaScript extension without exceptions,
 * over the whole repository rather than over whatever subtree the caller stood
 * in.
 *
 * The scanned population is the part that has to be pinned rather than assumed.
 * `git ls-files` is scoped to its working directory, so the entry's former
 * `process.cwd()` default made the population a property of the shell. Run from
 * `test/`, which is where the runner and its `tsconfig.json` live, it printed
 * "No directly authored JavaScript files are present." while
 * `build/zeroJavaScriptNegativeProbe.js` sat unignored in the tree: a guard that
 * reports the same green over a narrowed population is exactly the failure this
 * invariant exists to prevent.
 *
 * Scenarios:
 *
 * 1. The real repository passes, which is the invariant itself.
 * 2. The default root is the repository root and contains `build/` and
 *    `packages/`, so the entry cannot be scoped down to the package it lives in.
 * 3. A listing of TypeScript, JSON, and a Markdown file whose name merely
 *    contains `.mjs` is accepted, so the match is on the extension rather than
 *    on the substring.
 * 4. A `.js` entry the index still names but that is gone from disk is ignored,
 *    because a deleted file is not authored source.
 * 5. All three forbidden extensions are rejected together, sorted, with every
 *    path named in both the error's data and its message.
 * 6. A failure of the listing itself is reported rather than read as an empty
 *    population, which would be the same green as a clean repository.
 * 7. The real listing boundary reports the repository's own tracked and
 *    unignored paths, and the real presence boundary answers `true` for a file,
 *    `false` for a directory, and `false` for a path that is not there. Nothing
 *    else reaches the second one: the extension test short-circuits ahead of it
 *    whenever the repository is clean, which is every run that passes.
 * 8. The entry guard answers both ways and publishes its status through the
 *    process, so a guard that never fires cannot pass as one that did.
 */
export const test_workspace_zero_javascript = (): void => {
  assertZeroJavaScript(ROOT);

  const clean = captureRun(
    listing(["build/tool.ts", "config/policy.json", "docs/history.mjs.md"]),
  );
  const deleted = captureRun(listing(["removed/dead.js"], []));
  const forbiddenDependencies = listing([
    "z/wrapper.cjs",
    "a/config.js",
    "m/loader.mjs",
  ]);
  const forbidden = captureRun(forbiddenDependencies);
  const nonError = captureRun({
    list: () => {
      throw new Error("listing failed");
    },
    isFile: () => true,
  });
  let caught: unknown;
  try {
    assertZeroJavaScript(ROOT, forbiddenDependencies);
  } catch (error) {
    caught = error;
  }
  const entry = path.join(
    ROOT,
    "test",
    "src",
    "integrity",
    "zeroJavaScript.ts",
  );
  const listed = zeroJavaScriptDependencies.list(ROOT);
  const previous = process.exitCode;
  zeroJavaScriptCli(false, setZeroJavaScriptExitCode);
  const skipped = process.exitCode === previous;
  zeroJavaScriptCli(true, setZeroJavaScriptExitCode);
  const ran = process.exitCode === 0;
  process.exitCode = previous;

  TestValidator.equals(
    "zero-JavaScript invariant has positive, deleted, negative, and error behavior",
    namedFacts([
      ["clean accepted", () => clean.code === 0 && clean.error === ""],
      [
        "default root is the repository",
        () =>
          ZERO_JAVASCRIPT_ROOT === ROOT &&
          fs.existsSync(path.join(ZERO_JAVASCRIPT_ROOT, "build")) &&
          fs.existsSync(path.join(ZERO_JAVASCRIPT_ROOT, "packages")),
      ],
      [
        "success explains invariant",
        () => clean.output.includes("No directly authored JavaScript"),
      ],
      ["deleted index entry ignored", () => deleted.code === 0],
      ["all three extensions rejected", () => forbidden.code === 1],
      [
        "violations sorted",
        () =>
          findAuthoredJavaScript(ROOT, forbiddenDependencies).join(",") ===
          "a/config.js,m/loader.mjs,z/wrapper.cjs",
      ],
      [
        "error owns exact paths",
        () =>
          caught instanceof ZeroJavaScriptError &&
          caught.files.join(",") === "a/config.js,m/loader.mjs,z/wrapper.cjs",
      ],
      [
        "negative output names every path",
        () =>
          ["a/config.js", "m/loader.mjs", "z/wrapper.cjs"].every((file) =>
            forbidden.error.includes(file),
          ),
      ],
      [
        "listing failure preserved",
        () =>
          nonError.code === 1 && nonError.error === "Error: listing failed\n",
      ],
      [
        "the listing boundary reads this repository",
        () =>
          listed.includes("package.json") &&
          listed.includes("build/tgz.ts") &&
          listed.every((relative) => relative !== ""),
      ],
      [
        "the presence boundary separates file, directory, and absence",
        () =>
          zeroJavaScriptDependencies.isFile(ROOT, "build/tgz.ts") === true &&
          zeroJavaScriptDependencies.isFile(ROOT, "build") === false &&
          zeroJavaScriptDependencies.isFile(ROOT, "build/absent.js") === false,
      ],
      [
        "entry guard answers both ways",
        () =>
          isProcessEntry(entry, entry) === true &&
          isProcessEntry(path.join(ROOT, "package.json"), entry) === false &&
          isProcessEntry(undefined, entry) === false,
      ],
      ["entry guard publishes only when it fires", () => skipped && ran],
    ]),
    {
      "clean accepted": true,
      "default root is the repository": true,
      "success explains invariant": true,
      "deleted index entry ignored": true,
      "all three extensions rejected": true,
      "violations sorted": true,
      "error owns exact paths": true,
      "negative output names every path": true,
      "listing failure preserved": true,
      "the listing boundary reads this repository": true,
      "the presence boundary separates file, directory, and absence": true,
      "entry guard answers both ways": true,
      "entry guard publishes only when it fires": true,
    },
  );
};
