// Run the repository's coverage measurement in a directory nothing else writes.
//
// c8 wipes its `--temp-directory` at startup. With one fixed path, a second run
// started while a first is in flight deletes the first's per-process JSON, and
// whichever finishes last reports a total assembled from whatever survived. The
// number that comes out is not high, not low, and not flagged: it is arbitrary,
// and it reads exactly like a measurement.
//
// It was measured twice on one day, independently, by two owners of the same
// campaign. One file went 98.83% to 72.03% across a pair of runs that only
// *added* tests, with the repository total moving 47.98% to 35.73%; another went
// 95.1%/100% to 78.57%/39.68% across comment-only edits. Adding tests cannot
// lower coverage and comments cannot move it at all, so both pairs were
// arithmetically impossible, and both owners discarded their own numbers rather
// than reporting them. That is the only reason the instrument's fault surfaced
// instead of entering the record as two mysterious regressions.
//
// Raw records and report share one private run root. The exact immutable
// publication is passed to every consumer, then the whole root is removed;
// concurrent runs neither overwrite nor consume each other.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type IMeasuredSource,
  UNJUDGED_DECLARATION_GLOBS,
  UNMEASURED_SOURCE_ROOTS,
  canonicalCoveragePath,
  coverageSourceAttribution,
  isAuthoredExecutableSource,
} from "./coverageIdentity";
import {
  type ICoverageMeasurementResult,
  type ICoveragePublication,
  type ICoverageRunPaths,
  captureCoverageSnapshot,
  inspectCoverageSnapshot,
  publishCoverageSnapshot,
} from "./coveragePublication";
import {
  type ICoverageEntry,
  type IShapeReconciliation,
  reconcileCoverageShapes,
} from "./shapeReconciliation";

export interface ICoverageRecords {
  bytes: number;
  count: number;
  parsed: number;
  results: number;
}

export interface ICoverageMissingScripts {
  /** Every URL whose file the report will not find. */
  missing: number;
  /**
   * The measured sources among them, named.
   *
   * The count alone cannot be acted on. A vanished temporary script is
   * ordinary -- a generated project's own files are deleted with the fixture --
   * and a vanished measured source is a reading of code this repository charges
   * for, dropped because c8 could not read the file to place its ranges. The
   * run printed 219 gone and said nothing about which kind they were, so the
   * number had never been worth reading either way.
   */
  measured: string[];
  urls: number;
}

export interface ICoverageScriptShapes {
  disagreeing: number;
  reread: number;
  sample: string[];
  urls: number;
}

interface IRawCoverageScript {
  functions?: Array<{
    functionName?: string;
    ranges?: Array<{ startOffset?: number }>;
  }>;
  url?: string;
}

interface IRawCoverageRecord {
  result?: IRawCoverageScript[];
}

export interface ICoverageSpawnResult {
  error?: Error;
  status: number | null;
}

/** All observations that decide whether a measurement can be trusted. */
export interface ICoverageMeasurementObservation {
  child: ICoverageSpawnResult;
  missingMeasuredSources: number;
  records: ICoverageRecords;
  reconciliationFailure: string | null;
  unionShortfalls: number;
}

/** Instrument invalidity outranks an ordinary test failure. */
export const decideCoverageMeasurementStatus = (
  observation: ICoverageMeasurementObservation,
): number => {
  if (
    observation.child.error !== undefined ||
    observation.child.status === null ||
    observation.reconciliationFailure !== null ||
    observation.records.count === 0 ||
    observation.records.parsed !== observation.records.count ||
    observation.records.results === 0 ||
    observation.missingMeasuredSources !== 0 ||
    observation.unionShortfalls !== 0
  )
    return 2;
  return observation.child.status === 0 ? 0 : 1;
};

export interface ICoverageMeasurementDependencies {
  captureSnapshot: () => Record<string, IMeasuredSource>;
  /** Measured sources that appear in no record this run wrote. */
  neverRecorded: (directory: string, reportDirectory: string) => string[];
  environment: NodeJS.ProcessEnv;
  log: (line: string) => void;
  mkdir: (directory: string, options: { recursive: true }) => unknown;
  missingScripts: (directory: string) => ICoverageMissingScripts;
  records: (directory: string) => ICoverageRecords;
  reconcile: (
    directory: string,
    reportDirectory: string,
  ) => IShapeReconciliation;
  remove: (directory: string) => void;
  scriptShapes: (directory: string) => ICoverageScriptShapes;
  currentSnapshot: () => Record<string, IMeasuredSource>;
  publish: (
    reportDirectory: string,
    sources: Readonly<Record<string, IMeasuredSource>>,
  ) => ICoveragePublication;
  reportFiles: (reportDirectory: string) => string[];
  runPaths: () => ICoverageRunPaths;
  spawn: (
    executable: string,
    arguments_: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      shell: false;
      stdio: "inherit";
    },
  ) => ICoverageSpawnResult;
}

