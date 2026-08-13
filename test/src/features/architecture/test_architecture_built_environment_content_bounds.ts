import {
  builtEnvironmentContainsPoint,
  builtEnvironmentSpaceContentBounds,
  builtEnvironmentSpaceNodes,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts, throwsError, vclose } from "../internal/predicates";

const place = (
  x: number,
  y: number,
  z: number,
  scale: IAutoMovieVector3 = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale,
});

const box = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
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

/** The eight corners of a unit cube, as a mesh the record states itself. */
const cubeMeshPart = (transform: IAutoMovieTransform): IAutoMovieModelPart => ({
  id: "slab-mesh",
  name: null,
  geometry: {
    type: "mesh",
    mesh: {
      positions: [
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      ],
      normals: null,
      uvs: null,
      indices: null,
      skin: null,
    },
  },
  material: null,
  attachedBone: null,
  transform,
});

const model = (id: string, parts: IAutoMovieModelPart[]): IAutoMovieModel => ({
  ...makeProp(parts),
  id,
});

/**
 * A stair hall declared far wider than the tower that actually stands in it.
 *
 * The cell is the one observed in the `#1902` residence experiment (x 3.5..14.5,
 * y 0..4.2, z 5.5..11.5); the tower inside it is written from unit boxes at
 * whole-metre placements so every expected bound is hand arithmetic rather than
 * a snapshot of what the kernel happened to print.
 */
