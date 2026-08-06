import {
  IAutoMovieCompiledShotSource,
  IAutoMovieInstanceSetDesign,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AUTOMOVIE_INSTANCE_CHUNK_SIZE,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  materializeCompiledInstanceSet,
  materializeCompiledInstanceSetInventory,
  materializeInstanceSlot,
  materializeInstanceSlots,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  modelRecipe,
  productionCompileSucceeded,
  productionFixture,
  worldDesign,
} from "./productionFixtures";

interface IProductionInstancesFixtureFailure {
  error: unknown;
}

class ProductionInstancesFixtureCleanupError extends AggregateError {}

/** Dispose the production-instances fixture without replacing its failure. */
export const preserveProductionInstancesFixtureCleanup = (
  failure: IProductionInstancesFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionInstancesFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-instances fixture teardown failed after the test failed.",
    );
  }
};

const instanceSet = (
  id: string,
  count: number,
  layout: IAutoMovieInstanceSetDesign["layout"],
): IAutoMovieInstanceSetDesign => ({
  id,
  modelRecipe: "sentinel",
  count,
  layout,
  anchor: { x: 2, y: 0, z: 3 },
  facingDeg: 20,
  seed: 1_421,
  variation: {
    scale: { min: 0.8, max: 1.2 },
    palette: ["#335522", "#557733", "#779944"],
    traits: [
      { name: "pace", min: 0.5, max: 1.5 },
      { name: "windPhase", min: 0, max: 1 },
      { name: "__proto__", min: 2, max: 3 },
    ],
  },
});

