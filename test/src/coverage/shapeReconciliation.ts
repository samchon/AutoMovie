import fs from "node:fs";
import path from "node:path";

/**
 * One raw V8 record, reduced to the shape it saw each script in.
 *
 * The shape is the record's own account of a script's function layout. Two
 * records that saw one URL with different layouts saw two different emitted
 * forms of the same source, and their range offsets are not comparable.
 */
export interface IRecordShapes {
  file: string;
  urls: ReadonlyMap<string, string>;
}

export interface ICoverageEntry {
  b?: Record<string, number[]>;
  f?: Record<string, number>;
  s?: Record<string, number>;
}

/** The signature a record gives one script, as `coverageScriptShapes` spells it. */
export const scriptShape = (script: {
  functions?: Array<{
    functionName?: string;
    ranges?: Array<{ startOffset?: number }>;
  }>;
}): string =>
  (script.functions ?? [])
    .map(
      (fn) => `${fn.functionName ?? ""}:${fn.ranges?.[0]?.startOffset ?? -1}`,
    )
    .sort((left, right) => left.localeCompare(right))
    .join(",");

/**
 * Split records so no group holds two readings of one script.
 *
 * Measured on this repository: `builtEnvironment.ts` appears in two raw records
 * of one suite run with 127 and 241 function entries. Reported together, c8
 * returns 90.93 percent. Reported apart, the two groups return 100 percent and
 * 32.56 percent — so the merge of a complete reading and a partial one is worse
 * than the complete one, which a union can never be.
 *
 * The grouping is greedy and first-fit, which is enough because the number of
 * groups is bounded by the largest number of shapes any one script was read in,
 * and a record joins the first group that has no quarrel with it. Order is the
 * caller's, so the same records always partition the same way.
 */
export const partitionByShape = (
  records: readonly IRecordShapes[],
): string[][] => {
  const groups: Array<{ files: string[]; urls: Map<string, string> }> = [];
  for (const record of records) {
    const fits = (group: { urls: Map<string, string> }): boolean =>
      [...record.urls].every(
        ([url, shape]) => (group.urls.get(url) ?? shape) === shape,
      );
    const found = groups.find(fits);
    const target = found ?? { files: [], urls: new Map<string, string>() };
    if (found === undefined) groups.push(target);
    target.files.push(record.file);
    for (const [url, shape] of record.urls) target.urls.set(url, shape);
  }
  return groups.map((group) => group.files);
};

/** How many executable positions one report entry says actually ran. */
export const coveredPositions = (entry: ICoverageEntry): number =>
  Object.values(entry.s ?? {}).filter((hits) => hits > 0).length +
  Object.values(entry.f ?? {}).filter((hits) => hits > 0).length +
  Object.values(entry.b ?? {})
    .flat()
    .filter((hits) => hits > 0).length;

/**
 * Per file, the reading that saw the most of it actually run.
 *
 * Each group's report is a truthful account of what its own processes executed,
 * so the fullest one never claims a position no process reached. It can still
 * fall short of a true union when two shapes ran disjoint halves, which is why
 * this is stated as the best available reading rather than the exact one — but
 * it is never worse than the merge it replaces, and on the measured case it is
 * exact.
 *
 * A file only one group knows about is taken from that group unchanged.
 */
export const mostCoveredEntries = <T extends ICoverageEntry>(
  reports: ReadonlyArray<Record<string, T>>,
): Record<string, T> => {
  const best: Record<string, T> = {};
  for (const report of reports)
    for (const [file, entry] of Object.entries(report)) {
      const standing = best[file];
      if (
        standing === undefined ||
        coveredPositions(entry) > coveredPositions(standing)
      )
        best[file] = entry;
    }
  return best;
};

/** Every raw record in a temp directory, reduced to its per-script shapes. */
export const readRecordShapes = (
  directory: string,
  measured: (url: string) => boolean,
): IRecordShapes[] => {
  const records: IRecordShapes[] = [];
  for (const entry of fs
    .readdirSync(directory)
    .sort((left, right) => Number(left > right) - Number(left < right))) {
    if (entry.endsWith(".json") === false) continue;
    let parsed: {
      result?: Array<{
        functions?: Array<{
          functionName?: string;
          ranges?: Array<{ startOffset?: number }>;
        }>;
        url?: string;
      }>;
    };
    try {
      parsed = JSON.parse(
        fs.readFileSync(path.join(directory, entry), "utf8"),
      ) as typeof parsed;
    } catch {
      // A record caught mid-write says nothing about any shape. Skipping it
      // here changes no verdict: c8 will not read it either.
      continue;
    }
    const urls = new Map<string, string>();
    for (const script of parsed.result ?? []) {
      const url = script.url;
      if (typeof url !== "string" || measured(url) === false) continue;
      urls.set(url, scriptShape(script));
    }
    if (urls.size !== 0) records.push({ file: entry, urls });
  }
  return records;
};

export interface IShapeReconciliation {
  /** Why no corrected report was written, or null when one was. */
  failure: string | null;
  /** How many shape-consistent groups the records fell into. */
  groups: number;
}

/**
 * Replace a lossy merge with the fullest reading each file actually got.
 *
 * c8 writes one entry per source path, and when two processes saw one source in
 * two emitted forms the entry it writes is worse than the better of the two.
 * The raw records are still on disk at this point, so the run can ask each
 * shape-consistent group of them for its own report and keep, per file, the
 * reading that saw the most of it run.
 *
 * One group means nothing was read twice and the merge had nothing to lose, so
 * the report c8 already wrote stands untouched. A group whose report cannot be
 * produced or read stops the correction and says why: a partial correction
 * would be a third reading with no account of itself.
 */
export const reconcileCoverageShapes = (props: {
  copy: (from: string, to: string) => void;
  groupRoot: string;
  measured: (url: string) => boolean;
  mkdir: (directory: string) => void;
  readReport: (directory: string) => Record<string, ICoverageEntry> | null;
  report: (temporary: string, reports: string) => number;
  temporary: string;
  writeReport: (entries: Record<string, ICoverageEntry>) => void;
}): IShapeReconciliation => {
  const groups = partitionByShape(
    readRecordShapes(props.temporary, props.measured),
  );
  if (groups.length < 2) return { failure: null, groups: groups.length };
  const reports: Array<Record<string, ICoverageEntry>> = [];
  for (const [index, files] of groups.entries()) {
    const temporary = path.join(props.groupRoot, `shape-${index}`);
    const reports_ = path.join(props.groupRoot, `report-${index}`);
    props.mkdir(temporary);
    props.mkdir(reports_);
    for (const file of files)
      props.copy(path.join(props.temporary, file), path.join(temporary, file));
    const status = props.report(temporary, reports_);
    if (status !== 0)
      return {
        failure: `shape group ${index} could not be reported (status ${status})`,
        groups: groups.length,
      };
    const read = props.readReport(reports_);
    if (read === null)
      return {
        failure: `shape group ${index} wrote no readable report`,
        groups: groups.length,
      };
    reports.push(read);
  }
  props.writeReport(mostCoveredEntries(reports));
  return { failure: null, groups: groups.length };
};