export const COVERAGE_ROOT = path.resolve(__dirname, "../../..");
const ROOT = COVERAGE_ROOT;
const CACHE = path.join(ROOT, "node_modules", ".cache");
export const coverageRunPaths = (): ICoverageRunPaths => {
  const rootDirectory = path.join(
    CACHE,
    "automovie-c8-runs",
    `${process.pid}-${crypto.randomUUID()}`,
  );
  return {
    rawDirectory: path.join(rootDirectory, "raw"),
    reportDirectory: path.join(rootDirectory, "report"),
    rootDirectory,
  };
};

/**
 * What a run's own record directory holds, counted three ways.
 *
 * The count alone was not enough. A bad run and a good run of this suite both
 * wrote **179** records, and the bad one reported 79,786 covered statements
 * against the good one's 118,565 — the same files, a third of the coverage
 * gone. So nothing failed to flush, and a count cannot tell a complete record
 * from a directory entry for one that was still being written.
 *
 * Bytes and parsability can. A record caught mid-write has a name, an entry and
 * a size, and no usable content; a short byte total or a short parsable count
 * is that race. Equal figures in both modes move the question into the merge
 * itself, which is the other branch and needs a different fix. Three numbers
 * from one directory walk, on a step that already takes minutes.
 */
/**
 * How many script URLs a run's records name that no longer exist on disk.
 *
 * The three numbers above moved the question into the merge and stopped there,
 * because they describe the records and not what the records point at. A V8
 * record names a `url` and carries no source; the report step opens that file
 * to turn ranges into lines and to follow its source map back to the `.ts`. So
 * a record can be complete, parsable and counted, and still contribute nothing,
 * because the file it names is gone by the time anyone reads it.
 *
 * That is not hypothetical here. The launcher emits to a run-scoped directory
 * under `node_modules/.cache` and removes it, so every URL a suite's own
 * records name is a path with a limited life, and a child process that spawns
 * its own launcher gets its own. This says how many of them survived to the
 * report, which is the one thing that separates "the merge dropped complete
 * records" from "the records were complete and pointed at nothing".
 *
 * Counted per distinct URL rather than per record, because one file appears in
 * as many records as there were processes that loaded it and a per-record total
 * would report the same absence several times over.
 */
export const coverageMissingScripts = (
  directory: string,
  isMeasured: (url: string) => boolean = (url) =>
    measuredRawScriptIdentity(url, SOURCES, ROOT) !== null,
): ICoverageMissingScripts => {
  const urls = new Set<string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return { measured: [], missing: 0, urls: 0 };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    let record: IRawCoverageRecord;
    try {
      record = JSON.parse(
        fs.readFileSync(path.join(directory, entry), "utf8"),
      ) as IRawCoverageRecord;
    } catch {
      continue;
    }
    for (const script of Array.isArray(record.result) ? record.result : [])
      if (typeof script.url === "string" && script.url.startsWith("file:"))
        urls.add(script.url);
  }
  let missing = 0;
  const measured: string[] = [];
  for (const url of urls) {
    let target;
    try {
      target = fileURLToPath(url);
    } catch {
      // A URL this cannot resolve is not a file this can look for, and saying
      // so as an absence would be a guess rather than a reading.
      continue;
    }
    if (fs.existsSync(target) !== false) continue;
    missing++;
    if (isMeasured(url)) measured.push(url);
  }
  return {
    measured: measured.sort((left, right) => left.localeCompare(right)),
    missing,
    urls: urls.size,
  };
};

