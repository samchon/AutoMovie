import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  coverageMissingScripts,
  coverageNeverRecorded,
  coverageRecords,
  coverageRunPaths,
  coverageScriptShapes,
  measuredScriptIdentity,
} from "../../coverage/measureCoverage";
import {
  coverageProcessIsEntry,
  coverageRunDependencies,
  coverageStageStatus,
  runCoverage,
  runCoverageCli,
} from "../../coverage/runCoverage";
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
 * 3. The entry point can say what a run's own record directory holds, counting
 *    records and nothing else. The suite's total is bimodal — about 83.6% or
 *    about 56.3%, on either platform, with an identical denominator and every
 *    test passing either way — and the count settled which half of that it is:
 *    a good run and a bad run both wrote **179** records, so nothing failed to
 *    flush and a third of the coverage is on disk without reaching the total.
 * 4. A record caught mid-write is counted as present and not as parsable. That
 *    is the difference the next question turns on, and a walk that counted a
 *    stray note, a nested directory, or a truncated record as usable would
 *    answer neither question.
 * 5. The one command runs measure, report, population and changed in that order,
 *    stops at the first refusal, and keeps an instrument fault a different exit
 *    status from a coverage gap. The population step is pinned between the
 *    report and the changed gate because a disagreeing population makes the
 *    changed gate's verdict describe a set other than the one it names, and both
 *    of its statuses are pinned so a step wired to a gate that cannot refuse
 *    would show here.
 * 6. Every consumer receives the one publication the measurement returned; a
 *    success that returns none, a stage that returns a status outside 0, 1
 *    and 2, and a measurement, consumer or cleanup that throws are each an
 *    instrument red named on its own line rather than a status guessed from a
 *    boolean, and a consumer that throws still has its run removed.
 * 7. A raw script URL inside the repository has a source identity only when
 *    the authored-source policy admits it: a toolchain module, an unmeasured
 *    package, an entry barrel and another checkout's file are all refused.
 */
