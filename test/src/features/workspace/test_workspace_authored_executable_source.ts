import { TestValidator } from "@nestia/e2e";

import {
  UNJUDGED_DECLARATION_GLOBS,
  isAuthoredExecutableSource,
} from "../../coverage/changedCoverage";
import { namedFacts } from "../internal/predicates";

/**
 * Which authored files this repository's own coverage gate is answerable for.
 *
 * The population gate exits on a source it would have demanded and never saw,
 * which is right: normally that is an instrument that missed. Three categories
 * are not that, and each of them arrived by a decision rather than by a fault.
 *
 * Scenarios:
 *
 * 1. Ordinary package source is measured.
 * 2. The scaffold is not. It is the harness a generated project inherits
 *    verbatim and runs there, which is the standing `packages/playground/`
 *    already had; its decision modules keep their own scenarios.
 * 3. A declaration -- a lint or bundler configuration, an evidence exclusion
 *    list -- is not. What it says is checked by the thing it configures
 *    failing, and importing one for the number is the trade asserting the
 *    contents of a `package.json` makes.
 */
export const test_workspace_authored_executable_source = (): void => {
  TestValidator.equals(
    "the gate answers for product source and not for shipped or declared files",
    namedFacts([
      [
        "ordinaryPackageSourceIsMeasured",
        () =>
          isAuthoredExecutableSource(
            "packages/production/src/production/materializeProduction.ts",
          ),
      ],
      [
        // Including the modules that do have scenarios: the scenarios are the
        // guarantee, and the coverage demand was the backstop.
        "theScaffoldIsShippedRatherThanRunHere",
        () =>
          isAuthoredExecutableSource(
            "packages/template/scaffold/scripts/buildingRecords.ts",
          ) === false &&
          isAuthoredExecutableSource(
            "packages/template/scaffold/viewer/src/main.ts",
          ) === false,
      ],
      [
        "thisRepositorysOwnPackagingToolingIsNotMeasured",
        () => isAuthoredExecutableSource("build/tgz.ts") === false,
      ],
      [
        "aDeclarationIsNotAProgram",
        () =>
          isAuthoredExecutableSource("docs/lint.config.ts") === false &&
          isAuthoredExecutableSource("packages/engine/vite.config.ts") ===
            false &&
          isAuthoredExecutableSource(
            "packages/engine/src/AutoMovieEngineEvidenceExclusions.ts",
          ) === false,
      ],
      [
        // The gate exists to catch the two populations disagreeing, and it
        // caught exactly that: the judging half learned this rule and the
        // measuring half did not, so c8 took `packages/render/lint.config.ts`
        // and nothing judged it. One rule, two spellings, and the glob half is
        // checked against the same files the regex half decides.
        "theMeasurementIsToldTheSameRule",
        () =>
          UNJUDGED_DECLARATION_GLOBS.every(
            (glob) =>
              isAuthoredExecutableSource(
                glob
                  .replace("**/", "packages/engine/src/")
                  .replace("*", "Engine"),
              ) === false,
          ) && UNJUDGED_DECLARATION_GLOBS.length === 3,
      ],
      [
        // The name has to be the whole file, not a fragment of one: a module
        // that merely mentions a configuration in its name is a program.
        "aSourceFileNamedAfterAConfigurationIsStillMeasured",
        () =>
          isAuthoredExecutableSource(
            "packages/production/src/production/lintConfigReader.ts",
          ),
      ],
    ]),
    {
      ordinaryPackageSourceIsMeasured: true,
      theScaffoldIsShippedRatherThanRunHere: true,
      thisRepositorysOwnPackagingToolingIsNotMeasured: true,
      aDeclarationIsNotAProgram: true,
      theMeasurementIsToldTheSameRule: true,
      aSourceFileNamedAfterAConfigurationIsStillMeasured: true,
    },
  );
};
