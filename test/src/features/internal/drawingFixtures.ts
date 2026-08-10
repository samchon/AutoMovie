import {
  AutoMoviePrimitiveShape,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingStyle,
  IAutoMovieDrawingView,
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * One small building whose every dimension is a round number, so a drawing
 * derived from it can be checked by hand rather than by snapshot.
 *
 * The geometry is deliberately plain and deliberately varied: a slab below the
 * plan cut, a wall through it, a beam above it, a footing far below it, a
 * boundary that carries its own face and no element, a rectangular door void, a
 * circular oculus authored as two half-turn arcs, and an opening with no
 * geometry at all. Each of those is one branch of the derivation, and each has
 * a size somebody can multiply in their head.
 *
 * World layout, in metres:
 *
 * - `floor-slab`: x 0..10, y -0.2..0, z 0..6
 * - `north-wall`: x 0..6, y 0..3, z 0..0.2
 * - `door-leaf`: x 1.05..1.95, y 0..2.1, z 0.075..0.125 (child of the wall)
 * - `roof-beam`: x 0..6, y 3..3.4, z 2.85..3.15
 * - `footing`: x 0..10, y -0.7..-0.5, z 0..6
 * - `parapet` boundary face: x 0..10, y 3..3.5, z 0..0.2
 */

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

/** A transform that only moves something; the fixture never scales or turns. */
export const drawingPlace = (
  x: number,
  y: number,
  z: number,
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: NO_ROTATION,
  scale: { x: 1, y: 1, z: 1 },
});

