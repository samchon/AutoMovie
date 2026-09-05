import fs from "node:fs";
import path from "node:path";

import {
  type ICoverageSpan,
  branchIdentity,
  canonicalCoverageEntryPath,
  functionIdentity,
  statementIdentity,
} from "./coverageIdentity";

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
  branchMap?: Record<
    string,
    { loc?: ICoverageSpan; locations?: ICoverageSpan[]; type?: string }
  >;
  f?: Record<string, number>;
  fnMap?: Record<
    string,
    { decl?: ICoverageSpan; loc?: ICoverageSpan; name?: string }
  >;
  s?: Record<string, number>;
  statementMap?: Record<string, ICoverageSpan>;
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
 * 32.56 percent, so for that file the merge is worse than one of its parts.
 *
 * It is not worse for every file, and reading it that way was the mistake this
 * split first made. `build/experimental.ts` appears four times in one run
 * carrying three shapes, and c8 folds all four to 302 of 304 statements while
 * splitting them reached 184. Splitting is therefore a candidate reading rather
 * than a correction, and `unionEntries` is given c8's own report alongside the
 * groups so the fullest of them wins.
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

/** Exact declaration/position identities one reading says ran. */
export const coveredIdentities = (
  entry: ICoverageEntry,
): {
  branches: Set<string>;
  functions: Set<string>;
  statements: Set<string>;
} => {
  const statements = new Set<string>();
  const functions = new Set<string>();
  const branches = new Set<string>();
  for (const [id, span] of Object.entries(entry.statementMap ?? {})) {
    const identity = statementIdentity(span);
    if ((entry.s?.[id] ?? 0) > 0 && identity !== null) statements.add(identity);
  }
  for (const [id, definition] of Object.entries(entry.fnMap ?? {})) {
    const identity = functionIdentity(definition);
    if ((entry.f?.[id] ?? 0) > 0 && identity !== null) functions.add(identity);
  }
  for (const [id, definition] of Object.entries(entry.branchMap ?? {})) {
    const hits = entry.b?.[id] ?? [];
    for (const [arm] of (definition.locations ?? []).entries()) {
      const identity = branchIdentity({ arm, definition });
      if ((hits[arm] ?? 0) > 0 && identity !== null) branches.add(identity);
    }
  }
  return { branches, functions, statements };
};

/** Covered positions whose report omits part of their matching identity. */
export const unidentifiableCoveredPositions = (
  entry: ICoverageEntry,
): string[] => {
  const missing: string[] = [];
  for (const [id, span] of Object.entries(entry.statementMap ?? {}))
    if ((entry.s?.[id] ?? 0) > 0 && statementIdentity(span) === null)
      missing.push(`statement:${id}`);
  for (const [id, definition] of Object.entries(entry.fnMap ?? {}))
    if ((entry.f?.[id] ?? 0) > 0 && functionIdentity(definition) === null)
      missing.push(`function:${id}`);
  for (const [id, definition] of Object.entries(entry.branchMap ?? {}))
    for (const [arm] of (definition.locations ?? []).entries())
      if (
        (entry.b?.[id]?.[arm] ?? 0) > 0 &&
        branchIdentity({ arm, definition }) === null
      )
        missing.push(`branch:${id}:${arm}`);
  return missing;
};

/**
 * One entry's positions, marked covered only when another reading carries the
 * same complete declaration or position identity.
 *
 * Taking the fullest single reading is not a union, and the shortfall was
 * measured: `build/experimental.ts` reads 99.61 percent under the build tests
 * and about 70 under the full suite, because a record carrying its coverage is
 * assigned to a group by some unrelated file's shape conflict and its half is
 * never added to the other's. Positions are what the two halves have in common:
 * identifiers differ between shapes, line numbers do not.
 *
 * The base is the reading with the most positions, so the structure this
 * returns is one c8 actually produced rather than a shape assembled here. A
 * position keeps its own hits when it has them and otherwise takes a single hit
 * only from a reading with the same complete kind-specific identity. Two
 * statements on one line, same-name functions at different declarations, and
 * distinct branch arms therefore never lend coverage to one another.
 */
