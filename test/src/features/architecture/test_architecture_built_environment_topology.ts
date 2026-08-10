import {
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentBuildingOfSpace,
  builtEnvironmentContainsPoint,
  builtEnvironmentSpaceNodes,
  lowerBuiltEnvironment,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltElement,
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, nclose, qclose, vclose } from "../internal/predicates";

const WING_YAW = Math.PI / 6;
const ANNEX_TILT = (5 * Math.PI) / 180;

const yaw = (angle: number): IAutoMovieQuaternion => ({
  x: 0,
  y: Math.sin(angle / 2),
  z: 0,
  w: Math.cos(angle / 2),
});

const roll = (angle: number): IAutoMovieQuaternion => ({
  x: 0,
  y: 0,
  z: Math.sin(angle / 2),
  w: Math.cos(angle / 2),
});

const place = (
  x: number,
  y: number,
  z: number,
  rotation: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation,
  scale,
});

const box = (
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

const slab = (
  id: string,
  parent: string,
  y: number,
  space: string | null,
  half: { x: number; z: number } = { x: 6, z: 5 },
): IAutoMovieBuiltElement => ({
  id,
  kind: "floor-slab",
  parent,
  transform: place(0, y, 0, undefined, {
    x: half.x * 2,
    y: 0.2,
    z: half.z * 2,
  }),
  model: "stone",
  space,
});

/**
 * One work holding two independently rooted building units and a sky-bridge.
 *
 * The keep stacks levels that are deliberately not a uniform floor grid: a
 * double-height hall, a mezzanine sharing the hall's own air, a void punched
 * from the second level to the attic, one duplex apartment that owns two slabs,
 * an attic, a rotunda, and a yawed wing. The annex is a second unit tilted on
 * its own root. Nothing here is a floor table: a storey is one `kind` string
 * beside `mezzanine`, `duplex`, `void`, `attic`, and `dome`.
 */
const work = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "citadel",
  units: "meter",
  buildings: [
    { id: "keep", element: "keep-root", space: "keep-whole" },
    { id: "annex", element: "annex-root", space: "annex-whole" },
  ],
  models: [{ ...createModel(null), id: "stone" }],
  modelReferences: ["dome-mesh"],
  elements: [
    {
      id: "keep-root",
      kind: "building",
      parent: null,
      transform: place(0, 0, 0),
      model: null,
      space: "keep-whole",
    },
    slab("keep-hall-slab", "keep-root", 0, "hall"),
    {
      ...slab("keep-mezzanine-slab", "keep-root", 4.5, "mezzanine"),
      kind: "mezzanine-slab",
      transform: place(0, 4.5, 3, undefined, { x: 12, y: 0.2, z: 4 }),
    },
    slab("keep-level-2-slab", "keep-root", 9, "storey-2"),
    slab("keep-duplex-lower-slab", "keep-root", 12.2, "duplex"),
    slab("keep-duplex-upper-slab", "keep-root", 15, "duplex"),
    slab("keep-attic-slab", "keep-root", 18, "attic"),
    {
      id: "keep-wing",
      kind: "wing",
      parent: "keep-root",
      transform: place(6, 9, 0, yaw(WING_YAW)),
      model: null,
      space: null,
    },
    {
      id: "keep-wing-slab",
      kind: "floor-slab",
      parent: "keep-wing",
      transform: place(4, 0, 0, undefined, { x: 6, y: 0.2, z: 4 }),
      model: "stone",
      space: "wing-storey",
    },
    {
      id: "keep-dome",
      kind: "dome",
      parent: "keep-root",
      transform: place(0, 18.2, 0),
      model: "dome-mesh",
      space: "rotunda",
    },
    {
      id: "keep-curtain-wall",
      kind: "envelope",
      parent: "keep-root",
      transform: place(0, 4.5, 5.1),
      model: "stone",
      space: null,
    },
    {
      id: "keep-door-leaf",
      kind: "door-leaf",
      parent: "keep-root",
      transform: place(0, 1, -5),
      model: "stone",
      space: "hall",
    },
    {
      id: "annex-root",
      kind: "building",
      parent: null,
      transform: place(30, 0, 0, roll(ANNEX_TILT)),
      model: null,
      space: "annex-whole",
    },
    {
      id: "annex-ground-slab",
      kind: "floor-slab",
      parent: "annex-root",
      transform: place(6, 0, 0, undefined, { x: 8, y: 0.2, z: 6 }),
      model: "stone",
      space: "annex-storey-0",
    },
    {
      id: "annex-upper-slab",
      kind: "floor-slab",
      parent: "annex-root",
      transform: place(6, 4.2, 0, undefined, { x: 8, y: 0.2, z: 6 }),
      model: "stone",
      space: "annex-storey-1",
    },
  ],
  spaces: [
    { id: "keep-whole", kind: "building", parent: null, cells: [] },
    {
      id: "hall",
      kind: "double-height-hall",
      parent: "keep-whole",
      cells: [box("hall-cell", { x: -6, y: 0, z: -5 }, { x: 6, y: 9, z: 5 })],
    },
    {
      id: "mezzanine",
      kind: "mezzanine",
      parent: "keep-whole",
      cells: [
        box("mezzanine-cell", { x: -6, y: 4.5, z: 1 }, { x: 6, y: 9, z: 5 }),
      ],
    },
    {
      // A void is not a storey with a hole: it is its own region, and the
      // storey around it is written as the two convex cells that remain.
      id: "atrium",
      kind: "void",
      parent: "keep-whole",
      cells: [
        box("atrium-cell", { x: -2, y: 9, z: -2 }, { x: 2, y: 18, z: 2 }),
      ],
    },
    {
      id: "storey-2",
      kind: "storey",
      parent: "keep-whole",
      cells: [
        box("storey-2-west", { x: -6, y: 9, z: -5 }, { x: -2, y: 12.2, z: 5 }),
        box("storey-2-east", { x: 2, y: 9, z: -5 }, { x: 6, y: 12.2, z: 5 }),
      ],
    },
    {
      id: "duplex",
      kind: "duplex",
      parent: "keep-whole",
      cells: [
        box("duplex-cell", { x: -6, y: 12.2, z: -5 }, { x: 6, y: 18, z: 5 }),
      ],
    },
    {
      id: "attic",
      kind: "attic",
      parent: "keep-whole",
      cells: [
        box("attic-cell", { x: -6, y: 18, z: -5 }, { x: 6, y: 20, z: 5 }),
      ],
    },
    {
      // The dome's own volume is only approximated by its bounding cell; the
      // curved shell itself lives in the cited mesh, not in this half-space set.
      id: "rotunda",
      kind: "dome",
      parent: "keep-whole",
      cells: [
        box("rotunda-cell", { x: -3, y: 18.2, z: -3 }, { x: 3, y: 21.2, z: 3 }),
      ],
    },
    { id: "wing-storey", kind: "storey", parent: "keep-whole", cells: [] },
    { id: "annex-whole", kind: "building", parent: null, cells: [] },
    { id: "annex-storey-0", kind: "storey", parent: "annex-whole", cells: [] },
    { id: "annex-storey-1", kind: "storey", parent: "annex-whole", cells: [] },
  ],
  boundaries: [
    {
      id: "hall-wall",
      kind: "wall",
      spaces: ["hall"],
      elements: ["keep-curtain-wall"],
    },
    {
      id: "mezzanine-edge",
      kind: "open-edge",
      spaces: ["hall", "mezzanine"],
      elements: [],
    },
  ],
  openings: [
    {
      id: "front-door",
      kind: "door",
      boundary: "hall-wall",
      fill: "keep-door-leaf",
    },
  ],
  connectors: [
    {
      id: "grand-stair",
      kind: "stair",
      from: "hall",
      to: "mezzanine",
      bidirectional: true,
      route: [
        { x: -4, y: 0, z: 4 },
        { x: -4, y: 4.5, z: 1 },
      ],
      width: 1.6,
      clearHeight: 2.4,
      elements: [],
    },
    {
      id: "duplex-stair",
      kind: "stair",
      from: "storey-2",
      to: "duplex",
      bidirectional: true,
      route: [
        { x: 4, y: 9, z: 0 },
        { x: 4, y: 12.2, z: 0 },
      ],
      width: 1.2,
      clearHeight: 2.2,
      elements: [],
    },
    {
      id: "keep-lift",
      kind: "lift",
      from: "hall",
      to: "attic",
      bidirectional: true,
      route: [
        { x: 5, y: 0, z: -4 },
        { x: 5, y: 18, z: -4 },
      ],
      width: 1.5,
      clearHeight: 2.4,
      elements: [],
    },
    {
      // The one relation a work owns rather than a unit: it lands on two
      // different building units, at two different heights.
      id: "skybridge",
      kind: "bridge",
      from: "storey-2",
      to: "annex-storey-1",
      bidirectional: true,
      route: [
        { x: 6, y: 9, z: 0 },
        { x: 35.61, y: 4.71, z: 0 },
      ],
      width: 2.4,
      clearHeight: 2.6,
      elements: [],
    },
  ],
  surfaces: [
    {
      space: "hall",
      surface: {
        id: "hall-floor",
        kind: "floor",
        polygon: [
          { x: -6, y: 0, z: -5 },
          { x: 6, y: 0, z: -5 },
          { x: 6, y: 0, z: 5 },
          { x: -6, y: 0, z: 5 },
        ],
        anchor: { x: -6, y: 0, z: -5 },
        rampTo: null,
      },
    },
  ],
  walkable: ["hall-floor"],
});

