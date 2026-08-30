import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { COVERAGE_REPORT_DIRECTORY, MEASURED_SOURCES } from "./measureCoverage";
import { positionsPastEndOfFile } from "./reportCoverageGaps";

const SOURCE_EXTENSION = /\.(?:[cm]?ts|tsx)$/u;

export interface ICoveragePosition {
  column?: number;
  line?: number;
}

export interface ICoverageSpan {
  end?: ICoveragePosition;
  start?: ICoveragePosition;
}

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

export interface IMeasuredSource {
  lines: number;
  sha256: string;
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
  files: Array<{ file: string; totals: ICoverageTotals }>;
  gaps: string[];
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
const canonical = (value: string): string => slash(path.resolve(value));

/**
 * Whether a repository path is authored executable source owed coverage.
 *
 * The two typed repository-tool roots are named because both sit under `test/`,
 * which the ordinary rule removes: they are tools this repository runs against
 * itself rather than scenarios, and `measureCoverage` measures them for exactly
 * that reason. The exemption has to cover the directory-name rule as well as the
 * `test/` one, because `test/src/coverage/` also contains the segment `coverage`
 * that names c8's own output directory. It did not: `test/src/integrity/**` was
 * admitted and `test/src/coverage/**` was silently refused, so the four modules
 * that implement the per-change 100% obligation were the only measured sources
 * the obligation never applied to. They are measured (the whole-suite report
 * carries all four, three of them below 100%) and they were unjudged, which is
 * the one shape where a gate can be edited freely while reporting green.
 *
 * The directory names that stay unconditional are the ones no authored source
 * ever legitimately sits under.
 */
export const isAuthoredExecutableSource = (relative: string): boolean => {
  const target = slash(relative);
  const typedRepositoryTool =
    target.startsWith("test/src/coverage/") ||
    target.startsWith("test/src/integrity/");
  if (
    SOURCE_EXTENSION.test(target) === false ||
    /\.d\.[cm]?ts$/u.test(target) ||
    (typedRepositoryTool === false &&
      (/(^|\/)(?:test|tests|__tests__|fixtures)(\/|$)/u.test(target) ||
        /(^|\/)coverage(\/|$)/u.test(target))) ||
    /(^|\/)(?:node_modules|dist|generated|\.cache)(\/|$)/u.test(target) ||
    /(?:\.test|\.spec|\.generated)\.[cm]?[jt]sx?$/u.test(target) ||
    /(^|\/)(?:index|bin)\.ts$/u.test(target)
  )
    return false;
  return true;
};

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
  for (const relative of untracked) {
    files.set(relative, new Set());
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
}): IChangedCoverageInspection => {
  const coverage = indexed(props.coverage);
  const measured = indexed(props.measuredSources);
  const instrumentFailures = [...props.divergent].map(
    (file) =>
      `${file}: index and worktree contain different snapshots; stage the final file or restore one side before measuring`,
  );
  const gaps = [];
  const createTotals = (): ICoverageTotals => ({
    statements: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
  });
  const totals = createTotals();
  const files: Array<{ file: string; totals: ICoverageTotals }> = [];

  for (const [relative] of [...props.files].sort(([left], [right]) =>
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

    for (const [id, entry] of Object.entries(data.fnMap ?? {})) {
      const covered = (data.f?.[id] ?? 0) > 0;
      count("functions", covered);
      if (covered === false)
        gaps.push(
          `${relative}:${entry?.loc?.start?.line ?? "?"} uncovered function ${entry?.name ?? "(anonymous)"}`,
        );
    }

    for (const [id, entry] of Object.entries(data.branchMap ?? {})) {
      const locations = entry?.locations ?? [];
      const hits = data.b?.[id] ?? [];
      for (const [index, location] of locations.entries()) {
        const covered = (hits[index] ?? 0) > 0;
        count("branches", covered);
        if (covered === false)
          gaps.push(
            `${relative}:${location?.start?.line ?? "?"} uncovered branch ${entry?.type ?? "branch"}[${index}]`,
          );
      }
    }
    files.push({ file: relative, totals: fileTotals });
  }
  return { totals, files, gaps, instrumentFailures };
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
    `Changed-file executable coverage: statements ${result.totals.statements.covered}/${result.totals.statements.total}, branches ${result.totals.branches.covered}/${result.totals.branches.total}, functions ${result.totals.functions.covered}/${result.totals.functions.total}, lines ${result.totals.lines.covered}/${result.totals.lines.total}.`,
  );
  for (const entry of result.files)
    write(
      `${entry.file}: statements ${entry.totals.statements.covered}/${entry.totals.statements.total}, branches ${entry.totals.branches.covered}/${entry.totals.branches.total}, functions ${entry.totals.functions.covered}/${entry.totals.functions.total}, lines ${entry.totals.lines.covered}/${entry.totals.lines.total}.`,
    );
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
      `${label} could not be read at ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const runChangedCoverageGate = (
  arguments_: string[],
  environment: NodeJS.ProcessEnv = process.env,
  write: Writer = console.log,
): number => {
  try {
    const options = parseChangedCoverageArguments(arguments_);
    const root = path.resolve(
      options.root ?? path.resolve(__dirname, "../../.."),
    );
    const reportDirectory = path.resolve(
      options.reportDirectory ?? COVERAGE_REPORT_DIRECTORY,
    );
    const base = resolveCoverageBase(root, options.base, environment);
    const changes = collectGitChangedLines(root, base);
    const coverage = readJson(
      path.join(reportDirectory, "coverage-final.json"),
      "coverage report",
    ) as Record<string, IIstanbulFileCoverage>;
    const measuredSources = readJson(
      path.join(reportDirectory, MEASURED_SOURCES),
      "measured-source snapshot",
    ) as Record<string, unknown>;
    const result = inspectChangedCoverage({
      root,
      files: changes.files,
      divergent: changes.divergent,
      coverage,
      measuredSources,
    });
    reportChangedCoverage(changes, result, write);
    if (result.instrumentFailures.length !== 0) return 2;
    if (result.gaps.length !== 0) return 1;
    return 0;
  } catch (error) {
    write(
      `INSTRUMENT FAILURE: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
};
