import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IMeasuredSource,
  canonicalCoveragePath,
  isAuthoredExecutableSource,
  readMeasuredSource,
  sameMeasuredSources,
  sourceDigest,
} from "./coverageIdentity";

export const MEASURED_LINES = "measured-lines.json";
export const MEASURED_SOURCES = "measured-sources.json";
export const COVERAGE_REPORT = "coverage-final.json";

export interface ICoverageRunPaths {
  rawDirectory: string;
  reportDirectory: string;
  rootDirectory: string;
  sourceHostDirectory: string;
}

export interface ICoveragePublication {
  readonly reportDirectory: string;
  readonly reportSha256: string;
  readonly sources: Readonly<Record<string, IMeasuredSource>>;
}

export interface ICoverageMeasurementResult {
  publication?: ICoveragePublication;
  status: number;
}

export interface ICoverageSnapshotInspection {
  failures: string[];
  published: Record<string, IMeasuredSource>;
}

const byCodeUnit = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);
const freezeSources = (
  sources: Readonly<Record<string, IMeasuredSource>>,
): Readonly<Record<string, IMeasuredSource>> =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(sources).map(([file, source]) => [
        file,
        Object.freeze({ ...source }),
      ]),
    ),
  );

/** Capture bytes before the child starts; this map is the run's source truth. */
export const captureCoverageSnapshot = (props: {
  candidates: readonly string[];
  root: string;
}): Record<string, IMeasuredSource> => {
  const snapshot: Record<string, IMeasuredSource> = {};
  for (const relative of props.candidates) {
    if (isAuthoredExecutableSource(relative) === false) continue;
    const file = path.resolve(props.root, relative);
    if (fs.existsSync(file))
      snapshot[canonicalCoveragePath(file)] = readMeasuredSource(file);
  }
  return snapshot;
};

/** Reconcile report population and post-run bytes against the pre-run map. */
export const inspectCoverageSnapshot = (props: {
  current: Readonly<Record<string, IMeasuredSource>>;
  reportFiles: readonly string[];
  snapshot: Readonly<Record<string, IMeasuredSource>>;
}): ICoverageSnapshotInspection => {
  const snapshot = new Map(
    Object.entries(props.snapshot).map(([file, identity]) => [
      canonicalCoveragePath(file),
      identity,
    ]),
  );
  const current = new Map(
    Object.entries(props.current).map(([file, identity]) => [
      canonicalCoveragePath(file),
      identity,
    ]),
  );
  const report = new Set(
    props.reportFiles.map((file) => canonicalCoveragePath(file)),
  );
  const failures: string[] = [];
  for (const file of [...snapshot.keys()].sort(byCodeUnit)) {
    if (report.has(file) === false)
      failures.push(
        `${file}: pre-run measured source is absent from the report`,
      );
    const before = snapshot.get(file)!;
    const after = current.get(file);
    if (after === undefined)
      failures.push(`${file}: measured source disappeared during the run`);
    else if (before.lines !== after.lines || before.sha256 !== after.sha256)
      failures.push(`${file}: measured source bytes changed during the run`);
  }
  for (const file of [...current.keys()].sort(byCodeUnit))
    if (snapshot.has(file) === false)
      failures.push(`${file}: measured source appeared during the run`);
  for (const file of [...report].sort(byCodeUnit))
    if (snapshot.has(file) === false)
      failures.push(
        `${file}: report source was absent from the pre-run snapshot`,
      );
  const published: Record<string, IMeasuredSource> = {};
  if (failures.length === 0)
    for (const file of [...report].sort(byCodeUnit))
      published[file] = snapshot.get(file)!;
  return { failures, published };
};

/** Publish both compatibility sidecars from one immutable in-memory snapshot. */
export const publishCoverageSnapshot = (props: {
  reportDirectory: string;
  sources: Readonly<Record<string, IMeasuredSource>>;
}): ICoveragePublication => {
  const lines = Object.fromEntries(
    Object.entries(props.sources).map(([file, source]) => [file, source.lines]),
  );
  const suffix = crypto.randomUUID();
  const linesFile = path.join(props.reportDirectory, MEASURED_LINES);
  const sourcesFile = path.join(props.reportDirectory, MEASURED_SOURCES);
  const pendingLines = `${linesFile}.${suffix}.tmp`;
  const pendingSources = `${sourcesFile}.${suffix}.tmp`;
  fs.writeFileSync(pendingLines, `${JSON.stringify(lines, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    pendingSources,
    `${JSON.stringify(props.sources, null, 2)}\n`,
    "utf8",
  );
  fs.renameSync(pendingLines, linesFile);
  fs.renameSync(pendingSources, sourcesFile);
  const report = fs.readFileSync(
    path.join(props.reportDirectory, COVERAGE_REPORT),
  );
  return Object.freeze({
    reportDirectory: path.resolve(props.reportDirectory),
    reportSha256: sourceDigest(report),
    sources: freezeSources(props.sources),
  });
};

/** Verify that a consumer still reads the report named by this publication. */
export const publicationReport = (
  publication: ICoveragePublication,
): string => {
  const report = path.join(publication.reportDirectory, COVERAGE_REPORT);
  if (sourceDigest(fs.readFileSync(report)) !== publication.reportSha256)
    throw new Error("coverage report no longer matches its run publication");
  return report;
};

/** Load a complete explicit publication for the standalone changed gate. */
export const loadCoveragePublication = (
  reportDirectory: string,
): ICoveragePublication => {
  const directory = path.resolve(reportDirectory);
  const sources = JSON.parse(
    fs.readFileSync(path.join(directory, MEASURED_SOURCES), "utf8"),
  ) as Record<string, IMeasuredSource>;
  const report = fs.readFileSync(path.join(directory, COVERAGE_REPORT));
  return Object.freeze({
    reportDirectory: directory,
    reportSha256: sourceDigest(report),
    sources: freezeSources(sources),
  });
};

export const publicationSourcesAreCurrent = (props: {
  current: Readonly<Record<string, IMeasuredSource>>;
  publication: ICoveragePublication;
}): boolean => sameMeasuredSources(props.current, props.publication.sources);
