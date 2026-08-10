import {
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentBuildingOfSpace,
  builtEnvironmentContainsPoint,
  builtEnvironmentSpaceConnectors,
  builtEnvironmentSpaceNodes,
  builtEnvironmentSpaceSurfaces,
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
    {
      id: "curtain-wall",
      kind: "envelope",
      parent: "root",
      transform: transform(5, 3.5, 0),
      model: "slab",
      space: null,
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
    {
      space: "roof",
      surface: {
        id: "helipad-deck",
        kind: "platform",
        polygon: [
          { x: 7, y: 0, z: -3 },
          { x: 13, y: 0, z: -3 },
          { x: 13, y: 0, z: 3 },
          { x: 7, y: 0, z: 3 },
        ],
        anchor: { x: 7, y: 7, z: -3 },
        rampTo: null,
      },
    },
  ],
  walkable: ["ground-floor", "upper-floor"],
});

/** Two independently placed building units sharing one work. */
const campus = (): IAutoMovieBuiltEnvironment => {
  const value = building();
  value.elements.push({
    id: "annex-root",
    kind: "building",
    parent: null,
    transform: transform(-20, 0, 4),
    model: null,
    space: "annex-space",
  });
  value.spaces.push({
    id: "annex-space",
    kind: "building",
    parent: null,
    cells: [],
  });
  value.buildings.push({
    id: "annex",
    element: "annex-root",
    space: "annex-space",
  });
  return value;
};

/**
 * The exact violation paths one mutation produces, so a refusal is pinned to
 * the field the author wrote rather than to "something failed".
 */
const refusalPaths = (
  mutate: (value: IAutoMovieBuiltEnvironment) => void,
): string[] => {
  const value = building();
  mutate(value);
  const validation = validateBuiltEnvironment({ environment: value });
  return validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);
};

