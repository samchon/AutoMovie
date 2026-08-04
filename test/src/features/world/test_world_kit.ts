import {
  assertWorldPlacements,
  worldAlongRoute,
  worldBlock,
  worldGrid,
  worldRamp,
  worldScatter,
  worldSurfaceHeight,
  worldTerrain,
} from "@automovie/engine";
import { IAutoMovieInstanceSetDesign } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const instanceBase = (): Omit<IAutoMovieInstanceSetDesign, "layout"> => ({
  id: "trees",
  modelRecipe: "tree",
  count: 12,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 7,
  variation: {
    scale: { min: 0.8, max: 1.2 },
    palette: ["#335522", "#557733"],
    traits: [{ name: "wind", min: 0, max: 1 }],
  },
});

/** World-kit constructors stay procedural while placement contradictions throw. */
export const test_world_kit = (): void => {
  const ground = worldTerrain({
    id: "ground",
    polygon: [
      { x: -20, z: -20 },
      { x: 20, z: -20 },
      { x: 20, z: 20 },
      { x: -20, z: 20 },
    ],
    height: 0,
    walkable: true,
  });
  const ramp = worldRamp({
    id: "ramp",
    from: { x: -4, z: -4 },
    to: { x: -4, z: 4 },
    width: 2,
    baseHeight: 0,
    rise: 2,
    walkable: true,
  });
  const building = worldBlock({
    id: "house",
    kind: "building",
    base: { x: 8, y: 0, z: 8 },
    size: { x: 3, y: 4, z: 3 },
    color: "#886644",
  });
  const wall = worldBlock({
    id: "wall",
    kind: "wall",
    base: { x: -8, y: 0, z: 8 },
    size: { x: 5, y: 2, z: 0.4 },
    color: "#777777",
  });
  const route = {
    id: "road",
    waypoints: [
      { x: -15, z: -10 },
      { x: 0, z: -10 },
      { x: 15, z: -10 },
    ],
    allowedFormationWidth: 2,
  };
  const landmark = {
    id: "square",
    position: { x: 0, y: 0, z: 0 },
    radius: 2,
    meaning: "Reachable town square.",
  };
  assertWorldPlacements({
    blocks: [building, wall],
    surfaces: [ground, ramp],
    routes: [route],
    landmarks: [landmark],
  });
  const raisedBlock = worldBlock({
    id: "raised",
    kind: "building",
    base: { x: 0, y: 1, z: 0 },
    size: { x: 2, y: 2, z: 2 },
    color: "#665544",
  });
  const platform = worldTerrain({
    id: "platform",
    polygon: [
      { x: -2, z: -2 },
      { x: 2, z: -2 },
      { x: 2, z: 2 },
      { x: -2, z: 2 },
    ],
    height: 1,
    walkable: true,
  });
  assertWorldPlacements({
    blocks: [raisedBlock],
    surfaces: [ground, platform],
    routes: [],
    landmarks: [],
  });
  const grid = worldGrid(instanceBase(), {
    kind: "grid",
    rows: 3,
    columns: 4,
    spacing: { x: 2, z: 2 },
  });
  const scatter = worldScatter(instanceBase(), {
    kind: "scatter",
    radius: 10,
  });
  const alongRoute = worldAlongRoute(instanceBase(), {
    kind: "along-route",
    route: route.id,
    lateralJitter: 0.5,
  });
  TestValidator.equals(
    "terrain, ramp, blocks, and compact placement helpers retain exact facts",
    namedFacts([
      ["buildingRecipe", () => building.recipe.parameters.shape === "box"],
      ["buildingNode", () => building.node.model.endsWith(":house")],
      ["buildingBounds", () => building.bounds.min.y === 0],
      [
        "worldSurfaceHeightGround",
        () => worldSurfaceHeight(ground, { x: 0, z: 0 }) === 0,
      ],
      [
        "worldSurfaceHeightRamp",
        () => worldSurfaceHeight(ramp, { x: -4, z: 4 }) === 2,
      ],
      ["gridLayout", () => grid.layout.kind === "grid"],
      ["scatterLayout", () => scatter.layout.kind === "scatter"],
      ["alongRouteLayout", () => alongRoute.layout.kind === "along-route"],
      ["gridInstanceBase", () => grid !== instanceBase()],
    ]),
    {
      buildingRecipe: true,
      buildingNode: true,
      buildingBounds: true,
      worldSurfaceHeightGround: true,
      worldSurfaceHeightRamp: true,
      gridLayout: true,
      scatterLayout: true,
      alongRouteLayout: true,
      gridInstanceBase: true,
    },
  );

  const routeLandmark = {
    ...landmark,
    id: "route-only",
    position: { x: 0, y: 0, z: -10 },
  };
  assertWorldPlacements({
    blocks: [],
    surfaces: [],
    routes: [route],
    landmarks: [routeLandmark],
  });

  const rejected = [
    () =>
      worldBlock({
        id: "",
        kind: "wall",
        base: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: "#ffffff",
      }),
    () =>
      worldBlock({
        id: "size",
        kind: "wall",
        base: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 1, z: 1 },
        color: "#ffffff",
      }),
    () =>
      worldBlock({
        id: "base",
        kind: "wall",
        base: { x: Number.NaN, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: "#ffffff",
      }),
    () =>
      worldBlock({
        id: "color",
        kind: "wall",
        base: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: "white",
      }),
    () =>
      worldRamp({
        id: "invalid",
        from: { x: 0, z: 0 },
        to: { x: 0, z: 0 },
        width: 0,
        baseHeight: 0,
        rise: 0,
        walkable: true,
      }),
    () =>
      assertWorldPlacements({
        blocks: [
          building,
          {
            ...building,
            id: "overlap",
            recipe: { ...building.recipe, id: "overlap" },
            node: { ...building.node, id: "overlap" },
          },
        ],
        surfaces: [ground],
        routes: [],
        landmarks: [],
      }),
    () =>
      assertWorldPlacements({
        blocks: [
          worldBlock({
            id: "overhang",
            kind: "building",
            base: { x: 0, y: 0, z: 0 },
            size: { x: 4, y: 2, z: 4 },
            color: "#ffffff",
          }),
        ],
        surfaces: [
          worldTerrain({
            id: "tiny-support",
            polygon: [
              { x: -0.5, z: -0.5 },
              { x: 0.5, z: -0.5 },
              { x: 0.5, z: 0.5 },
              { x: -0.5, z: 0.5 },
            ],
            height: 0,
            walkable: true,
          }),
        ],
        routes: [],
        landmarks: [],
      }),
    () =>
      assertWorldPlacements({
        blocks: [
          {
            ...building,
            bounds: {
              ...building.bounds,
              min: { ...building.bounds.min, y: 1 },
            },
          },
        ],
        surfaces: [ground],
        routes: [],
        landmarks: [],
      }),
    () =>
      assertWorldPlacements({
        blocks: [building],
        surfaces: [ground],
        routes: [
          {
            ...route,
            waypoints: [
              { x: 0, z: 8 },
              { x: 15, z: 8 },
            ],
          },
        ],
        landmarks: [],
      }),
    () =>
      assertWorldPlacements({
        blocks: [],
        surfaces: [],
        routes: [],
        landmarks: [
          {
            ...landmark,
            id: "unreachable",
            position: { x: 100, y: 0, z: 100 },
          },
        ],
      }),
  ];
  rejected.forEach((callback, index) =>
    TestValidator.error(`invalid world placement ${index} throws`, callback),
  );
};
