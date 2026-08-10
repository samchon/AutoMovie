import {
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentContainsPoint,
  lowerBuiltEnvironment,
  mergeAutoMovieSpaces,
  validateBuiltEnvironment,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, qclose } from "../internal/predicates";

const transform = (
  x = 0,
  y = 0,
  z = 0,
  rotation: IAutoMovieTransform["rotation"] = { x: 0, y: 0, z: 0, w: 1 },
  scale: IAutoMovieTransform["scale"] = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale,
});

const boxCell = (
  id: string,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): IAutoMovieConvexSpaceCell => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

const building = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "tower",
  units: "meter",
  buildings: [{ id: "tower-a", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "slab" }],
  modelReferences: ["external-stone"],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: transform(10),
      model: null,
      space: "whole",
    },
    {
      id: "ground-slab",
      kind: "slab",
      parent: "root",
      transform: transform(
        2,
        0,
        0,
        { x: 0, y: 0, z: 0, w: 1 },
        {
          x: 4,
          y: 0.2,
          z: 3,
        },
      ),
      model: "slab",
      space: "ground",
    },
    {
      id: "bridge",
      kind: "skybridge",
      parent: "root",
      transform: transform(0, 4, 0, {
        x: 0,
        y: 0,
        z: Math.SQRT1_2,
        w: Math.SQRT1_2,
      }),
      model: "external-stone",
      space: "upper",
    },
    {
      id: "helipad",
      kind: "roof-helipad",
      parent: "root",
      transform: transform(0, 7, 0),
      model: "slab",
      space: "roof",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    {
      id: "ground",
      kind: "double-height-hall",
      parent: "whole",
      cells: [
        boxCell("ground-cell", { x: 5, y: 0, z: -5 }, { x: 15, y: 4, z: 5 }),
      ],
    },
    {
      id: "upper",
      kind: "mezzanine",
      parent: "whole",
      cells: [
        boxCell("upper-cell", { x: 5, y: 4, z: -5 }, { x: 15, y: 7, z: 5 }),
      ],
    },
    {
      id: "roof",
      kind: "roof-deck",
      parent: "whole",
      cells: [
        boxCell("roof-cell", { x: 5, y: 7, z: -5 }, { x: 15, y: 8, z: 5 }),
      ],
    },
  ],
  boundaries: [
    {
      id: "mezzanine-edge",
      kind: "open-edge",
      spaces: ["ground", "upper"],
      elements: ["bridge"],
    },
    {
      id: "facade",
      kind: "wall",
      spaces: ["ground"],
      elements: [],
    },
  ],
  openings: [
    {
      id: "arched-door",
      kind: "arch",
      boundary: "facade",
      fill: null,
    },
  ],
  connectors: [
    {
      id: "grand-stair",
      kind: "stair",
      from: "ground",
      to: "upper",
      bidirectional: true,
      route: [
        { x: 8, y: 0, z: 0 },
        { x: 10, y: 4, z: 0 },
      ],
      width: 2,
      clearHeight: 3,
      elements: ["bridge"],
    },
    {
      id: "service-lift",
      kind: "lift",
      from: "ground",
      to: "roof",
      bidirectional: true,
      route: [
        { x: 13, y: 0, z: 0 },
        { x: 13, y: 7, z: 0 },
      ],
      width: 1.5,
      clearHeight: 2.4,
      elements: [],
    },
    {
      id: "facade-ladder",
      kind: "ladder",
      from: "roof",
      to: "upper",
      bidirectional: false,
      route: [
        { x: 15, y: 7, z: 0 },
        { x: 15, y: 4, z: 0 },
      ],
      width: 0.5,
      clearHeight: 2,
      elements: [],
    },
  ],
  surfaces: [
    {
      space: "ground",
      surface: {
        id: "ground-floor",
        kind: "floor",
        polygon: [
          { x: 5, y: 0, z: -5 },
          { x: 15, y: 0, z: -5 },
          { x: 15, y: 0, z: 5 },
          { x: 5, y: 0, z: 5 },
        ],
        anchor: { x: 5, y: 0, z: -5 },
        rampTo: null,
      },
    },
    {
      space: "upper",
      surface: {
        id: "upper-floor",
        kind: "floor",
        polygon: [
          { x: 5, y: 0, z: -5 },
          { x: 15, y: 0, z: -5 },
          { x: 15, y: 0, z: 5 },
          { x: 5, y: 0, z: 5 },
        ],
        anchor: { x: 5, y: 4, z: -5 },
        rampTo: null,
      },
    },
  ],
  walkable: ["ground-floor", "upper-floor"],
});

