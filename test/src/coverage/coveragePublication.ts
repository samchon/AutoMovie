import fs from "node:fs";
import path from "node:path";

import {
  type IMeasuredSource,
  canonicalCoveragePath,
  isAuthoredExecutableSource,
  readMeasuredSource,
  sourceDigest,
} from "./coverageIdentity";

export const COVERAGE_REPORT = "coverage-final.json";

export interface ICoverageRunPaths {
  rawDirectory: string;
  reportDirectory: string;
  rootDirectory: string;
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

/**
 * Capture every measured source before the child starts.
 *
 * An Istanbul report carries positions and no way to say which content they
 * were taken from: the per-file entry holds `path`, the maps and the counts,
 * and no hash. A reader asking "does this position exist in the file?" against
 * whatever the file has since become blames the instrument for an ordinary
 * edit; measured on this repository, one commit that shortened a file by 23
 * lines made 26 positions read as past its end, none of which was a fault. And
 * a length alone cannot tell an equal-length edit from the measured bytes, so
 * both the line count and the digest are taken here, from the same bytes, in
 * the one moment that precedes execution.
 *
 * This map is the run's source truth. {@link inspectCoverageSnapshot} refuses
 * the run when the report or the post-run bytes disagree with it, and only its
 * entries are ever published; a file it does not name is one no consumer may
 * judge.
 */
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

/**
 * Publish one immutable in-memory identity for the run-private report.
 *
 * Nothing is written beside the report. Every consumer receives this value
 * from the orchestration that measured, and {@link publicationReport} re-reads
 * the report against the digest taken here, so a consumer can neither find a
 * report by convention nor read one whose bytes are not the ones published.
 */
export const publishCoverageSnapshot = (props: {
  reportDirectory: string;
  sources: Readonly<Record<string, IMeasuredSource>>;
}): ICoveragePublication => {
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
