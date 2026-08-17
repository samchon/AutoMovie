import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { namedFacts } from "../internal/predicates";

/**
 * Two coverage runs cannot read or destroy each other's intermediate data.
 *
 * c8 wipes its `--temp-directory` at startup, so one fixed path means a second
 * run started while a first is in flight deletes the first's per-process JSON,
 * and whichever finishes last reports a total assembled from whatever survived.
 * That number is not high, not low, and not flagged. It is arbitrary, and it
 * reads exactly like a measurement, which is the failure mode that survives
 * review.
 *
 * It was measured twice in one day by two owners of one campaign, neither
 * knowing the other had. One file read 98.83% then 72.03% across a pair of runs
 * that only **added** tests, with the repository total moving 47.98% to 35.73%;
 * another read 95.1%/100% then 78.57%/39.68% across **comment-only** edits.
 * Adding tests cannot lower coverage and comments cannot move it at all, so both
 * pairs were arithmetically impossible. Both owners discarded their own numbers,
 * which is the only reason the instrument's fault surfaced at all instead of
 * entering the record as two mysterious regressions.
 *
 * The guard is on the class rather than on one spelling of it. What must hold is
 * that the entry point derives a path per run and that the report consumer still
 * resolves the run just measured; a future edit that reverts to a shared
 * constant, or that moves the report without moving its reader, fails here.
 *
 * Scenarios:
 *
 * 1. The entry point yields a different temporary directory on every call, each
 *    under the cache and none equal to the shared parent. Two calls in one
 *    process is the strict case: process id alone would pass a two-process check
 *    and still collide with a killed run's leftovers.
 * 2. Importing the entry point does not launch a measurement, so the rule above
 *    is readable without paying for the suite — and so this case is not itself
 *    a coverage run.
 * 3. The published `coverage` script routes through that entry point and hands
 *    c8 no temporary directory of its own, which is where the shared constant
 *    lived before.
 * 4. The gap reporter reads the exact directory the entry point writes. These
 *    are two files with one path between them, and moving either alone reports
 *    a different run than the one just measured.
 */
export const test_workspace_coverage_isolation = (): void => {
  const entry = path.join(ROOT, "internals", "coverage.mjs");
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(pathToFileURL(entry).href)}).then((module) => {
         const first = module.coverageTemporaryDirectory();
         const second = module.coverageTemporaryDirectory();
         console.log(JSON.stringify({ first, second }));
       });`,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );

  const parent = path.join(ROOT, "node_modules", ".cache", "automovie-c8");
  const drawn = ((): { first: string; second: string } | null => {
    const line = probe.stdout
      .split("\n")
      .map((value) => value.trim())
      .find((value) => value.startsWith("{"));
    if (line === undefined) return null;
    return JSON.parse(line) as { first: string; second: string };
  })();

  TestValidator.equals(
    "every coverage run draws a directory no other run writes",
    namedFacts([
      ["the entry point answered", () => drawn !== null],
      [
        "two draws in one process differ",
        () => drawn !== null && drawn.first !== drawn.second,
      ],
      [
        "both sit under the coverage cache",
        () =>
          drawn !== null &&
          path.dirname(path.resolve(drawn.first)) === parent &&
          path.dirname(path.resolve(drawn.second)) === parent,
      ],
      [
        "neither is the shared parent itself",
        () =>
          drawn !== null &&
          path.resolve(drawn.first) !== parent &&
          path.resolve(drawn.second) !== parent,
      ],
      [
        "importing it measured nothing",
        () => probe.stdout.includes("AutoMovie Test Program") === false,
      ],
    ]),
    {
      "the entry point answered": true,
      "two draws in one process differ": true,
      "both sit under the coverage cache": true,
      "neither is the shared parent itself": true,
      "importing it measured nothing": true,
    },
  );

  const script = (
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "test", "package.json"), "utf8"),
    ) as { scripts: Record<string, string> }
  ).scripts.coverage;
  const reporter = fs.readFileSync(
    path.join(ROOT, "internals", "report-coverage-gaps.mjs"),
    "utf8",
  );
  const entryText = fs.readFileSync(entry, "utf8");

  TestValidator.equals(
    "the published script routes through it and the reporter reads what it wrote",
    namedFacts([
      [
        "the script invokes the entry point",
        () => script.includes("internals/coverage.mjs"),
      ],
      [
        "the script names no temporary directory of its own",
        () => script.includes("--temp-directory") === false,
      ],
      [
        "the entry point writes the report directory the reporter resolves",
        () =>
          entryText.includes(REPORT_DIRECTORY) &&
          reporter.includes(REPORT_DIRECTORY),
      ],
    ]),
    {
      "the script invokes the entry point": true,
      "the script names no temporary directory of its own": true,
      "the entry point writes the report directory the reporter resolves": true,
    },
  );
};

/** The repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "../../../..");

/**
 * The one path the measurement writes and the gap reporter reads.
 *
 * Spelled once here so the assertion fails when either side moves rather than
 * when both move together, which is the only arrangement that would report a
 * different run than the one just measured.
 */
const REPORT_DIRECTORY = "automovie-c8-report";
