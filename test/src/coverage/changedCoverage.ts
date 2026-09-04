import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { describeThrown } from "../integrity/contractOwnership";
import {
  type IInheritedGaps,
  changedOrder,
  describeInheritedGaps,
  inheritedGapsAreEmpty,
  spanIsDemanded,
} from "./changedLineDemand";
import {
  type ICoveragePosition,
  type ICoverageSpan,
  type IMeasuredSource,
  canonicalCoveragePath,
  functionIdentity,
  isAuthoredExecutableSource,
} from "./coverageIdentity";
import {
  type ICoveragePublication,
  loadCoveragePublication,
  publicationReport,
} from "./coveragePublication";
import {
  emitsNoExecutableStatement,
  excuseNonExecutableGaps,
  repositoryEmitProbe,
} from "./executableEmission";
import {
  branchGapIsReal,
  functionGapIsReal,
  positionsPastEndOfFile,
} from "./reportCoverageGaps";

export {
  UNJUDGED_DECLARATION_GLOBS,
  UNMEASURED_SOURCE_ROOTS,
  isAuthoredExecutableSource,
} from "./coverageIdentity";

export type { ICoveragePosition, ICoverageSpan, IMeasuredSource };

export interface IIstanbulFileCoverage {
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
  path?: string;
  s?: Record<string, number>;
  statementMap?: Record<string, ICoverageSpan>;
}

export interface ICoverageMetric {
  covered: number;
  total: number;
}

export interface ICoverageTotals {
  branches: ICoverageMetric;
  functions: ICoverageMetric;
  lines: ICoverageMetric;
  statements: ICoverageMetric;
}

export interface IChangedCoverageInspection {
  /** Files whose entries disagree about their own shape, and by how much. */
  disagreements: string[];
  files: Array<{ file: string; totals: ICoverageTotals }>;
  gaps: string[];
  /** Excused populations, one line per file that carries one. */
  inherited: string[];
  instrumentFailures: string[];
  totals: ICoverageTotals;
}

export interface IChangedFiles {
  base: string;
  divergent: string[];
  files: Map<string, Set<number>>;
  mergeBase: string;
  staged: number;
  untracked: number;
  wholeFiles: Set<string>;
  worktree: number;
}

export interface IGitExecutionResult {
  error?: Error;
  status: number | null;
  stderr: string;
  stdout: string;
}

export type GitExecute = (
  executable: string,
  arguments_: string[],
  options: {
    cwd: string;
    encoding: "utf8";
    maxBuffer: number;
    shell: false;
  },
) => IGitExecutionResult;

const executeGit: GitExecute = (executable, arguments_, options) =>
  spawnSync(executable, arguments_, options);
type Metric = keyof ICoverageTotals;
type Writer = (line: string) => void;

const slash = (value: string): string => value.replaceAll("\\", "/");
const canonical = canonicalCoveragePath;

const diffPath = (line: string): string | null => {
  const encoded = line.slice(4).split("\t", 1)[0];
  if (encoded === "/dev/null") return null;
  if (encoded.startsWith('"') && encoded.endsWith('"')) {
    let decoded;
    try {
      decoded = JSON.parse(encoded);
    } catch {
      decoded = encoded.slice(1, -1);
    }
    return slash(decoded.replace(/^b\//u, ""));
  }
  return slash(encoded.replace(/^b\//u, ""));
};

/** Parse the new-side lines from a zero-context unified diff. */
export const parseChangedLines = (diff: string): Map<string, Set<number>> => {
  const files = new Map<string, Set<number>>();
  let current: string | null = null;
  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith("+++ ")) {
      current = diffPath(line);
      if (current !== null && files.has(current) === false)
        files.set(current, new Set());
      continue;
    }
    if (current === null || line.startsWith("@@ ") === false) continue;
    const hunk = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (hunk === null) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let index = 0; index < count; index++)
      files.get(current)!.add(start + index);
  }
  return files;
};

export const runGit = (
  root: string,
  arguments_: string[],
  execute: GitExecute = executeGit,
): string => {
  const result = execute("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `git ${arguments_.join(" ")} failed: ${result.stderr.trim()}`,
    );
  return result.stdout;
};

const existingRef = (root: string, reference: string): boolean => {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", "--quiet", `${reference}^{commit}`],
    { cwd: root, encoding: "utf8", shell: false },
  );
  return result.status === 0;
};

/** Resolve the explicit or CI/local default comparison base. */
export const resolveCoverageBase = (
  root: string,
  explicit: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): string => {
  const candidates = [
    explicit,
    environment.AUTOMOVIE_COVERAGE_BASE,
    environment.GITHUB_BASE_REF === undefined
      ? undefined
      : `origin/${environment.GITHUB_BASE_REF}`,
    "origin/master",
    "master",
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length !== 0,
  );
  for (const candidate of candidates)
    if (existingRef(root, candidate)) return candidate;
  throw new Error(
    `no coverage comparison base exists; pass --base <ref> or set AUTOMOVIE_COVERAGE_BASE`,
  );
};

