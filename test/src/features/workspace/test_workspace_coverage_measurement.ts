import { TestValidator } from "@nestia/e2e";

import { canonicalCoveragePath } from "../../coverage/coverageIdentity";
import { inspectCoverageSnapshot } from "../../coverage/coveragePublication";
import {
  decideCoverageMeasurementStatus,
  measureCoverage,
} from "../../coverage/measureCoverage";
import { namedFacts } from "../internal/predicates";

const SOURCE = "/repo/packages/engine/src/source.ts";
const OTHER = "/repo/packages/engine/src/other.ts";
const A = { lines: 1, sha256: "a" };
const B = { lines: 1, sha256: "b" };

/**
 * One run publishes only its own complete and unchanged source measurement.
 *
 * A measurement is a claim about exact bytes: the report's positions were
 * taken from the sources captured before the child started, and the numbers
 * downstream consumers read belong to that snapshot and no other. Anything
 * the instrument cannot stand behind exits with status 2 and publishes
 * nothing, so an ordinary test failure (status 1) and an untrustworthy
 * reading never wear the same colour.
 *
 * Scenarios:
 *
 * 1. A child that exits 0 over unchanged sources publishes a result naming
 *    this run's private report directory, and both c8 paths the child was
 *    given belong to this run.
 * 2. A child that exits 1 is an ordinary red; a child with no status is an
 *    instrument red; neither publishes.
 * 3. A same-length edit between capture and report is refused by digest, and
 *    a publisher that throws is an instrument failure, not a partial success.
 * 4. Every measurement-validity observation decides status 2 on its own --
 *    zero, truncated or resultless records, a vanished measured source, a
 *    union shortfall, a reconciliation failure -- and invalidity outranks a
 *    child failure, while a valid child failure stays status 1.
 * 5. The snapshot inspection names each disagreement: a pre-run source the
 *    report lacks, a report source the snapshot lacks, a source that
 *    disappeared or appeared during the run, and one drifted source among
 *    several, which withholds the whole publication rather than the one file.
 */