const invalid = (
  mutate: (value: IAutoMovieBuiltEnvironment) => void,
): boolean => {
  const value = building();
  mutate(value);
  return validateBuiltEnvironment({ environment: value }).success === false;
};

/**
 * A building keeps visible hierarchy, logical partitions, and traversal as
 * separate but linked graphs, then lowers once to ordinary shot contributions.
 */
export const test_architecture_built_environment = (): void => {
  const source = building();
  TestValidator.equals(
    "a multi-level connected building validates",
    validateBuiltEnvironment({ environment: source }).success,
    true,
  );
  const contribution = lowerBuiltEnvironment(source);
  TestValidator.equals(
    "lowering preserves owned models and the structured building",
    {
      models: contribution.models?.map((model) => model.id),
      buildings: contribution.builtEnvironments?.map((value) => value.id),
      spaces: contribution.spaces?.map((space) => space.id),
    },
    {
      models: ["slab"],
      buildings: ["tower"],
      spaces: ["tower/whole", "tower/ground", "tower/upper", "tower/roof"],
    },
  );
  const pieces = contribution.set ?? [];
  TestValidator.equals(
    "parent-local placement is flattened to world-space full TRS",
    {
      slab: pieces.find((piece) => piece.node === "tower/ground-slab"),
      externalModel: pieces.find((piece) => piece.node === "tower/bridge")
        ?.model,
    },
    {
      slab: {
        node: "tower/ground-slab",
        model: "slab",
        position: { x: 12, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 4, y: 0.2, z: 3 },
      },
      externalModel: "external-stone",
    },
  );
  TestValidator.predicate(
    "full arbitrary rotation survives hierarchy lowering",
    qclose(pieces.find((piece) => piece.node === "tower/bridge")!.rotation!, {
      x: 0,
      y: 0,
      z: Math.SQRT1_2,
      w: Math.SQRT1_2,
    }),
  );
  TestValidator.equals(
    "logical support spaces merge without restating surfaces",
    mergeAutoMovieSpaces("tower-stage", contribution.spaces ?? []),
    {
      id: "tower-stage",
      surfaces: source.surfaces.map((entry) => entry.surface),
      walkable: ["ground-floor", "upper-floor"],
    },
  );
  TestValidator.equals(
    "containment includes descendants and excludes outside points",
    namedFacts([
      [
        "ground",
        () =>
          builtEnvironmentContainsPoint(source, "ground", {
            x: 10,
            y: 2,
            z: 0,
          }),
      ],
      [
        "whole",
        () =>
          builtEnvironmentContainsPoint(source, "whole", {
            x: 10,
            y: 5,
            z: 0,
          }),
      ],
      [
        "outside",
        () =>
          !builtEnvironmentContainsPoint(source, "whole", {
            x: 100,
            y: 0,
            z: 0,
          }),
      ],
    ]),
    { ground: true, whole: true, outside: true },
  );
  TestValidator.equals(
    "boundaries and directional connectors answer adjacency",
    {
      ground: builtEnvironmentAdjacentSpaces(source, "ground"),
      roof: builtEnvironmentAdjacentSpaces(source, "roof"),
      upper: builtEnvironmentAdjacentSpaces(source, "upper"),
    },
    {
      ground: ["upper", "roof"],
      roof: ["ground", "upper"],
      upper: ["ground"],
    },
  );
  TestValidator.error("unknown containment space throws", () =>
    builtEnvironmentContainsPoint(source, "missing", { x: 0, y: 0, z: 0 }),
  );
  TestValidator.error("unknown adjacency space throws", () =>
    builtEnvironmentAdjacentSpaces(source, "missing"),
  );

  const reversed = building();
  reversed.elements.reverse();
  TestValidator.equals(
    "lowering composes parents independently of declaration order",
    lowerBuiltEnvironment(reversed).set?.length,
    3,
  );

  const campus = building();
  campus.elements.push({
    id: "annex-root",
    kind: "building",
    parent: null,
    transform: transform(-20, 0, 4),
    model: null,
    space: "annex-space",
  });
  campus.spaces.push({
    id: "annex-space",
    kind: "building",
    parent: null,
    cells: [],
  });
  campus.buildings.push({
    id: "annex",
    element: "annex-root",
    space: "annex-space",
  });
  TestValidator.equals(
    "one work may own independently placed building units",
    validateBuiltEnvironment({ environment: campus }).success,
    true,
  );

  const malformed: Array<
    readonly [string, (value: IAutoMovieBuiltEnvironment) => void]
  > = [
    ["blank building id", (value) => (value.id = " ")],
    ["unknown version", (value) => (value.version = 2 as 1)],
    ["unknown units", (value) => (value.units = "foot" as "meter")],
    ["no building units", (value) => (value.buildings = [])],
    [
      "duplicate building unit",
      (value) => value.buildings.push(value.buildings[0]!),
    ],
    ["blank building unit", (value) => (value.buildings[0]!.id = " ")],
    [
      "missing building element",
      (value) => (value.buildings[0]!.element = "missing"),
    ],
    [
      "nested building element",
      (value) => (value.buildings[0]!.element = "ground-slab"),
    ],
    [
      "missing building space",
      (value) => (value.buildings[0]!.space = "missing"),
    ],
    [
      "nested building space",
      (value) => (value.buildings[0]!.space = "ground"),
    ],
    [
      "shared building element root",
      (value) =>
        value.buildings.push({ id: "annex", element: "root", space: "upper" }),
    ],
    [
      "shared building space root",
      (value) =>
        value.buildings.push({
          id: "annex",
          element: "bridge",
          space: "whole",
        }),
    ],
    ["duplicate model", (value) => value.models.push(value.models[0]!)],
    ["invalid owned model", (value) => (value.models[0]!.id = " ")],
    ["blank model reference", (value) => (value.modelReferences[0] = " ")],
    ["owned model reference", (value) => value.modelReferences.push("slab")],
    [
      "duplicate model reference",
      (value) => value.modelReferences.push("external-stone"),
    ],
    ["blank space id", (value) => (value.spaces[1]!.id = " ")],
    ["blank space kind", (value) => (value.spaces[1]!.kind = " ")],
    ["missing space parent", (value) => (value.spaces[1]!.parent = "missing")],
    ["space cycle", (value) => (value.spaces[0]!.parent = "ground")],
    ["blank cell id", (value) => (value.spaces[1]!.cells[0]!.id = " ")],
    [
      "duplicate cell",
      (value) => value.spaces[1]!.cells.push(value.spaces[1]!.cells[0]!),
    ],
    [
      "too few cell planes",
      (value) => (value.spaces[1]!.cells[0]!.planes = []),
    ],
    [
      "non-finite plane normal",
      (value) => (value.spaces[1]!.cells[0]!.planes[0]!.normal.x = Number.NaN),
    ],
    [
      "zero plane normal",
      (value) =>
        (value.spaces[1]!.cells[0]!.planes[0]!.normal = { x: 0, y: 0, z: 0 }),
    ],
    [
      "non-finite plane offset",
      (value) =>
        (value.spaces[1]!.cells[0]!.planes[0]!.offset =
          Number.POSITIVE_INFINITY),
    ],
    ["duplicate element", (value) => value.elements.push(value.elements[0]!)],
    ["blank element id", (value) => (value.elements[1]!.id = " ")],
    ["blank element kind", (value) => (value.elements[1]!.kind = " ")],
    [
      "missing element parent",
      (value) => (value.elements[1]!.parent = "missing"),
    ],
    [
      "missing element model",
      (value) => (value.elements[1]!.model = "missing"),
    ],
    [
      "missing element space",
      (value) => (value.elements[1]!.space = "missing"),
    ],
    [
      "invalid element transform",
      (value) => (value.elements[1]!.transform.scale.x = 0),
    ],
    ["element cycle", (value) => (value.elements[0]!.parent = "ground-slab")],
    [
      "hierarchical shear",
      (value) => {
        value.elements[0]!.transform.scale = { x: 2, y: 1, z: 1 };
        value.elements[1]!.transform.rotation = {
          x: 0,
          y: 0,
          z: Math.sin(Math.PI / 8),
          w: Math.cos(Math.PI / 8),
        };
      },
    ],
    [
      "duplicate boundary",
      (value) => value.boundaries.push(value.boundaries[0]!),
    ],
    ["blank boundary id", (value) => (value.boundaries[0]!.id = " ")],
    ["blank boundary kind", (value) => (value.boundaries[0]!.kind = " ")],
    ["empty boundary spaces", (value) => (value.boundaries[0]!.spaces = [])],
    [
      "three boundary spaces",
      (value) => value.boundaries[0]!.spaces.push("roof"),
    ],
    [
      "missing boundary space",
      (value) => (value.boundaries[0]!.spaces[0] = "missing"),
    ],
    [
      "duplicate boundary space",
      (value) => (value.boundaries[0]!.spaces[1] = "ground"),
    ],
    [
      "missing boundary element",
      (value) => (value.boundaries[0]!.elements[0] = "missing"),
    ],
    [
      "duplicate boundary element",
      (value) => value.boundaries[0]!.elements.push("bridge"),
    ],
    ["duplicate opening", (value) => value.openings.push(value.openings[0]!)],
    ["blank opening id", (value) => (value.openings[0]!.id = " ")],
    ["blank opening kind", (value) => (value.openings[0]!.kind = " ")],
    [
      "missing opening boundary",
      (value) => (value.openings[0]!.boundary = "missing"),
    ],
    ["missing opening fill", (value) => (value.openings[0]!.fill = "missing")],
    [
      "duplicate connector",
      (value) => value.connectors.push(value.connectors[0]!),
    ],
    [
      "unknown connector kind",
      (value) => (value.connectors[0]!.kind = "teleport" as "other"),
    ],
    [
      "missing connector from",
      (value) => (value.connectors[0]!.from = "missing"),
    ],
    ["missing connector to", (value) => (value.connectors[0]!.to = "missing")],
    [
      "same connector endpoints",
      (value) => (value.connectors[0]!.to = "ground"),
    ],
    ["short connector route", (value) => (value.connectors[0]!.route = [])],
    [
      "non-finite connector route",
      (value) => (value.connectors[0]!.route[0]!.x = Number.NaN),
    ],
    ["invalid connector width", (value) => (value.connectors[0]!.width = 0)],
    [
      "invalid connector clearance",
      (value) => (value.connectors[0]!.clearHeight = Number.NaN),
    ],
    [
      "missing connector element",
      (value) => (value.connectors[0]!.elements[0] = "missing"),
    ],
    [
      "duplicate connector element",
      (value) => value.connectors[0]!.elements.push("bridge"),
    ],
    [
      "missing surface space",
      (value) => (value.surfaces[0]!.space = "missing"),
    ],
    [
      "invalid support surface",
      (value) => (value.surfaces[0]!.surface.polygon = []),
    ],
    ["missing walkable surface", (value) => value.walkable.push("missing")],
  ];
  malformed.forEach(([name, mutate]) =>
    TestValidator.equals(`${name} is refused`, invalid(mutate), true),
  );
  TestValidator.error("lowering refuses an invalid building", () => {
    const value = building();
    value.elements[0]!.parent = "missing";
    lowerBuiltEnvironment(value);
  });
};
