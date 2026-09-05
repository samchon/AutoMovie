import { TestValidator } from "@nestia/e2e";

import { isAuthoredExecutableSource } from "../../coverage/changedCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * Unit-test coverage applies to executable package logic, not command or build surfaces.
 *
 * The one predicate decides both what c8 instruments and what the changed gate
 * demands, so every exclusion it makes is a decision the development skill
 * records rather than an accident of a glob, and every admission is a source a
 * test can reach.
 *
 * Scenarios:
 *
 * 1. Ordinary package source remains measured, in every accepted extension.
 * 2. CLI orchestration, the root and every package-local build directory, and
 *    the repository's own coverage and integrity tooling are excluded because
 *    the repository runs no process-level test for any of them.
 * 3. Configuration declarations and `.d.ts` declarations are excluded while an
 *    ordinary module whose name mentions configuration remains executable
 *    source.
 */
export const test_workspace_authored_executable_source = (): void => {
  TestValidator.equals(
    "the unit coverage population follows source responsibility",
    namedFacts([
      [
        "ordinaryPackageLogicIsMeasured",
        () =>
          isAuthoredExecutableSource(
            "packages/production/src/production/materializeProduction.ts",
          ),
      ],
      [
        "commandOrchestrationIsNotMeasured",
        () =>
          isAuthoredExecutableSource("packages/cli/src/command.ts") === false,
      ],
      [
        "packageBuildToolingIsNotMeasured",
        () =>
          isAuthoredExecutableSource("packages/template/build/versions.ts") ===
            false &&
          isAuthoredExecutableSource("packages/engine/build/versions.mts") ===
            false &&
          isAuthoredExecutableSource("packages/template/build/versions.cts") ===
            false,
      ],
      [
        "rootBuildToolingIsNotMeasured",
        () => isAuthoredExecutableSource("build/tgz.ts") === false,
      ],
      [
        "repositoryCoverageToolingIsNotMeasured",
        () =>
          isAuthoredExecutableSource("test/src/coverage/runCoverage.ts") ===
            false &&
          isAuthoredExecutableSource("test/src/integrity/describeThrown.ts") ===
            false,
      ],
      [
        "aDeclarationIsNotMeasured",
        () =>
          isAuthoredExecutableSource("packages/engine/src/types.d.ts") ===
          false,
      ],
      [
        "formatSpecificRuntimeSourcesAreMeasured",
        () =>
          isAuthoredExecutableSource("packages/engine/src/runtime.cts") &&
          isAuthoredExecutableSource("packages/engine/src/runtime.mts"),
      ],
      [
        "aConfigurationDeclarationIsNotMeasured",
        () =>
          isAuthoredExecutableSource("packages/engine/lint.config.ts") ===
          false,
      ],
      [
        "aNormalModuleNamedAfterConfigurationIsMeasured",
        () =>
          isAuthoredExecutableSource(
            "packages/production/src/production/configurationReader.ts",
          ),
      ],
    ]),
    {
      ordinaryPackageLogicIsMeasured: true,
      commandOrchestrationIsNotMeasured: true,
      packageBuildToolingIsNotMeasured: true,
      rootBuildToolingIsNotMeasured: true,
      repositoryCoverageToolingIsNotMeasured: true,
      aDeclarationIsNotMeasured: true,
      formatSpecificRuntimeSourcesAreMeasured: true,
      aConfigurationDeclarationIsNotMeasured: true,
      aNormalModuleNamedAfterConfigurationIsMeasured: true,
    },
  );
};
