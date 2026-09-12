import {
  materializeCompiledFormation,
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSet,
  materializeCompiledInstanceSetInventory,
  worldRamp,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieInstanceSetDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const unit = (id: string): IAutoMovieFormationDesign => ({
  id,
  modelRecipe: "member",
  count: 4,
  layout: {
    kind: "line",
    files: 2,
    ranks: 2,
    spacing: { lateral: 1, depth: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1,
  capabilities: [],
  heroOverrides: [],
});

const grove = (id: string): IAutoMovieInstanceSetDesign => ({
  id,
  modelRecipe: "tree",
  count: 3,
  layout: { kind: "grid", rows: 1, columns: 3, spacing: { x: 2, z: 2 } },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1,
  variation: { scale: { min: 1, max: 1 }, palette: ["#00ff00"], traits: [] },
});

const field = worldRamp({
  id: "field",
  from: { x: -5, z: -5 },
  to: { x: -5, z: 5 },
  width: 20,
  baseHeight: 0,
  rise: 2,
  walkable: true,
});

/**
 * A production's compiled populations are keyed by id in code-unit order, and
 * each record is the one its own kernel compiles from the same inputs.
 *
 * Code-unit order puts an upper-case id before every lower-case one, which is
 * not the order the designs are listed in here, so a key order that merely
 * followed insertion would fail.
 *
 * Scenarios:
 *
 * 1. Formations listed b, B, a are keyed B, a, b, and each record equals the
 *    formation kernel's output for the same recipes, radii and terrain.
 * 2. Instance sets declared y, X, x are keyed X, x, y, and each record equals the
 *    instance-set kernel's output for the same world, recipes and radii.
 * 3. No formations, and a world that declares no instance sets or an empty list,
 *    compile to empty inventories.
 */
export const test_engine_compiled_population_inventory = (): void => {
  const radii = new Map([
    ["member", 0.75],
    ["tree", 2],
  ]);
  const formations = materializeCompiledFormationInventory({
    formations: new Map([
      ["b", unit("b")],
      ["B", unit("B")],
      ["a", unit("a")],
    ]),
    projectionRadii: radii,
    surfaces: [field],
  });
  const world = {
    routes: [],
    instanceSets: [grove("y"), grove("X"), grove("x")],
  };
  const instanceSets = materializeCompiledInstanceSetInventory({
    world,
    projectionRadii: radii,
  });

  TestValidator.equals(
    "compiled populations are keyed in code-unit order",
    namedFacts([
      ["formationKeys", () => Object.keys(formations).join(",") === "B,a,b"],
      [
        "instanceSetKeys",
        () => Object.keys(instanceSets).join(",") === "X,x,y",
      ],
      ["terrainPassedThrough", () => formations.a!.ground.length === 1],
      [
        "radiiPassedThrough",
        () =>
          formations.a!.projectionRadius === 0.75 &&
          instanceSets.x!.projectionRadius === 2,
      ],
    ]),
    {
      formationKeys: true,
      instanceSetKeys: true,
      terrainPassedThrough: true,
      radiiPassedThrough: true,
    },
  );
  TestValidator.equals(
    "an inventory formation is the formation kernel's record",
    formations.B,
    materializeCompiledFormation({
      formation: unit("B"),
      projectionRadii: radii,
      surfaces: [field],
    }),
  );
  TestValidator.equals(
    "an inventory instance set is the instance-set kernel's record",
    instanceSets.X,
    materializeCompiledInstanceSet({
      instanceSet: grove("X"),
      world,
      projectionRadii: radii,
    }),
  );
  TestValidator.equals(
    "no declared population compiles to an empty inventory",
    namedFacts([
      [
        "noFormations",
        () =>
          Object.keys(
            materializeCompiledFormationInventory({ formations: new Map() }),
          ).length === 0,
      ],
      [
        "noInstanceSetsKey",
        () =>
          Object.keys(
            materializeCompiledInstanceSetInventory({ world: { routes: [] } }),
          ).length === 0,
      ],
      [
        "emptyInstanceSets",
        () =>
          Object.keys(
            materializeCompiledInstanceSetInventory({
              world: { routes: [], instanceSets: [] },
            }),
          ).length === 0,
      ],
    ]),
    { noFormations: true, noInstanceSetsKey: true, emptyInstanceSets: true },
  );
};