/**
 * A building keeps its visible assembly, its logical partitions, and its
 * traversal relations as three linked graphs over one set of stable ids, then
 * lowers once into ordinary shot contributions. This pins that the two
 * hierarchies stay independent, that every query answers by stable id, that a
 * floor is one classification among many rather than the root of anything, and
 * that each malformed graph is refused at the exact field that broke.
 *
 * Scenarios:
 *
 * 1. A four-space, three-connector tower validates, and the space list it lowers
 *    to is namespaced by the work id rather than colliding with world spaces.
 * 2. Parent-local placement flattens to world TRS: a slab offset under a
 *    translated root lands at the summed position with its own axis scale, and
 *    a quarter-turn about Z survives as a quaternion rather than a yaw.
 * 3. Support spaces merge into one stage space without restating surfaces.
 * 4. Containment answers for a space and every descendant, and refuses a point
 *    outside all of them.
 * 5. Adjacency follows both boundaries and connectors, and honours a one-way
 *    ladder in one direction only.
 * 6. The connector query answers with the authored records, so a stair's 3D centre
 *    route is still there after the query.
 * 7. The surface query answers support patches by stable id for a space and its
 *    descendants, separating "supports" from "walkable" (the helipad deck holds
 *    a prop but is not walkable).
 * 8. The staged-node query returns exactly the lowered `node` ids of a space's
 *    subtree, and the envelope element that belongs to no logical space is in
 *    the set yet in no room: visible and semantic never diverge, and neither is
 *    forced to be a subset of the other.
 * 9. Building ownership is answered per logical space across two units.
 * 10. Every query refuses an unknown space id instead of answering emptily.
 * 11. Declaration order does not change the lowering, because parents are composed
 *     by reference rather than by position.
 * 12. One work owns two independently rooted, independently placed units.
 * 13. Sixty-eight malformed graphs are each refused at their own path.
 * 14. Lowering refuses an invalid building rather than emitting a partial set.
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
  TestValidator.equals(
    "connector endpoints and authored 3D routes survive the query",
    builtEnvironmentSpaceConnectors(source, "upper").map((connector) => ({
      id: connector.id,
      from: connector.from,
      to: connector.to,
      route: connector.route,
    })),
    [
      {
        id: "grand-stair",
        from: "ground",
        to: "upper",
        route: [
          { x: 8, y: 0, z: 0 },
          { x: 10, y: 4, z: 0 },
        ],
      },
      {
        id: "facade-ladder",
        from: "roof",
        to: "upper",
        route: [
          { x: 15, y: 7, z: 0 },
          { x: 15, y: 4, z: 0 },
        ],
      },
    ],
  );
  TestValidator.equals(
    "a space with no connector at all answers with an empty list",
    builtEnvironmentSpaceConnectors(source, "whole"),
    [],
  );
  TestValidator.equals(
    "support and walkability are answered separately by stable surface id",
    {
      whole: builtEnvironmentSpaceSurfaces(source, "whole"),
      roof: builtEnvironmentSpaceSurfaces(source, "roof"),
    },
    {
      whole: [
        { space: "ground", surface: "ground-floor", walkable: true },
        { space: "upper", surface: "upper-floor", walkable: true },
        { space: "roof", surface: "helipad-deck", walkable: false },
      ],
      roof: [{ space: "roof", surface: "helipad-deck", walkable: false }],
    },
  );
  TestValidator.equals(
    "staged nodes and logical spaces answer over the same stable ids",
    {
      whole: builtEnvironmentSpaceNodes(source, "whole"),
      ground: builtEnvironmentSpaceNodes(source, "ground"),
      unplaced: pieces
        .map((piece) => piece.node)
        .filter(
          (node) => !builtEnvironmentSpaceNodes(source, "whole").includes(node),
        ),
    },
    {
      whole: ["tower/ground-slab", "tower/bridge", "tower/helipad"],
      ground: ["tower/ground-slab"],
      unplaced: ["tower/curtain-wall"],
    },
  );
  const twoUnits = campus();
  TestValidator.equals(
    "each logical space names the building unit that owns it",
    {
      room: builtEnvironmentBuildingOfSpace(twoUnits, "ground"),
      root: builtEnvironmentBuildingOfSpace(twoUnits, "whole"),
      annex: builtEnvironmentBuildingOfSpace(twoUnits, "annex-space"),
    },
    { room: "tower-a", root: "tower-a", annex: "annex" },
  );
  TestValidator.error("unknown containment space throws", () =>
    builtEnvironmentContainsPoint(source, "missing", { x: 0, y: 0, z: 0 }),
  );
  TestValidator.error("unknown adjacency space throws", () =>
    builtEnvironmentAdjacentSpaces(source, "missing"),
  );
  TestValidator.error("unknown connector space throws", () =>
    builtEnvironmentSpaceConnectors(source, "missing"),
  );
  TestValidator.error("unknown surface space throws", () =>
    builtEnvironmentSpaceSurfaces(source, "missing"),
  );
  TestValidator.error("unknown staged-node space throws", () =>
    builtEnvironmentSpaceNodes(source, "missing"),
  );
  TestValidator.error("unknown owner space throws", () =>
    builtEnvironmentBuildingOfSpace(source, "missing"),
  );
  TestValidator.error("a space owned by no building unit throws", () => {
    const orphan = building();
    orphan.spaces.push({
      id: "detached",
      kind: "room",
      parent: null,
      cells: [],
    });
    builtEnvironmentBuildingOfSpace(orphan, "detached");
  });

  const reversed = building();
  reversed.elements.reverse();
  TestValidator.equals(
    "lowering composes parents independently of declaration order",
    lowerBuiltEnvironment(reversed).set?.length,
    4,
  );

  TestValidator.equals(
    "one work may own independently placed building units",
    validateBuiltEnvironment({ environment: twoUnits }).success,
    true,
  );

  const malformed: Array<
    readonly [string, (value: IAutoMovieBuiltEnvironment) => void, string]
  > = [
    ["blank building id", (value) => (value.id = " "), "$input.id"],
    ["unknown version", (value) => (value.version = 2 as 1), "$input.version"],
    [
      "unknown units",
      (value) => (value.units = "foot" as "meter"),
      "$input.units",
    ],
    [
      "no building units",
      (value) => (value.buildings = []),
      "$input.buildings",
    ],
    [
      "duplicate building unit",
      (value) => value.buildings.push(value.buildings[0]!),
      "$input.buildings[1].id",
    ],
    [
      "blank building unit",
      (value) => (value.buildings[0]!.id = " "),
      "$input.buildings[0].id",
    ],
    [
      "missing building element",
      (value) => (value.buildings[0]!.element = "missing"),
      "$input.buildings[0].element",
    ],
    [
      "nested building element",
      (value) => (value.buildings[0]!.element = "ground-slab"),
      "$input.buildings[0].element",
    ],
    [
      "missing building space",
      (value) => (value.buildings[0]!.space = "missing"),
      "$input.buildings[0].space",
    ],
    [
      "nested building space",
      (value) => (value.buildings[0]!.space = "ground"),
      "$input.buildings[0].space",
    ],
    [
      "shared building element root",
      (value) =>
        value.buildings.push({ id: "annex", element: "root", space: "upper" }),
      "$input.buildings[1].element",
    ],
    [
      "shared building space root",
      (value) =>
        value.buildings.push({
          id: "annex",
          element: "bridge",
          space: "whole",
        }),
      "$input.buildings[1].space",
    ],
    [
      "unowned root element",
      (value) =>
        value.elements.push({
          id: "detached-root",
          kind: "folly",
          parent: null,
          transform: transform(40),
          model: null,
          space: null,
        }),
      "$input.elements[5].parent",
    ],
    [
      "unowned root space",
      (value) =>
        value.spaces.push({
          id: "detached",
          kind: "room",
          parent: null,
          cells: [],
        }),
      "$input.spaces[4].parent",
    ],
    [
      "duplicate model",
      (value) => value.models.push(value.models[0]!),
      "$input.models[1].id",
    ],
    [
      "invalid owned model",
      (value) => (value.models[0]!.id = " "),
      "$input.models[0].id",
    ],
    [
      "blank model reference",
      (value) => (value.modelReferences[0] = " "),
      "$input.modelReferences[0]",
    ],
    [
      "owned model reference",
      (value) => value.modelReferences.push("slab"),
      "$input.modelReferences[1]",
    ],
    [
      "duplicate model reference",
      (value) => value.modelReferences.push("external-stone"),
      "$input.modelReferences[1]",
    ],
    [
      "blank space id",
      (value) => (value.spaces[1]!.id = " "),
      "$input.spaces[1].id",
    ],
    [
      "blank space kind",
      (value) => (value.spaces[1]!.kind = " "),
      "$input.spaces[1].kind",
    ],
    [
      "missing space parent",
      (value) => (value.spaces[1]!.parent = "missing"),
      "$input.spaces[1].parent",
    ],
    [
      "space cycle",
      (value) => (value.spaces[0]!.parent = "ground"),
      "$input.spaces[0].parent",
    ],
    [
      "blank cell id",
      (value) => (value.spaces[1]!.cells[0]!.id = " "),
      "$input.spaces[1].cells[0].id",
    ],
    [
      "duplicate cell",
      (value) => value.spaces[1]!.cells.push(value.spaces[1]!.cells[0]!),
      "$input.spaces[1].cells[1].id",
    ],
    [
      "too few cell planes",
      (value) => (value.spaces[1]!.cells[0]!.planes = []),
      "$input.spaces[1].cells[0].planes",
    ],
    [
      "non-finite plane normal",
      (value) => (value.spaces[1]!.cells[0]!.planes[0]!.normal.x = Number.NaN),
      "$input.spaces[1].cells[0].planes[0].normal.x",
    ],
    [
      "zero plane normal",
      (value) =>
        (value.spaces[1]!.cells[0]!.planes[0]!.normal = { x: 0, y: 0, z: 0 }),
      "$input.spaces[1].cells[0].planes[0].normal",
    ],
    [
      "non-finite plane offset",
      (value) =>
        (value.spaces[1]!.cells[0]!.planes[0]!.offset =
          Number.POSITIVE_INFINITY),
      "$input.spaces[1].cells[0].planes[0].offset",
    ],
    [
      "duplicate element",
      (value) => value.elements.push(value.elements[0]!),
      "$input.elements[5].id",
    ],
    [
      "blank element id",
      (value) => (value.elements[1]!.id = " "),
      "$input.elements[1].id",
    ],
    [
      "blank element kind",
      (value) => (value.elements[1]!.kind = " "),
      "$input.elements[1].kind",
    ],
    [
      "missing element parent",
      (value) => (value.elements[1]!.parent = "missing"),
      "$input.elements[1].parent",
    ],
    [
      "missing element model",
      (value) => (value.elements[1]!.model = "missing"),
      "$input.elements[1].model",
    ],
    [
      "missing element space",
      (value) => (value.elements[1]!.space = "missing"),
      "$input.elements[1].space",
    ],
    [
      "invalid element transform",
      (value) => (value.elements[1]!.transform.scale.x = 0),
      "$input.elements[1].transform.scale.x",
    ],
    [
      "element cycle",
      (value) => (value.elements[0]!.parent = "ground-slab"),
      "$input.elements[0].parent",
    ],
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
      "$input.elements[1].transform",
    ],
    [
      "duplicate boundary",
      (value) => value.boundaries.push(value.boundaries[0]!),
      "$input.boundaries[2].id",
    ],
    [
      "blank boundary id",
      (value) => (value.boundaries[0]!.id = " "),
      "$input.boundaries[0].id",
    ],
    [
      "blank boundary kind",
      (value) => (value.boundaries[0]!.kind = " "),
      "$input.boundaries[0].kind",
    ],
    [
      "empty boundary spaces",
      (value) => (value.boundaries[0]!.spaces = []),
      "$input.boundaries[0].spaces",
    ],
    [
      "three boundary spaces",
      (value) => value.boundaries[0]!.spaces.push("roof"),
      "$input.boundaries[0].spaces",
    ],
    [
      "missing boundary space",
      (value) => (value.boundaries[0]!.spaces[0] = "missing"),
      "$input.boundaries[0].spaces[0]",
    ],
    [
      "duplicate boundary space",
      (value) => (value.boundaries[0]!.spaces[1] = "ground"),
      "$input.boundaries[0].spaces[1]",
    ],
    [
      "missing boundary element",
      (value) => (value.boundaries[0]!.elements[0] = "missing"),
      "$input.boundaries[0].elements[0]",
    ],
    [
      "duplicate boundary element",
      (value) => value.boundaries[0]!.elements.push("bridge"),
      "$input.boundaries[0].elements[1]",
    ],
    [
      "duplicate opening",
      (value) => value.openings.push(value.openings[0]!),
      "$input.openings[1].id",
    ],
    [
      "blank opening id",
      (value) => (value.openings[0]!.id = " "),
      "$input.openings[0].id",
    ],
    [
      "blank opening kind",
      (value) => (value.openings[0]!.kind = " "),
      "$input.openings[0].kind",
    ],
    [
      "opening without host",
      (value) => (value.openings[0]!.boundary = "missing"),
      "$input.openings[0].boundary",
    ],
    [
      "missing opening fill",
      (value) => (value.openings[0]!.fill = "missing"),
      "$input.openings[0].fill",
    ],
    [
      "duplicate connector",
      (value) => value.connectors.push(value.connectors[0]!),
      "$input.connectors[3].id",
    ],
    [
      "unknown connector kind",
      (value) => (value.connectors[0]!.kind = "teleport" as "other"),
      "$input.connectors[0].kind",
    ],
    [
      "missing connector from",
      (value) => (value.connectors[0]!.from = "missing"),
      "$input.connectors[0].from",
    ],
    [
      "missing connector to",
      (value) => (value.connectors[0]!.to = "missing"),
      "$input.connectors[0].to",
    ],
    [
      "same connector endpoints",
      (value) => (value.connectors[0]!.to = "ground"),
      "$input.connectors[0].to",
    ],
    [
      "short connector route",
      (value) => (value.connectors[0]!.route = []),
      "$input.connectors[0].route",
    ],
    [
      "non-finite connector route",
      (value) => (value.connectors[0]!.route[0]!.x = Number.NaN),
      "$input.connectors[0].route[0].x",
    ],
    [
      "invalid connector width",
      (value) => (value.connectors[0]!.width = 0),
      "$input.connectors[0].width",
    ],
    [
      "invalid connector clearance",
      (value) => (value.connectors[0]!.clearHeight = Number.NaN),
      "$input.connectors[0].clearHeight",
    ],
    [
      "missing connector element",
      (value) => (value.connectors[0]!.elements[0] = "missing"),
      "$input.connectors[0].elements[0]",
    ],
    [
      "duplicate connector element",
      (value) => value.connectors[0]!.elements.push("bridge"),
      "$input.connectors[0].elements[1]",
    ],
    [
      "missing surface space",
      (value) => (value.surfaces[0]!.space = "missing"),
      "$input.surfaces[0].space",
    ],
    [
      "invalid support surface",
      (value) => (value.surfaces[0]!.surface.polygon = []),
      "$input.surfaces[0].surface.polygon",
    ],
    [
      "duplicate support surface",
      (value) => value.surfaces.push(value.surfaces[0]!),
      "$input.surfaces[3].surface.id",
    ],
    [
      "missing walkable surface",
      (value) => value.walkable.push("missing"),
      "$input.walkable[2]",
    ],
    [
      "duplicate walkable surface",
      (value) => value.walkable.push("ground-floor"),
      "$input.walkable[2]",
    ],
  ];
  malformed.forEach(([name, mutate, path]) =>
    TestValidator.equals(
      `${name} is refused at ${path}`,
      refusalPaths(mutate).includes(path),
      true,
    ),
  );
  TestValidator.equals(
    "the untouched fixture produces no violation path at all",
    refusalPaths(() => {}),
    [],
  );
  TestValidator.error("lowering refuses an invalid building", () => {
    const value = building();
    value.elements[0]!.parent = "missing";
    lowerBuiltEnvironment(value);
  });
};
