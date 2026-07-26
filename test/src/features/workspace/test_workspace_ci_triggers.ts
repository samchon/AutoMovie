import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * One `paths:` entry: a quoted or bare scalar with an optional same-line
 * comment. This covers the scalar forms a path filter uses, not all of YAML --
 * an escaped inner quote or a `#` with no space before it is refused loudly
 * rather than read, which is the safe direction for a guard.
 *
 * The comment half is not decoration. A pattern read as `'**' # revert later`
 * is a string that matches no file, so a catch-all added with a note beside it
 * would report as harmless while the live workflow triggered on everything --
 * the one direction that turns the counter-example below into a false green.
 */
const PATHS_ITEM =
  /^ {6}- ('[^']*'|"[^"]*"|[^'"#\s](?:[^#]*[^#\s])?)(?:\s+#.*)?\s*$/;

/** A key line's content, with any trailing comment and whitespace removed. */
const withoutComment = (line: string): string =>
  line.replace(/\s+#.*$/, "").trim();

/**
 * Every `paths:` pattern a workflow document filters its `pull_request` trigger
 * by, in declaration order.
 *
 * Read line by line rather than by one regex over the file. A regex anchored on
 * `paths:` and the next top-level key cannot tell a `pull_request` filter from
 * a `push` one, and would silently merge a sibling `branches:` list into the
 * result; this walks the `pull_request` block and stops at its first sibling
 * key. Comments carry the reasoning but not the contract, so only list items
 * are collected -- and an item this cannot read throws instead of vanishing or
 * being guessed at, since a dropped or fabricated entry is exactly what would
 * make the equality below pass on two lists that differ.
 *
 * Each refusal names its own cause, and the oracle asserts the cause rather
 * than the mere fact of throwing: a missing list and an unreadable entry are
 * different failures, and a parser that silently skipped the entry would still
 * "throw" at the end for lack of any.
 *
 * Exported so the scenario can hand it documents the repository does not
 * contain: a parser is the oracle for everything after it, and one that cannot
 * be shown to fail is not an oracle.
 */
export const workflowTriggerPaths = (
  label: string,
  document: string,
): string[] => {
  const lines = document.split(/\r?\n/);
  const trigger = lines.findIndex(
    (line) =>
      line.startsWith("  pull_request:") &&
      withoutComment(line) === "pull_request:",
  );
  if (trigger === -1)
    throw new Error(`${label} declares no pull_request trigger`);

  const patterns: string[] = [];
  let sawPaths = false;
  let inPaths = false;
  for (const line of lines.slice(trigger + 1)) {
    const body = line.trimStart();
    if (body === "" || body.startsWith("#")) continue;
    const indent = line.length - body.length;
    if (indent <= 2) break; // the pull_request block ended
    if (indent === 4) {
      inPaths = withoutComment(line) === "paths:"; // else a sibling key
      sawPaths = sawPaths || inPaths;
      continue;
    }
    if (!inPaths) continue;
    const item = PATHS_ITEM.exec(line);
    if (item === null)
      throw new Error(`${label} has an unreadable paths entry: ${line}`);
    const scalar = item[1]!;
    const pattern =
      scalar.startsWith("'") || scalar.startsWith('"')
        ? scalar.slice(1, -1)
        : scalar;
    if (pattern === "") throw new Error(`${label} declares an empty pattern`);
    patterns.push(pattern);
  }
  if (!sawPaths) throw new Error(`${label} declares no readable paths list`);
  if (patterns.length === 0)
    throw new Error(`${label} declares an empty paths list`);
  return patterns;
};

/** The same, read off one of the repository's own workflow files. */
const triggerPaths = (workflow: string): string[] =>
  workflowTriggerPaths(
    `${workflow}.yml`,
    fs.readFileSync(
      path.join(ROOT, ".github", "workflows", `${workflow}.yml`),
      "utf8",
    ),
  );

/**
 * Glob syntax outside the subset {@link matches} implements: character classes,
 * alternation, single-character wildcards, negation, and escapes.
 */
const UNSUPPORTED_SYNTAX = /[?[\]!+{}\\]/;

/**
 * GitHub's path filter, restricted to the subset both workflows use: `*`
 * matches within one path segment, `**` matches zero or more of any character,
 * and everything else is literal.
 *
 * A globstar that OPENS a segment absorbs the separator after it, so the
 * globstar form of a root-level document still covers that document; one that
 * does not open a segment leaves the separator literal, since there the
 * globstar is an ordinary any-character run. Collapsing the first case to a
 * dot-star plus a literal separator answers false for the root file, which is
 * how a markdown catch-all would slip past the counter-example below.
 */
const matches = (pattern: string, file: string): boolean =>
  new RegExp(
    `^${pattern.replace(
      /\*\*\/|\*\*|\*|[.^$+(){}|[\]\\]/g,
      (token: string, offset: number) =>
        token === "**/"
          ? offset === 0 || pattern[offset - 1] === "/"
            ? "(?:.*/)?"
            : ".*/"
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
 * Files present in the checkout that no job reads, kept unmatched on purpose:
 * the agent instructions, the ignore list, and the packaging probe that runs by
 * hand outside CI.
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
 * The segment rules are what every assertion below rests on, and none is
 * exercised by the repository's own paths -- mutating `[^/]*` to `.*` left
 * every other assertion in this file green. These pairs discriminate directly.
 *
 * The rows marked `cheat sheet` are transcribed from GitHub's own filter-
 * pattern table, pattern and example both, which is the authority for the two
 * readings that look like they contradict: `**` is "zero or more of any
 * character", so a globstar that stands beside `.js` still reaches
 * `src/js/app.js` across a separator, AND a globstar-prefixed `README.md` row
 * is listed as matching a root-level `README.md`. A model with only the first
 * rule fails the second; a minimatch-style model that degrades a non-standalone
 * `**` to `*` fails the first. The implementation carries both, and these rows
 * are why.
 */
const MATCHER_ORACLE: Array<[string, string, boolean]> = [
  // `*` stays inside one segment
  ["packages/*/*.md", "packages/viewer/README.md", true],
  ["packages/*/*.md", "packages/viewer/docs/guide.md", false],
  ["*.yml", "pnpm-workspace.yml", true],
  ["*.yml", ".github/workflows/build.yml", false],
  // derived by contrasting the table's `docs/*` and `docs/**` rows: the first
  // is documented as "all files within the root of the docs directory"
  ["docs/*", "docs/mona/octocat.txt", false],
  // `**` crosses them
  ["packages/*/src/**", "packages/engine/src/film/cameraMove.ts", true],
  ["packages/*/src/**", "packages/engine/lib/film/cameraMove.js", false],
  ["test/**", "test/src/features/workspace/x.ts", true],
  ["**.js", "index.js", true], // cheat sheet
  ["**.js", "src/js/app.js", true], // cheat sheet
  // a globstar opening a segment also matches zero segments
  ["**/README.md", "README.md", true], // cheat sheet
  ["**/README.md", "js/README.md", true], // cheat sheet
  ["**/*src/**", "my-src/code/js/app.js", true], // cheat sheet
  ["docs/**/*.md", "docs/a/markdown/file.md", true], // cheat sheet
  ["**/*.md", "AGENTS.md", true],
  ["**/*.md", "packages/mcp/prompts/DESIGN.md", true],
  // one that does not open a segment keeps its separator literal
  ["docs**/x", "docsx", false],
  ["docs**/x", "docs/deep/x", true],
  // and a literal is a literal
  [".gitattributes", ".gitattributes", true],
  [".prettier*", ".prettierignore", true],
  [".prettier*", "prettier.config.js", false],
];

/** `on:` block lines wrapped into a whole workflow document. */
const probeDocument = (...lines: string[]): string =>
  ["name: probe", "on:", ...lines, "jobs:", "  Ubuntu:", ""].join("\n");

/**
 * The parser's own oracle: a labelled document and the list it must yield, or
 * the CAUSE it must refuse for.
 *
 * The cause, not the mere fact of a throw, is what makes the refusal rows
 * discriminate. Dropping an unreadable entry instead of refusing it still ends
 * in a throw whenever that entry was the only one, so a "did it throw" oracle
 * certifies a parser that silently vanishes what it cannot read.
 */
const PARSER_ORACLE: Array<[string, string, string[] | string]> = [
  [
    "a sibling key ends the list",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "      - 'a'",
      "    branches:",
      "      - master",
    ),
    ["a"],
  ],
  [
    "a push filter declared first stays out",
    probeDocument(
      "  push:",
      "    paths:",
      "      - 'p'",
      "  pull_request:",
      "    paths:",
      "      - 'q'",
    ),
    ["q"],
  ],
  [
    "a push filter declared after stays out",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "      - 'q'",
      "  push:",
      "    paths:",
      "      - 'p'",
    ),
    ["q"],
  ],
  [
    "bare and double-quoted entries are read, not dropped",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "      - 'a'",
      "      - docs/**",
      '      - "b/**"',
    ),
    ["a", "docs/**", "b/**"],
  ],
  [
    "a same-line comment is stripped, not folded into the pattern",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "      - '**' # temporary, revert after the docs merge",
      "      - docs/** # and this one",
    ),
    ["**", "docs/**"],
  ],
  [
    "own-line comments and blank lines are skipped",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "      # why this entry exists",
      "",
      "      - 'a'",
    ),
    ["a"],
  ],
  [
    "carriage returns do not change the reading",
    [
      "name: probe",
      "on:",
      "  pull_request:",
      "    paths:",
      "      - 'a'",
      "jobs:",
      "",
    ].join("\r\n"),
    ["a"],
  ],
  [
    "a padded key and a commented key still open the list",
    probeDocument("  pull_request: ", "    paths: # the filter", "      - 'a'"),
    ["a"],
  ],
  [
    "a commented trigger key is still the trigger",
    probeDocument("  pull_request: # every one", "    paths:", "      - 'a'"),
    ["a"],
  ],
  [
    "a pull_request key at another depth is not the trigger",
    probeDocument(
      "  workflow_call:",
      "    inputs:",
      "      pull_request:",
      "        default: true",
    ),
    "declares no pull_request trigger",
  ],
  [
    "a document with no pull_request trigger is refused",
    probeDocument("  push:", "    paths:", "      - 'a'"),
    "declares no pull_request trigger",
  ],
  [
    "a pull_request trigger with no paths list is refused",
    probeDocument("  pull_request:", "    branches:", "      - master"),
    "declares no readable paths list",
  ],
  [
    "a flow sequence is refused rather than read as empty",
    probeDocument("  pull_request:", "    paths: ['a', 'b']"),
    "declares no readable paths list",
  ],
  [
    "a paths list with no entries is refused",
    probeDocument(
      "  pull_request:",
      "    paths:",
      "    branches:",
      "      - x",
    ),
    "declares an empty paths list",
  ],
  [
    "an entry this cannot read is refused",
    probeDocument("  pull_request:", "    paths:", "      - "),
    "has an unreadable paths entry",
  ],
  [
    // the row that separates refusing from silently skipping: a parser that
    // dropped the bad entry would return ["a"] and never reach a throw.
    "an unreadable entry beside a readable one is still refused",
    probeDocument("  pull_request:", "    paths:", "      - 'a'", "      - "),
    "has an unreadable paths entry",
  ],
  [
    "an empty pattern is refused rather than counted",
    probeDocument("  pull_request:", "    paths:", "      - ''"),
    "declares an empty pattern",
  ],
  [
    // the refusal for an unreadable entry quotes that entry back, so a cause
    // matched anywhere in the message would let the entry name its own cause.
    "an entry that spells another cause is still refused for its own",
    probeDocument(
      "  pull_request:",
      "    paths:",
      '      - "declares an empty paths list',
    ),
    "has an unreadable paths entry",
  ],
];

