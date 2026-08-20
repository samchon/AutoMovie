import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
 * contain is not a function the file declares. Neither can hide a real gap.
 *
 * What is deliberately **not** filtered is a zero-hit entry whose reported line
 * does not define it while the file declares the name elsewhere. The position is
 * wrong and the gap is real, and dropping it would hide untested code to tidy a
 * line number. Those are printed, and {@link functionPositionConfirmed} counts
 * how many carry a position that could not be confirmed, so a reader knows which
 * line numbers to distrust.
 */
export const functionGapIsReal = (props) => {
  const name = props.name;
  if (typeof name !== "string" || name.startsWith("(anonymous")) return true;
  if (props.covered.has(name)) return false;
  return props.text === null || props.text.includes(name);
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
export const functionPositionConfirmed = (source, entry) => {
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
const sourceText = (file) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

const REPORT = path.resolve(
  "node_modules/.cache/automovie-c8-report/coverage-final.json",
);

const relative = (file) =>
  path.relative(process.cwd(), file).replaceAll("\\", "/");

const location = (span) =>
  span.start.line === span.end.line
    ? `${span.start.line}:${span.start.column}-${span.end.column}`
    : `${span.start.line}:${span.start.column}-${span.end.line}:${span.end.column}`;

/**
 * Print every uncovered position the last measurement can stand behind.
 *
 * Guarded so importing this module to read its rule does not print a report,
 * which is what lets the rule be tested at all. `coverage.mjs` carries the same
 * guard for the same reason.
 */
const reportGaps = () => {
  if (fs.existsSync(REPORT) === false) {
    console.log("No Istanbul coverage-final.json was produced.");
    return;
  }
  const coverage = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  let ghosts = 0;
  let unconfirmed = 0;
  for (const [file, data] of Object.entries(coverage).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const statements = Object.entries(data.s)
      .filter(([, hits]) => hits === 0)
      .map(([id]) => location(data.statementMap[id]));
    const text = sourceText(file);
    const source = text === null ? [] : text.split("\n");
    const covered = new Set(
      Object.entries(data.f)
        .filter(([, hits]) => hits > 0)
        .map(([id]) => data.fnMap[id].name),
    );
    const claimed = Object.entries(data.f)
      .filter(([, hits]) => hits === 0)
      .map(([id]) => data.fnMap[id]);
    const kept = claimed.filter((definition) =>
      functionGapIsReal({ name: definition.name, covered, text }),
    );
    ghosts += claimed.length - kept.length;
    if (text !== null)
      unconfirmed += kept.filter(
        (definition) => functionPositionConfirmed(source, definition) === false,
      ).length;
    const functions = kept.map(
      (definition) => `${definition.name}@${location(definition.loc)}`,
    );
    const branches = [];
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
    console.log(`::group::${relative(file)}`);
    if (statements.length !== 0)
      console.log(`uncovered statements: ${statements.join(", ")}`);
    if (functions.length !== 0)
      console.log(`uncovered functions: ${functions.join(", ")}`);
    if (branches.length !== 0)
      console.log(`uncovered branches: ${branches.join(", ")}`);
    console.log("::endgroup::");
  }
  // Said at the end and always. A dropped entry is a statement about the
  // instrument rather than about the code, and a reader who cannot see how many
  // were dropped cannot tell a clean report from a filtered one.
  if (ghosts !== 0)
    console.log(
      `${ghosts} zero-hit function entr${ghosts === 1 ? "y" : "ies"} named a function that ran under another entry, or a name this repository never wrote, and ${ghosts === 1 ? "is" : "are"} not listed above. That is the coverage tool reading its own emitted output, not a gap here.`,
    );
  if (unconfirmed !== 0)
    console.log(
      `${unconfirmed} of the uncovered functions listed above carr${unconfirmed === 1 ? "ies" : "y"} a line that does not contain ${unconfirmed === 1 ? "its" : "their"} own name. The gap is real and the position is not to be trusted; find the function by name.`,
    );
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  reportGaps();
