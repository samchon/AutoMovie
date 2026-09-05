import path from "node:path";
import process from "node:process";

import { describeThrown } from "../integrity/describeThrown";
import { isProcessEntry } from "../integrity/zeroJavaScript";
import { runChangedCoverageGate } from "./changedCoverage";
import { runCoveragePopulationGate } from "./coveragePopulation";
import {
  type ICoverageMeasurementResult,
  type ICoveragePublication,
  publicationReport,
} from "./coveragePublication";
import {
  COVERAGE_ROOT,
  coverageMeasurementDependencies,
  measureCoverage,
  removeCoverageTemporaryDirectory,
} from "./measureCoverage";
import { reportCoverageGaps } from "./reportCoverageGaps";

export interface IRunCoverageDependencies {
  changed: (arguments_: string[], publication: ICoveragePublication) => number;
  cleanup: (publication: ICoveragePublication) => void;
  measure: () => ICoverageMeasurementResult;
  population: (publication: ICoveragePublication) => number;
  report: (publication: ICoveragePublication) => number;
}

export type CoverageExitStatus = 0 | 1 | 2;
type CoverageRunStage = "changed" | "measure" | "population" | "report";
type Writer = (line: string) => void;

/** Preserve 0/1/2 and reject every unsupported stage status as instrument red. */
export const coverageStageStatus = (
  stage: CoverageRunStage,
  status: number,
  write: Writer,
): CoverageExitStatus => {
  if (status === 0 || status === 1 || status === 2) return status;
  write(
    `INSTRUMENT FAILURE: coverage ${stage} returned unsupported status ${String(status)}`,
  );
  return 2;
};

export const coverageRunDependencies = (
  measure: () => ICoverageMeasurementResult,
  changed: (arguments_: string[], publication: ICoveragePublication) => number,
  report: (publication: ICoveragePublication) => number,
  population: (publication: ICoveragePublication) => number,
  cleanup: (publication: ICoveragePublication) => void,
): IRunCoverageDependencies => ({
  changed,
  cleanup,
  measure,
  population,
  report,
});

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
  write: Writer = console.log,
): CoverageExitStatus => {
  let measurement: ICoverageMeasurementResult;
  try {
    measurement = dependencies.measure();
  } catch (error) {
    write(
      `INSTRUMENT FAILURE: coverage measure threw: ${describeThrown(error)}`,
    );
    return 2;
  }
  const measurementStatus = coverageStageStatus(
    "measure",
    measurement.status,
    write,
  );
  if (measurementStatus !== 0) return measurementStatus;
  const publication = measurement.publication;
  if (publication === undefined) {
    write(
      "INSTRUMENT FAILURE: coverage measure returned success without a publication",
    );
    return 2;
  }
  let status: CoverageExitStatus = 2;
  try {
    const report = coverageStageStatus(
      "report",
      dependencies.report(publication),
      write,
    );
    if (report !== 0) status = report;
    else {
      const population = coverageStageStatus(
        "population",
        dependencies.population(publication),
        write,
      );
      if (population !== 0) status = population;
      else {
        status = coverageStageStatus(
          "changed",
          dependencies.changed(arguments_, publication),
          write,
        );
      }
    }
  } catch (error) {
    write(
      `INSTRUMENT FAILURE: coverage consumer threw: ${describeThrown(error)}`,
    );
    status = 2;
  }
  try {
    dependencies.cleanup(publication);
  } catch (error) {
    write(
      `INSTRUMENT FAILURE: coverage cleanup threw: ${describeThrown(error)}`,
    );
    return 2;
  }
  return status;
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
    (publication) =>
      reportCoverageGaps(
        publicationReport(publication),
        console.log,
        publication.sources,
      ),
    (publication) =>
      runCoveragePopulationGate({ publication, root: COVERAGE_ROOT }),
    (publication) =>
      removeCoverageTemporaryDirectory(
        path.dirname(publication.reportDirectory),
      ),
  ),
  setCoverageExitStatus,
);