/**
 * How many measured sources were read in more than one shape, and by how many.
 *
 * A whole-suite figure can be lower than a scoped one over the same file, which
 * is arithmetically impossible for an execution count and entirely possible for
 * a merge. Measured on this repository: a geometry-scoped run reports
 * `tessellate.ts` at 226/226 statements while the full suite reports 172/226,
 * same denominator, same source. Its merged function map carries the six real
 * functions with tens of thousands of hits **and** two more naming two of them
 * at a line that defines neither, with zero hits.
 *
 * That second reading is what this counts. A record is one process's view of one
 * script; two processes that resolved the same source through different loaded
 * forms produce two range shapes, and the merge keeps both — the real one and
 * one whose positions land nowhere and whose counts are zero. The report cannot
 * show that afterwards, because by then it is one entry.
 *
 * The shape is the sorted list of each function's name and first start offset,
 * which is what changes when a different form of the same source is measured and
 * what stays fixed when the same form runs more or less often.
 *
 * Counted over the measured set only. Every process also loads its own launcher
 * and toolchain, and those disagree with each other constantly without affecting
 * one figure this repository reports.
 */
/**
 * Whether one raw V8 script URL names a file this measurement covers.
 *
 * Extracted so the shape census and the shape reconciliation ask one question
 * instead of two that can drift apart. The decoding notes inside are the
 * reason this is a parse rather than a host path resolution.
 */
export const measuredScriptIdentity = (
  url: string,
  roots: readonly string[],
  repository: string,
): string | null => {
  // Decode the URL rather than stripping its scheme by hand, and decode it
  // the same way on every host.
  //
  // The hand-rolled form was `url.replace(/^file:[/]{3}/u, "")`, which is
  // right only for a Windows drive letter: `file:///D:/a` loses three slashes
  // and correctly becomes `D:/a`, while `file:///home/a` becomes `home/a` and
  // loses the leading slash that `repository` still carries. Since
  // `coverageSourceRoots` is `["."]`, every comparison takes the prefix
  // branch, so every POSIX comparison failed and this census reported zero
  // measured scripts on Linux for its whole life.
  //
  // `fileURLToPath` fixes that but decides by host: it refuses
  // `file:///repo/a` on Windows because there is no drive letter, which is a
  // real URL shape this function is asked about. What the census needs is the
  // path the URL names, not the path this host could open, so the parse is
  // neutral and only a genuinely malformed URL is skipped.
  let target: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "file:" || parsed.hostname.length !== 0)
      return null;
    const decoded = decodeURIComponent(parsed.pathname);
    // A leading slash belongs to a POSIX path and precedes a Windows drive
    // letter; keep the first and drop the second.
    target = canonicalCoveragePath(
      /^\/[A-Za-z]:/u.test(decoded) ? decoded.slice(1) : decoded,
    );
  } catch {
    return null;
  }
  const canonicalRepository = canonicalCoveragePath(repository);
  const relative = target.slice(canonicalRepository.length).replace(/^\//u, "");
  return roots.some((root) => {
    if (
      target !== canonicalRepository &&
      target.startsWith(`${canonicalRepository}/`) === false
    )
      return false;
    const canonicalRoot =
      process.platform === "win32" ? root.toLowerCase() : root;
    const underRoot =
      canonicalRoot === "." ||
      relative === canonicalRoot ||
      relative.startsWith(`${canonicalRoot.replace(/\/$/u, "")}/`);
    return underRoot && isAuthoredExecutableSource(relative);
  })
    ? `${canonicalRepository}/${relative}`.replace(/\/$/u, "")
    : null;
};

/** Resolve source-map `sources` against the map file without choosing one. */
export const sourceMapSourceFiles = (props: {
  map: { sourceRoot?: string; sources?: unknown };
  mapFile: string;
}): string[] => {
  if (Array.isArray(props.map.sources) === false) return [];
  const root = props.map.sourceRoot ?? "";
  return props.map.sources
    .filter((source): source is string => typeof source === "string")
    .map((source) => {
      try {
        if (source.startsWith("file:")) return fileURLToPath(source);
        return path.resolve(path.dirname(props.mapFile), root, source);
      } catch {
        return "";
      }
    })
    .filter((source) => source.length !== 0);
};