const nulSet = (output: string): Set<string> =>
  new Set(
    output
      .split("\0")
      .filter((entry) => entry.length !== 0)
      .map(slash),
  );

/**
 * Collect committed, index, worktree, and untracked changes as one final-tree
 * population. A file changed in both index and worktree is refused because one
 * coverage snapshot cannot certify the two different byte sequences.
 */
export const collectGitChangedLines = (
  root: string,
  base: string,
): IChangedFiles => {
  const mergeBase = runGit(root, ["merge-base", base, "HEAD"]).trim();
  const diff = runGit(root, [
    "-c",
    "core.quotepath=false",
    "diff",
    "--no-ext-diff",
    "--no-renames",
    "--no-color",
    "--unified=0",
    mergeBase,
    "--",
  ]);
  const files = parseChangedLines(diff);
  const staged = nulSet(
    runGit(root, ["diff", "--cached", "--name-only", "-z", "--"]),
  );
  const worktree = nulSet(runGit(root, ["diff", "--name-only", "-z", "--"]));
  const untracked = nulSet(
    runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]),
  );
  const wholeFiles = new Set<string>();
  for (const relative of untracked) {
    files.set(relative, new Set());
    if (isAuthoredExecutableSource(relative)) wholeFiles.add(relative);
  }
  const divergent = [...staged].filter(
    (relative) =>
      worktree.has(relative) && isAuthoredExecutableSource(relative),
  );
  return {
    base,
    mergeBase,
    files,
    staged: staged.size,
    worktree: worktree.size,
    untracked: untracked.size,
    wholeFiles,
    divergent,
  };
};

const sourceHash = (file: string): string =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const indexed = <T>(record: Record<string, T>): Map<string, T> =>
  new Map(
    Object.entries(record).map(([file, value]) => [canonical(file), value]),
  );

