import { TestValidator } from "@nestia/e2e";

import { measureCoverage } from "../../coverage/measureCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * The coverage process maps its child outcome and owns an isolated record path.
 *
 * Scenarios:
 *
 * 1. A successful child returns success and receives the run's own temporary
 *    directory.
 * 2. A failed child returns failure.
 * 3. A child that never starts returns the distinct instrument-failure status.
 */
export const test_workspace_coverage_measurement = (): void => {
  let arguments_: string[] = [];
  const dependencies = (status: number | null) => ({
    environment: {} as NodeJS.ProcessEnv,
    log: () => {},
    mkdir: () => undefined,
    missingScripts: () => ({ measured: [], missing: 0, urls: 0 }) as never,
    neverRecorded: () => [],
    records: () => ({ bytes: 0, count: 0, parsed: 0, results: 0 }) as never,
    reconcile: () => ({ failure: null, groups: 0, shortfalls: [] }) as never,
    remove: () => {},
    scriptShapes: () => ({ disagreeing: 0, reread: 0, sample: [] }) as never,
    sourceHostDirectory: () => "/source-host",
    spawn: (_executable: string, received: string[]) => {
      arguments_ = received;
      return { status } as never;
    },
    temporaryDirectory: () => "/this-run",
    writeLines: () => {},
    writeSources: () => {},
  });

  const passed = measureCoverage(dependencies(0) as never);
  const failed = measureCoverage(dependencies(1) as never);
  const didNotStart = measureCoverage(dependencies(null) as never);

  TestValidator.equals(
    "the measurement reports the child outcome it actually received",
    namedFacts([
      ["aSuccessfulChildPasses", () => passed === 0],
      ["aFailedChildFails", () => failed === 1],
      ["aMissingChildIsAnInstrumentFailure", () => didNotStart === 2],
      [
        "theRunOwnsItsTemporaryDirectory",
        () =>
          arguments_[arguments_.indexOf("--temp-directory") + 1] ===
          "/this-run",
      ],
    ]),
    {
      aSuccessfulChildPasses: true,
      aFailedChildFails: true,
      aMissingChildIsAnInstrumentFailure: true,
      theRunOwnsItsTemporaryDirectory: true,
    },
  );
};
