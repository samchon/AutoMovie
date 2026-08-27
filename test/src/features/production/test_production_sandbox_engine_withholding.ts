import {
  AUTOMOVIE_ENGINE_RUNTIME_EXPORTS,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS,
  autoMovieSandboxEngineImportRefusal,
  compareCodeUnits,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * What the sandbox withholds is derived, complete, and carries its reason.
 *
 * The surface was a small hand-maintained list beside hundreds of engine exports,
 * and nothing distinguished a capability that had been considered and refused
 * from one nobody had reached yet: the gate refused both spellings identically,
 * and it refused a misspelling identically too. Six investigations in one
 * campaign began at that refusal. This pins the three facts that make the
 * difference readable — the withheld set is the engine's own inventory minus the
 * surface, a name on the surface really exists, and a refused import is told
 * which of the three situations it is in.
 *
 * Scenarios:
 *
 * 1. Every name the surface publishes is a runtime export of the engine, so the
 *    surface cannot promise reach to a name no bridge could ever answer.
 * 2. The surface and the withheld set partition the engine's runtime exports:
 *    concatenated and sorted they are exactly that inventory, which makes the
 *    withheld list complete by construction rather than by anyone's memory.
 * 3. The withheld list is sorted by code unit and carries no duplicate, because
 *    it is a published order an author and a refusal message read back.
 * 4. The runtime inventory holds runtime names only. `defineShot` is present and
 *    `IAutoMovieShotSource` is absent, since a type is erased before the module
 *    object exists and must never be reported as a withheld capability.
 * 5. No reachable name produces a refusal. Checked over the whole surface rather
 *    than one member, because this is what lets a mixed import naming one
 *    reachable and one withheld capability report the withheld half alone, and a
 *    single sample would leave forty-one names unasked.
 * 6. Every withheld name's refusal names the import, says the engine publishes it,
 *    names the unproved bridge or stand-in, and gives the project-script route.
 * 7. A name the engine does not publish is told exactly that, so a misspelling is
 *    never read as a decided exclusion.
 */
export const test_production_sandbox_engine_withholding = (): void => {
  TestValidator.equals(
    "every published surface name is a runtime export of the engine",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
      (name) => AUTOMOVIE_ENGINE_RUNTIME_EXPORTS.has(name) === false,
    ),
    [],
  );

  TestValidator.equals(
    "the surface and the withheld list partition the engine's runtime exports",
    [
      ...AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
      ...AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS,
    ].sort(compareCodeUnits),
    [...AUTOMOVIE_ENGINE_RUNTIME_EXPORTS].sort(compareCodeUnits),
  );

  TestValidator.equals(
    "the withheld list is a sorted set",
    namedFacts([
      [
        "sorted by code unit",
        () =>
          AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS.every(
            (name, index) =>
              index === 0 ||
              compareCodeUnits(
                AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS[index - 1]!,
                name,
              ) < 0,
          ),
      ],
      ["not empty", () => AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS.length > 0],
    ]),
    { "sorted by code unit": true, "not empty": true },
  );

  TestValidator.equals(
    "the runtime inventory holds runtime names and not erased types",
    namedFacts([
      [
        "defineShot present",
        () => AUTOMOVIE_ENGINE_RUNTIME_EXPORTS.has("defineShot"),
      ],
      [
        "IAutoMovieShotSource absent",
        () =>
          AUTOMOVIE_ENGINE_RUNTIME_EXPORTS.has("IAutoMovieShotSource") ===
          false,
      ],
    ]),
    { "defineShot present": true, "IAutoMovieShotSource absent": true },
  );

  TestValidator.equals(
    "no reachable name is refused",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
      (name) =>
        autoMovieSandboxEngineImportRefusal({
          name,
          sourcePath: "src/shots/opening.ts",
        }) !== null,
    ),
    [],
  );

  TestValidator.equals(
    "every withheld name carries the common reason and remaining route",
    AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS.filter((name) => {
      const reason =
        autoMovieSandboxEngineImportRefusal({
          name,
          sourcePath: "src/shots/opening.ts",
        }) ?? "";
      return (
        reason.includes(`"${name}"`) === false ||
        reason.includes("src/shots/opening.ts") === false ||
        reason.includes("publishes as a runtime value") === false ||
        reason.includes("JSON-safe bridge or deterministic stand-in") ===
          false ||
        reason.includes('"scripts/"') === false
      );
    }),
    [],
  );

  const absentReason =
    autoMovieSandboxEngineImportRefusal({
      name: "notAnAutoMovieEngineExport",
      sourcePath: "src/shots/opening.ts",
    }) ?? "";
  TestValidator.equals(
    "a name the engine does not publish is told exactly that",
    namedFacts([
      [
        "names the import",
        () => absentReason.includes('"notAnAutoMovieEngineExport"'),
      ],
      [
        "says no such runtime name",
        () => absentReason.includes("publishes no such name at run time"),
      ],
      [
        "offers the type-only route",
        () => absentReason.includes('"import type"'),
      ],
    ]),
    {
      "names the import": true,
      "says no such runtime name": true,
      "offers the type-only route": true,
    },
  );
};
