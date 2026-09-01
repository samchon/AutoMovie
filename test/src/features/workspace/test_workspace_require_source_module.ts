import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const refuses = (
  file: string,
  exports: readonly string[],
  fragment: string,
): boolean => {
  try {
    requireSourceModule(path.join(ROOT, file), exports);
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/**
 * A scenario that loads a module by path is told when it did not get that one.
 *
 * `require(<absolute .ts path>)` under this harness can answer with a different
 * module than the one named, and say nothing. Both files below are the measured
 * cases: `packages/template/build/syncVersions.ts` exports nothing at all -- it
 * writes a file and prints a line -- yet `require` answers it with
 * `templateVersions.ts`'s three exports and never runs its body; and
 * `packages/template/build/templateVersions.ts` is answered with the generated
 * `packages/template/src/templateVersions.ts` instead.
 *
 * Every private-unit scenario in this suite reaches its subject by path. One
 * handed the wrong module asserts against whatever that module exports and
 * passes, and what passed is not what it named. This is the guard that makes
 * that loud, so it has to be shown catching both shapes rather than trusted.
 *
 * Scenarios:
 *
 * 1. A module that really is at the path, named by exports it really has, loads
 *    and is returned.
 * 2. A wrong module missing a named export is refused, and the refusal says
 *    what it carries instead.
 * 3. A wrong module that happens to carry the named export is still refused,
 *    because the file at that path does not declare it.
 * 4. Naming no export is refused rather than passing vacuously, since a check
 *    with nothing to check is the failure this guard exists to end.
 */
export const test_workspace_require_source_module = (): void => {
  const real = requireSourceModule<{
    digestAutoMovieBytes: unknown;
  }>(path.join(ROOT, "packages/production/src/production/contentIdentity.ts"), [
    "digestAutoMovieBytes",
  ]);

  TestValidator.equals(
    "a module loaded by path is proved to be the module that path names",
    namedFacts([
      [
        "aRealModuleLoads",
        () => typeof real.digestAutoMovieBytes === "function",
      ],
      [
        // The module require answers with here carries AUTOMOVIE_TEMPLATE_VERSIONS
        // and nothing else, so the export the caller came for is absent.
        "aWrongModuleMissingTheExportIsRefused",
        () =>
          refuses(
            "packages/template/build/templateVersions.ts",
            ["readCatalogVersion"],
            "is not the module this path names",
          ),
      ],
      [
        // Here the wrong module does carry the named export, so only the second
        // arm can see it: syncVersions.ts declares no `resolveTemplateVersions`
        // in its own bytes.
        "aWrongModuleCarryingTheExportIsStillRefused",
        () =>
          refuses(
            "packages/template/build/syncVersions.ts",
            ["resolveTemplateVersions"],
            "came from somewhere else",
          ),
      ],
      [
        "namingNoExportIsRefused",
        () =>
          refuses(
            "packages/production/src/production/contentIdentity.ts",
            [],
            "would prove nothing",
          ),
      ],
    ]),
    {
      aRealModuleLoads: true,
      aWrongModuleMissingTheExportIsRefused: true,
      aWrongModuleCarryingTheExportIsStillRefused: true,
      namingNoExportIsRefused: true,
    },
  );
};
