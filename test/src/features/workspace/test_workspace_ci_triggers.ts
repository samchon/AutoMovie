import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/** One workflow's `paths:` entry, quoted or bare. */
const PATHS_ITEM = /^ {6}- (.+?)\s*$/;

/**
 * Every `paths:` pattern one workflow filters its `pull_request` trigger by, in
 * declaration order.
 *
 * Read line by line rather than by one regex over the file. A regex anchored on
 * `paths:` and the next top-level key cannot tell a `pull_request` filter from
 * a `push` one, and would silently merge a sibling `branches:` list into the
 * result; this walks the `pull_request` block and stops at its first sibling
 * key. Comments carry the reasoning but not the contract, so only list items
 * are collected — and an item this cannot read throws instead of vanishing,
 * since a dropped entry is exactly what would make the equality below pass on
 * two different lists.
 */
const triggerPaths = (workflow: string): string[] => {
  const lines = fs
    .readFileSync(path.join(ROOT, ".github", "workflows", `${workflow}.yml`), {
      encoding: "utf8",
    })
    .split(/\r?\n/);
  const trigger = lines.indexOf("  pull_request:");
  if (trigger === -1)
    throw new Error(`${workflow}.yml declares no pull_request trigger`);

  const patterns: string[] = [];
  let inPaths = false;
  for (const line of lines.slice(trigger + 1)) {
    const body = line.trimStart();
    if (body === "" || body.startsWith("#")) continue;
    const indent = line.length - body.length;
    if (indent <= 2) break; // the pull_request block ended
    if (indent === 4) {
      inPaths = body === "paths:"; // a sibling key: branches, types, ...
      continue;
    }
    if (!inPaths) continue;
    const item = PATHS_ITEM.exec(line);
    if (item === null)
      throw new Error(`${workflow}.yml has an unreadable paths entry: ${line}`);
    patterns.push(item[1]!.replace(/^'(.*)'$|^"(.*)"$/, "$1$2"));
  }
  if (patterns.length === 0)
    throw new Error(`${workflow}.yml declares an empty paths filter`);
  return patterns;
};

/**
 * Glob syntax outside the subset {@link matches} implements: character classes,
 * alternation, single-character wildcards, negation, and escapes.
 */
const UNSUPPORTED_SYNTAX = /[?[\]!+{}\\]/;

/**
 * GitHub's path filter, restricted to the subset both workflows use: `*`
 * matches within one path segment, `**` crosses separators, and everything else
 * is literal. A leading globstar segment matches ZERO segments as well, so the
 * globstar form of a root-level document still covers it; collapsing that form
 * to a dot-star plus a literal separator answers false there, and that is the
 * direction that turns the counter-example below into a false green.
 *
 * Scenario 1 refuses any pattern outside the subset, so this can never quietly
 * answer for syntax it does not implement.
 */
const matches = (pattern: string, file: string): boolean =>
  new RegExp(
    `^${pattern.replace(/\*\*\/|\*\*|\*|[.^$+(){}|[\]\\]/g, (token) =>
      token === "**/"
        ? "(?:.*/)?"
        : token === "**"
          ? ".*"
          : token === "*"
            ? "[^/]*"
            : `\\${token}`,
    )}$`,
  ).test(file);

/**
 * Every repository file the workspace scenarios name and read. Each is an input
 * a pull request can change on its own, so each must reach both jobs.
 *
 * The recursive tree walk in `test_workspace_no_shadowing_js` is deliberately
 * absent: it has no fixed file list, and its coverage rests on the shape
 * patterns rather than on any name this could enumerate.
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
  // this scenario
  ".github/workflows/build.yml",
  ".github/workflows/test.yml",
];

/**
 * Tracked files no job reads, kept unmatched on purpose: the agent
 * instructions, the ignore list, and the packaging probe that runs by hand
 * outside CI.
 */
const UNWATCHED = [
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ".agents/skills/review/SKILL.md",
  "internals/e2e-tgz.mjs",
];