const sourceMappedFiles = (url: string): string[] => {
  try {
    const script = fileURLToPath(url);
    const text = fs.readFileSync(script, "utf8");
    const match = /\/\/[#@] sourceMappingURL=([^\s]+)\s*$/mu.exec(text);
    if (match === null) return [];
    const reference = match[1]!;
    let mapFile = `${script}.map`;
    let encoded: string;
    if (reference.startsWith("data:application/json;base64,"))
      encoded = Buffer.from(
        reference.slice(reference.indexOf(",") + 1),
        "base64",
      ).toString("utf8");
    else {
      mapFile = path.resolve(
        path.dirname(script),
        decodeURIComponent(reference),
      );
      encoded = fs.readFileSync(mapFile, "utf8");
    }
    return sourceMapSourceFiles({
      map: JSON.parse(encoded) as { sourceRoot?: string; sources?: unknown },
      mapFile,
    });
  } catch {
    return [];
  }
};

/** Direct source URL or exactly one authored source-map attribution. */
export const measuredRawScriptIdentity = (
  url: string,
  roots: readonly string[],
  repository: string,
): string | null => {
  const direct = measuredScriptIdentity(url, roots, repository);
  if (direct !== null) return direct;
  if (measuredScriptIdentity(url, ["."], repository) !== null) return null;
  const attributed = coverageSourceAttribution({
    attributed: sourceMappedFiles(url),
    repository,
    url,
  });
  if (attributed.reason !== "measured" || attributed.identity === null)
    return null;
  const relative = path
    .relative(repository, attributed.identity)
    .replaceAll("\\", "/");
  const relativeIdentity =
    process.platform === "win32" ? relative.toLowerCase() : relative;
  return roots.some(
    (root) =>
      root === "." ||
      relativeIdentity ===
        (process.platform === "win32" ? root.toLowerCase() : root) ||
      relativeIdentity.startsWith(
        `${(process.platform === "win32" ? root.toLowerCase() : root).replace(/\/$/u, "")}/`,
      ),
  )
    ? attributed.identity
    : null;
};

/**
 * Measured sources that appear in no record at all.
 *
 * `--all` puts every include match in the report whether it loaded or not, so a
 * file reading zero percent may be untested code or may be code that ran and
 * was addressed somewhere the report could not follow. The report cannot tell
 * them apart and neither could this repository: three separate ways of counting
 * "does any test run this script" -- names mentioned in test files, the script
 * passed as an argument, URLs in one cached record directory -- gave three
 * different answers, and the disagreement was the point. Each counted a proxy.
 *
 * A record is not a proxy. If a URL for a file is in no record the process
 * never loaded it, and if one is there it did. That is the only reading of
 * "nothing runs this" this measurement can honestly make, so it is the one it
 * makes.
 */
export const coverageNeverRecorded = (props: {
  directory: string;
  identity?: (url: string) => string | null;
  reported: readonly string[];
}): string[] => {
  const seen = new Set<string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(props.directory);
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    let record: IRawCoverageRecord;
    try {
      record = JSON.parse(
        fs.readFileSync(path.join(props.directory, entry), "utf8"),
      ) as IRawCoverageRecord;
    } catch {
      continue;
    }
    for (const script of Array.isArray(record.result) ? record.result : []) {
      const url = script.url;
      if (typeof url !== "string" || url.startsWith("file:") === false)
        continue;
      const cut = url.search(/[?#]/u);
      try {
        const identity =
          props.identity === undefined
            ? fileURLToPath(cut === -1 ? url : url.slice(0, cut))
            : props.identity(url);
        if (identity !== null) seen.add(canonicalCoveragePath(identity));
      } catch {
        // A URL this cannot resolve names no file, which is a different
        // finding and one `coverageMissingScripts` already reports.
      }
    }
  }
  return props.reported
    .filter((file) => seen.has(canonicalCoveragePath(file)) === false)
    .sort((left, right) => left.localeCompare(right));
};

export const coverageScriptShapes = (
  directory: string,
  roots: readonly string[] = SOURCES,
): ICoverageScriptShapes => {
  const measured = (url: string): string | null =>
    measuredRawScriptIdentity(url, roots, ROOT);
  const shapes = new Map<string, { count: number; forms: Set<string> }>();
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return { urls: 0, reread: 0, disagreeing: 0, sample: [] };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    let record: IRawCoverageRecord;
    try {
      record = JSON.parse(
        fs.readFileSync(path.join(directory, entry), "utf8"),
      ) as IRawCoverageRecord;
    } catch {
      continue;
    }
    for (const script of Array.isArray(record.result) ? record.result : []) {
      if (
        typeof script.url !== "string" ||
        script.url.startsWith("file:") === false
      )
        continue;
      const identity = measured(script.url);
      if (identity === null) continue;
      const shape = (Array.isArray(script.functions) ? script.functions : [])
        .map(
          (fn) =>
            `${fn.functionName ?? ""}:${fn.ranges?.[0]?.startOffset ?? -1}`,
        )
        .sort((left, right) => left.localeCompare(right))
        .join(",");
      const seen = shapes.get(identity) ?? { count: 0, forms: new Set() };
      seen.count += 1;
      seen.forms.add(shape);
      shapes.set(identity, seen);
    }
  }
  let reread = 0;
  let disagreeing = 0;
  const sample: string[] = [];
  for (const [url, seen] of shapes) {
    if (seen.count > 1) reread += 1;
    if (seen.forms.size > 1) {
      disagreeing += 1;
      if (sample.length < 5)
        sample.push(`${url.split("/").pop()} (${seen.forms.size} shapes)`);
    }
  }
  return { urls: shapes.size, reread, disagreeing, sample };
};

export const coverageRecords = (directory: string): ICoverageRecords => {
  let count = 0;
  let bytes = 0;
  let parsed = 0;
  let results = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    // A directory the run never created holds nothing, which is exactly what a
    // caller asking this question needs to be told.
    return { count, bytes, parsed, results };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    count++;
    let text;
    try {
      text = fs.readFileSync(path.join(directory, entry), "utf8");
    } catch {
      continue;
    }
    bytes += Buffer.byteLength(text);
    try {
      const record = JSON.parse(text);
      parsed++;
      if (Array.isArray(record.result)) results += record.result.length;
    } catch {
      // Counted in `count` and not in `parsed`, which is the difference this
      // exists to expose.
    }
  }
  return { count, bytes, parsed, results };
};