export const test_workspace_coverage_isolation = (): void => {
  // A directory holding a complete record, a truncated one, and two things that
  // are not records at all, so every figure is asserted against a mixture rather
  // than against an empty answer.
  const records = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-coverage-records-"),
  );
  // Three of the four URLs are `file:` paths under this directory: **two**
  // written and one never created. Two present rather than one on purpose —
  // with one of each, a rule that counted the surviving files instead of the
  // absent ones would return the same number and the case would pass inverted.
  // The fourth is not a file URL at all, so the walk has to skip it rather
  // than report it absent.
  const present = path.join(records, "present.ts");
  const alsoPresent = path.join(records, "also-present.ts");
  fs.writeFileSync(present, "");
  fs.writeFileSync(alsoPresent, "");
  fs.writeFileSync(
    path.join(records, "coverage-1-2-0.json"),
    JSON.stringify({
      result: [
        { url: pathToFileURL(present).href },
        { url: pathToFileURL(alsoPresent).href },
        { url: pathToFileURL(path.join(records, "gone.ts")).href },
        { url: "node:internal/modules/cjs/loader" },
      ],
    }),
  );
  // A record the collector had not finished writing when the walk reached it.
  fs.writeFileSync(path.join(records, "coverage-1-2-1.json"), '{"result":[{"u');
  fs.writeFileSync(path.join(records, "notes.txt"), "");
  fs.mkdirSync(path.join(records, "nested"));
  // Two processes reading one measured source, the second in a different shape.
  // Kept in its own directory so the record counts above stay what they assert.
  // `present.ts` sits outside the measured set and must not be counted at all.
  const shaped = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-coverage-shapes-"),
  );
  const shape = (offset: number) => ({
    url: pathToFileURL(
      path.join(ROOT, "packages", "engine", "src", "geometry", "probe.ts"),
    ).href,
    functions: [{ functionName: "probe", ranges: [{ startOffset: offset }] }],
  });
  fs.writeFileSync(
    path.join(shaped, "coverage-2-1-0.json"),
    JSON.stringify({
      result: [shape(10), { url: pathToFileURL(present).href }],
    }),
  );
  fs.writeFileSync(
    path.join(shaped, "coverage-2-2-0.json"),
    // A malformed `file:` URL, which is the case that proves the census skips
    // an unusable record instead of throwing out of the whole walk and losing
    // every record behind it. The parse is deliberately host-neutral, so a
    // POSIX-shaped URL on Windows is measured rather than skipped; only a URL
    // that is not a URL fails here.
    JSON.stringify({ result: [shape(64), { url: "file://[invalid" }] }),
  );

  // Both host shapes of a `file:` URL, so the drive-letter arm and the POSIX
  // arm are each decided on every platform. `pathToFileURL` produces only the
  // running host's shape, so a run on one platform would leave the other arm
  // undecided, which is what CI reported against `measureCoverage.ts`.
  const hostShapes = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-coverage-hosts-"),
  );
  fs.writeFileSync(
    path.join(hostShapes, "coverage-3-1-0.json"),
    JSON.stringify({
      result: [
        { url: "file:///D:/repo/packages/engine/src/windows.ts" },
        { url: "file:///home/runner/packages/engine/src/posix.ts" },
      ],
    }),
  );

  const drawn = {
    run: coverageRunPaths(),
    first: coverageRunPaths().rootDirectory,
    second: coverageRunPaths().rootDirectory,
    walked: coverageRecords(records),
    absent: coverageRecords(path.join(records, "never-created")),
    scripts: coverageMissingScripts(records),
    shapes: coverageScriptShapes(shaped),
    narrow: coverageScriptShapes(shaped, ["packages/face/src"]),
    hosts:
      Number(
        measuredScriptIdentity(
          "file:///D:/repo/packages/engine/src/windows.ts",
          ["."],
          "D:/repo",
        ) !== null,
      ) +
      Number(
        measuredScriptIdentity(
          "file:///home/runner/packages/engine/src/posix.ts",
          ["."],
          "/home/runner",
        ) !== null,
      ),
    nonFile:
      measuredScriptIdentity(
        "https://example.com/D:/repo/packages/engine/src/remote.ts",
        ["."],
        "d:/repo",
      ) !== null,
    // Inside the repository and outside the authored population: a toolchain
    // module, an unmeasured package, an entry barrel, and a file under another
    // checkout. Each is refused by the one policy the changed gate judges by,
    // so none can split a record group or enter the shape census.
    excluded: [
      "file:///D:/repo/node_modules/pkg/index.js",
      "file:///D:/repo/packages/evidence/src/internal.ts",
      "file:///D:/repo/packages/engine/src/index.ts",
      "file:///D:/other/packages/engine/src/elsewhere.ts",
    ].map((url) => measuredScriptIdentity(url, ["."], "D:/repo")),
    mappedSeen: coverageNeverRecorded({
      directory: records,
      identity: (url) =>
        url === pathToFileURL(present).href
          ? path.join(ROOT, "packages", "engine", "src", "mapped.ts")
          : null,
      reported: [path.join(ROOT, "packages", "engine", "src", "mapped.ts")],
    }),
  };
  fs.rmSync(records, { recursive: true, force: true });
  fs.rmSync(shaped, { recursive: true, force: true });
  fs.rmSync(hostShapes, { recursive: true, force: true });

  const parent = path.join(ROOT, "node_modules", ".cache", "automovie-c8-runs");

  TestValidator.equals(
    "every coverage run draws a directory no other run writes",
    namedFacts([
      [
        "the typed measurement functions answered",
        () => drawn.walked.count === 2,
      ],
      // A whole-suite figure can read lower than a scoped one over the same
      // file, which no execution count can do and a merge can. Two processes
      // that resolved one source through different loaded forms leave two range
      // shapes, and the merged entry keeps both: the real reading and one whose
      // positions land nowhere with zero hits. The report cannot show that
      // afterwards, so the walk over the raw records is the only place it is
      // visible.
      [
        "a source read in two shapes is counted as both reread and disagreeing",
        () => drawn.shapes.reread === 1 && drawn.shapes.disagreeing === 1,
      ],
      [
        "and named, so the figure it spoils can be found",
        () => drawn.shapes.sample.join(" ").includes("probe.ts") === true,
      ],
      // Every process also loads its own launcher and toolchain, and those
      // disagree constantly without touching one figure this repository reports.
      [
        "a source outside the measured set is not counted at all",
        () => drawn.narrow.urls === 0 && drawn.narrow.disagreeing === 0,
      ],
      [
        "both host shapes of a file URL are measured on either platform",
        () => drawn.hosts === 2,
      ],
      ["non-file URLs have no source identity", () => drawn.nonFile === false],
      [
        "excluded repository URLs have no source identity",
        () =>
          drawn.excluded.length === 4 &&
          drawn.excluded.every((identity) => identity === null),
      ],
      [
        "source-mapped raw URLs satisfy authored report identity",
        () => drawn.mappedSeen.length === 0,
      ],
      ["two draws in one process differ", () => drawn.first !== drawn.second],
      [
        "one run owns raw and report paths together",
        () =>
          path.dirname(drawn.run.rawDirectory) === drawn.run.rootDirectory &&
          path.dirname(drawn.run.reportDirectory) === drawn.run.rootDirectory,
      ],
      [
        "both sit under the coverage cache",
        () =>
          path.dirname(path.resolve(drawn.first)) === parent &&
          path.dirname(path.resolve(drawn.second)) === parent,
      ],
      [
        "neither is the shared parent itself",
        () =>
          path.resolve(drawn.first) !== parent &&
          path.resolve(drawn.second) !== parent,
      ],
      [
        "drawing a path does not create or start a measurement",
        () =>
          fs.existsSync(drawn.first) === false &&
          fs.existsSync(drawn.second) === false,
      ],
      // The count is what separates "no records were written" from "records
      // were written and not merged", which is the only question a low total
      // leaves open. It must count records and nothing else, or it answers a
      // different question than the one it is printed to answer.
      [
        "it counts records and not the other contents",
        () => drawn.walked.count === 2,
      ],
      [
        "and a directory that was never created is zero rather than a throw",
        () => drawn.absent.count === 0,
      ],
      // A record caught mid-write has a name, an entry and a size and no usable
      // content, so a count alone reads it as present. Parsability is what
      // separates the two, and the unparsable one must still be counted or the
      // difference disappears.
      [
        "an unreadable record counts as present and not as parsable",
        () =>
          drawn.walked.count === 2 &&
          drawn.walked.parsed === 1 &&
          drawn.walked.results === 4 &&
          drawn.walked.bytes > 0,
      ],
      // A record can be complete, parsable and counted and still contribute
      // nothing, because the script it names is gone by the time anyone reads
      // it. The three figures above cannot see that; this one can.
      [
        "a script URL that no longer exists is reported as gone",
        () => drawn.scripts.missing === 1,
      ],
      // Counted per distinct URL, and a non-file URL is skipped rather than
      // reported absent: `node:` internals are named by every record and are
      // not files anybody could look for.
      ["and only the file URLs are looked for", () => drawn.scripts.urls === 3],
    ]),
    {
      "the typed measurement functions answered": true,
      "a source read in two shapes is counted as both reread and disagreeing": true,
      "and named, so the figure it spoils can be found": true,
      "a source outside the measured set is not counted at all": true,
      "both host shapes of a file URL are measured on either platform": true,
      "non-file URLs have no source identity": true,
      "excluded repository URLs have no source identity": true,
      "source-mapped raw URLs satisfy authored report identity": true,
      "two draws in one process differ": true,
      "one run owns raw and report paths together": true,
      "both sit under the coverage cache": true,
      "neither is the shared parent itself": true,
      "drawing a path does not create or start a measurement": true,
      "it counts records and not the other contents": true,
      "and a directory that was never created is zero rather than a throw": true,
      "an unreadable record counts as present and not as parsable": true,
      "a script URL that no longer exists is reported as gone": true,
      "and only the file URLs are looked for": true,
    },
  );

  const order: string[] = [];
  const arguments_: string[] = [];
  const receivedPublications: unknown[] = [];
  const publication = {
    reportDirectory: "/this-run/report",
    reportSha256: "report",
    sources: {},
  };
  const measured = (status: number) => ({
    publication: status === 0 ? publication : undefined,
    status,
  });
  const dependencies = coverageRunDependencies(
    () => (order.push("measure"), measured(0)),
    (received, owned) => {
      order.push("changed");
      arguments_.push(...received);
      receivedPublications.push(owned);
      return 0;
    },
    (owned) => {
      order.push("report");
      receivedPublications.push(owned);
      return 0;
    },
    (owned) => {
      order.push("population");
      receivedPublications.push(owned);
      return 0;
    },
    (owned) => (order.push("cleanup"), receivedPublications.push(owned)),
  );
  const green = runCoverage(["--base", "origin/master"], dependencies);
  const unreached = (step: string, after: string): (() => never) => {
    return () => {
      throw new Error(`${step} ran after ${after}`);
    };
  };
  const ordinaryRed = runCoverage([], {
    measure: () => measured(1),
    report: unreached("report", "a failed measurement"),
    population: unreached("population gate", "a failed measurement"),
    changed: unreached("changed gate", "a failed measurement"),
    cleanup: unreached("cleanup", "a failed measurement"),
  });
  const measurementInstrumentRed = runCoverage([], {
    measure: () => measured(2),
    report: unreached("report", "an invalid measurement"),
    population: unreached("population gate", "an invalid measurement"),
    changed: unreached("changed gate", "an invalid measurement"),
    cleanup: unreached("cleanup", "an invalid measurement"),
  });
  const instrumentRed = runCoverage([], {
    measure: () => measured(0),
    report: () => 2,
    population: unreached("population gate", "an invalid report"),
    changed: unreached("changed gate", "an invalid report"),
    cleanup: () => undefined,
  });
  const populationInstrumentRed = runCoverage([], {
    measure: () => measured(0),
    report: () => 0,
    population: () => 2,
    changed: unreached("changed gate", "a disagreeing population"),
    cleanup: () => undefined,
  });
  const populationOrdinaryRed = runCoverage([], {
    measure: () => measured(0),
    report: () => 0,
    population: () => 1,
    changed: unreached("changed gate", "a refused population"),
    cleanup: () => undefined,
  });
  const changedRed = runCoverage([], {
    measure: () => measured(0),
    report: () => 0,
    population: () => 0,
    changed: () => 2,
    cleanup: () => undefined,
  });
  const coverageGap = runCoverage([], {
    measure: () => measured(0),
    report: () => 0,
    population: () => 0,
    changed: () => 1,
    cleanup: () => undefined,
  });
  const reportGap = runCoverage([], {
    measure: () => measured(0),
    report: () => 1,
    population: unreached("population gate", "a failed report"),
    changed: unreached("changed gate", "a failed report"),
    cleanup: () => undefined,
  });
  const diagnostics: string[] = [];
  const unknownMeasurement = runCoverage(
    [],
    {
      measure: () => measured(3),
      report: unreached("report", "an unknown measurement status"),
      population: unreached("population gate", "an unknown measurement status"),
      changed: unreached("changed gate", "an unknown measurement status"),
      cleanup: unreached("cleanup", "an unknown measurement status"),
    },
    (line) => diagnostics.push(line),
  );
  const unknownReport = runCoverage(
    [],
    {
      measure: () => measured(0),
      report: () => -1,
      population: unreached("population gate", "an unknown report status"),
      changed: unreached("changed gate", "an unknown report status"),
      cleanup: () => undefined,
    },
    (line) => diagnostics.push(line),
  );
  const missingPublication = runCoverage(
    [],
    {
      measure: () => ({ status: 0 }),
      report: unreached("report", "a missing publication"),
      population: unreached("population gate", "a missing publication"),
      changed: unreached("changed gate", "a missing publication"),
      cleanup: unreached("cleanup", "a missing publication"),
    },
    (line) => diagnostics.push(line),
  );
  const thrownMeasurement = runCoverage(
    [],
    {
      measure: () => {
        throw new Error("measurement failed before returning a status");
      },
      report: unreached("report", "a thrown measurement"),
      population: unreached("population gate", "a thrown measurement"),
      changed: unreached("changed gate", "a thrown measurement"),
      cleanup: unreached("cleanup", "a thrown measurement"),
    },
    (line) => diagnostics.push(line),
  );
  // A consumer that throws is an instrument red, and the run it was reading is
  // still removed: the publication was made, so its directory exists.
  let cleanedAfterThrow = false;
  const thrownConsumer = runCoverage(
    [],
    {
      measure: () => measured(0),
      report: () => {
        throw new Error("report threw");
      },
      population: unreached("population gate", "a thrown report"),
      changed: unreached("changed gate", "a thrown report"),
      cleanup: () => {
        cleanedAfterThrow = true;
      },
    },
    (line) => diagnostics.push(line),
  );
  const thrownCleanup = runCoverage(
    [],
    {
      measure: () => measured(0),
      report: () => 0,
      population: () => 0,
      changed: () => 0,
      cleanup: () => {
        throw new Error("cleanup failed");
      },
    },
    (line) => diagnostics.push(line),
  );
  const cliStatuses: number[] = [];
  runCoverageCli(false, [], dependencies, (status) => cliStatuses.push(status));
  runCoverageCli(
    true,
    [],
    {
      measure: () => measured(0),
      report: () => 0,
      population: () => 0,
      changed: () => 0,
      cleanup: () => undefined,
    },
    (status) => cliStatuses.push(status),
  );
  // The two `runCoverageCli` calls above pin the unit with both booleans, which
  // is what let the real defect hide: the call site passed
  // `require.main === module`, always false under `ttsx`, so the covered unit
  // sat behind a wiring nothing could reach and the command measured nothing
  // while exiting 0. Pin the binding itself, both ways.
  const entryDecision = {
    own: coverageProcessIsEntry(
      path.resolve(__dirname, "../../coverage/runCoverage.ts"),
    ),
    launcher: coverageProcessIsEntry(path.resolve(__dirname, "../../index.ts")),
    absent: coverageProcessIsEntry(undefined),
  };
  TestValidator.equals(
    "one typed coverage command preserves order and failure classes",
    {
      green,
      order,
      arguments_,
      onePublication: receivedPublications.every(
        (owned) => owned === publication,
      ),
      ordinaryRed,
      measurementInstrumentRed,
      instrumentRed,
      populationInstrumentRed,
      populationOrdinaryRed,
      changedRed,
      coverageGap,
      reportGap,
      unknownMeasurement,
      unknownReport,
      missingPublication,
      directUnknownStatus: coverageStageStatus("changed", 9, (line) =>
        diagnostics.push(line),
      ),
      diagnostics,
      thrownMeasurement,
      thrownConsumer,
      cleanedAfterThrow,
      thrownCleanup,
      cliStatuses,
      entryDecision,
    },
    {
      green: 0,
      order: ["measure", "report", "population", "changed", "cleanup"],
      arguments_: ["--base", "origin/master"],
      onePublication: true,
      ordinaryRed: 1,
      measurementInstrumentRed: 2,
      instrumentRed: 2,
      populationInstrumentRed: 2,
      populationOrdinaryRed: 1,
      changedRed: 2,
      coverageGap: 1,
      reportGap: 1,
      unknownMeasurement: 2,
      unknownReport: 2,
      missingPublication: 2,
      directUnknownStatus: 2,
      diagnostics: [
        "INSTRUMENT FAILURE: coverage measure returned unsupported status 3",
        "INSTRUMENT FAILURE: coverage report returned unsupported status -1",
        "INSTRUMENT FAILURE: coverage measure returned success without a publication",
        "INSTRUMENT FAILURE: coverage measure threw: measurement failed before returning a status",
        "INSTRUMENT FAILURE: coverage consumer threw: report threw",
        "INSTRUMENT FAILURE: coverage cleanup threw: cleanup failed",
        "INSTRUMENT FAILURE: coverage changed returned unsupported status 9",
      ],
      thrownMeasurement: 2,
      thrownConsumer: 2,
      cleanedAfterThrow: true,
      thrownCleanup: 2,
      cliStatuses: [0],
      entryDecision: { own: true, launcher: false, absent: false },
    },
  );
};

/** The repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "../../../..");
