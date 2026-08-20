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
// So the temporary directory is per-run and removed afterwards. The report
// directory stays where it is, because `report-coverage-gaps.mjs` and CI both
// resolve that exact path; a concurrent run therefore still overwrites the
// report, which is last-writer-wins rather than corruption — the file is one
// run's complete result instead of a mixture of two.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lineCount } from "./report-coverage-gaps.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "node_modules", ".cache");
const REPORT = path.join(CACHE, "automovie-c8-report");

/**
 * One run's own scratch directory, exported so the invariant can be tested.
 *
 * The process id alone is not enough. It is recycled, and a run killed before
 * its cleanup leaves a directory behind for whichever later process happens to
 * draw the same number — which is the stale-merge half of the same defect, and
 * would reappear the first time a run were interrupted. The random suffix is
 * what makes two calls distinct even inside one process, which is the property
 * `test_workspace_coverage_isolation` actually measures.
 */
export const coverageTemporaryDirectory = () =>
  path.join(CACHE, "automovie-c8", `${process.pid}-${crypto.randomUUID()}`);

/**
 * How many per-process coverage records a run left in its own directory.
 *
 * Counts the files V8 writes, one per process that exited under the collector,
 * and nothing else: the directory is this run's alone, so anything that is not
 * a record is not part of this measurement.
 */
export const coverageRecordCount = (directory) =>
  coverageRecords(directory).count;

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
export const coverageMissingScripts = (directory) => {
  const urls = new Set();
  let entries;
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return { urls: 0, missing: 0 };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(directory, entry), "utf8"));
    } catch {
      continue;
    }
    for (const script of Array.isArray(record.result) ? record.result : [])
      if (typeof script.url === "string" && script.url.startsWith("file:"))
        urls.add(script.url);
  }
  let missing = 0;
  for (const url of urls) {
    let target;
    try {
      target = fileURLToPath(url);
    } catch {
      // A URL this cannot resolve is not a file this can look for, and saying
      // so as an absence would be a guess rather than a reading.
      continue;
    }
    if (fs.existsSync(target) === false) missing++;
  }
  return { urls: urls.size, missing };
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
export const coverageScriptShapes = (directory, roots = SOURCES) => {
  const measured = (url) => {
    const target = url.replace(/^file:[/]{3}/u, "").replace(/[/]/gu, "/");
    return roots.some((root) =>
      target.toLowerCase().includes(root.toLowerCase()),
    );
  };
  const shapes = new Map();
  let entries;
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return { urls: 0, reread: 0, disagreeing: 0, sample: [] };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(directory, entry), "utf8"));
    } catch {
      continue;
    }
    for (const script of Array.isArray(record.result) ? record.result : []) {
      if (
        typeof script.url !== "string" ||
        script.url.startsWith("file:") === false ||
        measured(script.url) === false
      )
        continue;
      const shape = (Array.isArray(script.functions) ? script.functions : [])
        .map(
          (fn) =>
            `${fn.functionName ?? ""}:${fn.ranges?.[0]?.startOffset ?? -1}`,
        )
        .sort()
        .join(",");
      const seen = shapes.get(script.url) ?? { count: 0, forms: new Set() };
      seen.count += 1;
      seen.forms.add(shape);
      shapes.set(script.url, seen);
    }
  }
  let reread = 0;
  let disagreeing = 0;
  const sample = [];
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

