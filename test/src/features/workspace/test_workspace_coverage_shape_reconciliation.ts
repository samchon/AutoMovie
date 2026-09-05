import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { measuredShapeReconciliationParts } from "../../coverage/measureCoverage";
import {
  type ICoverageEntry,
  coveredPositions,
  partitionByShape,
  readRecordShapes,
  reconcileCoverageShapes,
  scriptShape,
  unionShortfalls,
} from "../../coverage/shapeReconciliation";

const ROOT = path.resolve(__dirname, "../../../..");

/**
 * A repository file's URL, spelled once and built the way Node builds one.
 *
 * `file:///` followed by a path is right only where the path starts with a
 * drive letter. On a POSIX runner the path's own leading slash makes it four,
 * and the census reads a URL it cannot parse -- which is how the first of these
 * two call sites failed on Ubuntu while passing on Windows, and how the reader
 * `measuredScriptIdentity` replaced reported zero measured scripts on Linux
 * for its whole life. One spelling is what keeps the second site from
 * repeating the first.
 */
const repositoryUrl = (...segments: readonly string[]): string =>
  pathToFileURL(path.join(ROOT, ...segments)).href;

/**
 * A merge that loses hits is replaced by the fullest reading each file got.
 *
 * c8 writes one entry per source path. When two processes load one source in
 * two emitted forms, V8 records two different function layouts for the same
 * URL and the entry c8 writes is worse than the better of the two. Measured on
 * this repository: `builtEnvironment.ts` appears in two raw records of one run
 * with 127 and 241 function entries; reported together c8 returns 90.93
 * percent, and reported apart the groups return 100 percent and 32.56 percent.
 * A union of a complete reading and a partial one cannot be worse than the
 * complete one, so that merge is not a union.
 *
 * The raw records are still on disk when the run ends, so each shape-consistent
 * group can be asked for its own report and the fullest reading of each file
 * kept. Run against the 67 real records of that reproduction, this partitions
 * them into five groups and returns both files to their complete readings --
 * 4535/4535 and 820/820 statements.
 *
 * It is the fullest available reading rather than an exact union: two shapes
 * that ran disjoint halves would still lose the half that lost. It is never
 * worse than the merge it replaces and never claims a position no process
 * reached, and saying that plainly is better than calling it exact.
 *
 * Scenarios:
 *
 * 1. A shape is the sorted function-name-and-offset signature, and a script
 *    with neither name nor range still has one.
 * 2. Records that agree stay in one group; records that disagree about any one
 *    URL are separated, and a record joins the first group with no quarrel.
 * 3. The fullest reading wins per file, and a file only one group knows about
 *    is carried through unchanged.
 * 4. Reading skips what says nothing: a file that is not JSON, a record caught
 *    mid-write, a URL outside the measured population, and a record left with
 *    no measured URL at all.
 * 5. One group means the merge had nothing to lose, so a report whose keys are
 *    already canonical is not written. A group whose report cannot be produced
 *    or read stops the correction and says which group and why, rather than
 *    writing a partial third reading.
 * 6. One group whose report keys two spellings of one file folds them into one
 *    entry under the canonical key and loses neither reading's coverage, and a
 *    single non-canonical key is rewritten under its canonical one; both are
 *    decided by an injected identity so the fold is pinned on every host.
 * 7. Through the real measured-URL predicate, two records that differ only in
 *    the shape of an excluded toolchain module stay one group, while the same
 *    difference on an authored source separates them.
 */