/** An axis-aligned convex cell, as the six half-spaces that bound it. */
export const drawingCell = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): IAutoMovieBuiltEnvironment["spaces"][number]["cells"][number] => ({
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

/** One flat material, since a finish plan only ever reads its id. */
export const drawingMaterial = (id: string): IAutoMovieMaterial => ({
  id,
  name: null,
  baseColor: { r: 0.5, g: 0.5, b: 0.5, a: 1, hex: null },
  metallic: 0,
  roughness: 1,
  emissive: null,
  opacity: 1,
  baseColorTexture: null,
});

/** A single-part model of one box, with one material bound to that part. */
export const drawingBoxModel = (props: {
  id: string;
  shape: AutoMoviePrimitiveShape;
  material: string;
}): IAutoMovieModel => ({
  id: props.id,
  name: null,
  origin: "generated",
  parts: [
    {
      id: `${props.id}-body`,
      name: null,
      geometry: { type: "primitive", shape: props.shape },
      material: props.material,
      attachedBone: null,
      transform: null,
    },
  ],
  skeleton: null,
  body: null,
  materials: [drawingMaterial(props.material)],
  asset: null,
});

/** The hand-checkable building every drawing scenario is derived from. */
export const drawingEnvironment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "atelier",
  units: "meter",
  buildings: [{ id: "unit-a", element: "shell", space: "site" }],
  models: [
    drawingBoxModel({
      id: "slab",
      shape: { type: "box", width: 10, height: 0.2, depth: 6 },
      material: "screed",
    }),
    drawingBoxModel({
      id: "wall",
      shape: { type: "box", width: 6, height: 3, depth: 0.2 },
      material: "plaster",
    }),
    drawingBoxModel({
      id: "beam",
      shape: { type: "box", width: 6, height: 0.4, depth: 0.3 },
      material: "plaster",
    }),
    drawingBoxModel({
      id: "leaf",
      shape: { type: "box", width: 0.9, height: 2.1, depth: 0.05 },
      material: "oak",
    }),
  ],
  modelReferences: [],
  elements: [
    {
      id: "shell",
      kind: "building",
      parent: null,
      transform: drawingPlace(0, 0, 0),
      model: null,
      space: "site",
    },
    {
      id: "floor-slab",
      kind: "slab",
      parent: "shell",
      transform: drawingPlace(5, -0.1, 3),
      model: "slab",
      space: "hall",
    },
    {
      id: "north-wall",
      kind: "wall",
      parent: "shell",
      transform: drawingPlace(3, 1.5, 0.1),
      model: "wall",
      space: "hall",
    },
    {
      id: "door-leaf",
      kind: "door-leaf",
      parent: "north-wall",
      transform: drawingPlace(-1.5, -0.45, 0),
      model: "leaf",
      space: "hall",
    },
    {
      id: "roof-beam",
      kind: "beam",
      parent: "shell",
      transform: drawingPlace(3, 3.2, 3),
      model: "beam",
      space: "roof-deck",
    },
    {
      id: "footing",
      kind: "footing",
      parent: "shell",
      transform: drawingPlace(5, -0.6, 3),
      model: "slab",
      space: "hall",
    },
  ],
  spaces: [
    { id: "site", kind: "building", parent: null, cells: [] },
    {
      id: "hall",
      kind: "room",
      parent: "site",
      cells: [
        drawingCell("hall-cell", { x: 0, y: 0, z: 0 }, { x: 10, y: 3, z: 6 }),
      ],
    },
    {
      id: "roof-deck",
      kind: "roof-deck",
      parent: "site",
      cells: [
        drawingCell("deck-cell", { x: 0, y: 3, z: 0 }, { x: 10, y: 3.5, z: 6 }),
      ],
    },
  ],
  boundaries: [
    {
      id: "north",
      kind: "wall",
      spaces: ["hall"],
      elements: ["north-wall"],
      face: {
        origin: { x: 0, y: 0, z: 0 },
        rotation: NO_ROTATION,
        outline: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 3 },
          { x: 0, y: 3 },
        ],
        thickness: 0.2,
      },
    },
    {
      id: "parapet",
      kind: "parapet",
      spaces: ["roof-deck"],
      elements: [],
      face: {
        origin: { x: 0, y: 3, z: 0 },
        rotation: NO_ROTATION,
        outline: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0.5 },
          { x: 0, y: 0.5 },
        ],
        thickness: 0.2,
      },
    },
  ],
  openings: [
    {
      id: "front-door",
      kind: "door",
      boundary: "north",
      fill: "door-leaf",
      profile: {
        outline: [
          { x: 1.05, y: 0 },
          { x: 1.95, y: 0 },
          { x: 1.95, y: 2.1 },
          { x: 1.05, y: 2.1 },
        ],
      },
    },
    {
      id: "oculus",
      kind: "window",
      boundary: "north",
      fill: null,
      profile: {
        outline: [
          { x: 3, y: 2 },
          { x: 3.6, y: 2 },
        ],
        bulges: [1, 1],
      },
    },
    { id: "vent", kind: "vent", boundary: "north", fill: null },
  ],
  connectors: [
    {
      id: "roof-stair",
      kind: "stair",
      from: "hall",
      to: "roof-deck",
      bidirectional: true,
      route: [
        { x: 9, y: 0, z: 5 },
        { x: 9, y: 3, z: 3 },
      ],
      width: 1.2,
      clearHeight: 2.1,
      elements: [],
    },
    {
      id: "service-ramp",
      kind: "ramp",
      from: "hall",
      to: "roof-deck",
      bidirectional: false,
      route: [
        { x: 0.5, y: 0, z: 5 },
        { x: 0.5, y: 3, z: 1 },
      ],
      sections: [
        { at: 0, width: 1.5, clearHeight: 2.2 },
        { at: 1, width: 1.2, clearHeight: 2.4 },
      ],
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
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 0, z: 6 },
          { x: 0, y: 0, z: 6 },
        ],
        height: { kind: "constant", value: 0 },
      },
    },
  ],
  walkable: ["hall-floor"],
});

/** A plain pen: one weight per role, the two removed roles dashed. */
export const drawingStyle = (): IAutoMovieDrawingStyle => ({
  weights: { cut: 0.5, projected: 0.25, overhead: 0.18, hidden: 0.13 },
  dashes: { cut: [], projected: [], overhead: [3, 1.5], hidden: [1, 1] },
  textHeight: 2.5,
});

/** A view with every field spelled, so a scenario only overrides what it tests. */
export const drawingView = (
  overrides: Partial<IAutoMovieDrawingView> = {},
): IAutoMovieDrawingView => ({
  id: "plan-ground",
  projection: "plan",
  discipline: "architectural",
  origin: { x: 0, y: 1.2, z: 0 },
  direction: { x: 0, y: -1, z: 0 },
  up: { x: 0, y: 0, z: -1 },
  scale: 50,
  depth: null,
  overhead: null,
  spaces: [],
  elementKinds: [],
  dimensions: [],
  annotations: [],
  style: drawingStyle(),
  ...overrides,
});