export const coverageRecords = (directory) => {
  let count = 0;
  let bytes = 0;
  let parsed = 0;
  let results = 0;
  let entries;
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
const SOURCES = [
  "packages/archetypes/src",
  "packages/cli/src",
  "packages/engine/src",
  "packages/face/src",
  "packages/ingest/src",
  "packages/render",
  "packages/viewer/src",
  "packages/mcp/src",
];

const INCLUDES = [
  "packages/archetypes/src/**",
  "packages/cli/src/loadAutoMovieProjectState.ts",
  "packages/engine/src/**",
  "packages/face/src/**",
  "packages/ingest/src/**",
  "packages/render/src/**",
  "packages/render/gltfTransformCore.cjs",
  "packages/viewer/src/**",
  "packages/mcp/src/**",
];

/** Where a run records how long each measured file was while it was measured. */
export const MEASURED_LINES = "measured-lines.json";

/**
 * Record every measured file's line count beside the report that names it.
 *
 * An Istanbul report carries positions and no way to say which content they were
 * taken from — the per-file entry holds `path`, the maps and the counts, and no
 * hash. So a reader asking "does this position exist in the file?" is asking
 * about whatever the file has since become, and a guard built on that answer
 * blames the instrument for an ordinary edit. Measured on this repository: one
 * commit that shortened a file by 23 lines made 26 positions read as past its
 * end, none of which was a fault.
 *
 * Written here because this is the one moment the sources on disk are the
 * sources just measured. A missing entry is a file the reader must not judge.
 *
 * The length itself is {@link lineCount}'s to define, and it is defined beside
 * the reader because that is where the reason lives: a file ending in a newline
 * splits into one more piece than it has lines, and the reader's check is exact
 * or it is nothing. Two copies of that arithmetic is how a writer and a reader
 * stop agreeing about what a length is.
 */
export const writeMeasuredLines = () => {
  const report = path.join(REPORT, "coverage-final.json");
  let coverage;
  try {
    coverage = JSON.parse(fs.readFileSync(report, "utf8"));
  } catch {
    // No report, nothing to describe. The reader already says so in its own
    // words when the report is absent.
    return;
  }
  const lines = {};
  for (const file of Object.keys(coverage)) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    lines[file] = lineCount(text);
  }
  fs.writeFileSync(
    path.join(REPORT, MEASURED_LINES),
    `${JSON.stringify(lines, null, 2)}
`,
    "utf8",
  );
};

/**
 * Measure once, into a directory this run alone owns.
 *
 * Guarded so importing this module to read its path rule does not launch the
 * whole suite. `test_workspace_coverage_isolation` does exactly that.
 */
const measure = () => {
  const temporary = coverageTemporaryDirectory();
  fs.mkdirSync(temporary, { recursive: true });
  try {
    const result = spawnSync(
      process.execPath,
      [
        path.join(ROOT, "test", "node_modules", "c8", "bin", "c8.js"),
        "--all",
        ...SOURCES.flatMap((source) => ["--src", source]),
        ...INCLUDES.flatMap((include) => ["--include", include]),
        "--exclude",
        "**/index.ts",
        "--exclude",
        "**/bin.ts",
        "--extension",
        ".ts",
        "--extension",
        ".cjs",
        "--temp-directory",
        temporary,
        "--reports-dir",
        REPORT,
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
      { cwd: ROOT, stdio: "inherit", shell: false },
    );
    if (result.error !== undefined) throw result.error;
    // Printed because the report alone cannot say whether a low number means
    // little ran or little was counted. This suite's total is bimodal -- about
    // 83.6% or about 56.3%, on either platform, with an identical denominator
    // and every test passing either way -- and the first reading of this line
    // settled which half of that it is: a good run and a bad run both wrote
    // 179 records. Nothing failed to flush; a third of the coverage is on disk
    // and does not reach the total. The remaining numbers separate a record
    // caught mid-write from a merge that drops complete ones, and they cost one
    // directory read on a step that already took minutes.
    writeMeasuredLines();
    const records = coverageRecords(temporary);
    const scripts = coverageMissingScripts(temporary);
    console.log(
      `coverage records: ${records.count} files, ${records.parsed} parsable, ` +
        `${records.results} script entries, ${records.bytes} bytes in ${temporary}`,
    );
    console.log(
      `coverage scripts: ${scripts.urls} distinct file URLs, ` +
        `${scripts.missing} of them gone from disk at report time`,
    );
    const shapes = coverageScriptShapes(temporary);
    console.log(
      `coverage shapes: ${shapes.reread} scripts were read by more than one ` +
        `process, ${shapes.disagreeing} of those in more than one shape` +
        (shapes.sample.length === 0 ? "" : ` (${shapes.sample.join(", ")})`),
    );
    process.exitCode = result.status ?? 1;
  } finally {
    // Leaving it behind is the stale half of the defect this file exists to fix.
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  measure();