const residence = (doorState = "closed"): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "residence",
  units: "meter",
  buildings: [
    { id: "residence-unit", element: "residence-root", space: "residence" },
  ],
  models: [
    model("stone", [
      primitivePart("block", { type: "box", width: 1, height: 1, depth: 1 }),
    ]),
    model("leaf", [
      primitivePart("panel", { type: "box", width: 0.1, height: 2, depth: 1 }),
    ]),
    // A stated mesh under a part transform: the other geometry spelling, and
    // the other placement path, measured by the same query.
    model("slab", [cubeMeshPart(place(0, 0, -0.4, { x: 2, y: 0.2, z: 2.6 }))]),
  ],
  modelReferences: ["vault-mesh"],
  elements: [
    {
      id: "residence-root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "residence",
    },
    {
      id: "stair-tower-west",
      kind: "wall",
      parent: "residence-root",
      transform: place(9.5, 2, 8.5, { x: 1, y: 4, z: 5 }),
      model: "stone",
      space: "stair-ground",
    },
    {
      id: "stair-tower-east",
      kind: "wall",
      parent: "residence-root",
      transform: place(13.5, 2, 8.5, { x: 1, y: 4, z: 5 }),
      model: "stone",
      space: "stair-ground",
    },
    {
      id: "stair-door-leaf",
      kind: "door-leaf",
      parent: "residence-root",
      transform: place(9, 1, 8.5),
      model: "leaf",
      space: "stair-ground",
    },
    {
      id: "stair-landing-slab",
      kind: "floor-slab",
      parent: "residence-root",
      transform: place(11, 2, 7.5),
      model: "slab",
      space: "stair-landing",
    },
    {
      id: "stair-vault",
      kind: "vault",
      parent: "residence-root",
      transform: place(11, 3.9, 8),
      model: "vault-mesh",
      space: "stair-landing",
    },
    {
      // A grouping node inside the space that draws nothing: high enough that
      // counting it as content would be visible in the box.
      id: "stair-tower-assembly",
      kind: "assembly",
      parent: "residence-root",
      transform: place(11, 8, 8.5),
      model: null,
      space: "stair-ground",
    },
    {
      id: "hall-table",
      kind: "furniture",
      parent: "residence-root",
      transform: place(5, 0.5, 8),
      model: "stone",
      space: "hall",
    },
    {
      id: "residence-eaves",
      kind: "eaves",
      parent: "residence-root",
      transform: place(20, 6, 20, { x: 2, y: 0.2, z: 2 }),
      model: "stone",
      space: null,
    },
  ],
  spaces: [
    { id: "residence", kind: "building", parent: null, cells: [] },
    {
      id: "stair-ground",
      kind: "stair-hall",
      parent: "residence",
      cells: [
        box(
          "stair-ground-cell",
          { x: 3.5, y: 0, z: 5.5 },
          { x: 14.5, y: 4.2, z: 11.5 },
        ),
      ],
    },
    {
      id: "stair-landing",
      kind: "landing",
      parent: "stair-ground",
      cells: [
        box(
          "stair-landing-cell",
          { x: 9.5, y: 1.5, z: 5.5 },
          { x: 13.5, y: 4.2, z: 9 },
        ),
      ],
    },
    {
      id: "hall",
      kind: "hall",
      parent: "residence",
      cells: [
        box("hall-cell", { x: 0, y: 0, z: 5.5 }, { x: 3.5, y: 4.2, z: 11.5 }),
      ],
    },
    { id: "west-wing", kind: "wing", parent: "residence", cells: [] },
  ],
  boundaries: [
    {
      id: "stair-west-wall",
      kind: "wall",
      spaces: ["stair-ground"],
      elements: ["stair-tower-west"],
    },
  ],
  openings: [
    {
      id: "stair-door",
      kind: "door",
      boundary: "stair-west-wall",
      fill: "stair-door-leaf",
      operation: {
        panels: [
          {
            id: "stair-door-panel",
            element: "stair-door-leaf",
            width: 1,
            height: 2,
            motion: {
              kind: "prismatic",
              axis: { x: -1, y: 0, z: 0 },
              min: 0,
              max: 0.9,
            },
          },
        ],
        states: [
          { id: "closed", panels: [{ panel: "stair-door-panel", value: 0 }] },
          { id: "open", panels: [{ panel: "stair-door-panel", value: 0.9 }] },
        ],
        state: doorState,
        hardware: [],
      },
    },
  ],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * A declared space is not where its contents are, and the box says which.
 *
 * The `#1902` experiment placed review cameras at the corners of a space's own
 * convex cell and three of the four stood in empty air facing a wall, because
 * `stair-ground` is declared eleven metres wide while the stair tower filling it
 * is five. This pins the query that answers the other question: the world extent
 * of what is actually staged in a space and everything below it, so a consumer
 * placing an eye aims at content rather than at a declaration.
 *
 * Every expected bound is hand arithmetic over unit primitives at whole-metre
 * placements, never a transcript of the kernel's own output.
 *
 * Scenarios:
 *
 * 1. The record validates, so nothing below is read off a malformed building.
 * 2. `stair-ground` is measured at x 8.95..14, y 0..4, z 5.8..11: the two tower
 *    walls, the closed door leaf standing 0.05 m proud of the west face, and the
 *    landing slab reaching to z 5.8. The unassigned eaves at x 19..21, the hall
 *    table in a sibling space, and the modelless assembly node standing at y 8
 *    inside this very space are all absent, which are the three ways an element
 *    fails the selection and each would move a bound if it were counted.
 * 3. The declared cell and the content disagree exactly as the experiment found:
 *    the corner camera at (4.1, 1.62, 6.1) is inside the space and outside its
 *    contents, so the cell could not have answered where to stand.
 * 4. A descendant space contributes: the landing slab and its vault sit below
 *    `stair-ground`, and their own box is the same query asked one level down.
 *    The slab is a stated mesh under its own part transform, so the other
 *    geometry spelling and the other placement path are measured here too.
 * 5. An element citing a runtime model reference the record does not own carries
 *    its world origin rather than nothing: the vault at y 3.9 raises the
 *    landing's top above the 2.1 the slab alone reaches.
 * 6. The box is measured where the current operating state puts a member, not at
 *    rest: opening the sliding leaf 0.9 m widens the same space to x 8.05.
 * 7. A space with nothing placed in it answers `null` rather than refusing or
 *    inventing a degenerate box, beside the empty node list of the same space.
 * 8. An undeclared space id is refused by name, exactly as every other query in
 *    the file refuses it.
 */
