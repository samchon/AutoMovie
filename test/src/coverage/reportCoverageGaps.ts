import fs from "node:fs";
import path from "node:path";

import {
  type ICoverageSpan,
  canonicalCoveragePath,
  functionIdentity,
} from "./coverageIdentity";

interface IIstanbulFileCoverage {
  b: Record<string, number[]>;
  branchMap: Record<string, { locations: ICoverageSpan[]; type: string }>;
  f: Record<string, number>;
  fnMap: Record<
    string,
    { decl?: ICoverageSpan; loc: ICoverageSpan; name: string }
  >;
  s: Record<string, number>;
  statementMap: Record<string, ICoverageSpan>;
}

interface IFunctionGapProps {
  covered: Set<string>;
  definition: {
    decl?: ICoverageSpan;
    loc?: ICoverageSpan;
    name?: string;
  };
  text: string | null;
}

type Writer = (line: string) => void;

/**
 * Whether a zero-hit function entry is a gap this file actually has.
 *
 * `#1991` reported a function listed as uncovered beside its own six calls, and
 * the list is worse than one entry. Measured on one 343-file report: **361**
 * named function entries had zero hits; **137** of them carried a name that had
 * *run* under another entry in the same file, and **13** carried a name the file
 * does not contain at all — `__setModuleDefault`, `ownKeys` and `get` are
 * helpers the transpile emitted, mapped back onto the `import {` a file opens
 * with and printed as untested code somebody wrote.
 *
 * Both tests are provable rather than heuristic, which is the whole of why they
 * are the two used. A name with a covered entry beside it demonstrably ran, so
 * the zero entry is a second reading of one function. A name the file does not
 * declare is not a function the file declares. Neither can hide a real gap.
 *
 * "Does not contain" was the first spelling of the second test and it was too
 * loose by exactly one shape: a file that only ever *calls* somebody else's
 * method contains that method's name. `libraryObservationRequirements.ts` was
 * charged for an emitted `get` because it writes `waivedCounts.get(...)` four
 * times, and a `Map`'s method is not a function that file declares any more
 * than a name it never writes at all. So the reading is now "appears somewhere
 * other than after a dot", which is the narrowest change that separates the two
 * -- a declaration never sits behind a member access, whatever else it looks
 * like.
 *
 * It stays deliberately conservative in the other direction. A name written in
 * a comment or a string counts as declared, so the gap survives; narrowing
 * further would mean parsing, and a rule that hides a real gap to tidy a false
 * one is worse than the false one.
 *
 * What is deliberately **not** filtered is a zero-hit entry whose reported line
 * does not define it while the file declares the name elsewhere. The position is
 * wrong and the gap is real, and dropping it would hide untested code to tidy a
 * line number. Those are printed, and {@link functionPositionConfirmed} counts
 * how many carry a position that could not be confirmed, so a reader knows which
 * line numbers to distrust.
 */
export const functionGapIsReal = (props: IFunctionGapProps): boolean => {
  const name = props.definition.name;
  if (typeof name !== "string" || name.startsWith("(anonymous")) return true;
  const identity = functionIdentity(props.definition);
  if (identity !== null && props.covered.has(identity)) return false;
  return props.text === null || fileDeclaresName(props.text, name);
};

/**
 * Whether a name appears anywhere other than behind a member access.
 *
 * The identifier is matched whole, so `getter` never answers for `get`, and an
 * occurrence preceded by `.` or `?.` is passed over because that position is a
 * call on somebody else's object rather than a declaration on this one.
 */
