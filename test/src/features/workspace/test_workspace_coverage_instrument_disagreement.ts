import { TestValidator } from "@nestia/e2e";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { inspectChangedCoverage } from "../../coverage/changedCoverage";

/**
 * A second reading of a function that ran is not an untested function.
 *
 * One source loaded in two shapes produces two sets of ranges for the same
 * file, and the merge keeps both rather than their union. Measured on this
 * repository: adding a single test that runs a generated child against the
 * built package moved `builtEnvironment.ts` from 94 function entries to 116
 * while its statement total did not move, and its covered statements fell from
 * 4,535 to 4,124. The extra entries carry zero hits and the gate was counting
 * every one of them as untested code.
 *
 * A zero entry with the same complete declaration identity as a covered entry,
 * and an entry naming something the file does not contain, are artifacts. This
 * pins that exact rule and that the gate says so out loud: the artifacts leave both the
 * numerator and the denominator, and their count is reported at the file's own
 * address rather than absorbed into a green.
 *
 * Scenarios:
 *
 * 1. A zero entry whose name ran under another entry is dropped from the
 *    function totals and produces no gap, while a genuinely untested function
 *    beside it still does.
 * 2. A zero entry naming something the file does not contain is dropped for the
 *    other stated reason.
 * 3. The dropped entries are reported at their file's address, and an anonymous
 *    zero entry is kept, because nothing can be said about a name that is not
 *    there.
 */
export const test_workspace_coverage_instrument_disagreement = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-disagreement-"),
  );
  try {
    const relative = "packages/x/src/shape.ts";
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const source = [
      "export const build = (): number => 1;",
      "export const idle = (): number => 2;",
      "",
    ].join("\n");
    fs.writeFileSync(file, source, "utf8");

    const span = (line: number) => ({
      start: { line, column: 0 },
      end: { line, column: 10 },
    });
    const coverage = {
      [file]: {
        path: file,
        statementMap: { 0: span(1) },
        s: { 0: 1 },
        fnMap: {
          0: { decl: span(1), loc: span(1), name: "build" },
          // The same function, read again in another shape.
          1: { decl: span(1), loc: span(1), name: "build" },
          // A helper the transpile emitted; the file never contains this name.
          2: { decl: span(1), loc: span(1), name: "__emittedHelper" },
          // Anonymous, so nothing can be said about it either way.
          3: { decl: span(2), loc: span(2), name: "(anonymous_7)" },
          // Genuinely untested, and named on a line that defines it.
          4: { decl: span(2), loc: span(2), name: "idle" },
        },
        f: { 0: 3, 1: 0, 2: 0, 3: 0, 4: 0 },
        branchMap: {},
        b: {},
      },
    };

    // Both source lines are named as changed, so #2163's demand rule excuses
    // nothing here and this case stays about what it is about: an instrument
    // artifact is filed as a disagreement rather than as a gap or a debt.
    const result = inspectChangedCoverage({
      root,
      files: new Map([[relative, new Set([1, 2])]]),
      divergent: [],
      coverage,
      measuredSources: {
        [file]: {
          lines: source.split("\n").length,
          sha256: crypto.createHash("sha256").update(source).digest("hex"),
        },
      },
    });

    TestValidator.equals(
      "second readings leave the totals and are named, real gaps stay",
      {
        functions: result.totals.functions,
        gaps: result.gaps.filter((gap) => gap.includes("function")),
        disagreements: result.disagreements,
        instrumentFailures: result.instrumentFailures,
      },
      {
        // `build` covered, plus the anonymous entry and `idle` uncovered. The
        // duplicate `build` and the emitted helper are gone from both sides.
        functions: { covered: 1, total: 3 },
        gaps: [
          "packages/x/src/shape.ts:2 uncovered function (anonymous_7)",
          "packages/x/src/shape.ts:2 uncovered function idle",
        ],
        disagreements: [
          "packages/x/src/shape.ts: 2 function entries are a second reading of a function that ran, not an untested one",
        ],
        instrumentFailures: [],
      },
    );

    // One artifact reads in the singular, which is a different sentence.
    const single = inspectChangedCoverage({
      root,
      files: new Map([[relative, new Set([1, 2])]]),
      divergent: [],
      coverage: {
        [file]: {
          ...coverage[file]!,
          fnMap: {
            0: { decl: span(1), loc: span(1), name: "build" },
            1: { decl: span(1), loc: span(1), name: "build" },
          },
          f: { 0: 3, 1: 0 },
        },
      },
      measuredSources: {
        [file]: {
          lines: source.split(/\r?\n/u).length,
          sha256: crypto.createHash("sha256").update(source).digest("hex"),
        },
      },
    });
    TestValidator.equals(
      "one artifact is reported in the singular",
      single.disagreements,
      [
        "packages/x/src/shape.ts: 1 function entry is a second reading of a function that ran, not an untested one",
      ],
    );
    const untracked = inspectChangedCoverage({
      root,
      files: new Map([[relative, new Set()]]),
      wholeFiles: new Set([relative]),
      divergent: [],
      coverage: {
        [file]: {
          ...coverage[file]!,
          statementMap: { 0: span(1) },
          s: { 0: 0 },
          fnMap: {},
          f: {},
        },
      },
      measuredSources: {
        [file]: {
          lines: source.split(/\r?\n/u).length,
          sha256: crypto.createHash("sha256").update(source).digest("hex"),
        },
      },
    });
    TestValidator.equals(
      "a nonempty untracked authored source owes its whole file",
      {
        totals: untracked.totals.statements,
        gap: untracked.gaps.includes(
          "packages/x/src/shape.ts:1 uncovered statement",
        ),
      },
      { totals: { covered: 0, total: 1 }, gap: true },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
