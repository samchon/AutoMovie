import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { namedFacts } from "../internal/predicates";

/** The repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "../../../..");

/**
 * A file carrying the shapes the report actually produced.
 *
 * Line 1 is the import a transpile helper was mapped onto, line 4 is a constant
 * carrying nothing but its own name, and line 5 is an ordinary definition.
 */
const SOURCE = [
  "import {",
  "  builtEnvironmentUnclaimedElements,",
  "} from './builtEnvironment';",
  "const PLANE_NORMAL_EPSILON = 1e-12;",
  "export const mountViewer = (host) => host;",
];

/**
 * One newline, built rather than written as an escape.
 *
 * The probe below is a template literal whose output is JavaScript source, so an
 * escape written inside it is resolved while the template builds the string: the
 * probe would receive a real line break in the middle of a string literal and
 * fail to parse. Building the character instead keeps the escape out of the
 * template entirely.
 */
const NEWLINE = String.fromCharCode(10);

const entry = (name: string, line: number) =>
  JSON.stringify({
    name,
    loc: { start: { line, column: 0 }, end: { line, column: 0 } },
  });

interface IAnswers {
  noRecord: number | null;
  unnamedFile: number | null;
  namedFile: number | null;
  malformedFile: number | null;
  emptyLines: number;
  bareLine: number;
  trailingLine: number;
  pastEnd: number;
  withinFile: number;
  everyMap: number;
  fresh: boolean;
  ranElsewhere: boolean;
  neverWritten: boolean;
  anonymous: boolean;
  unreadable: boolean;
  confirmed: boolean;
  otherName: boolean;
}

/**
 * A gap the reporter drops must be one the file provably does not have.
 *
 * `#1991` reported a function listed as uncovered beside its own six calls.
 * Measured on one 343-file report: **361** named function entries had zero
 * hits; **137** carried a name that had run under another entry in the same
 * file, and **13** carried a name the file never contains —
 * `__setModuleDefault`, `ownKeys` and `get` are helpers the transpile emitted,
 * mapped onto the `import {` a file opens with and printed as untested code
 * somebody wrote. `builtEnvironmentUnclaimedElements` appeared twice: at a line
 * holding `const PLANE_NORMAL_EPSILON = 1e-12;` with zero hits, and where it is
 * defined with six.
 *
 * Both rules are provable, and that is why they are the two. A name with a
 * covered entry beside it demonstrably ran. A name the file never contains is
 * not a function the file declares. Neither can hide untested code.
 *
 * The rule that was tried and rejected is the tempting one: drop an entry whose
 * reported line does not define it. It is a heuristic, and it fails in the
 * direction that costs the most — a function entry can be anchored at its body's
 * first statement rather than its signature, so the line holds no name while the
 * gap is entirely real. Those stay listed, and the report says how many carry a
 * position not to be trusted.
 *
 * Scenarios:
 *
 * 1. A zero-hit name with nothing against it is a gap, which is the ordinary
 *    case this report exists to print.
 * 2. A name that ran under another entry in the same file is dropped.
 * 3. A name the file never contains is dropped.
 * 4. An entry the tool named anonymously is kept: there is nothing to look for,
 *    and a guess that hides a real gap is worse than one that shows a false one.
 * 5. A file the report outlived is kept whole rather than judged against
 *    nothing.
 * 6. Position confirmation is a separate question, and answers no for a line
 *    that holds a different name — which is a count, never a drop.
 * 7. The length a position is judged against comes from what the measurement
 *    recorded, never from the file as it now stands. An Istanbul report carries
 *    no hash, so it cannot say which content it measured. A file the record does
 *    not name, and a record whose value is not a number, are both judged by
 *    nothing rather than by a guess.
 * 8. A file's line count is what it has, not what splitting it yields: a
 *    trailing newline must not buy one line of slack in the one check that
 *    exists to be exact.
 * 9. A span ending past the file's last line as measured is refused rather than
 *    counted, because nothing in the source sits there to be left untested. That
 *    makes it the one class that can turn a job red without turning it
 *    permanently red. All three of the report's maps are read, because a fault
 *    in any one of them is the same fault.
 * 10. Importing the reporter prints nothing. That guard is what lets this case
 *     ask about the rule at all, and `coverage.mjs` carries it for the same
 *     reason.
 */