/** The measured set. One definition, so two runs cannot count different things. */
export const coverageSourceRoots = ["."];

/**
 * The measured population, written as source-tree shapes rather than as a list.
 *
 * A pattern that names one directory of a root makes "owes no coverage" the
 * default for every sibling added afterwards, and nothing reports the omission.
 * The scaffold entry was `scripts/**` plus `lint.config.ts`, so the shipped
 * `src/examples`, the shipped `viewer/src`, `vite.config.ts` and
 * `repaintSelectionReviews.ts` were outside it while carrying exactly the same
 * kind of authored TypeScript. `isAuthoredExecutableSource` admitted all of
 * them, so the changed-file gate demanded coverage for a file the measurement
 * never took, and reported the disagreement as `changed measured source is
 * absent from coverage-final.json`, which is an instrument diagnostic for what
 * was really a population that had drifted from the predicate beside it.
 * `packages/template/scaffold/**` is one shape for one root; the extension and
 * `node_modules` filters decide the rest.
 *
 * {@link runCoveragePopulationGate} is what keeps this honest, by refusing any
 * run where a file one population admits the other does not.
 *
 * What this list does not say is what `UNMEASURED_SOURCE_ROOTS` says: the roots
 * this repository deliberately leaves outside its unit-test coverage
 * population. They are excluded from the measurement by that same constant
 * rather than by a second spelling here, because a second spelling is how the
 * two populations drifted before.
 */
export const coverageIncludes = [
  "*.ts",
  "*.tsx",
  "*.cts",
  "*.mts",
  "config/**",
  "docs/lint.config.ts",
  "packages/*/*.ts",
  "packages/*/*.tsx",
  "packages/*/*.cts",
  "packages/*/*.mts",
  "packages/*/scripts/**",
  "packages/*/src/**",
];

const SOURCES = coverageSourceRoots;
const INCLUDES = coverageIncludes;

/** Remove one run's private directory; a missing one is already removed. */
export const removeCoverageTemporaryDirectory = (directory: string): void =>
  fs.rmSync(directory, { recursive: true, force: true });

/**
 * The parts a real shape reconciliation is made of, each one askable on its own.
 *
 * Kept as a value rather than inlined so the wiring is reachable by a test. A
 * composition root nothing can call is where a one-line mistake -- the wrong
 * report filename, a group directory that is never made -- survives every green
 * run until it is needed.
 */
