import process from "node:process";

import { runChangedCoverageGate } from "./changedCoverage";
import {
  coverageMeasurementDependencies,
  measureCoverage,
} from "./measureCoverage";
import { reportCoverageGaps } from "./reportCoverageGaps";

export interface IRunCoverageDependencies {
  changed: (arguments_: string[]) => number;
  measure: () => number;
  report: () => number;
}

export interface ICoverageCommandWiring {
  rootPackage: string;
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
  const root = packageScripts(files.rootPackage);
  const test = packageScripts(files.testPackage);
  if (root["consumer:check"] !== "pnpm --filter @automovie/test consumer:check")
    diagnostics.push("root consumer:check is not the typed targeted scenario");
  if (test.coverage !== "ttsx -P tsconfig.json src/coverage/runCoverage.ts")
    diagnostics.push("test coverage does not use the single typed entry");
  if (occurrences(files.workflow, "fetch-depth: 0") !== 2)
    diagnostics.push("both CI checkouts must fetch the comparison base");
  if (
    occurrences(
      files.workflow,
      WORKFLOW_BASE_ENVIRONMENT,
    ) !== 2
  )
    diagnostics.push("both CI lanes must pass the pull-request base");
  if (occurrences(files.workflow, "run: pnpm coverage") !== 2)
    diagnostics.push("both CI lanes must run the same coverage command");
  if (occurrences(files.workflow, "working-directory: test") !== 2)
    diagnostics.push("both CI lanes must run coverage from the test package");
  if (
    files.workflow.includes("- '*.ts'") === false ||
    files.workflow.includes("- 'build/**'") === false
  )
    diagnostics.push("typed root tools and build tools must trigger CI");
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
): IRunCoverageDependencies => ({ changed, measure, report });

/** Run the suite, historical report, and touched-file gate in that order. */
export const runCoverage = (
  arguments_: string[],
  dependencies: IRunCoverageDependencies,
): number => {
  const measurement = dependencies.measure();
  if (measurement !== 0) return measurement === 2 ? 2 : 1;
  const report = dependencies.report();
  if (report !== 0) return report === 2 ? 2 : 1;
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

runCoverageCli(
  require.main === module,
  process.argv.slice(2),
  coverageRunDependencies(
    measureCoverage.bind(undefined, coverageMeasurementDependencies),
    runChangedCoverageGate,
    reportCoverageGaps,
  ),
  setCoverageExitStatus,
);