export const fileDeclaresName = (text: string, name: string): boolean => {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![.\\w$])${escaped}(?![\\w$])`, "u").test(text);
};

/**
 * Whether a zero-hit branch location is a branch this file actually has.
 *
 * The function filter's twin, and provable in the same way. A branch has no
 * name to look for, so the question asked instead is what the reported span
 * covers: `libraryObservationRequirements.ts` was charged for `branch@21:0-2`,
 * and columns 0 to 2 of line 21 are the two spaces that indent a template
 * literal. Nobody writes a branch in an indent. It is the same source-map
 * inversion that puts an emitted helper's name onto an `import {` line, landing
 * on a position instead of a name.
 *
 * Whitespace is the whole of the test, which is what keeps it from hiding
 * anything: a branch somebody wrote covers code, and a span covering code is
 * kept whatever else it looks like. A span this cannot read -- the file is
 * gone, the line is past its end, the columns are missing -- is kept too, for
 * the same reason an unreadable file keeps all of its entries.
 */
export const branchGapIsReal = (props: {
  source: string[] | null;
  span: ICoverageSpan | undefined;
}): boolean => {
  const start = props.span?.start;
  const end = props.span?.end;
  if (props.source === null) return true;
  if (start?.line === undefined || start.line !== end?.line) return true;
  const line = props.source[start.line - 1];
  if (typeof line !== "string") return true;
  if (start.column === undefined || end.column === undefined) return true;
  return line.slice(start.column, end.column).trim() !== "";
};

/**
 * Whether an entry's reported line contains the name of the function it claims.
 *
 * Only ever counted, never used to drop anything. A definition line holds its
 * own name — `const name = (`, `function name(`, a method — and a line that does
 * not either sits inside the function's body, which is harmless, or belongs to a
 * different artifact, which is not. Reporting the count keeps that difference
 * visible without guessing which one a given entry is.
 */
export const functionPositionConfirmed = (
  source: string[],
  entry: { loc?: ICoverageSpan; name?: string },
): boolean => {
  const name = entry?.name;
  if (typeof name !== "string" || name.startsWith("(anonymous")) return true;
  const line = source[(entry?.loc?.start?.line ?? 0) - 1];
  return typeof line === "string" && line.includes(name);
};

/**
 * A file's text, or `null` when the report has outlived it.
 *
 * A file nobody can read cannot answer either question, so its entries are
 * printed exactly as the tool stated them rather than judged against nothing.
 */
const sourceText = (file: string): string | null => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/**
 * How many lines a file has, which is not how many pieces splitting it yields.
 *
 * A file ending in a newline splits into one more piece than it has lines, and
 * a guard that tolerates one line past the end is a guard with a hole in the one
 * place it is supposed to be exact.
 */
export const lineCount = (text: string): number =>
  text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

/**
 * Every reported position that lies past the end of the file it names.
 *
 * `#1991` asks for exactly this guard, and asks for it here because it is
 * "checkable from the report alone". A span ending beyond the last line is the
 * unambiguous form of the fault: the tool inverted a source map against the
 * wrong artifact and handed back the transpiled output's geometry. Unlike a
 * misattributed line inside the file, nothing about it is arguable.
 *
 * Measured on one 343-file report the count is **zero**, which is why this can
 * be a refusal rather than a notice. It stays silent today and goes red the day
 * the instrument regresses, which is the difference between a gate and a number
 * nobody can certify.
 *
 * The line count comes from the explicit run publication. Judging against the
 * current file instead blames the instrument for an ordinary edit: one commit
 * that shortened a file by 23 lines made 26 of its positions read as past the
 * end, and not one of them was a fault. A file the publication does not name is
 * left unjudged and counted as such.
 */
export const positionsPastEndOfFile = (
  data: {
    branchMap?: Record<string, { locations?: ICoverageSpan[] }>;
    fnMap?: Record<string, { loc?: ICoverageSpan }>;
    statementMap?: Record<string, ICoverageSpan>;
  },
  lines: number,
): number => {
  const spans = [
    ...Object.values(data.statementMap ?? {}),
    ...Object.values(data.fnMap ?? {}).map((entry) => entry?.loc),
    ...Object.values(data.branchMap ?? {}).flatMap(
      (entry) => entry?.locations ?? [],
    ),
  ];
  return spans.filter((span) => {
    const last = Math.max(span?.start?.line ?? 0, span?.end?.line ?? 0);
    return last > lines;
  }).length;
};

/**
 * The length recorded for one file, or `null` when the record cannot say.
 *
 * `null` has two readings and both mean the same thing to a caller: no record
 * was written, or this file is not in it. Either way the only honest answer is
 * to judge nothing, because the alternative is judging a report against a file
 * it never measured.
 */
export const measuredLineCount = (
  record: Record<string, unknown> | null | undefined,
  file: string,
): number | null => {
  const direct = record?.[file];
  const value =
    direct ??
    Object.entries(record ?? {}).find(
      ([candidate]) =>
        canonicalCoveragePath(candidate) === canonicalCoveragePath(file),
    )?.[1];
  if (typeof value === "number") return value;
  return typeof value === "object" &&
    value !== null &&
    "lines" in value &&
    typeof value.lines === "number"
    ? value.lines
    : null;
};

const ROOT = path.resolve(__dirname, "../../..");

const relative = (file: string): string =>
  path.relative(ROOT, file).replaceAll("\\", "/");

const location = (span: ICoverageSpan): string => {
  const start = span.start ?? {};
  const end = span.end ?? {};
  return start.line === end.line
    ? `${start.line ?? "?"}:${start.column ?? "?"}-${end.column ?? "?"}`
    : `${start.line ?? "?"}:${start.column ?? "?"}-${end.line ?? "?"}:${end.column ?? "?"}`;
};

/**
 * Print every uncovered position the last measurement can stand behind.
 *
 * Guarded so importing this module to read its rule does not print a report,
 * which is what lets focused scenarios ask about the rule without printing the
 * repository report.
 */
export const reportCoverageGaps = (
  reportFile: string,
  write: Writer,
  measuredSources: Record<string, unknown>,
): number => {
  if (fs.existsSync(reportFile) === false) {
    write("No Istanbul coverage-final.json was produced.");
    return 2;
  }
  const coverage = JSON.parse(fs.readFileSync(reportFile, "utf8")) as Record<
    string,
    IIstanbulFileCoverage
  >;
  let ghosts = 0;
  let unconfirmed = 0;
  let outside = 0;
  let unmeasured = 0;
  const outsideFiles: string[] = [];
  const measuredLines = measuredSources;
  for (const [file, data] of Object.entries(coverage).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const statements = Object.entries(data.s)
      .filter(([, hits]) => hits === 0)
      .map(([id]) => location(data.statementMap[id]));
    const text = sourceText(file);
    const source = text === null ? [] : text.split("\n");
    const measured = measuredLineCount(measuredLines, file);
    if (measured !== null) {
      const past = positionsPastEndOfFile(data, measured);
      if (past !== 0) {
        outside += past;
        outsideFiles.push(`${relative(file)} (${past}, ${measured} lines)`);
      }
    } else unmeasured++;
    const covered = new Set(
      Object.entries(data.f)
        .filter(([, hits]) => hits > 0)
        .map(([id]) => functionIdentity(data.fnMap[id]))
        .filter((identity): identity is string => identity !== null),
    );
    const claimed = Object.entries(data.f)
      .filter(([, hits]) => hits === 0)
      .map(([id]) => data.fnMap[id]);
    const kept = claimed.filter((definition) =>
      functionGapIsReal({ definition, covered, text }),
    );
    ghosts += claimed.length - kept.length;
    if (text !== null)
      unconfirmed += kept.filter(
        (definition) => functionPositionConfirmed(source, definition) === false,
      ).length;
    const functions = kept.map(
      (definition) => `${definition.name}@${location(definition.loc)}`,
    );
    const branches: string[] = [];
    for (const [id, hits] of Object.entries(data.b))
      hits.forEach((count, index) => {
        if (count === 0)
          branches.push(
            `${data.branchMap[id].type}@${location(data.branchMap[id].locations[index])}`,
          );
      });
    if (
      statements.length === 0 &&
      functions.length === 0 &&
      branches.length === 0
    )
      continue;
    write(`::group::${relative(file)}`);
    if (statements.length !== 0)
      write(`uncovered statements: ${statements.join(", ")}`);
    if (functions.length !== 0)
      write(`uncovered functions: ${functions.join(", ")}`);
    if (branches.length !== 0)
      write(`uncovered branches: ${branches.join(", ")}`);
    write("::endgroup::");
  }
  // Said at the end and always. A dropped entry is a statement about the
  // instrument rather than about the code, and a reader who cannot see how many
  // were dropped cannot tell a clean report from a filtered one.
  if (ghosts !== 0)
    write(
      `${ghosts} zero-hit function entr${ghosts === 1 ? "y" : "ies"} named a function that ran under another entry, or a name this repository never wrote, and ${ghosts === 1 ? "is" : "are"} not listed above. That is the coverage tool reading its own emitted output, not a gap here.`,
    );
  // A refusal rather than a notice, because a position outside the file it names
  // is not arguable: nothing in the source sits there to be uncovered. Zero on
  // the report this was measured against, so it costs nothing until it costs a
  // red job, which is the point.
  if (outside !== 0) {
    write(
      `${outside} reported position${outside === 1 ? "" : "s"} lie past the end of the file named, so a source map was inverted against the wrong artifact:`,
    );
    for (const named of outsideFiles) write(`  ${named}`);
  }
  if (unmeasured !== 0)
    write(
      `${unmeasured} file${unmeasured === 1 ? "" : "s"} could not be checked for positions past their own end, because the measurement recorded no length for ${unmeasured === 1 ? "it" : "them"}. Re-run the measurement to restore that check.`,
    );
  if (unconfirmed !== 0)
    write(
      `${unconfirmed} of the uncovered functions listed above carr${unconfirmed === 1 ? "ies" : "y"} a line that does not contain ${unconfirmed === 1 ? "its" : "their"} own name. The gap is real and the position is not to be trusted; find the function by name.`,
    );
  return outside === 0 ? 0 : 2;
};
