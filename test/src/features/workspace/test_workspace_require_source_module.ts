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
 * module than the one named, and say nothing. Measured on Windows against
 * `packages/template/build`: requiring `syncVersions.ts` returned
 * `templateVersions.ts`'s exports and never ran syncVersions' body, and
 * requiring `templateVersions.ts` returned the generated
 * `packages/template/src/templateVersions.ts` instead.
 *
 * Every private-unit scenario in this suite reaches its subject by path. One
 * handed the wrong module asserts against whatever that module exports and
 * passes, and what passed is not what it named.
 *
 * The two refusals below are built rather than borrowed from that measurement,
 * because the measurement is one platform's behaviour and the guard is not: a
 * scenario that reproduced the wrong resolution would pass on the platform that
 * resolves correctly and prove nothing there. Each arm is instead driven by a
 * mismatch that exists on every platform.
 *
 * Scenarios:
 *
 * 1. A module that really is at the path, named by an export it really
 *    declares, loads and is returned.
 * 2. A name no module at that path exports is refused, and the refusal says
 *    what the module carries instead.
 * 3. A name the file only re-exports is refused as well. A barrel carries it
 *    and declares none of it, which is exactly the shape a wrong module has,
 *    and telling them apart is not something this can do -- so it refuses both
 *    and says the file declares nothing of that name.
 * 4. Naming no export is refused rather than passing vacuously, since a check
 *    with nothing to check is the failure this guard exists to end.
 */
export const test_workspace_require_source_module = (): void => {
  const real = requireSourceModule<{
    sceneFogTransmittance: unknown;
  }>(path.join(ROOT, "packages/engine/src/scene/atmosphere.ts"), [
    "sceneFogTransmittance",
  ]);

  TestValidator.equals(
    "a module loaded by path is proved to be the module that path names",
    namedFacts([
      [
        "aRealModuleLoads",
        () => typeof real.sceneFogTransmittance === "function",
      ],
      [
        // Nothing at this path exports that name, on any platform.
        "aNameNoModuleExportsIsRefused",
        () =>
          refuses(
            "packages/engine/src/scene/atmosphere.ts",
            ["thisIsNotExportedByAnyModule"],
            "is not the module this path names",
          ),
      ],
      [
        // The barrel carries it and declares none of it. Only the second arm
        // can see that, and it is the same shape a wrong module presents. A
        // one-line barrel over a forty-line module, because the point is the
        // re-export and not the size of what is behind it.
        "aReExportedNameIsRefused",
        () =>
          refuses(
            "packages/engine/src/scene/index.ts",
            ["sceneFogTransmittance"],
            "came from somewhere else",
          ),
      ],
      [
        "namingNoExportIsRefused",
        () =>
          refuses(
            "packages/engine/src/scene/atmosphere.ts",
            [],
            "would prove nothing",
          ),
      ],
    ]),
    {
      aRealModuleLoads: true,
      aNameNoModuleExportsIsRefused: true,
      aReExportedNameIsRefused: true,
      namingNoExportIsRefused: true,
    },
  );
};