export const test_workspace_coverage_measurement = (): void => {
  let arguments_: string[] = [];
  let current = { [SOURCE]: A };
  let publications = 0;
  const dependencies = (status: number | null) => ({
    captureSnapshot: () => ({ [SOURCE]: A }),
    currentSnapshot: () => current,
    environment: {} as NodeJS.ProcessEnv,
    log: () => {},
    mkdir: () => undefined,
    missingScripts: () => ({ measured: [], missing: 0, urls: 0 }),
    neverRecorded: () => [],
    publish: (reportDirectory: string) => {
      publications++;
      return {
        reportDirectory,
        reportSha256: "report-a",
        sources: { [SOURCE]: A },
      };
    },
    reconcile: () => ({ failure: null, groups: 1, shortfalls: [] }),
    records: () => ({ bytes: 1, count: 1, parsed: 1, results: 1 }),
    remove: () => {},
    reportFiles: () => [SOURCE],
    runPaths: () => ({
      rawDirectory: "/this-run/raw",
      reportDirectory: "/this-run/report",
      rootDirectory: "/this-run",
    }),
    scriptShapes: () => ({ disagreeing: 0, reread: 0, sample: [], urls: 1 }),
    spawn: (_executable: string, received: string[]) => {
      arguments_ = received;
      return { status };
    },
  });

  const passed = measureCoverage(dependencies(0));
  const failed = measureCoverage(dependencies(1));
  const didNotStart = measureCoverage(dependencies(null));
  current = { [SOURCE]: B };
  const drifted = measureCoverage(dependencies(0));
  current = { [SOURCE]: A };
  const publicationFailed = measureCoverage({
    ...dependencies(0),
    publish: () => {
      throw new Error("publication failed");
    },
  });

  const validObservation = {
    child: { status: 0 },
    missingMeasuredSources: 0,
    records: { bytes: 1, count: 1, parsed: 1, results: 1 },
    reconciliationFailure: null,
    unionShortfalls: 0,
  };
  const status = (change: object): number =>
    decideCoverageMeasurementStatus({ ...validObservation, ...change });

  const exact = inspectCoverageSnapshot({
    current: { [SOURCE]: A },
    reportFiles: [SOURCE],
    snapshot: { [SOURCE]: A },
  });
  const missing = inspectCoverageSnapshot({
    current: { [SOURCE]: A },
    reportFiles: [],
    snapshot: { [SOURCE]: A },
  });
  const unexpected = inspectCoverageSnapshot({
    current: { [SOURCE]: A },
    reportFiles: [SOURCE, "/repo/unexpected.ts"],
    snapshot: { [SOURCE]: A },
  });
  const disappeared = inspectCoverageSnapshot({
    current: {},
    reportFiles: [SOURCE],
    snapshot: { [SOURCE]: A },
  });
  const appeared = inspectCoverageSnapshot({
    current: { [SOURCE]: A, "/repo/packages/engine/src/appeared.ts": A },
    reportFiles: [SOURCE],
    snapshot: { [SOURCE]: A },
  });
  const oneOfSeveral = inspectCoverageSnapshot({
    current: { [SOURCE]: A, [OTHER]: B },
    reportFiles: [SOURCE, OTHER],
    snapshot: { [SOURCE]: A, [OTHER]: A },
  });

  TestValidator.equals(
    "measurement validity and publication are one fail-closed decision",
    namedFacts([
      ["valid child publishes", () => passed.status === 0],
      [
        "publication names the private report",
        () => passed.publication?.reportDirectory === "/this-run/report",
      ],
      ["failed child is ordinary red", () => failed.status === 1],
      ["missing child is instrument red", () => didNotStart.status === 2],
      ["same-length byte drift is instrument red", () => drifted.status === 2],
      [
        "partial publication failure is instrument red",
        () => publicationFailed.status === 2,
      ],
      ["failed and drifted runs never publish", () => publications === 1],
      [
        "raw path belongs to this run",
        () =>
          arguments_[arguments_.indexOf("--temp-directory") + 1] ===
          "/this-run/raw",
      ],
      [
        "report path belongs to this run",
        () =>
          arguments_[arguments_.indexOf("--reports-dir") + 1] ===
          "/this-run/report",
      ],
      [
        "zero records are invalid",
        () =>
          status({ records: { bytes: 0, count: 0, parsed: 0, results: 0 } }) ===
          2,
      ],
      [
        "truncated records are invalid",
        () =>
          status({ records: { bytes: 1, count: 2, parsed: 1, results: 1 } }) ===
          2,
      ],
      [
        "empty script results are invalid",
        () =>
          status({ records: { bytes: 1, count: 1, parsed: 1, results: 0 } }) ===
          2,
      ],
      [
        "missing measured source is invalid",
        () => status({ missingMeasuredSources: 1 }) === 2,
      ],
      [
        "union shortfall is invalid",
        () => status({ unionShortfalls: 1 }) === 2,
      ],
      [
        "reconciliation failure is invalid",
        () => status({ reconciliationFailure: "failed" }) === 2,
      ],
      [
        "invalidity outranks child failure",
        () => status({ child: { status: 1 }, unionShortfalls: 1 }) === 2,
      ],
      [
        "valid child failure stays status one",
        () => status({ child: { status: 1 } }) === 1,
      ],
      [
        "exact snapshot publishes every report source",
        () =>
          exact.failures.length === 0 &&
          Object.keys(exact.published).length === 1,
      ],
      [
        "missing report source is named",
        () => missing.failures[0]?.includes("absent from the report") === true,
      ],
      [
        "unexpected report source is named",
        () =>
          unexpected.failures[0]?.includes(
            "absent from the pre-run snapshot",
          ) === true,
      ],
      [
        "disappeared source prevents publication",
        () =>
          disappeared.failures[0]?.includes("disappeared") === true &&
          Object.keys(disappeared.published).length === 0,
      ],
      [
        "appeared source prevents publication",
        () =>
          appeared.failures[0]?.includes("appeared") === true &&
          Object.keys(appeared.published).length === 0,
      ],
      [
        // Failures name the canonical path, which on Windows carries the
        // resolved drive and folded case rather than the POSIX spelling above.
        "one drifted source among several withholds every entry",
        () =>
          oneOfSeveral.failures.length === 1 &&
          oneOfSeveral.failures[0] ===
            `${canonicalCoveragePath(OTHER)}: measured source bytes changed during the run` &&
          Object.keys(oneOfSeveral.published).length === 0,
      ],
    ]),
    Object.fromEntries(
      [
        "valid child publishes",
        "publication names the private report",
        "failed child is ordinary red",
        "missing child is instrument red",
        "same-length byte drift is instrument red",
        "partial publication failure is instrument red",
        "failed and drifted runs never publish",
        "raw path belongs to this run",
        "report path belongs to this run",
        "zero records are invalid",
        "truncated records are invalid",
        "empty script results are invalid",
        "missing measured source is invalid",
        "union shortfall is invalid",
        "reconciliation failure is invalid",
        "invalidity outranks child failure",
        "valid child failure stays status one",
        "exact snapshot publishes every report source",
        "missing report source is named",
        "unexpected report source is named",
        "disappeared source prevents publication",
        "appeared source prevents publication",
        "one drifted source among several withholds every entry",
      ].map((key) => [key, true]),
    ),
  );
};