export const measuredShapeReconciliationParts = (props: {
  groupRoot: string;
  reportDirectory: string;
  /**
   * The reporter launcher, so a signalled process is an ordinary case.
   *
   * `spawnSync` reports a signalled child as a null status, and a reconciliation
   * that read that as success would write a corrected report from a group whose
   * reporter never finished. Naming the launcher here is what makes that an
   * input rather than an alternative only a killed process could produce.
   */
  spawn?: (
    command: string,
    argv: readonly string[],
    options: { cwd: string; shell: false; stdio: "ignore" },
  ) => { status: number | null };
  temporary: string;
}): Parameters<typeof reconcileCoverageShapes>[0] => ({
  copy: (from, to) => fs.copyFileSync(from, to),
  groupRoot: props.groupRoot,
  reportDirectory: props.reportDirectory,
  measured: (url) => measuredRawScriptIdentity(url, SOURCES, ROOT) ?? false,
  mkdir: (directory) => fs.mkdirSync(directory, { recursive: true }),
  readReport: (directory) => {
    try {
      return JSON.parse(
        fs.readFileSync(path.join(directory, "coverage-final.json"), "utf8"),
      ) as Record<string, ICoverageEntry>;
    } catch {
      return null;
    }
  },
  report: (records, reports) =>
    (props.spawn ?? spawnSync)(
      process.execPath,
      [
        path.join(ROOT, "test", "node_modules", "c8", "bin", "c8.js"),
        "report",
        "--all",
        // Filter after remapping, so a build whose own source map names a
        // measured source is judged by that source rather than dropped for the
        // path it was loaded from.
        "--exclude-after-remap",
        ...coverageInstrumentPopulation(),
        "--temp-directory",
        records,
        "--reports-dir",
        reports,
        "--reporter=json",
      ],
      { cwd: ROOT, shell: false, stdio: "ignore" },
    ).status ?? 1,
  temporary: props.temporary,
  writeReport: (entries) =>
    fs.writeFileSync(
      path.join(props.reportDirectory, "coverage-final.json"),
      JSON.stringify(entries),
      "utf8",
    ),
});

/**
 * Ask each shape-consistent group of raw records for its own report.
 *
 * The group reports are written beside the run's own temp directory and removed
 * with it, so a corrected run leaves nothing behind for the next one to
 * inherit.
 */
export const reconcileMeasuredShapes = (
  temporary: string,
  reportDirectory: string,
): IShapeReconciliation => {
  const groupRoot = `${temporary}-shapes`;
  try {
    return reconcileCoverageShapes(
      measuredShapeReconciliationParts({
        groupRoot,
        reportDirectory,
        temporary,
      }),
    );
  } finally {
    fs.rmSync(groupRoot, { force: true, recursive: true });
  }
};

/** Where a path is printed the way every other line prints one. */
const slashOf = (file: string): string => file.replaceAll("\\", "/");

/**
 * Every measured source the report carries, read from the report itself.
 *
 * The directory is a parameter so this can be read against a report that is
 * there and one that is not. It is the only way in: the measurement injects
 * `neverRecorded`, so a private helper reachable only through the shipped
 * dependency would never run under test, which is the shape this branch's own
 * commits keep catching elsewhere.
 */
export const measuredReportedSources = (reportDirectory: string): string[] => {
  try {
    return Object.keys(
      JSON.parse(
        fs.readFileSync(
          path.join(reportDirectory, "coverage-final.json"),
          "utf8",
        ),
      ) as Record<string, unknown>,
    );
  } catch {
    // No report is a different failure, and one the caller already reports.
    return [];
  }
};

/**
 * Measured sources this run's records never named, read against a given report.
 *
 * The two readings this composes are each exercised directly, and composing
 * them inside the shipped dependency put the composition itself out of reach:
 * the measurement injects `neverRecorded`, so nothing under test ever ran the
 * pair together and the changed-line demand charged the lambda that did. The
 * report directory is a parameter for the same reason its reader takes one --
 * a composition that can only be run against whatever report happens to be on
 * disk asserts nothing on a checkout that has none.
 */
export const coverageUnloadedSources = (props: {
  directory: string;
  reportDirectory: string;
}): string[] =>
  coverageNeverRecorded({
    directory: props.directory,
    identity: (url) => measuredRawScriptIdentity(url, SOURCES, ROOT),
    reported: measuredReportedSources(props.reportDirectory),
  });

export const coverageMeasurementDependencies: ICoverageMeasurementDependencies =
  {
    neverRecorded: (directory, reportDirectory) =>
      coverageUnloadedSources({ directory, reportDirectory }),
    runPaths: coverageRunPaths,
    mkdir: fs.mkdirSync,
    spawn: spawnSync,
    captureSnapshot: () => captureRepositoryCoverageSnapshot(ROOT),
    currentSnapshot: () => captureRepositoryCoverageSnapshot(ROOT),
    publish: (reportDirectory, sources) =>
      publishCoverageSnapshot({ reportDirectory, sources }),
    reportFiles: measuredReportedSources,
    records: coverageRecords,
    reconcile: reconcileMeasuredShapes,
    missingScripts: coverageMissingScripts,
    scriptShapes: coverageScriptShapes,
    log: console.log,
    remove: removeCoverageTemporaryDirectory,
    environment: process.env,
  };