export const test_workspace_coverage_shape_reconciliation = (): void => {
  TestValidator.equals(
    "a shape is the sorted signature of what the record saw",
    {
      ordered: scriptShape({
        functions: [
          { functionName: "b", ranges: [{ startOffset: 20 }] },
          { functionName: "a", ranges: [{ startOffset: 10 }] },
        ],
      }),
      bare: scriptShape({ functions: [{}] }),
      empty: scriptShape({}),
    },
    { ordered: "a:10,b:20", bare: ":-1", empty: "" },
  );

  const record = (file: string, urls: Record<string, string>) => ({
    file,
    urls: new Map(Object.entries(urls)),
  });
  TestValidator.equals(
    "records are separated only where they disagree",
    {
      agreeing: partitionByShape([
        record("one.json", { "file:///a.ts": "x" }),
        record("two.json", { "file:///a.ts": "x", "file:///b.ts": "y" }),
      ]),
      disagreeing: partitionByShape([
        record("one.json", { "file:///a.ts": "x" }),
        record("two.json", { "file:///a.ts": "z" }),
        // Agrees with the first group, so it joins that one rather than the
        // one immediately before it.
        record("three.json", { "file:///a.ts": "x", "file:///c.ts": "w" }),
      ]),
      none: partitionByShape([]),
    },
    {
      agreeing: [["one.json", "two.json"]],
      disagreeing: [["one.json", "three.json"], ["two.json"]],
      none: [],
    },
  );

  const entry = (
    s: Record<string, number>,
    f: Record<string, number> = {},
    b: Record<string, number[]> = {},
  ): ICoverageEntry => ({ s, f, b });
  const coverageSpan = (line: number) => ({
    start: { line, column: 0 },
    end: { line, column: 1 },
  });
  TestValidator.equals(
    "covered positions count only positive statement, function, and branch hits",
    {
      counted: coveredPositions(entry({ 0: 1, 1: 0 }, { 0: 2 }, { 0: [1, 0] })),
      empty: coveredPositions({}),
    },
    {
      counted: 3,
      empty: 0,
    },
  );

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-shape-records-"),
  );
  try {
    const shape = (url: string, offset: number): string =>
      JSON.stringify({
        result: [
          {
            url,
            functions: [
              { functionName: "f", ranges: [{ startOffset: offset }] },
            ],
          },
        ],
      });
    fs.writeFileSync(path.join(directory, "notes.txt"), "not a record", "utf8");
    fs.writeFileSync(path.join(directory, "a.json"), "{ truncated", "utf8");
    fs.writeFileSync(
      path.join(directory, "b.json"),
      shape("file:///measured/one.ts", 1),
      "utf8",
    );
    fs.writeFileSync(
      path.join(directory, "c.json"),
      shape("file:///elsewhere/two.ts", 1),
      "utf8",
    );
    fs.writeFileSync(
      path.join(directory, "d.json"),
      shape("file:///measured/one.ts", 2),
      "utf8",
    );
    // A record that parsed but carries no result list at all.
    fs.writeFileSync(path.join(directory, "e.json"), "{}", "utf8");
    const measured = (url: string): boolean => url.includes("/measured/");
    TestValidator.equals(
      "reading keeps only records that say something about the population",
      readRecordShapes(directory, measured).map((entry_) => [
        entry_.file,
        [...entry_.urls.keys()],
      ]),
      [
        ["b.json", ["file:///measured/one.ts"]],
        ["d.json", ["file:///measured/one.ts"]],
      ],
    );

    const groupRoot = path.join(directory, "groups");
    const reports: Record<string, Record<string, ICoverageEntry>> = {
      "report-0": { "one.ts": entry({ 0: 1, 1: 0 }) },
      "report-1": { "one.ts": entry({ 0: 1, 1: 1 }) },
    };
    const run = (
      report: (records: string, reports_: string) => number,
      readReport: (directory_: string) => Record<string, ICoverageEntry> | null,
    ): {
      result: ReturnType<typeof reconcileCoverageShapes>;
      written: unknown;
    } => {
      let written: unknown = null;
      const result = reconcileCoverageShapes({
        copy: (from, to) => fs.copyFileSync(from, to),
        groupRoot,
        measured,
        mkdir: (target) => fs.mkdirSync(target, { recursive: true }),
        readReport,
        report,
        // No merged report of its own, so the fold has only the groups.
        reportDirectory: path.join(directory, "absent-report"),
        temporary: directory,
        writeReport: (entries) => {
          written = entries;
        },
      });
      return { result, written };
    };

    const succeeded = run(
      () => 0,
      (target) => reports[path.basename(target)] ?? null,
    );
    // The same run with a merged report present. It is one more reading, so a
    // line only c8's own merge saw survives into what is written.
    const withMerged = run(
      () => 0,
      (target) =>
        path.basename(target) === "absent-report"
          ? { "one.ts": entry({ 0: 1, 1: 0, 2: 1 }) }
          : (reports[path.basename(target)] ?? null),
    );
    const reportFailed = run(
      (_records, target) => (path.basename(target) === "report-1" ? 3 : 0),
      (target) => reports[path.basename(target)] ?? null,
    );
    const readFailed = run(
      () => 0,
      (target) =>
        path.basename(target) === "report-1" ? null : reports["report-0"]!,
    );
    const single = reconcileCoverageShapes({
      copy: () => undefined,
      groupRoot,
      measured: () => false,
      mkdir: () => undefined,
      readReport: () => null,
      report: () => 0,
      reportDirectory: path.join(directory, "absent-report"),
      temporary: directory,
      writeReport: () => {
        throw new Error("a single group must write no corrected report");
      },
    });
    const singleUnidentifiable = reconcileCoverageShapes({
      copy: () => undefined,
      groupRoot,
      measured: () => false,
      mkdir: () => undefined,
      readReport: () => ({
        "one.ts": {
          s: { 0: 1 },
          statementMap: { 0: { start: { line: 1 } } },
        },
      }),
      report: () => 0,
      reportDirectory: path.join(directory, "single-report"),
      temporary: directory,
      writeReport: () => {
        throw new Error("a single group must write no corrected report");
      },
    });
    // One group, and c8 wrote one file under two spellings: the reading a
    // process loaded through its source map under the checkout's real casing,
    // and the `--all` entry under the working directory's. Each covered one of
    // the two statements. Keyed by an injected lower-casing identity so the
    // fold is decided the same way on a case-preserving and a case-sensitive
    // host.
    const lowered = (file: string): string => file.toLowerCase();
    const twoSpellings = (
      report: Record<string, ICoverageEntry>,
    ): {
      result: ReturnType<typeof reconcileCoverageShapes>;
      written: unknown;
    } => {
      let written: unknown = null;
      const result = reconcileCoverageShapes({
        copy: () => undefined,
        entryIdentity: lowered,
        groupRoot,
        measured: () => false,
        mkdir: () => undefined,
        readReport: () => report,
        report: () => 0,
        reportDirectory: path.join(directory, "single-report"),
        temporary: directory,
        writeReport: (entries) => {
          written = entries;
        },
      });
      return { result, written };
    };
    const twoLineMap = { 0: coverageSpan(1), 1: coverageSpan(2) };
    const singleFolded = twoSpellings({
      "/Repo/One.ts": { s: { 0: 1, 1: 0 }, statementMap: twoLineMap },
      "/repo/one.ts": { s: { 0: 0, 1: 1 }, statementMap: twoLineMap },
    });
    const singleRecased = twoSpellings({
      "/Repo/One.ts": { s: { 0: 1 }, statementMap: { 0: coverageSpan(1) } },
    });
    const singleCanonical = twoSpellings({
      "/repo/one.ts": { s: { 0: 1 }, statementMap: { 0: coverageSpan(1) } },
    });

    TestValidator.equals(
      "a correction is written only when every group answered",
      {
        succeeded: succeeded.result,
        written: succeeded.written,
        withMerged: withMerged.written,
        // Silent when the union kept everything, and naming the file with both
        // numbers when it did not.
        quiet: succeeded.result.shortfalls,
        // The same question asked of the fold directly, with a base that
        // carries positions the other reading does not: lines 1 and 2 were
        // covered by a reading and the written entry has neither, so they are
        // named. Counting would have missed this, because the base's own three
        // positions outnumber the two it lost.
        losing: unionShortfalls(
          new Map([
            [
              "one.ts",
              [
                {
                  b: {},
                  branchMap: {},
                  f: {},
                  fnMap: {},
                  s: { 0: 1, 1: 1 },
                  statementMap: {
                    0: coverageSpan(1),
                    1: coverageSpan(2),
                  },
                },
                {
                  b: {},
                  branchMap: {},
                  f: {},
                  fnMap: {},
                  s: { 0: 0, 1: 0, 2: 1 },
                  statementMap: {
                    0: coverageSpan(20),
                    1: coverageSpan(21),
                    2: coverageSpan(22),
                  },
                },
              ],
            ],
            // A file the union never wrote is not a file it lost.
            ["absent.ts", [entry({ 0: 1 })]],
          ]),
          {
            "one.ts": {
              s: { 0: 0, 1: 0, 2: 1 },
              statementMap: {
                0: coverageSpan(20),
                1: coverageSpan(21),
                2: coverageSpan(22),
              },
            },
          },
        ),
        unidentifiable: unionShortfalls(
          new Map([
            [
              "one.ts",
              [
                {
                  s: { 0: 1 },
                  statementMap: { 0: { start: { line: 1 } } },
                },
              ],
            ],
          ]),
          {
            "one.ts": {
              s: { 0: 1 },
              statementMap: { 0: { start: { line: 1 } } },
            },
          },
        ),
        reportFailed: reportFailed.result,
        reportFailedWrote: reportFailed.written,
        readFailed: readFailed.result,
        single,
        singleUnidentifiable,
        singleFolded,
        singleRecased,
        singleCanonical,
      },
      {
        succeeded: { failure: null, groups: 2, shortfalls: [] },
        quiet: [],
        losing: [
          {
            file: "one.ts",
            lost: ["statement:1:0-1:1", "statement:2:0-2:1"],
          },
        ],
        unidentifiable: [
          { file: "one.ts", lost: ["unidentifiable:0:statement:0"] },
        ],
        written: { "one.ts": entry({ 0: 1, 1: 1 }) },
        withMerged: { "one.ts": entry({ 0: 1, 1: 1, 2: 1 }) },
        reportFailed: {
          failure: "shape group 1 could not be reported (status 3)",
          groups: 2,
        },
        reportFailedWrote: null,
        readFailed: {
          failure: "shape group 1 wrote no readable report",
          groups: 2,
        },
        single: { failure: null, groups: 0 },
        singleUnidentifiable: {
          failure: null,
          groups: 0,
          shortfalls: [
            { file: "one.ts", lost: ["unidentifiable:0:statement:0"] },
          ],
        },
        // Both statements ran in one spelling or the other, so the folded
        // entry carries both and no reading lost a position.
        singleFolded: {
          result: { failure: null, groups: 0 },
          written: {
            "/repo/one.ts": {
              b: {},
              f: {},
              s: { 0: 1, 1: 1 },
              statementMap: twoLineMap,
            },
          },
        },
        singleRecased: {
          result: { failure: null, groups: 0 },
          written: {
            "/repo/one.ts": {
              b: {},
              f: {},
              s: { 0: 1 },
              statementMap: { 0: coverageSpan(1) },
            },
          },
        },
        singleCanonical: {
          result: { failure: null, groups: 0 },
          written: null,
        },
      },
    );

    // The filesystem adapters are exercised against this disposable fixture;
    // the reporter process remains injected so this logic case never launches
    // c8 recursively.
    const parts = measuredShapeReconciliationParts({
      groupRoot: path.join(directory, "real-groups"),
      reportDirectory: path.join(directory, "real-report"),
      spawn: () => ({ status: 0 }),
      temporary: directory,
    });
    parts.mkdir(path.join(directory, "real-report"));
    parts.mkdir(path.join(directory, "real-records"));
    parts.copy(
      path.join(directory, "b.json"),
      path.join(directory, "real-records", "b.json"),
    );
    const emptyReport = parts.readReport(path.join(directory, "real-groups"));
    parts.writeReport({ "one.ts": entry({ 0: 1 }) });
    // Two records that agree about an authored source and disagree about the
    // shape of a toolchain module under `node_modules`. The module is outside
    // the authored population, so the disagreement must not split the group;
    // the same disagreement on a second authored source must.
    const census = path.join(directory, "census");
    fs.mkdirSync(census);
    const scripts = (
      entries: ReadonlyArray<readonly [string, number]>,
    ): string =>
      JSON.stringify({
        result: entries.map(([url, offset]) => ({
          url,
          functions: [{ functionName: "f", ranges: [{ startOffset: offset }] }],
        })),
      });
    const authored = repositoryUrl("packages", "engine", "src", "x.ts");
    const sibling = repositoryUrl("packages", "engine", "src", "y.ts");
    const toolchain = repositoryUrl("node_modules", "pkg", "index.js");
    fs.writeFileSync(
      path.join(census, "a.json"),
      scripts([
        [authored, 1],
        [toolchain, 1],
      ]),
      "utf8",
    );
    fs.writeFileSync(
      path.join(census, "b.json"),
      scripts([
        [authored, 1],
        [toolchain, 2],
      ]),
      "utf8",
    );
    const authoredCensus = path.join(directory, "authored-census");
    fs.mkdirSync(authoredCensus);
    fs.writeFileSync(
      path.join(authoredCensus, "a.json"),
      scripts([
        [authored, 1],
        [sibling, 1],
      ]),
      "utf8",
    );
    fs.writeFileSync(
      path.join(authoredCensus, "b.json"),
      scripts([
        [authored, 1],
        [sibling, 2],
      ]),
      "utf8",
    );
    TestValidator.equals(
      "every part of the real wiring answers on its own",
      {
        copied: fs.existsSync(path.join(directory, "real-records", "b.json")),
        missingReport: emptyReport,
        writtenThenRead: parts.readReport(path.join(directory, "real-report")),
        reported: parts.report(
          path.join(directory, "real-records"),
          path.join(directory, "real-report"),
        ),
        inside: parts.measured(authored) !== false,
        outside: parts.measured("file:///elsewhere/x.ts"),
        toolchainGroups: partitionByShape(
          readRecordShapes(census, parts.measured),
        ),
        authoredGroups: partitionByShape(
          readRecordShapes(authoredCensus, parts.measured),
        ).length,
        // A signalled reporter has no status, and reading that as success
        // would correct a report from a group that never finished.
        signalled: measuredShapeReconciliationParts({
          groupRoot: path.join(directory, "real-groups"),
          reportDirectory: path.join(directory, "real-report"),
          spawn: () => ({ status: null }),
          temporary: directory,
        }).report("in", "out"),
      },
      {
        copied: true,
        missingReport: null,
        writtenThenRead: { "one.ts": entry({ 0: 1 }) },
        reported: 0,
        inside: true,
        outside: false,
        toolchainGroups: [["a.json", "b.json"]],
        authoredGroups: 2,
        signalled: 1,
      },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};