export const test_workspace_coverage_gap_attribution = (): void => {
  const module = path.join(ROOT, "internals", "report-coverage-gaps.mjs");
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(pathToFileURL(module).href)}).then((loaded) => {
         const source = ${JSON.stringify(SOURCE)};
         const text = ${JSON.stringify(SOURCE.join(NEWLINE))};
         const NEWLINE = String.fromCharCode(10);
         const span = (from, to) => ({ start: { line: from }, end: { line: to } });
         const real = (name, covered, body) =>
           loaded.functionGapIsReal({
             name,
             covered: new Set(covered),
             text: body === undefined ? text : body,
           });
         console.log(
           JSON.stringify({
             fresh: real("mountViewer", []),
             ranElsewhere: real("builtEnvironmentUnclaimedElements", [
               "builtEnvironmentUnclaimedElements",
             ]),
             neverWritten: real("__setModuleDefault", []),
             anonymous: real("(anonymous_12)", []),
             unreadable: real("__setModuleDefault", [], null),
             noRecord: loaded.measuredLineCount(null, "a.ts"),
             unnamedFile: loaded.measuredLineCount({ "b.ts": 12 }, "a.ts"),
             namedFile: loaded.measuredLineCount({ "a.ts": 12 }, "a.ts"),
             malformedFile: loaded.measuredLineCount({ "a.ts": "12" }, "a.ts"),
             emptyLines: loaded.lineCount(""),
             bareLine: loaded.lineCount("a"),
             trailingLine: loaded.lineCount("a" + NEWLINE),
             pastEnd: loaded.positionsPastEndOfFile(
               { statementMap: { 0: span(900, 901) } },
               5,
             ),
             withinFile: loaded.positionsPastEndOfFile(
               { statementMap: { 0: span(2, 3) } },
               5,
             ),
             everyMap: loaded.positionsPastEndOfFile(
               {
                 statementMap: { 0: span(2, 3) },
                 fnMap: { 0: { loc: span(80, 81) } },
                 branchMap: { 0: { locations: [span(90, 90)] } },
               },
               5,
             ),
             confirmed: loaded.functionPositionConfirmed(
               source,
               ${entry("mountViewer", 5)},
             ),
             otherName: loaded.functionPositionConfirmed(
               source,
               ${entry("mountViewer", 4)},
             ),
           }),
         );
       });`,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const answers = ((): IAnswers | null => {
    const line = probe.stdout
      .split("\n")
      .map((text) => text.trim())
      .find((text) => text.startsWith("{"));
    if (line === undefined) return null;
    try {
      return JSON.parse(line) as IAnswers;
    } catch {
      return null;
    }
  })();

  TestValidator.equals(
    "a coverage gap is dropped only where the file provably has none",
    namedFacts([
      ["the probe answered", () => answers !== null],
      ["an ordinary zero-hit name is a gap", () => answers?.fresh === true],
      [
        "a name that ran under another entry is not",
        () => answers?.ranElsewhere === false,
      ],
      [
        "and neither is a name this repository never wrote",
        () => answers?.neverWritten === false,
      ],
      [
        "an anonymous entry is kept, because nothing can be looked for",
        () => answers?.anonymous === true,
      ],
      [
        "a file the report outlived is kept whole",
        () => answers?.unreadable === true,
      ],
      // Which content the report measured is not knowable from the report: the
      // per-file entry carries a path, the maps and the counts, and no hash. So
      // the length comes from what the measurement recorded, and a file it did
      // not record is judged by nothing rather than by today's file.
      ["no record judges nothing", () => answers?.noRecord === null],
      [
        "and neither does a record that omits the file",
        () => answers?.unnamedFile === null,
      ],
      ["a recorded length is the one used", () => answers?.namedFile === 12],
      // A hand-edited or truncated record is not a length. Trusting one would
      // compare a line number against a string and refuse on the answer.
      [
        "and a record that is not a number judges nothing",
        () => answers?.malformedFile === null,
      ],
      // A file ending in a newline splits into one more piece than it has
      // lines, and a guard that tolerates one line past the end has a hole in
      // the one place it exists to be exact.
      ["an empty file has no lines", () => answers?.emptyLines === 0],
      ["a line without a newline is one", () => answers?.bareLine === 1],
      ["and a line with one is still one", () => answers?.trailingLine === 1],
      // The one class that is refused rather than counted. A span ending past
      // the last line names nothing the source could have left untested, and a
      // report full of them is the fault this issue opened on.
      ["a span past the last line is refused", () => answers?.pastEnd === 1],
      ["a span inside the file is not", () => answers?.withinFile === 0],
      [
        "and all three maps are read, not only statements",
        () => answers?.everyMap === 2,
      ],
      // Position is counted, never acted on. Both answers matter: a rule that
      // always said yes would report nothing to distrust.
      [
        "a definition line confirms its own position",
        () => answers?.confirmed === true,
      ],
      [
        "and a line holding another name does not",
        () => answers?.otherName === false,
      ],
      [
        "importing the reporter printed no report",
        () => probe.stdout.includes("::group::") === false,
      ],
    ]),
    {
      "the probe answered": true,
      "an ordinary zero-hit name is a gap": true,
      "a name that ran under another entry is not": true,
      "and neither is a name this repository never wrote": true,
      "an anonymous entry is kept, because nothing can be looked for": true,
      "a file the report outlived is kept whole": true,
      "no record judges nothing": true,
      "and neither does a record that omits the file": true,
      "a recorded length is the one used": true,
      "and a record that is not a number judges nothing": true,
      "an empty file has no lines": true,
      "a line without a newline is one": true,
      "and a line with one is still one": true,
      "a span past the last line is refused": true,
      "a span inside the file is not": true,
      "and all three maps are read, not only statements": true,
      "a definition line confirms its own position": true,
      "and a line holding another name does not": true,
      "importing the reporter printed no report": true,
    },
  );
};
