import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { makeProp, primitivePart } from "../internal/fixtures";
import { loadSourceModule } from "../internal/loadSourceModule";

const { inspectAutoMovieBuilding } = loadSourceModule<{
  inspectAutoMovieBuilding: (props: {
    environment: IAutoMovieBuiltEnvironment;
    inputFingerprint: string;
    study?: { groundY: number; tolerance: number };
  }) => {
    census: { populationSets: number; populationMembers: number };
    storage: {
      uniqueSerializedGeometries: number;
      geometryRecords: number;
      repeatedGeometryBytes: number;
    };
    support:
      | { status: "not-run" }
      | {
          status: "measured";
          report: { grounded: number; floating: unknown[] };
        };
    overlaps: { measured: number };
  };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/buildingInspection.ts",
  ),
);

export const test_cli_scaffold_building_inspection = (): void => {
  const model = makeProp([
    primitivePart("box", { type: "box", width: 1, height: 1, depth: 1 }),
  ]);
  const environment: IAutoMovieBuiltEnvironment = {
    version: 1,
    id: "work",
    units: "meter",
    buildings: [],
    models: [model],
    modelReferences: [],
    elements: [],
    spaces: [],
    boundaries: [],
    openings: [],
    connectors: [],
    surfaces: [],
    walkable: [],
  };
  const inspect = (study?: { groundY: number; tolerance: number }) =>
    inspectAutoMovieBuilding({
      environment,
      inputFingerprint: "revision",
      study,
    });
  TestValidator.equals(
    "missing ground is not a pass",
    inspect().support.status,
    "not-run",
  );
  TestValidator.equals(
    "one geometry record",
    inspect().storage.uniqueSerializedGeometries,
    1,
  );
  TestValidator.equals(
    "no repeats",
    inspect().storage.repeatedGeometryBytes,
    0,
  );
  environment.models.push({ ...model, id: "copy" });
  const repeated = inspect();
  TestValidator.equals(
    "two records sharing one geometry",
    [
      repeated.storage.geometryRecords,
      repeated.storage.uniqueSerializedGeometries,
    ],
    [2, 1],
  );
  TestValidator.equals(
    "one redundant geometry's byte cost",
    repeated.storage.repeatedGeometryBytes,
    Buffer.byteLength(JSON.stringify(model.parts[0]!.geometry)),
  );
  environment.populations = [
    {
      space: "room",
      prototypeBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      set: {
        id: "tiles",
        modelRecipe: model.id,
        count: 4,
        layout: { kind: "grid", rows: 2, columns: 2, spacing: { x: 2, z: 2 } },
        anchor: { x: 0, y: 0, z: 0 },
        facingDeg: 0,
        seed: 1,
        variation: {
          scale: { min: 1, max: 1 },
          palette: ["#808080"],
          traits: [],
        },
      },
    },
  ];
  const grounded = inspect({ groundY: 0, tolerance: 0 });
  TestValidator.equals(
    "compressed count stays separate",
    [
      grounded.census.populationSets,
      grounded.census.populationMembers,
      grounded.overlaps.measured,
    ],
    [1, 4, 1],
  );
  TestValidator.equals(
    "declared ground is measured",
    grounded.support.status,
    "measured",
  );
  if (grounded.support.status === "measured")
    TestValidator.equals(
      "population touches ground",
      grounded.support.report.grounded,
      1,
    );
  const floating = inspect({ groundY: -2, tolerance: 0 });
  if (floating.support.status === "measured")
    TestValidator.equals(
      "same population above reference ground",
      floating.support.report.floating.length,
      1,
    );
  environment.models = [];
  environment.populations = [];
  TestValidator.equals(
    "empty geometry population",
    inspect().storage.uniqueSerializedGeometries,
    0,
  );
};