/**
 * The matcher's own oracle: pattern, file, and what GitHub answers.
 *
 * The two segment rules are what every assertion below rests on, and neither is
 * exercised by the repository's own paths — mutating `[^/]*` to `.*` left every
 * other assertion in this file green. These pairs discriminate directly.
 */
const MATCHER_ORACLE: Array<[string, string, boolean]> = [
  // `*` stays inside one segment
  ["packages/*/*.md", "packages/viewer/README.md", true],
  ["packages/*/*.md", "packages/viewer/docs/guide.md", false],
  ["*.yml", "pnpm-workspace.yml", true],
  ["*.yml", ".github/workflows/build.yml", false],
  // `**` crosses them
  ["packages/*/src/**", "packages/engine/src/film/cameraMove.ts", true],
  ["packages/*/src/**", "packages/engine/lib/film/cameraMove.js", false],
  ["test/**", "test/src/features/workspace/x.ts", true],
  // a leading globstar also matches zero segments
  ["**/*.md", "AGENTS.md", true],
  ["**/*.md", "packages/mcp/prompts/DESIGN.md", true],
  // and a literal is a literal
  [".gitattributes", ".gitattributes", true],
  [".prettier*", ".prettierignore", true],
  [".prettier*", "prettier.config.js", false],
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
 * The two lists are also held identical, with no exception. Each workflow used
 * to name only its own definition, which left `build.yml` — a file this very
 * scenario reads and asserts on — outside the `test` filter, so editing it
 * alone ran the build and never the suite that checks it. Both names now sit in
 * both files. `build` and `test` do not read the same inputs (the build
 * compiles no `test/**`, and Prettier checks no markdown), but one shared list
 * is what makes the next drift a one-line diff instead of a silent divergence
 * between two long enumerations.
 *
 * Scenarios:
 *
 * 1. Every declared pattern stays inside the glob subset {@link matches}
 *    implements, so no assertion below is decided by a matcher guessing at
 *    syntax it does not support.
 * 2. The matcher answers GitHub's semantics on a hand-written oracle: `*` held
 *    inside one segment, `**` crossing them, a leading `**` matching zero
 *    segments, and literals literal. A matcher is the oracle for everything
 *    after it, so it gets its own counter-examples rather than borrowing the
 *    repository's paths, which do not discriminate the segment rule at all.
 * 3. Both workflows watch both definitions, and their lists are equal element for
 *    element and in order.
 * 4. Every file the workspace scenarios name exists in the checkout and matches at
 *    least one pattern in BOTH workflows. The existence half keeps a renamed
 *    input from leaving a pin that guards nothing.
 * 5. Fault injection by counter-example: the agent instructions, the ignore list,
 *    and the hand-run packaging probe match NO pattern in either workflow. A
 *    filter that grew a catch-all would satisfy scenario 4 vacuously; this is
 *    the assertion it fails.
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

  // 2. and it answers that syntax the way GitHub does
  TestValidator.equals(
    "the matcher models segment-bounded and separator-crossing globs",
    MATCHER_ORACLE.map(([pattern, file]) => matches(pattern, file)),
    MATCHER_ORACLE.map(([, , expected]) => expected),
  );

  // 3. one shared list, naming both definitions
  TestValidator.equals(
    "both workflows watch both workflow definitions",
    [
      build.includes(".github/workflows/build.yml"),
      build.includes(".github/workflows/test.yml"),
      test.includes(".github/workflows/build.yml"),
      test.includes(".github/workflows/test.yml"),
    ],
    [true, true, true, true],
  );
  TestValidator.equals("build and test filter by the same paths", build, test);

  // 4. every named suite input reaches both jobs
  TestValidator.equals(
    "every file the suite names exists and triggers both jobs",
    SUITE_INPUTS.map((file) => [
      fs.existsSync(path.join(ROOT, file)),
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    SUITE_INPUTS.map(() => [true, true, true]),
  );

  // 5. and the match is not vacuous
  TestValidator.equals(
    "tracked files no job reads trigger neither job",
    UNWATCHED.map((file) => [
      fs.existsSync(path.join(ROOT, file)),
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    UNWATCHED.map(() => [true, false, false]),
  );
};
