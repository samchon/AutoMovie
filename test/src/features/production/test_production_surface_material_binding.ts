import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
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
  plantingCluster,
  plantingInstallation,
  plantingRecipe,
  roomEnvironment,
  softFurnishing,
  softPanel,
} from "../internal/softFixtures";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

interface ISurfaceMaterials {
  water: string | null;
  soft: string | null;
  branch: string | null;
  leaf: string | null;
}

const authorSurfaces = (
  source: string,
  materials: ISurfaceMaterials,
  duplicateSoftDomain: boolean = false,
): string => {
  const basin = basinEnvironment();
  basin.boundaries = basin.boundaries.filter(
    (boundary) => boundary.id === "coping",
  );
  const suite = roomEnvironment();
  const annex = roomEnvironment({ id: "annex", space: "annex-room" });
  const furnishings = [
    softFurnishing({ material: materials.soft }),
    ...(duplicateSoftDomain
      ? [
          softFurnishing({
            id: "z-annex-curtain",
            environment: "annex",
            space: "annex-room",
            material: materials.soft,
          }),
        ]
      : []),
  ];
  return rewriteSource(
    source,
    "  return {\n    actors: [...performer.actors!],",
    [
      "  return {",
      `    builtEnvironments: ${JSON.stringify([basin, suite, ...(duplicateSoftDomain ? [annex] : [])])},`,
      `    fluidDomains: [${JSON.stringify(flatBasin({ columns: 2, rows: 2, depth: 1 }))}],`,
      `    waterFeatures: [${JSON.stringify(waterFeature({ mode: "static", material: materials.water }))}],`,
      `    softBodyDomains: [${JSON.stringify(softPanel({ columns: 2, rows: 2 }))}],`,
      `    softFurnishings: ${JSON.stringify(furnishings)},`,
      `    plantingDomains: [${JSON.stringify(plantingRecipe())}],`,
      `    plantingClusters: [${JSON.stringify(plantingCluster({ count: 1 }))}],`,
      `    plantingInstallations: [${JSON.stringify(
        plantingInstallation({
          branchMaterial: materials.branch,
          leafMaterial: materials.leaf,
        }),
      )}],`,
      "    actors: [...performer.actors!],",
    ].join("\n"),
  );
};

/**
 * Compilation resolves every simulated-surface material through one model
 * population and refuses ambiguous soft-body ownership before materialization.
 *
 * Scenarios:
 *
 * 1. Water, soft furnishing, planting branch, and planting leaf declarations
 *    compile both with their explicit `null` defaults and with the generated
 *    performer material `body`.
 * 2. Naming one absent id on all four surfaces produces exactly four addressed
 *    diagnostics with the resolver reason and atomically publishes nothing.
 * 3. A second environment cannot draw the first environment's world-space soft
 *    domain; the compiler reports the second source binding and publishes
 *    nothing even though each environment-local furnishing is valid alone.
 */
export const test_production_surface_material_binding = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const defaults: ISurfaceMaterials = {
      water: null,
      soft: null,
      branch: null,
      leaf: null,
    };
    fs.writeFileSync(sourcePath, authorSurfaces(original, defaults), "utf8");
    const defaulted = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });

    const named: ISurfaceMaterials = {
      water: "body",
      soft: "body",
      branch: "body",
      leaf: "body",
    };
    fs.writeFileSync(sourcePath, authorSurfaces(original, named), "utf8");
    const resolved = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });

    const absent: ISurfaceMaterials = {
      water: "absent-surface",
      soft: "absent-surface",
      branch: "absent-surface",
      leaf: "absent-surface",
    };
    fs.writeFileSync(sourcePath, authorSurfaces(original, absent), "utf8");
    const invalid = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const materialFindings = invalid.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "engine-validation-failed" &&
        diagnostic.message.includes('material "absent-surface" is absent'),
    );

    fs.writeFileSync(
      sourcePath,
      authorSurfaces(original, defaults, true),
      "utf8",
    );
    const ambiguous = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const ownershipFindings = ambiguous.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "source-scene-content-invalid" &&
        diagnostic.message.includes("soft body domain"),
    );

    TestValidator.equals(
      "surface material identity is a compiler-owned atomic gate",
      namedFacts([
        [
          "renderer default remains explicit and valid",
          () =>
            productionCompileSucceeded("default surface materials", defaulted),
        ],
        [
          "all named surface materials resolve",
          () => productionCompileSucceeded("named surface materials", resolved),
        ],
        ["absent identity is refused", () => invalid.success === false],
        [
          "every surface binding is addressed once",
          () =>
            [
              "waterFeatures[0].material",
              "softFurnishings[0].material",
              "plantingInstallations[0].branchMaterial",
              "plantingInstallations[0].leafMaterial",
            ].every(
              (binding) =>
                materialFindings.filter((finding) =>
                  finding.message.includes(binding),
                ).length === 1,
            ) && materialFindings.length === 4,
        ],
        [
          "failed compile publishes nothing",
          () => invalid.materialized.length === 0,
        ],
        [
          "world-space soft ownership is global",
          () =>
            ambiguous.success === false &&
            ownershipFindings.length === 1 &&
            ownershipFindings[0]?.message.includes(
              "$program.softFurnishings[1].domain",
            ) === true &&
            ownershipFindings[0]?.message.includes(
              'already drawn by furnishing "window-curtain"',
            ) === true,
        ],
        [
          "ambiguous compile publishes nothing",
          () => ambiguous.materialized.length === 0,
        ],
      ]),
      {
        "renderer default remains explicit and valid": true,
        "all named surface materials resolve": true,
        "absent identity is refused": true,
        "every surface binding is addressed once": true,
        "failed compile publishes nothing": true,
        "world-space soft ownership is global": true,
        "ambiguous compile publishes nothing": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
