import { TestValidator } from "@nestia/e2e";

import { functionIdentity } from "../../coverage/coverageIdentity";
import {
  branchGapIsReal,
  functionGapIsReal,
  functionPositionConfirmed,
  lineCount,
  measuredLineCount,
  positionsPastEndOfFile,
} from "../../coverage/reportCoverageGaps";
import { namedFacts } from "../internal/predicates";

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

const NEWLINE = "\n";

const entry = (name: string, line: number) => ({
  name,
  decl: { start: { line, column: 0 }, end: { line, column: name.length } },
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
  sameNameElsewhere: boolean;
  neverWritten: boolean;
  calledOnly: boolean;
  declaredMethod: boolean;
  declaredConst: boolean;
  longerName: boolean;
  indentBranch: boolean;
  realBranch: boolean;
  spanningBranch: boolean;
  unreadableBranch: boolean;
  columnlessBranch: boolean;
  halfColumnedBranch: boolean;
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
 * Both rules are provable, and that is why they are the two. The same complete
 * name/declaration/location identity with a covered entry demonstrably ran. A
 * name the file never contains is not a function the file declares. A repeated
 * name at another declaration remains independent.
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
 *     ask about the typed rule without running the repository report.
 */
export const test_workspace_coverage_gap_attribution = (): void => {
  const text = SOURCE.join(NEWLINE);
  const span = (from: number, to: number) => ({
    start: { line: from },
    end: { line: to },
  });
  const real = (
    name: string,
    covered: Array<ReturnType<typeof entry>>,
    body: string | null = text,
    line: number = 5,
  ): boolean =>
    functionGapIsReal({
      definition: entry(name, line),
      covered: new Set(
        covered
          .map(functionIdentity)
          .filter((identity): identity is string => identity !== null),
      ),
      text: body,
    });
  const answers: IAnswers = {
    fresh: real("mountViewer", []),
    ranElsewhere: real("builtEnvironmentUnclaimedElements", [
      entry("builtEnvironmentUnclaimedElements", 5),
    ]),
    sameNameElsewhere: real(
      "builtEnvironmentUnclaimedElements",
      [entry("builtEnvironmentUnclaimedElements", 4)],
      text,
      5,
    ),
    neverWritten: real("__setModuleDefault", []),
    // A file that only ever calls somebody else's method contains that
    // method's name and declares nothing. This is the exact shape that
    // charged `libraryObservationRequirements.ts` for an emitted `get`.
    calledOnly: real("get", [], "const n = waived.get(id) ?? 0;"),
    // And its twin, which is what keeps the narrowing from hiding real code:
    // the same name declared as a method, and declared as a binding. Both are
    // still gaps. Without these two the rule could be replaced by a constant
    // `false` and nothing here would notice.
    declaredMethod: real(
      "get",
      [],
      "const store = { get(id) { return id; } };",
    ),
    declaredConst: real("get", [], "const get = (id) => id;"),
    // A whole-identifier match, so a longer name never answers for a shorter
    // one. `getter` alone leaves `get` undeclared.
    longerName: real("get", [], "const getter = (id) => id;"),
    // The branch twin of the same fault. `libraryObservationRequirements.ts`
    // was charged `branch@21:0-2`, and columns 0 to 2 of that line are the two
    // spaces indenting a template literal. Nobody writes a branch in an indent.
    indentBranch: branchGapIsReal({
      // The indent is the whole of what matters here; the rest of the line
      // stands in for the template literal the real file carries, without
      // writing an interpolation inside a plain string.
      source: ["const a = 1;", "  spaceSubject(environment, space);"],
      span: { start: { line: 2, column: 0 }, end: { line: 2, column: 2 } },
    }),
    // And the branch that must survive it, on the same line shape: a span
    // covering code is kept, so the rule cannot be replaced by a constant.
    realBranch: branchGapIsReal({
      source: ["const a = b ?? c;"],
      span: { start: { line: 1, column: 10 }, end: { line: 1, column: 16 } },
    }),
    // Three shapes this declines to judge, each kept for the same reason an
    // unreadable file keeps all of its entries: a span across two lines, a file
    // the report outlived, and a location with no columns to slice.
    spanningBranch: branchGapIsReal({
      source: ["  ", "  "],
      span: { start: { line: 1, column: 0 }, end: { line: 2, column: 2 } },
    }),
    unreadableBranch: branchGapIsReal({
      source: null,
      span: { start: { line: 1, column: 0 }, end: { line: 1, column: 2 } },
    }),
    columnlessBranch: branchGapIsReal({
      source: ["  "],
      span: { start: { line: 1 }, end: { line: 1 } },
    }),
    // Half a pair of columns is no pair. Reading it as one would slice to the
    // end of the line and call an indent whatever follows it.
    halfColumnedBranch: branchGapIsReal({
      source: ["  const a = 1;"],
      span: { start: { line: 1, column: 0 }, end: { line: 1 } },
    }),
    anonymous: real("(anonymous_12)", []),
    unreadable: real("__setModuleDefault", [], null),
    noRecord: measuredLineCount(null, "a.ts"),
    unnamedFile: measuredLineCount({ "b.ts": 12 }, "a.ts"),
    namedFile: measuredLineCount({ "a.ts": 12 }, "a.ts"),
    malformedFile: measuredLineCount({ "a.ts": "12" }, "a.ts"),
    emptyLines: lineCount(""),
    bareLine: lineCount("a"),
    trailingLine: lineCount(`a${NEWLINE}`),
    pastEnd: positionsPastEndOfFile({ statementMap: { 0: span(900, 901) } }, 5),
    withinFile: positionsPastEndOfFile({ statementMap: { 0: span(2, 3) } }, 5),
    everyMap: positionsPastEndOfFile(
      {
        statementMap: { 0: span(2, 3) },
        fnMap: { 0: { loc: span(80, 81) } },
        branchMap: { 0: { locations: [span(90, 90)] } },
      },
      5,
    ),
    confirmed: functionPositionConfirmed(SOURCE, entry("mountViewer", 5)),
    otherName: functionPositionConfirmed(SOURCE, entry("mountViewer", 4)),
  };

  TestValidator.equals(
    "a coverage gap is dropped only where the file provably has none",
    namedFacts([
      ["an ordinary zero-hit name is a gap", () => answers.fresh === true],
      [
        "a name that ran under another entry is not",
        () => answers.ranElsewhere === false,
      ],
      [
        "the same name at another declaration stays a gap",
        () => answers.sameNameElsewhere === true,
      ],
      [
        "and neither is a name this repository never wrote",
        () => answers.neverWritten === false,
      ],
      [
        "a name this file only calls on another object is not a declaration",
        () => answers.calledOnly === false,
      ],
      [
        "the same name declared as a method is still a gap",
        () => answers.declaredMethod === true,
      ],
      [
        "and so is the same name declared as a binding",
        () => answers.declaredConst === true,
      ],
      [
        "a longer identifier does not answer for the name inside it",
        () => answers.longerName === false,
      ],
      [
        "a branch whose whole span is an indent is not a branch",
        () => answers.indentBranch === false,
      ],
      [
        "a branch whose span covers code still is",
        () => answers.realBranch === true,
      ],
      [
        "a span across two lines is judged by nothing",
        () => answers.spanningBranch === true,
      ],
      [
        "and so is one whose file the report outlived",
        () => answers.unreadableBranch === true,
      ],
      [
        "and so is one with no columns to slice",
        () => answers.columnlessBranch === true,
      ],
      [
        "and so is one carrying only half a pair of them",
        () => answers.halfColumnedBranch === true,
      ],
      [
        "an anonymous entry is kept, because nothing can be looked for",
        () => answers.anonymous === true,
      ],
      [
        "a file the report outlived is kept whole",
        () => answers.unreadable === true,
      ],
      // Which content the report measured is not knowable from the report: the
      // per-file entry carries a path, the maps and the counts, and no hash. So
      // the length comes from what the measurement recorded, and a file it did
      // not record is judged by nothing rather than by today's file.
      ["no record judges nothing", () => answers.noRecord === null],
      [
        "and neither does a record that omits the file",
        () => answers.unnamedFile === null,
      ],
      ["a recorded length is the one used", () => answers.namedFile === 12],
      // A hand-edited or truncated record is not a length. Trusting one would
      // compare a line number against a string and refuse on the answer.
      [
        "and a record that is not a number judges nothing",
        () => answers.malformedFile === null,
      ],
      // A file ending in a newline splits into one more piece than it has
      // lines, and a guard that tolerates one line past the end has a hole in
      // the one place it exists to be exact.
      ["an empty file has no lines", () => answers.emptyLines === 0],
      ["a line without a newline is one", () => answers.bareLine === 1],
      ["and a line with one is still one", () => answers.trailingLine === 1],
      // The one class that is refused rather than counted. A span ending past
      // the last line names nothing the source could have left untested, and a
      // report full of them is the fault this issue opened on.
      ["a span past the last line is refused", () => answers.pastEnd === 1],
      ["a span inside the file is not", () => answers.withinFile === 0],
      [
        "and all three maps are read, not only statements",
        () => answers.everyMap === 2,
      ],
      // Position is counted, never acted on. Both answers matter: a rule that
      // always said yes would report nothing to distrust.
      [
        "a definition line confirms its own position",
        () => answers.confirmed === true,
      ],
      [
        "and a line holding another name does not",
        () => answers.otherName === false,
      ],
    ]),
    {
      "an ordinary zero-hit name is a gap": true,
      "a name that ran under another entry is not": true,
      "the same name at another declaration stays a gap": true,
      "and neither is a name this repository never wrote": true,
      "a name this file only calls on another object is not a declaration": true,
      "the same name declared as a method is still a gap": true,
      "and so is the same name declared as a binding": true,
      "a longer identifier does not answer for the name inside it": true,
      "a branch whose whole span is an indent is not a branch": true,
      "a branch whose span covers code still is": true,
      "a span across two lines is judged by nothing": true,
      "and so is one whose file the report outlived": true,
      "and so is one with no columns to slice": true,
      "and so is one carrying only half a pair of them": true,
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
    },
  );
};
