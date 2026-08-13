import {
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture, rewriteSource } from "./productionFixtures";

const ENGINE_IMPORT = 'import { defineShot } from "@automovie/engine";';

/**
 * A source blocked at the import gate is told why, not merely refused.
 *
 * The gate answered every unlinkable runtime import with the same sentence, so a
 * decided exclusion, an oversight and a misspelling were indistinguishable at the
 * one moment an author could have acted on the difference. That is the mechanism
 * behind #1904, where an authoring agent told to use a technique it could not
 * reach invented a workaround that compiled, passed its tests and looked
 * plausible in a frame. This drives the real compiler over real project source
 * and reads the diagnostic an author would read.
 *
 * Scenarios:
 *
 * 1. A withheld engine name is refused by its own name, told that the engine does
 *    publish it, and given the project-script route that still works.
 * 2. A name the engine does not publish is told exactly that, so a misspelling is
 *    never read as a decided exclusion.
 * 3. An import naming one reachable, one type-only, and one aliased withheld
 *    capability reports the withheld export name only: the declaration is
 *    refused as a whole, while the local alias and admitted halves are not accused.
 * 4. A package the sandbox does not serve keeps the declaration-level refusal,
 *    since no per-name reason would be true of it.
 * 5. A namespace import of the engine keeps the declaration-level refusal too. It
 *    is refused for what it binds rather than for which name it wanted, and there
 *    is no name to give a reason for.
 * 6. An import whose module specifier is not a string literal at all is refused
 *    the same way. The gate reads the specifier as text to decide whether the
 *    engine is being addressed, so a specifier that has no text must fall back
 *    rather than let the per-name path read something that is not a package.
 * 7. Reachable engine and archetype names, a project-relative named import, and
 *    a type-only package import are admitted. Each is the negative twin of the
 *    corresponding refused package, name, binding-shape, or runtime case.
 * 8. Default, namespace, and side-effect imports are refused even from otherwise
 *    served modules, because the link graph must know each runtime name it binds.
 * 9. A name absent from the served archetype table keeps the declaration-level
 *    refusal. Only engine exports have the runtime inventory needed to distinguish
 *    a withheld capability from a misspelling.
 */
export const test_mcp_source_import_refusal = (): void => {
  const fixture = productionFixture();
  try {
    inspectImportRefusals(fixture.root);
  } finally {
    fixture.dispose();
  }
};