/**
 * A floor is one classification among many, never the root of the hierarchy.
 *
 * This pins the shapes the requirement calls for against the record as it
 * actually stands: two independently rooted and independently placed building
 * units, a sky-bridge that is a work-owned relation between them at two
 * different heights, a yawed wing and a tilted unit whose full quaternions
 * survive lowering, one duplex owning two slabs, a mezzanine sharing the hall's
 * own air, a void the surrounding storey is written around, and differing
 * storey heights. Two limits are pinned as limits rather than passes: a logical
 * volume is a set of convex cells, so a non-convex region exists only as the
 * cells it is split into, and a curved shell (dome, vault, free-form surface)
 * is visible geometry in a cited model whose logical volume here is only its
 * bounding cell.
 *
 * Scenarios:
 *
 * 1. The whole work validates as one record.
 * 2. The only root spaces are the two building units' roots; every storey, duplex,
 *    attic, void, mezzanine and dome is a child classification, and the kinds
 *    are siblings rather than levels of a floor tree.
 * 3. Ownership is answered per space: keep spaces name the keep, annex spaces name
 *    the annex.
 * 4. The sky-bridge joins spaces owned by two different units at two different
 *    heights, and adjacency reports it from both ends.
 * 5. One duplex logical space owns two slabs, so a dwelling is not forced to be a
 *    floor; the staged nodes of `duplex` are both slabs.
 * 6. The mezzanine sits inside the hall's own volume: a point at (0, 5, 3) is in
 *    both, which is the physically-continuous / logically-partitioned case.
 * 7. The void is punched through the second level: the atrium centre is in
 *    `atrium` and in the building root, but not in `storey-2`, whose remaining
 *    area is written as two convex cells; a point west of the void is in
 *    `storey-2` and not in `atrium`.
 * 8. Storey elevations are deliberately unequal (9.0, 3.2, 2.8, 3.0 apart), so no
 *    uniform floor height is baked into the record.
 * 9. A yawed wing's child lands at the hand-computed rotated world position and
 *    keeps the wing's quaternion, not a re-derived yaw.
 * 10. A tilted second unit does the same about a different axis, proving the unit
 *     root is a real coordinate root.
 * 11. The dome is a cited mesh on an element in the `rotunda` space; its
 *     containment answer comes from the bounding cell, which is why a point
 *     just outside that cell is refused while the curved shell is not modelled
 *     by half-spaces at all.
 * 12. A door is an opening in a wall boundary filled by a leaf element, and the
 *     lowered set stages that leaf like any other element.
 */
