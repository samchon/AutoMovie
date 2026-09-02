import { TestValidator } from "@nestia/e2e";

import {
  UNEXECUTED_AUTHORED_ROOTS,
  UNJUDGED_DECLARATION_GLOBS,
} from "../../coverage/changedCoverage";
import { measureCoverage } from "../../coverage/measureCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * What the measurement hands the instrument, read without launching a suite.
 *
 * `measureCoverage` spawns c8 around this repository's whole test run, so
 * nothing inside that run can execute it, and the arguments it assembles lived
 * where no test could see them. They drifted there: the judging half of the
 * population learned that a lint config is a declaration and this half did not,
 * so c8 kept instrumenting `packages/render/lint.config.ts` while nothing
 * judged it, and only a CI lane said so.
 *
 * The function already takes every effect as a dependency. Handing it fakes
 * runs the whole assembly and reads the result.
 *
 * Scenarios:
 *
 * 1. Every root and glob the changed-file gate refuses to judge is excluded
 *    from the measurement, which is the agreement the population gate exists to
 *    check.
 * 2. The run is measured into the directory it drew for itself, not a shared
 *    one, so two runs cannot delete each other's records.
 * 3. A spawn that never started is a different answer from one that failed,
 *    because an instrument that did not run is not a coverage result.
 */
export const test_workspace_coverage_instrument_arguments = (): void => {
  let handed: string[] = [];
  const fakes = (status: number | null) => ({
    environment: {} as NodeJS.ProcessEnv,
    log: () => {},
    mkdir: () => undefined,
    missingScripts: () => ({ measured: [], missing: 0, urls: 0 }) as never,
    neverRecorded: () => [],
    records: () => ({ bytes: 0, count: 0, parsed: 0, results: 0 }) as never,
    reconcile: () => ({ failure: null, groups: 0, shortfalls: [] }) as never,
    remove: () => {},
    scriptShapes: () => ({ disagreeing: 0, reread: 0, sample: [] }) as never,
    sourceHostDirectory: () => "/tmp/source-host",
    spawn: (_executable: string, arguments_: string[]) => {
      handed = arguments_;
      return { status } as never;
    },
    temporaryDirectory: () => "/tmp/drawn-for-this-run",
    writeLines: () => {},
    writeSources: () => {},
  });

  const green = measureCoverage(fakes(0) as never);
  const red = measureCoverage(fakes(1) as never);
  const neverStarted = measureCoverage(fakes(null) as never);

  TestValidator.equals(
    "the instrument is told exactly what the gate judges",
    namedFacts([
      [
        // The agreement the population gate exists to check, checked here
        // instead of in a CI log.
        "everyUnjudgedRootAndGlobIsExcluded",
        () =>
          UNEXECUTED_AUTHORED_ROOTS.every((root) =>
            handed.includes(`${root}**`),
          ) &&
          UNJUDGED_DECLARATION_GLOBS.every((glob) => handed.includes(glob)),
      ],
      [
        // c8 wipes its temp directory at startup, so a shared path means one
        // run deletes another's records and the survivor reports a total
        // assembled from whatever was left.
        "theRunIsMeasuredIntoTheDirectoryItDrewForItself",
        () =>
          handed[handed.indexOf("--temp-directory") + 1] ===
          "/tmp/drawn-for-this-run",
      ],
      ["aPassingInstrumentIsAPass", () => green === 0],
      ["aFailingInstrumentIsAFailure", () => red === 1],
      [
        // An instrument that never started is not a coverage result, and
        // reporting it as an ordinary failure would send a reader looking for
        // a gap that was never measured.
        "anInstrumentThatNeverStartedIsItsOwnAnswer",
        () => neverStarted === 2,
      ],
    ]),
    {
      everyUnjudgedRootAndGlobIsExcluded: true,
      theRunIsMeasuredIntoTheDirectoryItDrewForItself: true,
      aPassingInstrumentIsAPass: true,
      aFailingInstrumentIsAFailure: true,
      anInstrumentThatNeverStartedIsItsOwnAnswer: true,
    },
  );
};