/**
 * Every refusal {@link workflowTriggerPaths} can raise, as the message tail that
 * follows the document label. Scenario 1 requires each to have a document that
 * provokes it, which is a claim that cannot fall out of date the way a counted
 * one does.
 */
const REFUSALS = [
  "declares no pull_request trigger",
  "declares no readable paths list",
  "declares an empty paths list",
  "has an unreadable paths entry",
  "declares an empty pattern",
];

/** The label every probe parses under, and the prefix stripped before matching. */
const PROBE_LABEL = "probe.yml";

/**
 * Parse for the oracle above, reporting a refusal as its cause.
 *
 * The cause is matched at the START of the message tail, never anywhere in the
 * message. One refusal quotes the offending line back, so a substring search
 * would let a probe's own text name the cause: an entry reading `- "declares an
 * empty paths list` would be certified as the wrong refusal. An unclassified
 * message is returned whole rather than folded into a known one, so a new
 * failure mode shows up as itself.
 */
const parseOrRefusal = (probe: string): string[] | string => {
  try {
    return workflowTriggerPaths(PROBE_LABEL, probe);
  } catch (exp) {
    const tail = (exp as Error).message.replace(`${PROBE_LABEL} `, "");
    return REFUSALS.find((cause) => tail.startsWith(cause)) ?? tail;
  }
};

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
 * #1387 showed what an all-markdown diff does -- build and test never ran.
 *
 * The two lists are also held identical, with no exception. Each workflow used
 * to name only its own definition, which left `build.yml` -- a file this very
 * scenario reads and asserts on -- outside the `test` filter, so editing it
 * alone ran the build and never the suite that checks it. Both names now sit in
 * both files. `build` and `test` do not read the same inputs (the build
 * compiles no `test/**`, and Prettier checks no markdown), but one shared list
 * is what makes the next drift a one-line diff instead of a silent divergence
 * between two long enumerations.
 *
 * Scenarios:
 *
 * 1. The parser reads the trigger it claims to read and refuses what it cannot,
 *    proved on documents this repository does not contain: a sibling key ending
 *    the list, a `push:` filter on either side, bare and double-quoted entries,
 *    a same-line comment, carriage returns, padded and commented keys, a
 *    `pull_request` key at another depth, and every shape where refusing is the
 *    only correct answer. Refusals are asserted by CAUSE, and a second
 *    assertion requires each cause the parser can raise to have a document that
 *    provokes it -- a completeness claim that cannot fall out of date the way
 *    counting the rows in prose did, twice. One of those documents puts an
 *    unreadable entry beside a readable one, which is what separates refusing
 *    from silently skipping: a skipping parser returns the readable one.
 * 2. Every declared pattern stays inside the glob subset {@link matches}
 *    implements, so no assertion below is decided by a matcher guessing at
 *    syntax it does not support.
 * 3. The matcher answers GitHub's semantics on a hand-written oracle, anchored on
 *    rows transcribed from GitHub's published filter-pattern table: `*` held
 *    inside one segment, `**` crossing them, a segment-opening globstar
 *    matching zero segments, a mid-segment one keeping its separator, and
 *    literals literal. A matcher is the oracle for everything after it, so it
 *    gets its own counter-examples rather than borrowing the repository's
 *    paths, which do not discriminate the segment rule at all.
 * 4. Both workflows watch both definitions, and their lists are equal element for
 *    element and in order.
 * 5. Every file the workspace scenarios name exists in the checkout and matches at
 *    least one pattern in BOTH workflows. The existence half keeps a renamed
 *    input from leaving a pin that guards nothing.
 * 6. Fault injection by counter-example: the agent instructions, the ignore list,
 *    and the hand-run packaging probe match NO pattern in either workflow. A
 *    filter that grew a catch-all would satisfy scenario 5 vacuously; this is
 *    the assertion it fails.
 */
