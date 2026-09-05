import { TestValidator } from "@nestia/e2e";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalCoveragePath } from "../../coverage/coverageIdentity";
import {
  COVERAGE_REPORT,
  captureCoverageSnapshot,
  publicationReport,
  publishCoverageSnapshot,
} from "../../coverage/coveragePublication";
import { reportCoverageGaps } from "../../coverage/reportCoverageGaps";
import { namedFacts } from "../internal/predicates";

const sha256 = (text: string): string =>
  crypto.createHash("sha256").update(text).digest("hex");

const span = (line: number, end: number = 5) => ({
  start: { line, column: 0 },
  end: { line, column: end },
});

/**
 * A run's publication binds every consumer to the exact bytes it measured.
 *
 * The snapshot is taken before the child starts and admits only what the
 * authored-source policy admits; the publication carries that snapshot with
 * the digest of the report it stands beside; and a consumer re-reads the
 * report through that digest, so a report replaced under the same name is
 * refused rather than read. The historical reporter is the first consumer and
 * judges positions against the published lengths, never the file as it is
 * now.
 *
 * Scenarios:
 *
 * 1. The capture keys each admitted candidate by canonical path with the line
 *    count and digest of its bytes; a declaration, an excluded root and a
 *    candidate absent from disk are left out.
 * 2. The publication resolves the report directory, digests the report, and
 *    freezes its sources; the same bytes are handed back, replaced bytes are
 *    refused.
 * 3. The reporter prints each file's uncovered statements, functions and
 *    branches, drops a zero-hit second reading of a function that ran and
 *    says how many it dropped, counts a file the publication does not name as
 *    unchecked, and exits 0 when every position sits inside its file.
 * 4. A position past the published length exits 2 and names the file, and a
 *    report that does not exist exits 2 before reading anything.
 */
export const test_workspace_coverage_publication = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-publication-"));
  try {
    const write = (relative: string, text: string): string => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
      return file;
    };
    const logicText = "export const logic = (): number => 1;\nexport const idle = (): number => 2;\n";
    const logic = write("packages/engine/src/logic.ts", logicText);
    write("packages/engine/lint.config.ts", "export default {};\n");
    write("packages/cli/src/command.ts", "export const run = 1;\n");
    const captured = captureCoverageSnapshot({
      candidates: [
        "packages/engine/src/logic.ts",
        "packages/engine/lint.config.ts",
        "packages/cli/src/command.ts",
        "packages/engine/src/gone.ts",
      ],
      root,
    });

    const reportDirectory = path.join(root, "report");
    const reportText = JSON.stringify({ [logic]: {} });
    write(path.join("report", COVERAGE_REPORT), reportText);
    const publication = publishCoverageSnapshot({
      reportDirectory,
      sources: captured,
    });
    const sameBytes = publicationReport(publication);
    fs.writeFileSync(
      path.join(reportDirectory, COVERAGE_REPORT),
      `${reportText} `,
      "utf8",
    );
    let replaced: string | null = null;
    try {
      publicationReport(publication);
    } catch (error) {
      replaced = error instanceof Error ? error.message : String(error);
    }

    const lines: string[] = [];
    const reportFile = write(
      path.join("gaps", COVERAGE_REPORT),
      JSON.stringify({
        [logic]: {
          path: logic,
          statementMap: { 0: span(1), 1: span(2) },
          s: { 0: 3, 1: 0 },
          fnMap: {
            0: { decl: span(1), loc: span(1), name: "logic" },
            1: { decl: span(1), loc: span(1), name: "logic" },
            2: { decl: span(2), loc: span(2), name: "idle" },
          },
          f: { 0: 3, 1: 0, 2: 0 },
          branchMap: { 0: { type: "if", loc: span(2), locations: [span(2)] } },
          b: { 0: [0] },
        },
        [path.join(root, "packages/engine/src/unnamed.ts")]: {
          path: path.join(root, "packages/engine/src/unnamed.ts"),
          statementMap: {},
          s: {},
          fnMap: {},
          f: {},
          branchMap: {},
          b: {},
        },
      }),
    );
    const inside = reportCoverageGaps(
      reportFile,
      (line) => lines.push(line),
      captured,
    );
    const outsideLines: string[] = [];
    const outside = reportCoverageGaps(
      reportFile,
      (line) => outsideLines.push(line),
      { [canonicalCoveragePath(logic)]: { lines: 1, sha256: "x" } },
    );
    const absentLines: string[] = [];
    const absent = reportCoverageGaps(
      path.join(root, "never", COVERAGE_REPORT),
      (line) => absentLines.push(line),
      captured,
    );

    TestValidator.equals(
      "one publication binds capture, report and reporter to the same bytes",
      namedFacts([
        [
          "only the admitted candidate on disk is captured",
          () => Object.keys(captured).join(",") === canonicalCoveragePath(logic),
        ],
        [
          "the capture carries the line count and digest of its bytes",
          () =>
            captured[canonicalCoveragePath(logic)]?.lines === 2 &&
            captured[canonicalCoveragePath(logic)]?.sha256 ===
              sha256(logicText),
        ],
        [
          "the publication resolves the directory and digests the report",
          () =>
            publication.reportDirectory === path.resolve(reportDirectory) &&
            publication.reportSha256 === sha256(reportText),
        ],
        [
          "the publication is frozen",
          () =>
            Object.isFrozen(publication) &&
            Object.isFrozen(publication.sources) &&
            Object.isFrozen(publication.sources[canonicalCoveragePath(logic)]),
        ],
        [
          "the same bytes are handed back",
          () => sameBytes === path.join(reportDirectory, COVERAGE_REPORT),
        ],
        [
          "replaced bytes are refused",
          () =>
            replaced === "coverage report no longer matches its run publication",
        ],
        ["positions inside the file exit zero", () => inside === 0],
        [
          "uncovered positions are printed under the file",
          () =>
            lines.includes("uncovered statements: 2:0-5") &&
            lines.includes("uncovered functions: idle@2:0-5") &&
            lines.includes("uncovered branches: if@2:0-5"),
        ],
        [
          "a second reading of a function that ran is dropped and counted",
          () =>
            lines.some((line) =>
              line.startsWith("1 zero-hit function entry named a function"),
            ) && lines.includes("uncovered functions: idle@2:0-5"),
        ],
        [
          "a file the publication does not name is counted as unchecked",
          () =>
            lines.some((line) =>
              line.startsWith(
                "1 file could not be checked for positions past their own end",
              ),
            ),
        ],
        ["a position past the published length exits two", () => outside === 2],
        [
          "and names the file with its published length",
          () =>
            outsideLines.some((line) => line.startsWith("3 reported positions lie past the end")) &&
            outsideLines.includes(
              `  ${path.relative(path.resolve(__dirname, "../../../.."), logic).replaceAll("\\", "/")} (3, 1 lines)`,
            ),
        ],
        [
          "a missing report exits two without reading",
          () =>
            absent === 2 &&
            absentLines.join("\n") ===
              "No Istanbul coverage-final.json was produced.",
        ],
      ]),
      Object.fromEntries(
        [
          "only the admitted candidate on disk is captured",
          "the capture carries the line count and digest of its bytes",
          "the publication resolves the directory and digests the report",
          "the publication is frozen",
          "the same bytes are handed back",
          "replaced bytes are refused",
          "positions inside the file exit zero",
          "uncovered positions are printed under the file",
          "a second reading of a function that ran is dropped and counted",
          "a file the publication does not name is counted as unchecked",
          "a position past the published length exits two",
          "and names the file with its published length",
          "a missing report exits two without reading",
        ].map((key) => [key, true]),
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
