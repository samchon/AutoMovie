import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * Every `paths:` pattern one workflow filters its `pull_request` trigger by, in
 * declaration order. Comments and blank lines inside the block carry the
 * reasoning but not the contract, so only the quoted patterns are read.
 */
const triggerPaths = (workflow: string): string[] => {
  const text = fs.readFileSync(
    path.join(ROOT, ".github", "workflows", `${workflow}.yml`),
    "utf8",
  );
  const block = /\n {4}paths:\n([\s\S]*?)\njobs:/.exec(text);
  if (block === null)
    throw new Error(`${workflow}.yml declares no pull_request paths filter`);
  return [...block[1]!.matchAll(/^ {6}- '(.+)'$/gm)].map((match) => match[1]!);
};

/** Glob metacharacters outside the subset {@link matches} implements. */
const UNSUPPORTED_SYNTAX = /[?[\]!+{}]/;

/**
 * GitHub's path filter, restricted to the subset both workflows use: `*`
 * matches within one path segment, `**` crosses separators, and everything else
 * is literal. Scenario 1 refuses any pattern outside that subset, so this can
 * never quietly answer for syntax it does not implement.
 */
const matches = (pattern: string, file: string): boolean =>
  new RegExp(
    `^${pattern.replace(/\*\*|\*|[.^$+(){}|[\]\\]/g, (token) =>
      token === "**" ? ".*" : token === "*" ? "[^/]*" : `\\${token}`,
    )}$`,
  ).test(file);

/**
 * Every repository file the workspace scenarios read out of the checkout. Each
 * one is an input a pull request can change on its own, so each must reach both
 * jobs.
 */
const SUITE_INPUTS = [
  // test_workspace_public_contracts
  "README.md",
  "packages/engine/README.md",
  "packages/interface/README.md",
  "packages/mcp/README.md",
  "packages/interface/src/harness/IAutoMoviePerformanceApplication.ts",
  "packages/interface/src/harness/IAutoMovieActionCall.ts",
  "packages/interface/src/skeleton/AutoMovieBodyRegion.ts",
  "packages/interface/src/validation/AutoMovieViolationKind.ts",
  "packages/interface/src/validation/IAutoMovieConstraintViolation.ts",
  // test_workspace_pnpm_policy
  "package.json",
  "pnpm-workspace.yaml",
];

/**
 * Files no job reads, kept unmatched on purpose: agent instructions and the
 * gitignored working notes.
 */
const UNWATCHED = [
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ".agents/skills/review/SKILL.md",
  ".wiki/README.md",
];

/**
 * Every file the suite reads must reach the jobs that run the suite.
 *
 * A `paths:` filter that misses an input is not a slow build, it is no build:
 * GitHub evaluates the filter over a pull request's whole diff, so a change
 * confined to unmatched files runs zero jobs and merges on no evidence. The
 * filters were rewritten by shape twice for exactly that reason (#1333 for the
 * per-package inputs, #1335 for the root tooling), and the public entry
 * documents still slipped through: `test_workspace_public_contracts` asserts on
 * four markdown files that neither filter matched (#1397), while #1386 and
 * #1387 showed what an all-markdown diff does — build and test never ran.
 *
 * The two lists are also held identical apart from each workflow's own
 * filename. `build` and `test` do not read the same inputs (the build compiles
 * no `test/**`, and Prettier checks no markdown), but one shared list is what
 * makes the next drift a visible one-line diff instead of a silent divergence
 * between two long enumerations.
 *
 * Scenarios:
 *
 * 1. Every declared pattern stays inside the glob subset {@link matches}
 *    implements, so no assertion below is decided by a matcher guessing at
 *    syntax it does not support.
 * 2. Each workflow watches its own definition, and the two lists are otherwise
 *    equal, element for element and in order.
 * 3. Every file the workspace scenarios read exists in the checkout and matches at
 *    least one pattern in BOTH workflows. The existence half keeps a renamed
 *    input from leaving a pin that guards nothing.
 * 4. Fault injection by counter-example: agent instructions and the gitignored
 *    wiki match NO pattern in either workflow. A filter that grew a catch-all
 *    would satisfy scenario 3 vacuously; this is the assertion it fails.
 */
export const test_workspace_ci_triggers = (): void => {
  const build = triggerPaths("build");
  const test = triggerPaths("test");

  // 1. the matcher only answers for syntax it implements
  TestValidator.equals(
    "both filters stay inside the supported glob subset",
    [...build, ...test].filter((pattern) => UNSUPPORTED_SYNTAX.test(pattern)),
    [],
  );

  // 2. one shared list, plus each workflow's self-reference
  TestValidator.equals(
    "each workflow watches its own definition",
    [
      build.includes(".github/workflows/build.yml"),
      test.includes(".github/workflows/test.yml"),
    ],
    [true, true],
  );
  TestValidator.equals(
    "build and test filter by the same paths apart from their own file",
    build.filter((pattern) => pattern !== ".github/workflows/build.yml"),
    test.filter((pattern) => pattern !== ".github/workflows/test.yml"),
  );

  // 3. every suite input reaches both jobs
  TestValidator.equals(
    "every file the suite reads exists and triggers both jobs",
    SUITE_INPUTS.map((file) => [
      fs.existsSync(path.join(ROOT, file)),
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    SUITE_INPUTS.map(() => [true, true, true]),
  );

  // 4. and the match is not vacuous
  TestValidator.equals(
    "documents no job reads trigger neither job",
    UNWATCHED.map((file) => [
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    UNWATCHED.map(() => [false, false]),
  );
};