/** General instance sets remain compact and regenerate identically everywhere. */
export const test_mcp_production_instances = (): void => {
  const route = {
    id: "market-road",
    waypoints: [
      { x: -10, z: -5 },
      { x: 0, z: 5 },
      { x: 10, z: -5 },
    ],
    allowedFormationWidth: 3,
  };
  const world: IAutoMovieWorldDesign = {
    ...worldDesign(),
    routes: [route],
  };
  const grid = instanceSet("civilians", 100, {
    kind: "grid",
    rows: 10,
    columns: 10,
    spacing: { x: 1.2, z: 1.4 },
  });
  const scatter = instanceSet("trees", 1_000, {
    kind: "scatter",
    radius: 75,
  });
  const alongRoute = instanceSet("roadside", 12, {
    kind: "along-route",
    route: route.id,
    lateralJitter: 0.75,
  });
  world.instanceSets = [grid, scatter, alongRoute];
  const gridSlots = materializeInstanceSlots(grid, world);
  const scatterSlots = materializeInstanceSlots(scatter, world);
  const repeatedScatter = materializeInstanceSlots(scatter, world);
  const highWordScatter = materializeInstanceSlots(
    { ...scatter, seed: scatter.seed + 4_294_967_296 },
    world,
  );
  const routeSlots = materializeInstanceSlots(alongRoute, world);
  TestValidator.equals(
    "100 civilians, 1000 trees, and route instances derive stable variation",
    namedFacts([
      ["gridSlots", () => gridSlots.length === 100],
      ["scatterSlots000", () => scatterSlots.length === 1_000],
      ["routeSlots", () => routeSlots.length === 12],
      [
        "stringifyScatterSlotsStringify",
        () => JSON.stringify(scatterSlots) === JSON.stringify(repeatedScatter),
      ],
      [
        "stringifyScatterSlotsStringify2",
        () => JSON.stringify(scatterSlots) !== JSON.stringify(highWordScatter),
      ],
      [
        "gridSlotsSlotConst",
        () =>
          gridSlots.every((slot) => {
            const prototypeTrait = Object.getOwnPropertyDescriptor(
              slot.traits,
              "__proto__",
            )?.value;
            return (
              slot.scale >= 0.8 &&
              slot.scale <= 1.2 &&
              slot.palette.startsWith("#") &&
              slot.traits.pace! >= 0.5 &&
              slot.traits.pace! <= 1.5 &&
              typeof prototypeTrait === "number" &&
              prototypeTrait >= 2 &&
              prototypeTrait <= 3
            );
          }),
      ],
      [
        "routeSlotsSlotSlot",
        () =>
          routeSlots.every(
            (slot) => slot.position.x >= -10 && slot.position.x <= 10,
          ),
      ],
    ]),
    {
      gridSlots: true,
      scatterSlots000: true,
      routeSlots: true,
      stringifyScatterSlotsStringify: true,
      stringifyScatterSlotsStringify2: true,
      gridSlotsSlotConst: true,
      routeSlotsSlotSlot: true,
    },
  );
  TestValidator.error("negative instance slot is refused", () =>
    materializeInstanceSlot(grid, world, -1),
  );
  TestValidator.error("missing along-route geometry is refused", () =>
    materializeInstanceSlot(alongRoute, { routes: [] }, 0),
  );
  TestValidator.error("non-finite route accumulation is refused", () =>
    materializeInstanceSlot(
      alongRoute,
      {
        routes: [
          {
            ...route,
            waypoints: [
              { x: -Number.MAX_VALUE, z: 0 },
              { x: Number.MAX_VALUE, z: 0 },
            ],
          },
        ],
      },
      0,
    ),
  );
  const extremeTraitSlot = materializeInstanceSlot(
    {
      ...grid,
      variation: {
        ...grid.variation,
        traits: [
          {
            name: "extreme",
            min: -Number.MAX_VALUE,
            max: Number.MAX_VALUE,
          },
        ],
      },
    },
    world,
    0,
  );
  TestValidator.predicate(
    "overflow-safe interpolation retains a finite direct slot",
    Number.isFinite(extremeTraitSlot.traits.extreme),
  );

  const recipes = new Map([[modelRecipe().id, modelRecipe()]]);
  const highCount = {
    ...scatter,
    count: AUTOMOVIE_INSTANCE_CHUNK_SIZE * 2 + 1,
  };
  const compact = materializeCompiledInstanceSet(highCount, world, recipes);
  const compactAgain = materializeCompiledInstanceSet(
    highCount,
    world,
    recipes,
  );
  const inventory = materializeCompiledInstanceSetInventory(world, recipes);
  TestValidator.equals(
    "compiled instance sets retain only bounded chunks and resolved route data",
    namedFacts([
      ["compactChunks", () => compact.chunks.length === 3],
      [
        "compactChunksCount",
        () => compact.chunks[0]?.count === AUTOMOVIE_INSTANCE_CHUNK_SIZE,
      ],
      ["compactChunksCount2", () => compact.chunks[2]?.count === 1],
      [
        "compactDigestCompactAgain",
        () => compact.digest === compactAgain.digest,
      ],
      ["compactProjectionRadius", () => compact.projectionRadius > 0],
      ["keysInventory", () => Object.keys(inventory).length === 3],
      [
        "inventoryRoadsideRoute",
        () => inventory.roadside?.route?.id === route.id,
      ],
      ["inventoryTreesRoute", () => inventory.trees?.route === null],
    ]),
    {
      compactChunks: true,
      compactChunksCount: true,
      compactChunksCount2: true,
      compactDigestCompactAgain: true,
      compactProjectionRadius: true,
      keysInventory: true,
      inventoryRoadsideRoute: true,
      inventoryTreesRoute: true,
    },
  );

  let productionInstancesFailure:
    | IProductionInstancesFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const fixtureWorld = project.graph().world!;
    project.setWorldDesign({
      ...fixtureWorld,
      routes: [route],
      instanceSets: [grid, scatter, alongRoute],
    });
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(
      sourcePath,
      source.replace(
        "): IAutoMovieProductionShotProgram => {",
        `): IAutoMovieProductionShotProgram => {
  const sampledGrid = context.engine.instanceSlot("civilians", 0);
  const sampledScatter = context.engine.instanceSlot("trees", 0);
  const sampledRoute = context.engine.instanceSlot("roadside", 0);
  if (JSON.stringify(sampledGrid) !== ${JSON.stringify(
    JSON.stringify(gridSlots[0]),
  )}) throw new Error("grid instance oracle diverged");
  if (JSON.stringify(sampledScatter) !== ${JSON.stringify(
    JSON.stringify(scatterSlots[0]),
  )}) throw new Error("scatter instance oracle diverged");
  if (JSON.stringify(sampledRoute) !== ${JSON.stringify(
    JSON.stringify(routeSlots[0]),
  )}) throw new Error("route instance oracle diverged");`,
      ),
    );
    const output = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const outputSucceeded = productionCompileSucceeded(
      "world instance fixture",
      output,
    );
    const compiled = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
        "utf8",
      ),
    ) as IAutoMovieCompiledShotSource;
    TestValidator.predicate(
      "compiler and sandbox oracle publish compact world instance runtimes",
      outputSucceeded &&
        compiled.instanceSets.length === 3 &&
        compiled.instanceSets.find((item) => item.id === "civilians")?.count ===
          100 &&
        compiled.instanceSets.find((item) => item.id === "trees")?.count ===
          1_000 &&
        compiled.models.some((model) => model.id.endsWith(":sentinel")),
    );
  } catch (error) {
    productionInstancesFailure = { error };
    throw error;
  } finally {
    preserveProductionInstancesFixtureCleanup(productionInstancesFailure, () =>
      fixture.dispose(),
    );
  }
};
