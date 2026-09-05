import { TestValidator } from "@nestia/e2e";

import {
  type IGitExecutionResult,
  collectGitChangedLines,
  parseChangedCoverageArguments,
  parseChangedLines,
} from "../../coverage/changedCoverage";
import { namedFacts } from "../internal/predicates";

const NEW = "packages/engine/src/fresh.ts";
const STAGED = "packages/engine/src/staged.ts";
const SPACED = "packages/engine/src/sp ace.ts";
const NOTE = "notes/todo.txt";

/** Git's four answers, canned so the population is derived from them alone. */
const answers: Record<string, string> = {
  "merge-base": "0123abcd\n",
  diff: [
    "diff --git a/packages/engine/src/one.ts b/packages/engine/src/one.ts",
    "--- a/packages/engine/src/one.ts",
    "+++ b/packages/engine/src/one.ts",
    "@@ -1 +1 @@",
    "-export const one = 0;",
    "+export const one = 1;",
    "@@ -7,2 +8,3 @@ export const two = 2;",
    "+const a = 1;",
    "+const b = 2;",
    "+const c = 3;",
    "@@ -20,2 +25,0 @@",
    "-const gone = 1;",
    "-const alsoGone = 2;",
    `diff --git "a/${SPACED}" "b/${SPACED}"`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ "b/${SPACED}"`,
    "@@ -0,0 +1,2 @@",
    "+export const spaced = 1;",
    "+export const twice = 2;",
    "diff --git a/packages/engine/src/removed.ts b/packages/engine/src/removed.ts",
    "deleted file mode 100644",
    "--- a/packages/engine/src/removed.ts",
    "+++ /dev/null",
    "@@ -1,3 +0,0 @@",
    "-a",
    "-b",
    "-c",
    "",
  ].join("\r\n"),
  "diff --cached": `${STAGED}\0docs/readme.md\0`,
  "diff --name-only": `${STAGED}\0docs/readme.md\0`,
  "ls-files": `${NEW}\0${NOTE}\0`,
};

const canned = (
  _executable: string,
  arguments_: string[],
): IGitExecutionResult => {
  const key =
    arguments_[0] === "-c"
      ? "diff"
      : arguments_[0] === "diff" && arguments_[1] === "--cached"
        ? "diff --cached"
        : arguments_[0] === "diff"
          ? "diff --name-only"
          : arguments_[0]!;
  const stdout = answers[key];
  return stdout === undefined
    ? { status: 128, stderr: `unexpected git ${key}`, stdout: "" }
    : { status: 0, stderr: "", stdout };
};

/**
 * The changed-coverage gate derives its population from explicit inputs only.
 *
 * The gate's denominator is whatever git says changed between the merge base
 * and the final tree, and an untracked authored file is the one case git
 * cannot describe by lines. Recorded with an empty line set it inherits every
 * position and reads `0/0`, so it is demanded whole instead. The other silent
 * failure is a file staged in one form and edited to another: one snapshot
 * cannot certify both, so the pair is refused rather than judged.
 *
 * Scenarios:
 *
 * 1. A zero-context diff yields the new-side lines of each hunk: a bare `@@
 *    -1 +1 @@` is one line, a three-line hunk is three, a pure deletion adds
 *    nothing, a quoted path is unquoted, a deleted file is not a changed file,
 *    and CRLF line endings do not leak into names.
 * 2. Untracked paths join the population with no lines; only the authored one
 *    is demanded whole, and the note beside it is not.
 * 3. A source present in both the index and the worktree is divergent; a
 *    document in the same state is not a coverage concern and is not.
 * 4. The counts name what git reported, the base and merge base are carried,
 *    and a git failure surfaces as the thrown error rather than as an empty
 *    population.
 * 5. `--base` and `--root` parse exactly once each with one value; an unknown
 *    flag, a repeated flag and a flag without a value are refused.
 */
export const test_workspace_coverage_changed_population = (): void => {
  const changes = collectGitChangedLines("/repo", "origin/master", canned);
  const lines = (file: string): number[] =>
    [...(changes.files.get(file) ?? [])].sort((left, right) => left - right);
  const parsed = parseChangedLines(answers["diff"]!);
  const failing = (): unknown =>
    collectGitChangedLines("/repo", "origin/master", () => ({
      status: 1,
      stderr: "fatal: not a git repository",
      stdout: "",
    }));
  const erroring = (): unknown =>
    collectGitChangedLines("/repo", "origin/master", () => ({
      error: new Error("spawn git ENOENT"),
      status: null,
      stderr: "",
      stdout: "",
    }));
  const arguments_ = parseChangedCoverageArguments([
    "--base",
    "origin/master",
    "--root",
    "/repo",
  ]);
  const refused = (argv: string[]): boolean => {
    try {
      parseChangedCoverageArguments(argv);
      return false;
    } catch {
      return true;
    }
  };

  TestValidator.equals(
    "the changed population is derived from git's answers alone",
    namedFacts([
      [
        "a bare hunk header names one line",
        () => lines("packages/engine/src/one.ts").includes(1),
      ],
      [
        "a counted hunk names every new-side line",
        () =>
          lines("packages/engine/src/one.ts").join(",") === "1,8,9,10" &&
          parsed.get("packages/engine/src/one.ts")?.size === 4,
      ],
      [
        "a quoted path is unquoted and its lines kept",
        () => lines(SPACED).join(",") === "1,2",
      ],
      [
        "a deleted file is not a changed file",
        () =>
          changes.files.has("packages/engine/src/removed.ts") === false &&
          parsed.has("packages/engine/src/removed.ts") === false,
      ],
      [
        "untracked paths join the population with no lines",
        () => lines(NEW).length === 0 && lines(NOTE).length === 0,
      ],
      [
        "only the untracked authored source is demanded whole",
        () =>
          changes.wholeFiles.has(NEW) &&
          changes.wholeFiles.has(NOTE) === false &&
          changes.wholeFiles.size === 1,
      ],
      [
        "a source staged and edited again is divergent, a document is not",
        () => changes.divergent.join(",") === STAGED,
      ],
      [
        "the counts name what git reported",
        () =>
          changes.staged === 2 &&
          changes.worktree === 2 &&
          changes.untracked === 2,
      ],
      [
        "the base and merge base are carried",
        () =>
          changes.base === "origin/master" && changes.mergeBase === "0123abcd",
      ],
      [
        "a failing git command throws rather than emptying the population",
        () => {
          try {
            failing();
            return false;
          } catch (error) {
            return (
              error instanceof Error &&
              error.message.includes("fatal: not a git repository")
            );
          }
        },
      ],
      [
        "a git that could not start throws its own error",
        () => {
          try {
            erroring();
            return false;
          } catch (error) {
            return (
              error instanceof Error && error.message === "spawn git ENOENT"
            );
          }
        },
      ],
      [
        "base and root parse once each",
        () => arguments_.base === "origin/master" && arguments_.root === "/repo",
      ],
      ["no arguments parse to nothing", () =>
        Object.keys(parseChangedCoverageArguments([])).length === 0,
      ],
      [
        "an unknown flag is refused",
        () => refused(["--report-directory", "/elsewhere"]),
      ],
      [
        "a repeated flag is refused",
        () => refused(["--base", "a", "--base", "b"]),
      ],
      ["a flag without a value is refused", () => refused(["--root"])],
    ]),
    Object.fromEntries(
      [
        "a bare hunk header names one line",
        "a counted hunk names every new-side line",
        "a quoted path is unquoted and its lines kept",
        "a deleted file is not a changed file",
        "untracked paths join the population with no lines",
        "only the untracked authored source is demanded whole",
        "a source staged and edited again is divergent, a document is not",
        "the counts name what git reported",
        "the base and merge base are carried",
        "a failing git command throws rather than emptying the population",
        "a git that could not start throws its own error",
        "base and root parse once each",
        "no arguments parse to nothing",
        "an unknown flag is refused",
        "a repeated flag is refused",
        "a flag without a value is refused",
      ].map((key) => [key, true]),
    ),
  );
};