/** Git-known authored files, captured without consulting a post-run report. */
export const coverageSnapshotCandidates = (root: string): string[] => {
  const list = (arguments_: string[]): string[] => {
    const result = spawnSync("git", arguments_, {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    if (result.status !== 0)
      throw new Error(`git ${arguments_.join(" ")} failed while snapshotting`);
    return result.stdout
      .split("\0")
      .filter((entry) => entry.length !== 0)
      .map((entry) => entry.replaceAll("\\", "/"));
  };
  return [
    ...new Set([
      ...list(["ls-files", "-z"]),
      ...list(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ].sort((left, right) => Number(left > right) - Number(left < right));
};

export const captureRepositoryCoverageSnapshot = (
  root: string,
): Record<string, IMeasuredSource> =>
  captureCoverageSnapshot({
    candidates: coverageSnapshotCandidates(root),
    root,
  });

/**
 * Which sources the instrument takes, and which it leaves alone.
 *
 * Spelled once for the two spawns that need it -- the run and the report --
 * because it is the half that can be wrong on its own and it was written out
 * twice. The population gate exists to catch this list disagreeing with
 * `isAuthoredExecutableSource`, and it caught exactly that: the judging half
 * learned a lint config is a declaration and this half did not, so c8 kept
 * instrumenting `packages/render/lint.config.ts` and nothing judged it. A list
 * with two spellings has two places to drift from.
 *
 * The spawns around it launch the suite, so nothing in the suite can run them.
 * The list lived where no test could read it, which is how it drifted.
 */
export const coverageInstrumentPopulation = (): string[] => [
  ...SOURCES.flatMap((source) => ["--src", source]),
  ...INCLUDES.flatMap((include) => ["--include", include]),
  "--exclude",
  "**/index.ts",
  "--exclude",
  "**/bin.ts",
  ...UNMEASURED_SOURCE_ROOTS.flatMap((root) => ["--exclude", `${root}**`]),
  "--exclude",
  "packages/*/build/**",
  ...UNJUDGED_DECLARATION_GLOBS.flatMap((glob) => ["--exclude", glob]),
  "--extension",
  ".ts",
  "--extension",
  ".tsx",
  "--extension",
  ".cts",
  "--extension",
  ".mts",
];

export const measureCoverage = (
  dependencies: ICoverageMeasurementDependencies,
): ICoverageMeasurementResult => {
  const paths = dependencies.runPaths();
  const temporary = paths.rawDirectory;
  let publication: ICoveragePublication | undefined;
  try {
    const snapshot = Object.freeze(
      Object.fromEntries(
        Object.entries(dependencies.captureSnapshot()).map(([file, source]) => [
          file,
          Object.freeze({ ...source }),
        ]),
      ),
    );
    dependencies.mkdir(temporary, { recursive: true });
    dependencies.mkdir(paths.reportDirectory, { recursive: true });
    const result = dependencies.spawn(
      process.execPath,
      [
        path.join(ROOT, "test", "node_modules", "c8", "bin", "c8.js"),
        "--all",
        "--exclude-after-remap",
        ...coverageInstrumentPopulation(),
        "--temp-directory",
        temporary,
        "--reports-dir",
        paths.reportDirectory,
        "--reporter=text",
        "--reporter=text-summary",
        "--reporter=json",
        // The launcher's own entry rather than the `.bin` shim: a shim is a shell
        // script on POSIX and a `.cmd` on Windows, and neither is executable
        // without a shell, which this spawn deliberately does not open.
        process.execPath,
        path.join(
          ROOT,
          "test",
          "node_modules",
          "ttsc",
          "lib",
          "launcher",
          "ttsx.js",
        ),
        "-P",
        "test/tsconfig.json",
        "test/src/index.ts",
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
        shell: false,
        env: {
          ...dependencies.environment,
        },
      },
    );
    if (result.error !== undefined) {
      dependencies.log(
        `INSTRUMENT FAILURE: coverage process could not start: ${result.error.message}`,
      );
      return { status: 2 };
    }
    // Printed because the report alone cannot say whether a low number means
    // little ran or little was counted. This suite's total is bimodal -- about
    // 83.6% or about 56.3%, on either platform, with an identical denominator
    // and every test passing either way -- and the first reading of this line
    // settled which half of that it is: a good run and a bad run both wrote
    // 179 records. Nothing failed to flush; a third of the coverage is on disk
    // and does not reach the total. The remaining numbers separate a record
    // caught mid-write from a merge that drops complete ones, and they cost one
    // directory read on a step that already took minutes.
    // Correct the merge before anything reads it. c8 writes one entry per
    // source path, and when two processes saw one source in two emitted forms
    // that entry is worse than the better of the two -- measured here at 90.93
    // percent where the two groups alone read 100 and 32.56. The snapshot and
    // the gate both consume this report, so the correction comes first.
    const reconciliation = dependencies.reconcile(
      temporary,
      paths.reportDirectory,
    );
    if (reconciliation.failure !== null) {
      dependencies.log(`INSTRUMENT FAILURE: ${reconciliation.failure}`);
      return { status: 2 };
    }
    // A file the union wrote worse than a reading it was given is the union
    // losing, and it used to be indistinguishable from a file nothing covered.
    for (const shortfall of reconciliation.shortfalls ?? [])
      dependencies.log(
        `UNION SHORTFALL: ${shortfall.file} lost ${shortfall.lost.length} covered ${shortfall.lost.length === 1 ? "position" : "positions"} a reading had (${shortfall.lost.slice(0, 12).join(", ")})`,
      );
    dependencies.log(
      `coverage groups: ${reconciliation.groups} shape-consistent record ` +
        (reconciliation.groups === 1
          ? "group, so the merge had nothing to lose"
          : "groups, report corrected to the fullest reading of each file"),
    );
    const records = dependencies.records(temporary);
    const scripts = dependencies.missingScripts(temporary);
    dependencies.log(
      `coverage records: ${records.count} files, ${records.parsed} parsable, ` +
        `${records.results} script entries, ${records.bytes} bytes in ${temporary}`,
    );
    dependencies.log(
      `coverage scripts: ${scripts.urls} distinct file URLs, ` +
        `${scripts.missing} of them gone from disk at report time, ` +
        `${scripts.measured.length} of those a measured source`,
    );
    // A vanished measured source is a reading of charged code that c8 dropped
    // because it could not read the file to place the ranges. Named, because a
    // count of them is exactly as unusable as the count they came from.
    for (const url of scripts.measured)
      dependencies.log(`MEASURED SOURCE GONE AT REPORT TIME: ${url}`);
    // Which measured sources no process ever loaded. `--all` reports every
    // include match, so a zero-percent file is either untested or ran somewhere
    // the report could not follow, and only the records tell them apart.
    const never = dependencies.neverRecorded(temporary, paths.reportDirectory);
    dependencies.log(
      `coverage never loaded: ${never.length} measured ${never.length === 1 ? "source was" : "sources were"} in no record`,
    );
    for (const file of never)
      dependencies.log(`NO PROCESS LOADED: ${slashOf(file)}`);
    const shapes = dependencies.scriptShapes(temporary);
    dependencies.log(
      `coverage shapes: ${shapes.reread} scripts were read by more than one ` +
        `process, ${shapes.disagreeing} of those in more than one shape` +
        (shapes.sample.length === 0 ? "" : ` (${shapes.sample.join(", ")})`),
    );
    const status = decideCoverageMeasurementStatus({
      child: result,
      missingMeasuredSources: scripts.measured.length,
      records,
      reconciliationFailure: reconciliation.failure,
      unionShortfalls: reconciliation.shortfalls?.length ?? 0,
    });
    if (status === 2) return { status };
    const inspected = inspectCoverageSnapshot({
      current: dependencies.currentSnapshot(),
      reportFiles: dependencies.reportFiles(paths.reportDirectory),
      snapshot,
    });
    for (const failure of inspected.failures)
      dependencies.log(`INSTRUMENT FAILURE: ${failure}`);
    if (inspected.failures.length !== 0) return { status: 2 };
    if (status === 1) return { status };
    publication = dependencies.publish(
      paths.reportDirectory,
      inspected.published,
    );
    return { publication, status: 0 };
  } catch (error) {
    dependencies.log(
      `INSTRUMENT FAILURE: coverage publication failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { status: 2 };
  } finally {
    dependencies.remove(temporary);
    if (publication === undefined) dependencies.remove(paths.rootDirectory);
  }
};
