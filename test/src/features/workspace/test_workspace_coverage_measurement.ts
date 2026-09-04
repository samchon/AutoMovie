import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalCoveragePath } from "../../coverage/coverageIdentity";
import {
  captureCoverageSnapshot,
  inspectCoverageSnapshot,
} from "../../coverage/coveragePublication";
import {
  decideCoverageMeasurementStatus,
  measureCoverage,
} from "../../coverage/measureCoverage";
import { namedFacts } from "../internal/predicates";

const SOURCE = "/repo/packages/engine/src/source.ts";
const A = { lines: 1, sha256: "a" };
const B = { lines: 1, sha256: "b" };

/** One run publishes only its own complete and unchanged source measurement. */
export const test_workspace_coverage_measurement = (): void => {
  const captureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-coverage-capture-"),
  );
  const captureRelative = "packages/engine/src/AutoMovieScene.ts";
  const captureFile = path.resolve(captureRoot, captureRelative);
  fs.mkdirSync(path.dirname(captureFile), { recursive: true });
  fs.writeFileSync(captureFile, "export const scene = true;\n", "utf8");
  const captured = captureCoverageSnapshot({
    candidates: [captureRelative],
    root: captureRoot,
  });
  fs.rmSync(captureRoot, { force: true, recursive: true });
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
      sourceHostDirectory: "/this-run/source-host",
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
      throw new Error("sidecar write failed");
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

  TestValidator.equals(
    "measurement validity and publication are one fail-closed decision",
    namedFacts([
      ["valid child publishes", () => passed.status === 0],
      [
        "capture uses canonical source identity",
        () =>
          captured[canonicalCoveragePath(captureFile)]?.sha256.length === 64,
      ],
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
        "disappeared source prevents every sidecar",
        () =>
          disappeared.failures[0]?.includes("disappeared") === true &&
          Object.keys(disappeared.published).length === 0,
      ],
      [
        "appeared source prevents every sidecar",
        () =>
          appeared.failures[0]?.includes("appeared") === true &&
          Object.keys(appeared.published).length === 0,
      ],
    ]),
    Object.fromEntries(
      [
        "valid child publishes",
        "capture uses canonical source identity",
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
        "disappeared source prevents every sidecar",
        "appeared source prevents every sidecar",
      ].map((key) => [key, true]),
    ),
  );
};