export const unionEntryByLine = <T extends ICoverageEntry>(
  entries: readonly T[],
): T | undefined => {
  // Most positions, and on a tie the reading that saw the most of them run. An
  // entry carrying no position map cannot be folded at all, so without the
  // tiebreak the base among such entries would be whichever arrived first.
  // A reading that ran outranks one that did not, whatever their sizes.
  //
  // `--all` writes an entry for a file a group never loaded, and that entry has
  // one position per source line -- comment and blank lines included -- with no
  // hits anywhere. Ranked by positions alone it beats every real reading, and
  // the fold then carries the real hits onto a structure in which every comment
  // is an uncovered statement. Measured on `build/experimental.ts`: 49 lines
  // read as uncovered under the full suite, line 1 among them, while the file's
  // own tests read it at 99 percent.
  //
  // Among readings that ran, more positions is still the better structure, and
  // coverage breaks a tie so entries carrying no position map at all are not
  // ordered by arrival.
  const rank = (entry: T): readonly [number, number, number] => [
    coveredPositions(entry) > 0 ? 1 : 0,
    Object.keys(entry.statementMap ?? {}).length,
    coveredPositions(entry),
  ];
  const base = entries.reduce<T | undefined>((standing, entry) => {
    if (standing === undefined) return entry;
    const [ran, positions, covered] = rank(entry);
    const [heldRan, held, heldCovered] = rank(standing);
    if (ran !== heldRan) return ran > heldRan ? entry : standing;
    return positions > held || (positions === held && covered > heldCovered)
      ? entry
      : standing;
  }, undefined);
  if (base === undefined) return undefined;
  const identities = entries.map(coveredIdentities);
  const ran = (
    kind: "branches" | "functions" | "statements",
    identity: string | null,
  ) => identity !== null && identities.some((set) => set[kind].has(identity));
  const s = { ...(base.s ?? {}) };
  for (const [id, span] of Object.entries(base.statementMap ?? {}))
    if ((s[id] ?? 0) === 0 && ran("statements", statementIdentity(span)))
      s[id] = 1;
  const f = { ...(base.f ?? {}) };
  for (const [id, definition] of Object.entries(base.fnMap ?? {}))
    if ((f[id] ?? 0) === 0 && ran("functions", functionIdentity(definition)))
      f[id] = 1;
  const b: Record<string, number[]> = {};
  for (const [id, span] of Object.entries(base.branchMap ?? {}))
    b[id] = (span?.locations ?? []).map((_location, index) => {
      const hits = base.b?.[id]?.[index] ?? 0;
      return hits > 0 ||
        ran("branches", branchIdentity({ arm: index, definition: span }))
        ? Math.max(hits, 1)
        : 0;
    });
  return { ...base, b: { ...(base.b ?? {}), ...b }, f, s };
};

/** A file the union wrote without a position one reading had covered. */
export interface IUnionShortfall {
  file: string;
  /** Exact identities a reading covered and the written entry does not. */
  lost: string[];
}

/**
 * Whether the union ever wrote less than the best reading it was given.
 *
 * The union folds exact identities onto a base structure, so a position the
 * base does not carry cannot be lifted into it however well another reading
 * covered it.
 * That is a real way to lose, and until now nothing said when it happened: the
 * gate refused files whose changed lines a scoped run reads at 99.67% and
 * nobody could tell whether the union had lost them or never seen them.
 *
 * A shortfall is not proof of which, but it is the difference between the two,
 * and it costs one pass over what the union already computed.
 *
 * Identities rather than counts. A count says how much was covered while a
 * complete key says exactly which declaration, statement, or branch arm was.
 *
 * Covered positions only, deliberately. A reading's uncovered positions are
 * its own geometry: the `--all` entry a group writes for a file it never
 * loaded carries one zero-hit statement per source line, and a second emitted
 * form carries function entries at lines that define nothing. Neither is an
 * obligation the base lost; what must never be lost is coverage a process
 * observed.
 */
export const unionShortfalls = <T extends ICoverageEntry>(
  grouped: ReadonlyMap<string, readonly T[]>,
  united: Readonly<Record<string, T>>,
  identity: (file: string) => string = canonicalCoverageEntryPath,
): IUnionShortfall[] => {
  const allIdentities = (entry: ICoverageEntry): Set<string> => {
    const kinds = coveredIdentities(entry);
    return new Set([
      ...kinds.statements,
      ...kinds.functions,
      ...kinds.branches,
    ]);
  };
  const writtenEntries = new Map(
    Object.entries(united).map(([file, entry]) => [identity(file), entry]),
  );
  const shortfalls: IUnionShortfall[] = [];
  for (const [file, entries] of grouped) {
    const chosen = writtenEntries.get(identity(file));
    if (chosen === undefined) continue;
    const written = allIdentities(chosen);
    const lost = new Set<string>();
    for (const [reading, entry] of entries.entries()) {
      for (const missing of unidentifiableCoveredPositions(entry))
        lost.add(`unidentifiable:${reading}:${missing}`);
      for (const position of allIdentities(entry))
        if (written.has(position) === false) lost.add(position);
    }
    if (lost.size !== 0)
      shortfalls.push({
        file,
        lost: [...lost].sort(
          (left, right) => Number(left > right) - Number(left < right),
        ),
      });
  }
  return shortfalls.sort((left, right) => right.lost.length - left.lost.length);
};

