import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  basinEnvironment,
  flatBasin,
  waterFeature,
} from "../internal/fluidFixtures";
import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

const authorWater = (source: string, material: string | null): string => {
  const environment = basinEnvironment();
  environment.boundaries = environment.boundaries.filter(
    (boundary) => boundary.id === "coping",
  );
  return rewriteSource(
    source,
    "  return {\n    actors: [...performer.actors!],",
    [
      "  return {",
      `    builtEnvironments: [${JSON.stringify(environment)}],`,
      `    fluidDomains: [${JSON.stringify(flatBasin({ columns: 2, rows: 2, depth: 1 }))}],`,
      `    waterFeatures: [${JSON.stringify(waterFeature({ mode: "static", material }))}],`,
      "    actors: [...performer.actors!],",
    ].join("\n"),
  );
};

/**
 * Compilation refuses a simulated-surface material id no model defines.
 *
 * Scenarios:
 *
 * 1. The same valid water declaration compiles when it asks the renderer for
 *    its explicit default through `null`.
 * 2. Changing only that binding to an absent id produces one addressed engine
 *    diagnostic and atomically materializes no replacement output.
 */
export const test_mcp_production_surface_material_binding = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(sourcePath, authorWater(original, null), "utf8");
    const valid = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });

    fs.writeFileSync(
      sourcePath,
      authorWater(original, "absent-surface"),
      "utf8",
    );
    const invalid = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const findings = invalid.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "engine-validation-failed" &&
        diagnostic.message.includes("waterFeatures[0].material"),
    );

    TestValidator.equals(
      "surface material identity is a compiler-owned atomic gate",
      namedFacts([
        [
          "renderer default remains explicit and valid",
          () => productionCompileSucceeded("default water material", valid),
        ],
        ["absent identity is refused", () => invalid.success === false],
        ["one binding is addressed once", () => findings.length === 1],
        [
          "diagnostic keeps the resolver reason",
          () =>
            findings[0]?.message.includes(
              'material "absent-surface" is absent',
            ) === true,
        ],
        [
          "failed compile publishes nothing",
          () => invalid.materialized.length === 0,
        ],
      ]),
      {
        "renderer default remains explicit and valid": true,
        "absent identity is refused": true,
        "one binding is addressed once": true,
        "diagnostic keeps the resolver reason": true,
        "failed compile publishes nothing": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
