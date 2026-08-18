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
export const coverageRecordCount = (directory) => {
  try {
    return fs.readdirSync(directory).filter((entry) => entry.endsWith(".json"))
      .length;
  } catch {
    // A directory the run never created is zero records, which is exactly what
    // a caller asking this question needs to be told.
    return 0;
  }
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
    // little ran or little was counted. One commit measured 813/813 tests
    // passing and 141,395 statements instrumented on both platforms, and
    // 118,208 statements covered on Ubuntu against 79,618 on Windows -- an
    // identical denominator with a much smaller numerator, which is execution
    // data collected and then not counted rather than positions mis-mapped.
    // This line is what separates "not written" from "written and not merged",
    // and it costs one directory read on a step that already took minutes.
    console.log(
      `coverage records: ${coverageRecordCount(temporary)} in ${temporary}`,
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