export const test_architecture_built_environment_topology = (): void => {
  const citadel = work();
  TestValidator.equals(
    "a two-unit work with a sky-bridge validates",
    validateBuiltEnvironment({ environment: citadel }).success,
    true,
  );
  TestValidator.equals(
    "only building units root the logical hierarchy",
    {
      roots: citadel.spaces
        .filter((space) => space.parent === null)
        .map((space) => space.id),
      rootKinds: citadel.spaces
        .filter((space) => space.parent === null)
        .map((space) => space.kind),
      keepChildKinds: citadel.spaces
        .filter((space) => space.parent === "keep-whole")
        .map((space) => space.kind),
    },
    {
      roots: ["keep-whole", "annex-whole"],
      rootKinds: ["building", "building"],
      keepChildKinds: [
        "double-height-hall",
        "mezzanine",
        "void",
        "storey",
        "duplex",
        "attic",
        "dome",
        "storey",
      ],
    },
  );
  TestValidator.equals(
    "every logical space names its owning building unit",
    {
      hall: builtEnvironmentBuildingOfSpace(citadel, "hall"),
      duplex: builtEnvironmentBuildingOfSpace(citadel, "duplex"),
      annexUpper: builtEnvironmentBuildingOfSpace(citadel, "annex-storey-1"),
    },
    { hall: "keep", duplex: "keep", annexUpper: "annex" },
  );
  const bridge = citadel.connectors.find(
    (connector) => connector.id === "skybridge",
  )!;
  TestValidator.equals(
    "the sky-bridge is a work-owned relation between two units at two heights",
    {
      from: builtEnvironmentBuildingOfSpace(citadel, bridge.from),
      to: builtEnvironmentBuildingOfSpace(citadel, bridge.to),
      rise: bridge.route[0]!.y > bridge.route.at(-1)!.y,
    },
    { from: "keep", to: "annex", rise: true },
  );
  TestValidator.equals(
    "one duplex logical space owns two slabs",
    builtEnvironmentSpaceNodes(citadel, "duplex"),
    ["citadel/keep-duplex-lower-slab", "citadel/keep-duplex-upper-slab"],
  );
  TestValidator.equals(
    "continuous volume, independent logical partitions, and a real void",
    namedFacts([
      [
        "mezzanineInHallAir",
        () =>
          builtEnvironmentContainsPoint(citadel, "hall", {
            x: 0,
            y: 5,
            z: 3,
          }) &&
          builtEnvironmentContainsPoint(citadel, "mezzanine", {
            x: 0,
            y: 5,
            z: 3,
          }),
      ],
      [
        "voidIsNotStorey",
        () =>
          builtEnvironmentContainsPoint(citadel, "atrium", {
            x: 0,
            y: 10,
            z: 0,
          }) &&
          !builtEnvironmentContainsPoint(citadel, "storey-2", {
            x: 0,
            y: 10,
            z: 0,
          }),
      ],
      [
        "storeyIsWrittenAroundTheVoid",
        () =>
          builtEnvironmentContainsPoint(citadel, "storey-2", {
            x: -4,
            y: 10,
            z: 0,
          }) &&
          !builtEnvironmentContainsPoint(citadel, "atrium", {
            x: -4,
            y: 10,
            z: 0,
          }),
      ],
      [
        "unitRootSeesItsWholeSubtree",
        () =>
          builtEnvironmentContainsPoint(citadel, "keep-whole", {
            x: 0,
            y: 10,
            z: 0,
          }),
      ],
      [
        "domeVolumeIsOnlyItsBoundingCell",
        () =>
          builtEnvironmentContainsPoint(citadel, "rotunda", {
            x: 0,
            y: 19,
            z: 0,
          }) &&
          !builtEnvironmentContainsPoint(citadel, "rotunda", {
            x: 0,
            y: 21.5,
            z: 0,
          }),
      ],
    ]),
    {
      mezzanineInHallAir: true,
      voidIsNotStorey: true,
      storeyIsWrittenAroundTheVoid: true,
      unitRootSeesItsWholeSubtree: true,
      domeVolumeIsOnlyItsBoundingCell: true,
    },
  );
  const elevations = [
    "keep-hall-slab",
    "keep-level-2-slab",
    "keep-duplex-lower-slab",
    "keep-duplex-upper-slab",
    "keep-attic-slab",
  ].map(
    (id) =>
      citadel.elements.find((element) => element.id === id)!.transform
        .translation.y,
  );
  const rises = elevations
    .slice(1)
    .map((value, index) => value - elevations[index]!);
  TestValidator.predicate(
    "storey heights are deliberately unequal, so no floor pitch is baked in",
    nclose(rises[0]!, 9) &&
      nclose(rises[1]!, 3.2) &&
      nclose(rises[2]!, 2.8) &&
      nclose(rises[3]!, 3) &&
      new Set(rises.map((rise) => Math.round(rise * 10))).size === rises.length,
  );
  TestValidator.equals(
    "the sky-bridge is reported from both of its ends",
    {
      keep: builtEnvironmentAdjacentSpaces(citadel, "storey-2").includes(
        "annex-storey-1",
      ),
      annex: builtEnvironmentAdjacentSpaces(citadel, "annex-storey-1").includes(
        "storey-2",
      ),
    },
    { keep: true, annex: true },
  );

  const pieces = lowerBuiltEnvironment(citadel).set ?? [];
  const wing = pieces.find((piece) => piece.node === "citadel/keep-wing-slab")!;
  TestValidator.predicate(
    "a yawed wing places its child by the composed rotation",
    vclose(wing.position, {
      x: 6 + 4 * Math.cos(WING_YAW),
      y: 9,
      z: -4 * Math.sin(WING_YAW),
    }) &&
      qclose(wing.rotation!, yaw(WING_YAW)) &&
      typeof wing.scale === "object" &&
      vclose(wing.scale, { x: 6, y: 0.2, z: 4 }),
  );
  const annex = pieces.find(
    (piece) => piece.node === "citadel/annex-upper-slab",
  )!;
  TestValidator.predicate(
    "a tilted unit root is a real coordinate root",
    vclose(annex.position, {
      x: 30 + 6 * Math.cos(ANNEX_TILT) - 4.2 * Math.sin(ANNEX_TILT),
      y: 6 * Math.sin(ANNEX_TILT) + 4.2 * Math.cos(ANNEX_TILT),
      z: 0,
    }) && qclose(annex.rotation!, roll(ANNEX_TILT)),
  );
  TestValidator.equals(
    "the dome and the door leaf stage like any other element",
    {
      dome: pieces.find((piece) => piece.node === "citadel/keep-dome")?.model,
      leaf: pieces.find((piece) => piece.node === "citadel/keep-door-leaf")
        ?.model,
      door: citadel.openings[0],
    },
    {
      dome: "dome-mesh",
      leaf: "stone",
      door: {
        id: "front-door",
        kind: "door",
        boundary: "hall-wall",
        fill: "keep-door-leaf",
      },
    },
  );
};
