import process from "node:process";

import { isProcessEntry } from "../integrity/zeroJavaScript";
import { runChangedCoverageGate } from "./changedCoverage";
import { runCoveragePopulationGate } from "./coveragePopulation";
import {
  COVERAGE_REPORT_DIRECTORY,
  COVERAGE_ROOT,
  coverageMeasurementDependencies,
  measureCoverage,
} from "./measureCoverage";
import { reportCoverageGaps } from "./reportCoverageGaps";

export interface IRunCoverageDependencies {
  changed: (arguments_: string[]) => number;
  measure: () => number;
  population: () => number;
  report: () => number;
}

export interface ICoverageCommandWiring {
  testPackage: string;
  workflow: string;
}

const packageScripts = (text: string): Record<string, unknown> => {
  const manifest: unknown = JSON.parse(text);
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("scripts" in manifest) ||
    typeof manifest.scripts !== "object" ||
    manifest.scripts === null
  )
    return {};
  return Object.fromEntries(Object.entries(manifest.scripts));
};

const occurrences = (text: string, value: string): number =>
  text.split(value).length - 1;
const WORKFLOW_BASE_ENVIRONMENT =
  "AUTOMOVIE_COVERAGE_BASE: origin/$" + "{{ github.base_ref }}";

/** Diagnose drift between the root command, test command, and both CI lanes. */
export const coverageCommandWiringDiagnostics = (
  files: ICoverageCommandWiring,
): string[] => {
  const diagnostics: string[] = [];
  const test = packageScripts(files.testPackage);
  if (test.coverage !== "ttsx -P tsconfig.json src/coverage/runCoverage.ts")
    diagnostics.push("test coverage does not use the single typed entry");
  // Counted at one, not two. The lanes were two duplicated job blocks and each
  // of these had to be spelled twice, so the check counted spellings and the
  // duplication it was policing was the thing that made it necessary. One
  // matrix job covers both operating systems and cannot disagree with itself;
  // what is worth checking now is that the one spelling is right and that the
  // matrix still names both.
  if (occurrences(files.workflow, "fetch-depth: 0") !== 1)
    diagnostics.push("the CI checkout must fetch the comparison base, once");
  if (occurrences(files.workflow, WORKFLOW_BASE_ENVIRONMENT) !== 1)
    diagnostics.push("the lane must pass the pull-request base, once");
  if (occurrences(files.workflow, "run: pnpm coverage") !== 1)
    diagnostics.push("the lane must run the coverage command, once");
  if (occurrences(files.workflow, "working-directory: test") !== 1)
    diagnostics.push("the lane must run coverage from the test package, once");
  if (
    files.workflow.includes("ubuntu-latest") === false ||
    files.workflow.includes("windows-latest") === false
  )
    diagnostics.push("the matrix must still name both operating systems");
  // No path filter to check. A filtered required workflow can stay pending
  // instead of reporting, which is what the filters cost; every push runs both
  // lanes now, and a list of paths that must appear is a list that drifts.
  if (files.workflow.includes("paths:"))
    diagnostics.push("a path-filtered required lane can stay pending forever");
  if (
    files.workflow.includes("internals/") ||
    files.workflow.includes("license:check") ||
    files.workflow.includes("Report Coverage Gaps")
  )
    diagnostics.push("CI still names a deleted JavaScript-era gate");
  return diagnostics;
};

export const coverageRunDependencies = (
  measure: () => number,
  changed: (arguments_: string[]) => number,
  report: () => number,
  population: () => number,
): IRunCoverageDependencies => ({ changed, measure, population, report });

/**
 * Run the suite, the historical report, the population gate, and the
 * touched-file gate in that order.
 *
 * The population gate sits between the report and the touched-file gate because
 * it decides whether that gate's verdict covers the set it names. A source the
 * gate would demand 100% of and the run never measured, or one the run measured
 * and the gate never judges, both leave a green verdict that answered about a
 * different population, so the run stops there rather than printing one.
 */
export const runCoverage = (
  arguments_: string[],
  dependencies: IRunCoverageDependencies,
): number => {
  const measurement = dependencies.measure();
  if (measurement !== 0) return measurement === 2 ? 2 : 1;
  const report = dependencies.report();
  if (report !== 0) return report === 2 ? 2 : 1;
  const population = dependencies.population();
  if (population !== 0) return population === 2 ? 2 : 1;
  const changed = dependencies.changed(arguments_);
  return changed === 2 ? 2 : changed === 0 ? 0 : 1;
};

type ExitStatusWriter = (status: number) => void;

/** Execute the command only for the direct TypeScript entry module. */
export const runCoverageCli = (
  isMain: boolean,
  arguments_: string[],
  dependencies: IRunCoverageDependencies,
  setExitStatus: ExitStatusWriter,
): void => {
  if (isMain === false) return;
  setExitStatus(runCoverage(arguments_, dependencies));
};

export const setCoverageExitStatus = (status: number): void => {
  process.exitCode = status;
};

/**
 * Whether the process was started on this module rather than on an importer.
 *
 * `require.main === module` is false under `ttsx`, which is the only way this
 * module is ever started: the launcher is the process entry and this file is a
 * dependency of it. The gate therefore returned immediately, and
 * `pnpm --dir test coverage` exited 0 in seconds having measured nothing, which
 * is exactly the command CI's "Run Tests and Enforce Coverage" step runs. The
 * per-change 100% obligation had never once been machine-enforced, and no
 * touched-file coverage failure had ever been reported because no coverage was
 * ever taken.
 *
 * `runCoverageCli` was already tested with both booleans. What nothing tested
 * was the argument the call site passed it, so the covered unit sat behind a
 * wiring that could never reach it. This predicate exists so the binding to
 * this module's own resolved path is itself a value a test can inspect, rather
 * than an expression only the process can evaluate.
 */
export const coverageProcessIsEntry = (entry: string | undefined): boolean =>
  isProcessEntry(entry, __filename);

runCoverageCli(
  coverageProcessIsEntry(process.argv[1]),
  process.argv.slice(2),
  coverageRunDependencies(
    measureCoverage.bind(undefined, coverageMeasurementDependencies),
    runChangedCoverageGate,
    reportCoverageGaps,
    runCoveragePopulationGate.bind(undefined, {
      root: COVERAGE_ROOT,
      reportDirectory: COVERAGE_REPORT_DIRECTORY,
    }),
  ),
  setCoverageExitStatus,
);