export const test_workspace_ci_triggers = (): void => {
  // 1. the parser, on documents the repository does not contain
  TestValidator.equals(
    "the paths parser reads its own trigger and refuses what it cannot",
    PARSER_ORACLE.map(([label, probe]) => [label, parseOrRefusal(probe)]),
    PARSER_ORACLE.map(([label, , expected]) => [label, expected]),
  );
  TestValidator.equals(
    "every refusal the parser can raise has a document that provokes it",
    REFUSALS.filter(
      (cause) => !PARSER_ORACLE.some(([, , expected]) => expected === cause),
    ),
    [],
  );

  const build = triggerPaths("build");
  const test = triggerPaths("test");

  // 2. the matcher only answers for syntax it implements
  TestValidator.equals(
    "both filters stay inside the supported glob subset",
    [...build, ...test].filter((pattern) => UNSUPPORTED_SYNTAX.test(pattern)),
    [],
  );

  // 3. and it answers that syntax the way GitHub does
  TestValidator.equals(
    "the matcher models segment-bounded and separator-crossing globs",
    MATCHER_ORACLE.map(([pattern, file]) => matches(pattern, file)),
    MATCHER_ORACLE.map(([, , expected]) => expected),
  );

  // 4. one shared list, naming both definitions
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

  // 5. every named suite input reaches both jobs
  TestValidator.equals(
    "every file the suite names exists and triggers both jobs",
    SUITE_INPUTS.map((file) => [
      fs.existsSync(path.join(ROOT, file)),
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    SUITE_INPUTS.map(() => [true, true, true]),
  );

  // 6. and the match is not vacuous
  TestValidator.equals(
    "files present that no job reads trigger neither job",
    UNWATCHED.map((file) => [
      fs.existsSync(path.join(ROOT, file)),
      build.some((pattern) => matches(pattern, file)),
      test.some((pattern) => matches(pattern, file)),
    ]),
    UNWATCHED.map(() => [true, false, false]),
  );
};