export const test_architecture_built_environment_content_bounds = (): void => {
  const closed = residence();
  TestValidator.equals(
    "the stair-hall record validates",
    validateBuiltEnvironment({ environment: closed }).success,
    true,
  );

  const ground = builtEnvironmentSpaceContentBounds(closed, "stair-ground");
  TestValidator.equals(
    "the box is the staged contents, not the declared cell",
    namedFacts([
      ["measured", () => ground !== null],
      [
        "min",
        () => ground !== null && vclose(ground.min, { x: 8.95, y: 0, z: 5.8 }),
      ],
      [
        "max",
        () => ground !== null && vclose(ground.max, { x: 14, y: 4, z: 11 }),
      ],
      [
        "sameElementsAsTheNodeQuery",
        () =>
          builtEnvironmentSpaceNodes(closed, "stair-ground").join(",") ===
          [
            "residence/stair-tower-west",
            "residence/stair-tower-east",
            "residence/stair-door-leaf",
            "residence/stair-landing-slab",
            "residence/stair-vault",
          ].join(","),
      ],
    ]),
    {
      measured: true,
      min: true,
      max: true,
      sameElementsAsTheNodeQuery: true,
    },
  );

  TestValidator.equals(
    "the declared cell puts a corner camera where the content is not",
    namedFacts([
      [
        "cornerIsInTheSpace",
        () =>
          builtEnvironmentContainsPoint(closed, "stair-ground", {
            x: 4.1,
            y: 1.62,
            z: 6.1,
          }),
      ],
      [
        "cornerIsOutsideTheContent",
        () => ground !== null && 4.1 < ground.min.x,
      ],
      [
        "centreOfTheContentIsInTheSpace",
        () =>
          ground !== null &&
          builtEnvironmentContainsPoint(closed, "stair-ground", {
            x: (ground.min.x + ground.max.x) / 2,
            y: (ground.min.y + ground.max.y) / 2,
            z: (ground.min.z + ground.max.z) / 2,
          }),
      ],
    ]),
    {
      cornerIsInTheSpace: true,
      cornerIsOutsideTheContent: true,
      centreOfTheContentIsInTheSpace: true,
    },
  );

  const landing = builtEnvironmentSpaceContentBounds(closed, "stair-landing");
  TestValidator.equals(
    "a descendant space is measured on its own, referenced models included",
    namedFacts([
      ["measured", () => landing !== null],
      [
        "min",
        () =>
          landing !== null && vclose(landing.min, { x: 10, y: 1.9, z: 5.8 }),
      ],
      [
        "max",
        () =>
          landing !== null && vclose(landing.max, { x: 12, y: 3.9, z: 8.4 }),
      ],
    ]),
    { measured: true, min: true, max: true },
  );

  const opened = builtEnvironmentSpaceContentBounds(
    residence("open"),
    "stair-ground",
  );
  TestValidator.equals(
    "an opened leaf is measured where it rests, not where it was authored",
    namedFacts([
      ["measured", () => opened !== null],
      [
        "min",
        () => opened !== null && vclose(opened.min, { x: 8.05, y: 0, z: 5.8 }),
      ],
      [
        "max",
        () => opened !== null && vclose(opened.max, { x: 14, y: 4, z: 11 }),
      ],
    ]),
    { measured: true, min: true, max: true },
  );

  TestValidator.equals(
    "a space holding nothing answers null beside an empty node list",
    {
      bounds: builtEnvironmentSpaceContentBounds(closed, "west-wing"),
      nodes: builtEnvironmentSpaceNodes(closed, "west-wing"),
    },
    { bounds: null, nodes: [] },
  );

  TestValidator.equals(
    "an undeclared logical space is refused by name",
    throwsError(
      () => builtEnvironmentSpaceContentBounds(closed, "cellar"),
      ['has no logical space "cellar"'],
    ),
    true,
  );
};