const inspectImportRefusals = (root: string): void => {
  const sourcePath = path.join(root, "src/shots/opening.ts");
  const original = fs.readFileSync(sourcePath, "utf8");
  const compiler = new AutoMovieProductionCompiler(
    AutoMovieProductionProject.open(root),
  );
  const refusalsFor = (statement: string): string[] => {
    fs.writeFileSync(
      sourcePath,
      rewriteSource(original, ENGINE_IMPORT, statement),
      "utf8",
    );
    return compiler
      .compile({ scope: "source" })
      .diagnostics.filter(
        (diagnostic) => diagnostic.code === "source-import-unsupported",
      )
      .map((diagnostic) => diagnostic.message);
  };

  fs.mkdirSync(path.join(root, "src/helpers"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src/helpers/importProbe.ts"),
    "export const importProbe = 1;\n",
    "utf8",
  );

  TestValidator.equals(
    "the source import allow matrix has no import refusal",
    {
      engine: refusalsFor(
        'import { defineShot, worldSurfaceHeight } from "@automovie/engine";',
      ),
      archetype: refusalsFor(
        `${ENGINE_IMPORT}\nimport { CAT_GAITS } from "@automovie/archetypes";`,
      ),
      project: refusalsFor(
        `${ENGINE_IMPORT}\nimport { importProbe } from "../helpers/importProbe";`,
      ),
      typeOnly: refusalsFor(
        `${ENGINE_IMPORT}\nimport type { IAutoMovieShotSource } from "@automovie/interface";`,
      ),
    },
    { engine: [], archetype: [], project: [], typeOnly: [] },
  );

  const withheld = AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS[0]!;
  const withheldRefusals = refusalsFor(
    `import { defineShot, type IAutoMovieShotSource, ${withheld} as hiddenCapability } from "@automovie/engine";`,
  );
  TestValidator.equals(
    "a withheld engine name is refused by name, with the route that still works",
    namedFacts([
      ["exactly one refusal", () => withheldRefusals.length === 1],
      [
        "names the import",
        () => withheldRefusals[0]!.includes(`"${withheld}"`),
      ],
      [
        "does not accuse the reachable half",
        () =>
          withheldRefusals[0]!.includes(`"defineShot"`) === false &&
          withheldRefusals[0]!.includes("IAutoMovieShotSource") === false &&
          withheldRefusals[0]!.includes("hiddenCapability") === false,
      ],
      [
        "says the engine publishes it",
        () =>
          withheldRefusals[0]!.includes("publishes as a runtime value") &&
          withheldRefusals[0]!.includes(
            "JSON-safe bridge or deterministic stand-in",
          ),
      ],
      [
        "gives the project-script route",
        () => withheldRefusals[0]!.includes('"scripts/"'),
      ],
      [
        "names the source module",
        () => withheldRefusals[0]!.includes("src/shots/opening.ts"),
      ],
    ]),
    {
      "exactly one refusal": true,
      "names the import": true,
      "does not accuse the reachable half": true,
      "says the engine publishes it": true,
      "gives the project-script route": true,
      "names the source module": true,
    },
  );

  const absentRefusals = refusalsFor(
    `import { defineShot, notAnAutoMovieEngineExport } from "@automovie/engine";`,
  );
  TestValidator.equals(
    "a name the engine does not publish is told exactly that",
    namedFacts([
      ["exactly one refusal", () => absentRefusals.length === 1],
      [
        "says no such runtime name",
        () => absentRefusals[0]!.includes("publishes no such name at run time"),
      ],
    ]),
    { "exactly one refusal": true, "says no such runtime name": true },
  );

  TestValidator.equals(
    "an unserved package keeps the declaration-level refusal",
    refusalsFor(
      `${ENGINE_IMPORT}\nimport { readFileSync } from "node:fs";`,
    ).map((message) => message.startsWith("runtime import is unavailable")),
    [true],
  );

  TestValidator.equals(
    "an unavailable archetype name keeps the declaration-level refusal",
    refusalsFor(
      `${ENGINE_IMPORT}\nimport { DOG_GAITS } from "@automovie/archetypes";`,
    ).map((message) => message.startsWith("runtime import is unavailable")),
    [true],
  );

  TestValidator.equals(
    "a namespace import of the engine keeps the declaration-level refusal",
    refusalsFor(`import * as engine from "@automovie/engine";`).map((message) =>
      message.startsWith("runtime import is unavailable"),
    ),
    [true],
  );

  TestValidator.equals(
    "default and side-effect imports keep the declaration-level refusal",
    {
      defaultImport: refusalsFor(`import engine from "@automovie/engine";`).map(
        (message) => message.startsWith("runtime import is unavailable"),
      ),
      sideEffect: refusalsFor(`import "@automovie/engine";`).map((message) =>
        message.startsWith("runtime import is unavailable"),
      ),
    },
    { defaultImport: [true], sideEffect: [true] },
  );

  TestValidator.equals(
    "a specifier that is not a string literal keeps the declaration-level refusal",
    refusalsFor(`import { defineShot } from engineModule;`).map((message) =>
      message.startsWith("runtime import is unavailable"),
    ),
    [true],
  );

  TestValidator.equals(
    "the reachable surface is what the gate was measured against",
    AUTOMOVIE_SANDBOX_ENGINE_SURFACE.includes("defineShot"),
    true,
  );
};