/** Inspect every executable location in each touched source file. */
export const inspectChangedCoverage = (props: {
  coverage: Record<string, IIstanbulFileCoverage>;
  divergent: string[];
  files: Map<string, Set<number>>;
  measuredSources: Record<string, unknown>;
  root: string;
  wholeFiles?: ReadonlySet<string>;
}): IChangedCoverageInspection => {
  const coverage = indexed(props.coverage);
  const measured = indexed(props.measuredSources);
  const disagreements: string[] = [];
  const instrumentFailures = [...props.divergent].map(
    (file) =>
      `${file}: index and worktree contain different snapshots; stage the final file or restore one side before measuring`,
  );
  const gaps = [];
  const inherited: string[] = [];
  const createTotals = (): ICoverageTotals => ({
    statements: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
  });
  const totals = createTotals();
  const files: Array<{ file: string; totals: ICoverageTotals }> = [];

  for (const [relative, lines] of [...props.files].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (isAuthoredExecutableSource(relative) === false) continue;
    const file = path.resolve(props.root, relative);
    if (fs.existsSync(file) === false) continue;
    const key = canonical(file);
    const data = coverage.get(key);
    const snapshot = measured.get(key);
    if (data === undefined) {
      instrumentFailures.push(
        `${relative}: changed measured source is absent from coverage-final.json`,
      );
      continue;
    }
    if (
      typeof snapshot !== "object" ||
      snapshot === null ||
      !("lines" in snapshot) ||
      typeof snapshot.lines !== "number" ||
      !("sha256" in snapshot) ||
      typeof snapshot.sha256 !== "string"
    ) {
      instrumentFailures.push(
        `${relative}: exact measured-source snapshot is absent`,
      );
      continue;
    }
    if (sourceHash(file) !== snapshot.sha256) {
      instrumentFailures.push(
        `${relative}: coverage report predates the current source bytes`,
      );
      continue;
    }
    const outside = positionsPastEndOfFile(data, snapshot.lines);
    if (outside !== 0) {
      instrumentFailures.push(
        `${relative}: ${outside} coverage position${outside === 1 ? " lies" : "s lie"} past the measured source`,
      );
      continue;
    }
    const fileTotals = createTotals();
    const order = changedOrder(lines);
    const wholeFile = props.wholeFiles?.has(relative) === true;
    const inheritedGaps: IInheritedGaps = {
      branches: 0,
      functions: 0,
      statements: 0,
    };
    const count = (metric: Metric, covered: boolean): void => {
      totals[metric].total++;
      fileTotals[metric].total++;
      if (covered) {
        totals[metric].covered++;
        fileTotals[metric].covered++;
      }
    };

    const lineHits = new Map();
    for (const [id, span] of Object.entries(data.statementMap ?? {})) {
      const line = span?.start?.line;
      const hits = data.s?.[id] ?? 0;
      if (spanIsDemanded({ order, span, wholeFile }) === false) {
        if (hits === 0) inheritedGaps.statements++;
        continue;
      }
      count("statements", hits > 0);
      if (hits === 0)
        gaps.push(
          `${relative}:${typeof line === "number" ? line : "?"} uncovered statement`,
        );
      if (typeof line === "number")
        lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
    }
    for (const [line, hits] of lineHits) {
      count("lines", hits > 0);
      if (hits === 0) gaps.push(`${relative}:${line} uncovered line`);
    }

    // A zero function entry whose name already ran under another entry in the
    // same file is a second reading of one function, not an untested one, and
    // an entry naming something the file does not contain is a helper the
    // transpile emitted. `reportCoverageGaps` has told the historical reader
    // this since it was written -- measured there at 137 and 13 entries -- and
    // the gate was counting both as debt.
    //
    // Both readings arrive together when one source is loaded in two shapes:
    // measured here, adding a single test that runs a generated child against
    // the built package moved `builtEnvironment.ts` from 94 function entries to
    // 116 while its statement total did not change. Dropping the artifacts
    // takes them out of the numerator and the denominator alike, and the count
    // is reported rather than absorbed, because a gate that silently stops
    // counting something reads the same as one that counted it and was
    // satisfied.
    // Read plainly rather than defensively: the snapshot comparison above has
    // already read this file, so a guard here would be an alternative nothing
    // can reach and could only be covered by pretending.
    const text = fs.readFileSync(file, "utf8");
    const sourceLines = text.split("\n");
    const ranFunctions = new Set(
      Object.entries(data.fnMap ?? {})
        .filter(([id]) => (data.f?.[id] ?? 0) > 0)
        .map(([, entry]) => functionIdentity(entry))
        .filter((identity): identity is string => identity !== null),
    );
    let secondReadings = 0;
    for (const [id, entry] of Object.entries(data.fnMap ?? {})) {
      const covered = (data.f?.[id] ?? 0) > 0;
      // The artifact question comes before the demand question. A second
      // reading of a function that ran is not a gap on any line, so asking
      // first whether the change occupies it would file an instrument artifact
      // as inherited debt: a number somebody could later be asked to pay down,
      // for code that is already tested.
      if (
        covered === false &&
        functionGapIsReal({
          covered: ranFunctions,
          definition: entry,
          text,
        }) === false
      ) {
        secondReadings++;
        continue;
      }
      if (
        spanIsDemanded({
          order,
          span: entry?.loc ?? entry?.decl,
          wholeFile,
        }) === false
      ) {
        if (covered === false) inheritedGaps.functions++;
        continue;
      }
      count("functions", covered);
      if (covered === false)
        gaps.push(
          `${relative}:${entry?.loc?.start?.line ?? "?"} uncovered function ${entry?.name ?? "(anonymous)"}`,
        );
    }
    if (secondReadings !== 0)
      disagreements.push(
        `${relative}: ${secondReadings} function ${secondReadings === 1 ? "entry is" : "entries are"} a second reading of a function that ran, not an untested one`,
      );

    let artifactBranches = 0;
    for (const [id, entry] of Object.entries(data.branchMap ?? {})) {
      const locations = entry?.locations ?? [];
      const hits = data.b?.[id] ?? [];
      for (const [index, location] of locations.entries()) {
        const covered = (hits[index] ?? 0) > 0;
        // Artifact before demand, for the reason the function loop above
        // states: an instrument artifact sitting on a line this change did not
        // touch would otherwise be filed as inherited debt, a number somebody
        // could later be asked to pay down for a branch nobody wrote.
        if (
          covered === false &&
          branchGapIsReal({
            source: sourceLines,
            span: location ?? entry?.loc,
          }) === false
        ) {
          artifactBranches++;
          continue;
        }
        if (
          spanIsDemanded({
            order,
            span: location ?? entry?.loc,
            wholeFile,
          }) === false
        ) {
          if (covered === false) inheritedGaps.branches++;
          continue;
        }
        count("branches", covered);
        if (covered === false)
          gaps.push(
            `${relative}:${location?.start?.line ?? "?"} uncovered branch ${entry?.type ?? "branch"}[${index}]`,
          );
      }
    }
    if (artifactBranches !== 0)
      disagreements.push(
        `${relative}: ${artifactBranches} branch ${artifactBranches === 1 ? "location covers" : "locations cover"} nothing but whitespace, which is a position the instrument invented rather than a branch this file has`,
      );
    if (inheritedGapsAreEmpty(inheritedGaps) === false)
      inherited.push(
        describeInheritedGaps({ file: relative, gaps: inheritedGaps }),
      );
    files.push({ file: relative, totals: fileTotals });
  }
  return {
    totals,
    files,
    gaps,
    inherited,
    instrumentFailures,
    disagreements,
  };
};