/**
 * Group every report's entries by canonical file identity, keeping each
 * reading separate. Two spellings of one path are two readings of one file.
 */
export const groupEntriesByFile = <T extends ICoverageEntry>(
  reports: ReadonlyArray<Record<string, T>>,
  identity: (file: string) => string,
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const report of reports)
    for (const [file, entry] of Object.entries(report)) {
      const key = identity(file);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
  return grouped;
};

export const unionEntries = <T extends ICoverageEntry>(
  reports: ReadonlyArray<Record<string, T>>,
  identity: (file: string) => string = canonicalCoverageEntryPath,
): Record<string, T> => {
  const united: Record<string, T> = {};
  for (const [file, entries] of groupEntriesByFile(reports, identity)) {
    const merged = unionEntryByLine(entries);
    if (merged !== undefined) united[file] = merged;
  }
  return united;
};

/** Every raw record in a temp directory, reduced to its per-script shapes. */
export const readRecordShapes = (
  directory: string,
  measured: (url: string) => boolean | string,
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
      if (typeof url !== "string") continue;
      const identity = measured(url);
      if (identity === false) continue;
      urls.set(identity === true ? url : identity, scriptShape(script));
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
  /** Files the union wrote with fewer covered positions than a reading had. */
  shortfalls?: IUnionShortfall[];
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
 * the report c8 already wrote stands. It is rewritten only to key every entry
 * by its canonical identity, which on a case-preserving host is what makes two
 * spellings of one file fold into one entry: a source loaded through its map
 * is keyed by the checkout's real casing while `--all` keys a never-loaded
 * file by the working directory's, and a consumer indexing by canonical path
 * would otherwise keep whichever of the two arrived last. On a host whose
 * keys are already canonical nothing is rewritten. A group whose report cannot
 * be produced or read stops the correction and says why: a partial correction
 * would be a third reading with no account of itself.
 */
export const reconcileCoverageShapes = (props: {
  copy: (from: string, to: string) => void;
  groupRoot: string;
  measured: (url: string) => boolean | string;
  mkdir: (directory: string) => void;
  readReport: (directory: string) => Record<string, ICoverageEntry> | null;
  report: (temporary: string, reports: string) => number;
  /** Where the run's own merged report already sits, read as one more reading. */
  reportDirectory: string;
  temporary: string;
  writeReport: (entries: Record<string, ICoverageEntry>) => void;
  /** Canonical report-key identity; defaults to the current host platform. */
  entryIdentity?: (file: string) => string;
}): IShapeReconciliation => {
  const identity = props.entryIdentity ?? canonicalCoverageEntryPath;
  const groups = partitionByShape(
    readRecordShapes(props.temporary, props.measured),
  );
  if (groups.length < 2) {
    const merged = props.readReport(props.reportDirectory);
    if (merged === null) return { failure: null, groups: groups.length };
    const united = unionEntries([merged], identity);
    const shortfalls = unionShortfalls(
      groupEntriesByFile([merged], identity),
      united,
      identity,
    );
    if (
      Object.keys(merged).length !== Object.keys(united).length ||
      Object.keys(merged).some((file) => identity(file) !== file)
    )
      props.writeReport(united);
    return shortfalls.length === 0
      ? { failure: null, groups: groups.length }
      : { failure: null, groups: groups.length, shortfalls };
  }
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
  // The report c8 already wrote is a candidate too, and taking the fuller of
  // the two is what makes this never worse than the merge it replaces.
  //
  // Splitting by shape assumed a differing shape means a lossy merge. That is
  // true of `builtEnvironment.ts`, where c8 folds a complete reading and a
  // partial one into 90.93 percent. It is false of `build/experimental.ts`,
  // whose four records carry three shapes and which c8 merges to 302 of 304
  // statements -- there the split produced three partial groups and the fold
  // could not put them back. Measured on both, in that order, after the second
  // one made this claim's own JSDoc false.
  const merged = props.readReport(props.reportDirectory);
  const candidates = merged === null ? reports : [...reports, merged];
  const united = unionEntries(candidates, identity);
  props.writeReport(united);
  return {
    failure: null,
    groups: groups.length,
    shortfalls: unionShortfalls(
      groupEntriesByFile(candidates, identity),
      united,
      identity,
    ),
  };
};
