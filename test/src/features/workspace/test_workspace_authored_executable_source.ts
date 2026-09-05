import { TestValidator } from "@nestia/e2e";

import { isAuthoredExecutableSource } from "../../coverage/changedCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * Unit-test coverage applies to executable package logic, not command or build surfaces.
 *
 * Scenarios:
 *
 * 1. Ordinary package source remains measured.
 * 2. CLI orchestration and package-local build tooling are excluded because the
 *    repository runs no process-level test for either.
 * 3. Configuration declarations are excluded while an ordinary module whose
 *    name mentions configuration remains executable source.
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
          isAuthoredExecutableSource("packages/engine/build/versions.mts") ===
            false &&
          isAuthoredExecutableSource("packages/template/build/versions.cts") ===
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
      formatSpecificRuntimeSourcesAreMeasured: true,
      aConfigurationDeclarationIsNotMeasured: true,
      aNormalModuleNamedAfterConfigurationIsMeasured: true,
    },
  );
};