/** Print a human-readable changed-coverage verdict. */
export const reportChangedCoverage = (
  changes: IChangedFiles,
  result: IChangedCoverageInspection,
  write: Writer = console.log,
): void => {
  write(
    `Changed coverage base ${changes.base} (${changes.mergeBase}); local population: ${changes.staged} staged, ${changes.worktree} worktree, ${changes.untracked} untracked paths.`,
  );
  write(
    `Changed-line executable coverage: statements ${result.totals.statements.covered}/${result.totals.statements.total}, branches ${result.totals.branches.covered}/${result.totals.branches.total}, functions ${result.totals.functions.covered}/${result.totals.functions.total}, lines ${result.totals.lines.covered}/${result.totals.lines.total}.`,
  );
  for (const entry of result.files)
    write(
      `${entry.file}: statements ${entry.totals.statements.covered}/${entry.totals.statements.total}, branches ${entry.totals.branches.covered}/${entry.totals.branches.total}, functions ${entry.totals.functions.covered}/${entry.totals.functions.total}, lines ${entry.totals.lines.covered}/${entry.totals.lines.total}.`,
    );
  for (const line of result.inherited) write(line);
  for (const disagreement of result.disagreements)
    write(`INSTRUMENT DISAGREEMENT: ${disagreement}`);
  for (const gap of result.gaps) write(`COVERAGE GAP: ${gap}`);
  for (const failure of result.instrumentFailures)
    write(`INSTRUMENT FAILURE: ${failure}`);
};

export const parseChangedCoverageArguments = (
  arguments_: string[],
): { base?: string; reportDirectory?: string; root?: string } => {
  const options: { base?: string; reportDirectory?: string; root?: string } =
    {};
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    const key =
      argument === "--base"
        ? "base"
        : argument === "--root"
          ? "root"
          : argument === "--report-directory"
            ? "reportDirectory"
            : undefined;
    if (key === undefined) throw new Error(`unknown argument '${argument}'`);
    if (options[key] !== undefined || arguments_[index + 1] === undefined)
      throw new Error(`${argument} requires exactly one value`);
    options[key] = arguments_[++index];
  }
  return options;
};

const readJson = (file: string, label: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} could not be read at ${file}: ${describeThrown(error)}`,
    );
  }
};

export const runChangedCoverageGate = (
  arguments_: string[],
  publication?: ICoveragePublication,
  environment: NodeJS.ProcessEnv = process.env,
  write: Writer = console.log,
): number => {
  try {
    const options = parseChangedCoverageArguments(arguments_);
    const root = path.resolve(
      options.root ?? path.resolve(__dirname, "../../.."),
    );
    if (publication !== undefined && options.reportDirectory !== undefined)
      throw new Error(
        "--report-directory cannot replace an explicit run publication",
      );
    let owned = publication;
    if (owned === undefined) {
      if (options.reportDirectory === undefined)
        throw new Error(
          "changed coverage requires an explicit run publication or --report-directory",
        );
      owned = loadCoveragePublication(path.resolve(options.reportDirectory));
    }
    const base = resolveCoverageBase(root, options.base, environment);
    const changes = collectGitChangedLines(root, base);
    const coverage = readJson(
      publicationReport(owned),
      "coverage report",
    ) as Record<string, IIstanbulFileCoverage>;
    const measuredSources = owned.sources;
    const result = inspectChangedCoverage({
      root,
      files: changes.files,
      divergent: changes.divergent,
      coverage,
      measuredSources,
      wholeFiles: changes.wholeFiles,
    });
    const probe = repositoryEmitProbe({
      compilerRoot: path.resolve(__dirname, "../../.."),
      root,
      spawn: spawnSync,
    });
    const outDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-coverage-emit-"),
    );
    let judged;
    try {
      judged = excuseNonExecutableGaps({
        gaps: result.gaps,
        isNonExecutable: (file) =>
          emitsNoExecutableStatement({ file, outDirectory, probe }),
      });
    } finally {
      fs.rmSync(outDirectory, { recursive: true, force: true });
    }
    reportChangedCoverage(changes, { ...result, gaps: judged.gaps }, write);
    for (const file of judged.excused)
      write(
        `NOT EXECUTABLE: ${file} emits no statement of its own, so it owes no coverage`,
      );
    if (result.instrumentFailures.length !== 0) return 2;
    if (judged.gaps.length !== 0) return 1;
    return 0;
  } catch (error) {
    write(`INSTRUMENT FAILURE: ${describeThrown(error)}`);
    return 2;
  }
};
