import {
  buildAutoMovieWall,
  builtBoundaryWallCut,
  builtOpeningPanelPlacements,
  builtOpeningSweepEnvelope,
  inspectAutoMovieMeshTopology,
  lowerBuiltEnvironment,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts, nclose, qclose, vclose } from "../internal/predicates";

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

const place = (x = 0, y = 0, z = 0): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: NO_ROTATION,
  scale: { x: 1, y: 1, z: 1 },
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

/**
 * One partition wall carrying every opening family this stage must express.
 *
 * The wall's own frame is the world XY plane, so every planar number below is
 * also a world number and every expectation can be read off by hand. The
 * partition holds a folding double leaf, a double-acting sash, a sliding
 * shutter, a round oculus written as two half turns, and a round-headed arch
 * with no fill at all. None of those is a catalogue entry: each is the same
 * outline-plus-bulge profile and the same one-degree-of-freedom panel.
 */
const partition = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "vestibule",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "panel" }],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(),
      model: null,
      space: "whole",
    },
    {
      id: "wall",
      kind: "wall",
      parent: "root",
      transform: place(),
      model: "panel",
      space: "hall",
    },
    {
      id: "door-leaf",
      kind: "door-leaf",
      parent: "root",
      transform: place(1, 0, 0),
      model: "panel",
      space: "hall",
    },
    {
      id: "door-fold",
      kind: "door-leaf",
      parent: "door-leaf",
      transform: place(1, 0, 0),
      model: "panel",
      space: "hall",
    },
    {
      id: "door-frame",
      kind: "frame",
      parent: "root",
      transform: place(1, 0, 0),
      model: "panel",
      space: "hall",
    },
    {
      id: "sash",
      kind: "sash",
      parent: "root",
      transform: place(4, 1, 0),
      model: "panel",
      space: "hall",
    },
    {
      id: "shutter",
      kind: "shutter",
      parent: "root",
      transform: place(6, 0, 0),
      model: "panel",
      space: "hall",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    {
      id: "hall",
      kind: "room",
      parent: "whole",
      cells: [box("hall-cell", { x: 0, y: 0, z: -4 }, { x: 9, y: 3, z: 0 })],
    },
    {
      id: "yard",
      kind: "court",
      parent: "whole",
      cells: [box("yard-cell", { x: 0, y: 0, z: 0 }, { x: 9, y: 3, z: 4 })],
    },
  ],
  boundaries: [
    {
      id: "partition",
      kind: "wall",
      spaces: ["hall", "yard"],
      elements: ["wall"],
      face: {
        origin: { x: 0, y: 0, z: 0 },
        rotation: NO_ROTATION,
        outline: [
          { x: 0, y: 0 },
          { x: 9, y: 0 },
          { x: 9, y: 3 },
          { x: 0, y: 3 },
        ],
        thickness: 0.2,
      },
    },
    {
      // A boundary with no face at all: the pre-geometry record, kept valid.
      id: "threshold",
      kind: "threshold",
      spaces: ["hall"],
      elements: [],
    },
  ],
  openings: [
    {
      id: "door",
      kind: "door",
      boundary: "partition",
      fill: "door-leaf",
      profile: {
        outline: [
          { x: 1, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 2.1 },
          { x: 1, y: 2.1 },
        ],
      },
      operation: {
        panels: [
          {
            id: "outer",
            element: "door-leaf",
            width: 1,
            height: 2.1,
            motion: {
              kind: "revolute",
              axis: { x: 0, y: 1, z: 0 },
              pivot: { x: 0, y: 0, z: 0 },
              min: 0,
              max: Math.PI / 2,
            },
          },
          {
            id: "inner",
            element: "door-fold",
            width: 1,
            height: 2.1,
            motion: {
              kind: "revolute",
              axis: { x: 0, y: 1, z: 0 },
              pivot: { x: 0, y: 0, z: 0 },
              min: 0,
              max: Math.PI / 2,
            },
          },
        ],
        states: [
          {
            id: "closed",
            panels: [
              { panel: "outer", value: 0 },
              { panel: "inner", value: 0 },
            ],
          },
          {
            id: "open",
            panels: [
              { panel: "outer", value: Math.PI / 2 },
              { panel: "inner", value: Math.PI / 2 },
            ],
          },
        ],
        state: "closed",
        hardware: [
          { id: "frame", kind: "frame", element: "door-frame" },
          { id: "handle", kind: "handle", element: null },
        ],
      },
    },
    {
      id: "casement",
      kind: "window",
      boundary: "partition",
      fill: "sash",
      profile: {
        outline: [
          { x: 4, y: 1 },
          { x: 4.8, y: 1 },
          { x: 4.8, y: 2.2 },
          { x: 4, y: 2.2 },
        ],
      },
      operation: {
        panels: [
          {
            id: "leaf",
            element: "sash",
            width: 0.8,
            height: 1.2,
            motion: {
              kind: "revolute",
              axis: { x: 0, y: 1, z: 0 },
              pivot: { x: 0, y: 0, z: 0 },
              min: -Math.PI / 2,
              max: Math.PI / 2,
            },
          },
        ],
        states: [
          { id: "shut", panels: [{ panel: "leaf", value: 0 }] },
          { id: "vent", panels: [{ panel: "leaf", value: Math.PI / 6 }] },
        ],
        state: "shut",
        hardware: [],
      },
    },
    {
      id: "hatch",
      kind: "shutter",
      boundary: "partition",
      fill: "shutter",
      profile: {
        outline: [
          { x: 6, y: 0 },
          { x: 7, y: 0 },
          { x: 7, y: 1 },
          { x: 6, y: 1 },
        ],
      },
      operation: {
        panels: [
          {
            id: "slat",
            element: "shutter",
            width: 1,
            height: 1,
            motion: {
              kind: "prismatic",
              axis: { x: 0, y: 1, z: 0 },
              min: 0,
              max: 1,
            },
          },
        ],
        states: [
          { id: "down", panels: [{ panel: "slat", value: 0 }] },
          { id: "up", panels: [{ panel: "slat", value: 1 }] },
        ],
        state: "down",
        hardware: [],
      },
    },
    {
      // Two corners and two half turns: a circle, not a polygon pretending.
      id: "oculus",
      kind: "window",
      boundary: "partition",
      fill: null,
      profile: {
        outline: [
          { x: 8, y: 2 },
          { x: 8.8, y: 2 },
        ],
        bulges: [1, 1],
      },
    },
    {
      // A round-headed arch: two jambs, a sill, and one bulged head.
      id: "arch",
      kind: "arch",
      boundary: "partition",
      fill: null,
      profile: {
        outline: [
          { x: 1, y: 2.3 },
          { x: 2, y: 2.3 },
          { x: 2, y: 2.4 },
          { x: 1, y: 2.4 },
        ],
        bulges: [0, 0, -1, 0],
      },
    },
    {
      // The pre-geometry record: an opening that states nothing about shape.
      id: "gap",
      kind: "passage",
      boundary: "threshold",
      fill: null,
    },
  ],
  connectors: [
    {
      id: "doorway",
      kind: "passage",
      from: "hall",
      to: "yard",
      bidirectional: true,
      route: [
        { x: 2, y: 0, z: -0.5 },
        { x: 2, y: 0, z: 0.5 },
      ],
      width: 2,
      clearHeight: 2.1,
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** The violation paths one mutation of the partition produces. */
const refusalPaths = (
  mutate: (value: IAutoMovieBuiltEnvironment) => void,
): string[] => {
  const value = partition();
  mutate(value);
  const validation = validateBuiltEnvironment({ environment: value });
  return validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);
};

/**
 * A door is a hole in a wall, a leaf inside that hole, and a state the leaf
 * stands in, and this pins that the three agree. The boundary carries a located
 * face, the opening carries the void it cuts in that face, and the panel
 * carries one degree of freedom whose named states drive the very element the
 * shot stages. Whether a person can pass is deliberately not asked: what is
 * pinned is the geometry a later clearance or egress analysis would read.
 *
 * Scenarios:
 *
 * 1. A partition holding a folding door, a double-acting sash, a sliding shutter,
 *    a circular oculus, an arch, and one geometry-less opening validates as a
 *    whole.
 * 2. The mesh kernel and the architecture graph meet on one id: the boundary's
 *    wall cut names each void by its architectural opening id, and the wall
 *    built from it is a real hole rather than metadata (the cut wall has fewer
 *    triangles than the uncut one and stays a closed shell).
 * 3. A round void is handed to the rectangular kernel as the rectangle that
 *    exactly bounds it, which for a 0.4 m circle is 0.8 m square.
 * 4. Panel placement answers where a leaf stands at the record's own state and at
 *    any other named state, without editing the record.
 * 5. Lowering stages the leaf at the current state: opening the door moves the
 *    staged node, and the fold rides its parent leaf because the element
 *    hierarchy carries the chaining.
 * 6. A record that declares no operation lowers byte-for-byte as before.
 * 7. The swept envelope is solved, not sampled: a quarter-turn leaf reaches
 *    exactly its own radius, and a double-acting leaf reaches its widest at the
 *    interior critical angle its travel crosses rather than at either limit.
 * 8. A sliding leaf sweeps its own travel and no more.
 * 9. Every query refuses an unknown opening, an unknown state, and an opening that
 *    carries no operation answers emptily rather than throwing.
 * 10. Thirty-three malformed openings are each refused at their own path.
 */
export const test_architecture_built_opening = (): void => {
  const source = partition();
  TestValidator.equals(
    "a partition carrying every opening family validates",
    validateBuiltEnvironment({ environment: source }).success,
    true,
  );

  const cut = builtBoundaryWallCut(source, "partition");
  TestValidator.equals(
    "the wall cut names each void by its own architectural opening id",
    {
      panel: { width: cut.width, height: cut.height, depth: cut.depth },
      openings: cut.openings.map((opening) => opening.id),
      door: cut.openings.find((opening) => opening.id === "door"),
    },
    {
      panel: { width: 9, height: 3, depth: 0.2 },
      openings: ["door", "casement", "hatch", "oculus", "arch"],
      door: { id: "door", x: 1, y: 0, width: 2, height: 2.1 },
    },
  );
  TestValidator.predicate(
    "a round void reaches the rectangular kernel as its own exact bound",
    (() => {
      const oculus = cut.openings.find((opening) => opening.id === "oculus")!;
      return (
        nclose(oculus.x, 8) &&
        nclose(oculus.y, 1.6) &&
        nclose(oculus.width, 0.8) &&
        nclose(oculus.height, 0.8)
      );
    })(),
  );
  TestValidator.predicate(
    "the wall cut is placed by the boundary's own frame",
    vclose(cut.origin, { x: 4.5, y: 1.5, z: 0 }) &&
      qclose(cut.rotation, NO_ROTATION),
  );
  const cutWall = buildAutoMovieWall({
    width: cut.width,
    height: cut.height,
    depth: cut.depth,
    openings: cut.openings,
  });
  const solidWall = buildAutoMovieWall({
    width: cut.width,
    height: cut.height,
    depth: cut.depth,
    openings: [],
  });
  TestValidator.predicate(
    "the declared voids become real holes in a closed wall",
    (() => {
      const cutTopology = inspectAutoMovieMeshTopology(cutWall);
      const solidTopology = inspectAutoMovieMeshTopology(solidWall);
      return (
        cutTopology.triangles > solidTopology.triangles &&
        cutTopology.volume < solidTopology.volume &&
        cutTopology.nonFinite === 0
      );
    })(),
  );

  TestValidator.predicate(
    "panel placement answers for the record's state and for another",
    (() => {
      const closed = builtOpeningPanelPlacements(source, "door");
      const open = builtOpeningPanelPlacements(source, "door", "open");
      const closedOuter = closed.find((entry) => entry.panel === "outer")!;
      const openOuter = open.find((entry) => entry.panel === "outer")!;
      const openInner = open.find((entry) => entry.panel === "inner")!;
      return (
        closedOuter.node === "vestibule/door-leaf" &&
        vclose(closedOuter.position, { x: 1, y: 0, z: 0 }) &&
        qclose(closedOuter.rotation, NO_ROTATION) &&
        vclose(openOuter.position, { x: 1, y: 0, z: 0 }) &&
        qclose(openOuter.rotation, {
          x: 0,
          y: Math.SQRT1_2,
          z: 0,
          w: Math.SQRT1_2,
        }) &&
        // The fold hangs off the outer leaf, so a quarter turn of the outer
        // leaf carries its hinge from +x to -z before its own turn applies.
        vclose(openInner.position, { x: 1, y: 0, z: -1 })
      );
    })(),
  );

  const staged = lowerBuiltEnvironment(source).set ?? [];
  const opened = partition();
  opened.openings[0]!.operation!.state = "open";
  const openedStaged = lowerBuiltEnvironment(opened).set ?? [];
  TestValidator.predicate(
    "the staged leaf reproduces the operating state the record stands in",
    (() => {
      const shut = staged.find(
        (piece) => piece.node === "vestibule/door-fold",
      )!;
      const swung = openedStaged.find(
        (piece) => piece.node === "vestibule/door-fold",
      )!;
      return (
        vclose(shut.position!, { x: 2, y: 0, z: 0 }) &&
        vclose(swung.position!, { x: 1, y: 0, z: -1 }) &&
        qclose(swung.rotation!, { x: 0, y: 1, z: 0, w: 0 })
      );
    })(),
  );
  const inert = partition();
  inert.openings.forEach((opening) => delete opening.operation);
  TestValidator.equals(
    "a record with no operation lowers exactly as a rest-state record does",
    lowerBuiltEnvironment(inert).set,
    staged,
  );

  TestValidator.predicate(
    "a quarter-turn leaf sweeps exactly the quarter disc it can reach",
    (() => {
      const sweep = builtOpeningSweepEnvelope(source, "door").find(
        (entry) => entry.panel === "outer",
      )!;
      return (
        vclose(sweep.min, { x: 1, y: 0, z: -1 }) &&
        vclose(sweep.max, { x: 2, y: 2.1, z: 0 })
      );
    })(),
  );
  TestValidator.predicate(
    "a double-acting leaf reaches its widest at an interior critical angle",
    (() => {
      const sweep = builtOpeningSweepEnvelope(source, "casement")[0]!;
      return (
        sweep.panel === "leaf" &&
        // x = 4 + 0.8 cos(t) peaks at t = 0, which is neither travel limit.
        vclose(sweep.min, { x: 4, y: 1, z: -0.8 }) &&
        vclose(sweep.max, { x: 4.8, y: 2.2, z: 0.8 })
      );
    })(),
  );
  TestValidator.predicate(
    "a sliding leaf sweeps its own travel and no more",
    (() => {
      const sweep = builtOpeningSweepEnvelope(source, "hatch")[0]!;
      return (
        vclose(sweep.min, { x: 6, y: 0, z: 0 }) &&
        vclose(sweep.max, { x: 7, y: 2, z: 0 })
      );
    })(),
  );

  TestValidator.equals(
    "an opening with no operation answers with no panel and no envelope",
    {
      placements: builtOpeningPanelPlacements(source, "oculus"),
      sweep: builtOpeningSweepEnvelope(source, "oculus"),
    },
    { placements: [], sweep: [] },
  );
  TestValidator.error("an unknown opening refuses placement", () =>
    builtOpeningPanelPlacements(source, "missing"),
  );
  TestValidator.error("an unknown opening refuses an envelope", () =>
    builtOpeningSweepEnvelope(source, "missing"),
  );
  TestValidator.error("an unknown operating state is refused", () =>
    builtOpeningPanelPlacements(source, "door", "ajar"),
  );
  TestValidator.error("an unknown boundary refuses a wall cut", () =>
    builtBoundaryWallCut(source, "missing"),
  );
  TestValidator.error("a boundary with no face refuses a wall cut", () =>
    builtBoundaryWallCut(source, "threshold"),
  );
  TestValidator.error("a dangling panel element refuses placement", () => {
    const broken = partition();
    broken.openings[0]!.operation!.panels[0]!.element = "missing";
    builtOpeningPanelPlacements(broken, "door");
  });
  TestValidator.error("a dangling panel element refuses an envelope", () => {
    const broken = partition();
    broken.openings[0]!.operation!.panels[0]!.element = "missing";
    builtOpeningSweepEnvelope(broken, "door");
  });

  const malformed: Array<
    readonly [string, (value: IAutoMovieBuiltEnvironment) => void, string]
  > = [
    [
      "non-finite face origin",
      (value) => (value.boundaries[0]!.face!.origin.x = Number.NaN),
      "$input.boundaries[0].face.origin.x",
    ],
    [
      "face rotation that is not a unit quaternion",
      (value) =>
        (value.boundaries[0]!.face!.rotation = { x: 0, y: 0, z: 0, w: 2 }),
      "$input.boundaries[0].face.rotation",
    ],
    [
      "zero boundary thickness",
      (value) => (value.boundaries[0]!.face!.thickness = 0),
      "$input.boundaries[0].face.thickness",
    ],
    [
      "two-point boundary face",
      (value) =>
        (value.boundaries[0]!.face!.outline = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ]),
      "$input.boundaries[0].face.outline",
    ],
    [
      "non-finite face corner",
      (value) =>
        (value.boundaries[0]!.face!.outline[1]!.y = Number.POSITIVE_INFINITY),
      "$input.boundaries[0].face.outline[1].y",
    ],
    [
      "repeated face corner",
      (value) =>
        (value.boundaries[0]!.face!.outline[1] = {
          ...value.boundaries[0]!.face!.outline[0]!,
        }),
      "$input.boundaries[0].face.outline",
    ],
    [
      "collinear face outline",
      (value) =>
        (value.boundaries[0]!.face!.outline = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ]),
      "$input.boundaries[0].face.outline",
    ],
    [
      "self-crossing face outline",
      (value) =>
        (value.boundaries[0]!.face!.outline = [
          { x: 0, y: 0 },
          { x: 9, y: 3 },
          { x: 9, y: 0 },
          { x: 0, y: 4 },
        ]),
      "$input.boundaries[0].face.outline",
    ],
    [
      "void on a boundary that declares no face",
      (value) => (value.openings[5]!.profile = { outline: [{ x: 0, y: 0 }] }),
      "$input.openings[5].profile",
    ],
    [
      "one-point opening outline",
      (value) => (value.openings[0]!.profile!.outline = [{ x: 1, y: 0 }]),
      "$input.openings[0].profile.outline",
    ],
    [
      "opening outline with no area",
      (value) =>
        (value.openings[0]!.profile!.outline = [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ]),
      "$input.openings[0].profile.outline",
    ],
    [
      "self-crossing opening outline",
      (value) =>
        (value.openings[0]!.profile!.outline = [
          { x: 1, y: 0 },
          { x: 3, y: 2 },
          { x: 3, y: 0 },
          { x: 1, y: 3 },
        ]),
      "$input.openings[0].profile.outline",
    ],
    [
      "repeated opening corner",
      (value) => (value.openings[0]!.profile!.outline[1] = { x: 1, y: 0 }),
      "$input.openings[0].profile.outline",
    ],
    [
      "non-finite opening corner",
      (value) => (value.openings[0]!.profile!.outline[0]!.x = Number.NaN),
      "$input.openings[0].profile.outline[0].x",
    ],
    [
      "one bulge for four edges",
      (value) => (value.openings[0]!.profile!.bulges = [0]),
      "$input.openings[0].profile.bulges",
    ],
    [
      "an arc longer than a half turn",
      (value) => (value.openings[4]!.profile!.bulges = [0, 0, -1.5, 0]),
      "$input.openings[4].profile.bulges[2]",
    ],
    [
      "non-finite bulge",
      (value) => (value.openings[4]!.profile!.bulges = [0, 0, Number.NaN, 0]),
      "$input.openings[4].profile.bulges[2]",
    ],
    [
      "a void reaching past its host face",
      (value) =>
        (value.openings[0]!.profile!.outline = [
          { x: 1, y: -0.5 },
          { x: 3, y: -0.5 },
          { x: 3, y: 2.1 },
          { x: 1, y: 2.1 },
        ]),
      "$input.openings[0].profile.outline",
    ],
    [
      // Only the arc leaves the face; every stated corner stays inside it.
      "an arch whose bulged head leaves its host face",
      (value) =>
        (value.openings[4]!.profile!.outline = [
          { x: 1, y: 2.3 },
          { x: 2, y: 2.3 },
          { x: 2, y: 2.9 },
          { x: 1, y: 2.9 },
        ]),
      "$input.openings[4].profile.outline",
    ],
    [
      "two voids sharing the same part of one boundary",
      (value) =>
        (value.openings[1]!.profile!.outline = [
          { x: 2.5, y: 1 },
          { x: 3.3, y: 1 },
          { x: 3.3, y: 2 },
          { x: 2.5, y: 2 },
        ]),
      "$input.openings[1].profile.outline",
    ],
    [
      "movable panels with no filling element",
      (value) => (value.openings[2]!.fill = null),
      "$input.openings[2].fill",
    ],
    [
      "an operation with no panel",
      (value) => (value.openings[2]!.operation!.panels = []),
      "$input.openings[2].operation.panels",
    ],
    [
      "duplicate panel id",
      (value) =>
        value.openings[0]!.operation!.panels.push(
          value.openings[0]!.operation!.panels[0]!,
        ),
      "$input.openings[0].operation.panels[2].id",
    ],
    [
      "dangling panel element",
      (value) => (value.openings[2]!.operation!.panels[0]!.element = "missing"),
      "$input.openings[2].operation.panels[0].element",
    ],
    [
      "a panel outside the element it fills",
      (value) => (value.openings[2]!.operation!.panels[0]!.element = "wall"),
      "$input.openings[2].operation.panels[0].element",
    ],
    [
      "zero panel width",
      (value) => (value.openings[2]!.operation!.panels[0]!.width = 0),
      "$input.openings[2].operation.panels[0].width",
    ],
    [
      "zero panel height",
      (value) => (value.openings[2]!.operation!.panels[0]!.height = 0),
      "$input.openings[2].operation.panels[0].height",
    ],
    [
      "zero travel axis",
      (value) =>
        (value.openings[2]!.operation!.panels[0]!.motion.axis = {
          x: 0,
          y: 0,
          z: 0,
        }),
      "$input.openings[2].operation.panels[0].motion.axis",
    ],
    [
      "non-finite travel axis",
      (value) =>
        (value.openings[2]!.operation!.panels[0]!.motion.axis.y = Number.NaN),
      "$input.openings[2].operation.panels[0].motion.axis.y",
    ],
    [
      "non-finite pivot",
      (value) => {
        const motion = value.openings[0]!.operation!.panels[0]!.motion;
        if (motion.kind === "revolute") motion.pivot.z = Number.NaN;
      },
      "$input.openings[0].operation.panels[0].motion.pivot.z",
    ],
    [
      "a lowest travel above rest",
      (value) => (value.openings[2]!.operation!.panels[0]!.motion.min = 0.5),
      "$input.openings[2].operation.panels[0].motion.min",
    ],
    [
      "a highest travel below rest",
      (value) => (value.openings[2]!.operation!.panels[0]!.motion.max = -0.5),
      "$input.openings[2].operation.panels[0].motion.max",
    ],
    [
      "a panel with no travel at all",
      (value) => {
        value.openings[2]!.operation!.panels[0]!.motion.max = 0;
        value.openings[2]!.operation!.states[1]!.panels[0]!.value = 0;
      },
      "$input.openings[2].operation.panels[0].motion.max",
    ],
    [
      "a turning panel travelling more than a full turn",
      (value) => {
        const motion = value.openings[1]!.operation!.panels[0]!.motion;
        motion.min = -4;
        motion.max = 4;
      },
      "$input.openings[1].operation.panels[0].motion.max",
    ],
    [
      "an operation with no named state",
      (value) => (value.openings[2]!.operation!.states = []),
      "$input.openings[2].operation.states",
    ],
    [
      "duplicate state id",
      (value) =>
        value.openings[2]!.operation!.states.push(
          value.openings[2]!.operation!.states[0]!,
        ),
      "$input.openings[2].operation.states[2].id",
    ],
    [
      "a state driving an unknown panel",
      (value) =>
        (value.openings[2]!.operation!.states[0]!.panels[0]!.panel = "ghost"),
      "$input.openings[2].operation.states[0].panels[0].panel",
    ],
    [
      "a state driving one panel twice",
      (value) =>
        value.openings[2]!.operation!.states[0]!.panels.push(
          value.openings[2]!.operation!.states[0]!.panels[0]!,
        ),
      "$input.openings[2].operation.states[0].panels[1].panel",
    ],
    [
      "a state leaving a panel unstated",
      (value) => value.openings[0]!.operation!.states[0]!.panels.pop(),
      "$input.openings[0].operation.states[0].panels",
    ],
    [
      "a state outside a panel's travel",
      (value) =>
        (value.openings[2]!.operation!.states[1]!.panels[0]!.value = 2),
      "$input.openings[2].operation.states[1].panels[0].value",
    ],
    [
      "a non-finite state value",
      (value) =>
        (value.openings[2]!.operation!.states[1]!.panels[0]!.value =
          Number.NaN),
      "$input.openings[2].operation.states[1].panels[0].value",
    ],
    [
      "an unresolved current state",
      (value) => (value.openings[2]!.operation!.state = "ajar"),
      "$input.openings[2].operation.state",
    ],
    [
      "duplicate hardware id",
      (value) =>
        value.openings[0]!.operation!.hardware.push(
          value.openings[0]!.operation!.hardware[0]!,
        ),
      "$input.openings[0].operation.hardware[2].id",
    ],
    [
      "blank hardware kind",
      (value) => (value.openings[0]!.operation!.hardware[0]!.kind = " "),
      "$input.openings[0].operation.hardware[0].kind",
    ],
    [
      "dangling hardware element",
      (value) => (value.openings[0]!.operation!.hardware[0]!.element = "gone"),
      "$input.openings[0].operation.hardware[0].element",
    ],
    [
      "a leaf wider than the void it fills",
      (value) => (value.openings[1]!.operation!.panels[0]!.width = 1.4),
      "$input.openings[1].operation.panels[0]",
    ],
    [
      "a leaf resting outside its own void",
      (value) => (value.elements[5]!.transform.translation.x = 7.5),
      "$input.openings[1].operation.panels[0]",
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
    "the untouched partition produces no violation path at all",
    refusalPaths(() => {}),
    [],
  );
  TestValidator.equals(
    "a fixed void and a purely relational opening both stay valid",
    namedFacts([
      [
        "arch",
        () =>
          validateBuiltEnvironment({
            environment: (() => {
              const value = partition();
              value.openings = [value.openings[4]!];
              return value;
            })(),
          }).success,
      ],
      [
        "gap",
        () =>
          validateBuiltEnvironment({
            environment: (() => {
              const value = partition();
              value.openings = [value.openings[5]!];
              return value;
            })(),
          }).success,
      ],
    ]),
    { arch: true, gap: true },
  );
};
