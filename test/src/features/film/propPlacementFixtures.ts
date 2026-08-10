import {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePropRelation,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
} from "@automovie/interface";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";

/**
 * One furnished room, sized so every declared relation is also geometrically
 * true.
 *
 * The room cell spans `x, z in [-5, 5]` and `y in [-1, 4]`; the annex is a
 * deliberately cell-less semantic partition, so a prop placed in it can be
 * anywhere. The doorway's leaf occupies `x in [3.5, 4.5]`, `y in [0, 2]`, `z in
 * [-0.05, 0.05]`, and the stair sweeps `x in [-5.2, -3.8]`, `y in [0, 2.2]`, `z
 * in [-4.7, -1.3]`. Every prop below is placed clear of both, which is what
 * makes each blockage case in the suite a change of one number rather than a
 * rearrangement.
 */
export const propEnvironment = (id = "house"): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id,
  units: "meter",
  buildings: [{ id: "main", element: "root", space: "room" }],
  models: [
    {
      ...createModel(null),
      id: "leaf-box",
      parts: [
        {
          id: "leaf",
          name: null,
          geometry: {
            type: "primitive",
            shape: { type: "box", width: 1, height: 2, depth: 0.1 },
          },
          material: "mat-1",
          attachedBone: null,
          transform: null,
        },
      ],
    },
  ],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "room",
    },
    {
      id: "wall",
      kind: "wall",
      parent: "root",
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "room",
    },
    {
      id: "ceiling",
      kind: "ceiling",
      parent: "root",
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "room",
    },
    {
      id: "door-leaf",
      kind: "door-leaf",
      parent: "root",
      transform: {
        translation: { x: 4, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: "leaf-box",
      space: "room",
    },
    {
      id: "annex-wall",
      kind: "wall",
      parent: "root",
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "annex",
    },
  ],
  spaces: [
    {
      id: "room",
      kind: "room",
      parent: null,
      cells: [
        {
          id: "room-cell",
          planes: [
            { normal: { x: 1, y: 0, z: 0 }, offset: 5 },
            { normal: { x: -1, y: 0, z: 0 }, offset: 5 },
            { normal: { x: 0, y: 1, z: 0 }, offset: 4 },
            { normal: { x: 0, y: -1, z: 0 }, offset: 1 },
            { normal: { x: 0, y: 0, z: 1 }, offset: 5 },
            { normal: { x: 0, y: 0, z: -1 }, offset: 5 },
          ],
        },
      ],
    },
    { id: "annex", kind: "room", parent: "room", cells: [] },
  ],
  boundaries: [
    {
      id: "room-wall",
      kind: "wall",
      spaces: ["room", "annex"],
      elements: ["wall"],
    },
    { id: "bare-boundary", kind: "threshold", spaces: ["room"], elements: [] },
  ],
  openings: [
    { id: "doorway", kind: "door", boundary: "room-wall", fill: "door-leaf" },
    { id: "arch", kind: "arch", boundary: "room-wall", fill: null },
  ],
  connectors: [
    {
      id: "stair",
      kind: "stair",
      from: "room",
      to: "annex",
      bidirectional: true,
      route: [
        { x: -4.5, y: 0, z: -4 },
        { x: -4.5, y: 0, z: -2 },
      ],
      width: 1.4,
      clearHeight: 2.2,
      elements: [],
    },
  ],
  surfaces: [
    {
      space: "room",
      surface: {
        id: "floor",
        kind: "floor",
        polygon: [
          { x: -5, y: 0, z: -5 },
          { x: 5, y: 0, z: -5 },
          { x: 5, y: 0, z: 5 },
          { x: -5, y: 0, z: 5 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    },
    {
      space: "annex",
      surface: {
        id: "annex-floor",
        kind: "floor",
        polygon: [
          { x: 5, y: 0, z: -5 },
          { x: 10, y: 0, z: -5 },
          { x: 10, y: 0, z: 5 },
          { x: 5, y: 0, z: 5 },
        ],
        height: { kind: "constant", value: 0.5 },
      },
    },
  ],
  walkable: ["floor", "annex-floor"],
});

/** An `in-space` relation naming one logical space. */
export const inSpace = (
  space: string,
  environment = "house",
): IAutoMoviePropRelation => ({
  kind: "in-space",
  target: { kind: "space", environment, space },
});

/** A box prop of the default 0.4 x 0.6 x 0.2 model, with no relations yet. */
const boxProp = (node: string): IAutoMoviePropSpec => ({
  node,
  model: { ...createModel(null), id: node },
  articulation: null,
});

/** The table every stacked, plugged, and hung prop in the room cites. */
export const table = (): IAutoMoviePropSpec => ({
  ...boxProp("table"),
  model: {
    ...createModel(null),
    id: "table",
    affordances: [
      {
        id: "top",
        kind: "stack-top",
        frame: IDENTITY_TRANSFORM,
        extent: [
          { x: -0.5, y: 0, z: -0.5 },
          { x: 0.5, y: 0, z: -0.5 },
          { x: 0.5, y: 0, z: 0.5 },
          { x: -0.5, y: 0, z: 0.5 },
        ],
      },
      { id: "plug", kind: "socket", frame: IDENTITY_TRANSFORM, extent: null },
      { id: "peg", kind: "hook", frame: IDENTITY_TRANSFORM, extent: null },
    ],
  },
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "on-support",
        target: { kind: "surface", environment: "house", surface: "floor" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** Rests on the table's `stack-top`, and keeps a service volume beside it. */
export const lamp = (): IAutoMoviePropSpec => ({
  ...boxProp("lamp"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "on-support",
        target: { kind: "prop-affordance", prop: "table", affordance: "top" },
      },
    ],
    footprint: null,
    clearance: [
      {
        id: "shade-service",
        min: { x: 1, y: -0.5, z: -0.5 },
        max: { x: 2, y: 0.5, z: 0.5 },
      },
    ],
  },
});

/** Fixed to a building element rather than to another prop. */
export const sconce = (): IAutoMoviePropSpec => ({
  ...boxProp("sconce"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "attached",
        target: { kind: "element", environment: "house", element: "wall" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** Plugged into the table's `socket`. */
export const charger = (): IAutoMoviePropSpec => ({
  ...boxProp("charger"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "attached",
        target: { kind: "prop-affordance", prop: "table", affordance: "plug" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** Hung from a building element. */
export const pendant = (): IAutoMoviePropSpec => ({
  ...boxProp("pendant"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "suspended",
        target: { kind: "element", environment: "house", element: "ceiling" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** Hung from the table's `hook`. */
export const chime = (): IAutoMoviePropSpec => ({
  ...boxProp("chime"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "suspended",
        target: { kind: "prop-affordance", prop: "table", affordance: "peg" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** Stands against a boundary, on the floor, with a declared use footprint. */
export const cabinet = (): IAutoMoviePropSpec => ({
  ...boxProp("cabinet"),
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "against-boundary",
        target: {
          kind: "boundary",
          environment: "house",
          boundary: "room-wall",
        },
      },
      {
        kind: "on-support",
        target: { kind: "surface", environment: "house", surface: "floor" },
      },
    ],
    footprint: {
      min: { x: -0.25, y: -0.3, z: -0.15 },
      max: { x: 0.25, y: 0.3, z: 0.15 },
    },
    clearance: [],
  },
});

/** The leaf filling the doorway, sized to sit inside its reveal. */
export const door = (): IAutoMoviePropSpec => ({
  node: "door",
  model: {
    ...createModel(null),
    id: "door",
    parts: [
      {
        id: "panel",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 0.9, height: 1.9, depth: 0.05 },
        },
        material: "mat-1",
        attachedBone: null,
        transform: null,
      },
    ],
  },
  articulation: null,
  placement: {
    relations: [
      inSpace("room"),
      {
        kind: "fill-opening",
        target: { kind: "opening", environment: "house", opening: "doorway" },
      },
    ],
    footprint: null,
    clearance: [],
  },
});

/** A prop in the cell-less annex: located by name, not by geometry. */
export const crate = (): IAutoMoviePropSpec => ({
  ...boxProp("crate"),
  placement: { relations: [inSpace("annex")], footprint: null, clearance: [] },
});

/** A legacy prop: no placement, mesh geometry, a part-local transform. */
export const sculpture = (): IAutoMoviePropSpec => ({
  node: "sculpture",
  model: {
    ...createModel(null),
    id: "sculpture",
    parts: [
      {
        id: "tetrahedron",
        name: null,
        geometry: {
          type: "mesh",
          mesh: {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            normals: null,
            uvs: null,
            indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
            skin: null,
          },
        },
        material: "mat-1",
        attachedBone: null,
        transform: {
          translation: { x: 0.1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      },
    ],
  },
  articulation: null,
});

/** The whole furnished room, in a stable declaration order. */
export const propRegistry = (): IAutoMoviePropSpec[] => [
  table(),
  lamp(),
  sconce(),
  charger(),
  pendant(),
  chime(),
  cabinet(),
  door(),
  crate(),
  sculpture(),
];

/** The staged placement of every prop in {@link propRegistry}, same order. */
export const propSet = (): IAutoMovieStageSetPiece[] => [
  { node: "table", model: "table", position: { x: 0, y: 0.3, z: 0 } },
  { node: "lamp", model: "lamp", position: { x: 0, y: 0.9, z: 0 }, scale: 1.2 },
  { node: "sconce", model: "sconce", position: { x: -4.5, y: 1.5, z: 0 } },
  { node: "charger", model: "charger", position: { x: 0.5, y: 0.7, z: 0 } },
  { node: "pendant", model: "pendant", position: { x: 0, y: 3, z: 3 } },
  { node: "chime", model: "chime", position: { x: 0, y: 2, z: -2 } },
  { node: "cabinet", model: "cabinet", position: { x: -4, y: 0.3, z: 4 } },
  { node: "door", model: "door", position: { x: 4, y: 1, z: 0 } },
  { node: "crate", model: "crate", position: { x: 20, y: 0.3, z: 20 } },
  {
    node: "sculpture",
    model: "sculpture",
    position: { x: -3, y: 0, z: 0 },
    rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
    scale: { x: 1, y: 2, z: 0.5 },
  },
];
