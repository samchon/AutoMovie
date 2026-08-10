import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMovieWaterFeature,
} from "@automovie/interface";

/**
 * Builders for fluid-domain scenarios.
 *
 * Every default is chosen to be a **dyadic rational** (an exact binary
 * fraction), so a hand-computed expectation is reproducible bit for bit on any
 * IEEE-754 machine rather than merely close on the one that ran it.
 */
export const fluidDomain = (
  overrides: Partial<IAutoMovieFluidDomain> = {},
): IAutoMovieFluidDomain => ({
  version: 1,
  id: "pond",
  units: "meter",
  grid: {
    columns: 2,
    rows: 1,
    cellX: 1,
    cellZ: 1,
    origin: { x: 0, y: 0, z: 0 },
  },
  solver: {
    fixedStepSeconds: 0.125,
    gravity: 8,
    drag: 0,
    dryDepth: 0,
    referenceDepth: 1.5,
    maxSteps: 1_000,
  },
  boundaries: { xMin: "wall", xMax: "wall", zMin: "wall", zMax: "wall" },
  bed: [0, 0],
  depth: [1.5, 0.5],
  solid: [false, false],
  sources: [],
  drains: [],
  sprays: [],
  ...overrides,
});

/** A flat-bed basin of uniform depth, walled on every side. */
export const flatBasin = (props: {
  columns: number;
  rows: number;
  depth: number;
  overrides?: Partial<IAutoMovieFluidDomain>;
}): IAutoMovieFluidDomain => {
  const cells = props.columns * props.rows;
  return fluidDomain({
    id: "basin",
    grid: {
      columns: props.columns,
      rows: props.rows,
      cellX: 0.5,
      cellZ: 0.5,
      origin: { x: 0, y: 0, z: 0 },
    },
    solver: {
      fixedStepSeconds: 0.015625,
      gravity: 8,
      drag: 0,
      dryDepth: 0,
      referenceDepth: 2,
      maxSteps: 5_000,
    },
    bed: new Array(cells).fill(0),
    depth: new Array(cells).fill(props.depth),
    solid: new Array(cells).fill(false),
    ...props.overrides,
  });
};

/** A minimal built environment whose one logical space is a walled basin. */
export const basinEnvironment = (
  props: {
    id?: string;
    space?: string;
    /** Half-extent of the basin box on `x`/`z`, centred on the origin. */
    half?: number;
    /** Floor height of the basin box. */
    floor?: number;
    /** Ceiling height of the basin box. */
    ceiling?: number;
  } = {},
): IAutoMovieBuiltEnvironment => {
  const id = props.id ?? "atrium";
  const space = props.space ?? "atrium-basin";
  const half = props.half ?? 8;
  const floor = props.floor ?? -1;
  const ceiling = props.ceiling ?? 4;
  return {
    version: 1,
    id,
    units: "meter",
    buildings: [{ id: "unit", element: "root", space }],
    models: [],
    modelReferences: [],
    elements: [
      {
        id: "root",
        kind: "building",
        parent: null,
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        model: null,
        space,
      },
    ],
    spaces: [
      {
        id: space,
        kind: "room",
        parent: null,
        cells: [
          {
            id: "basin-cell",
            planes: [
              { normal: { x: -1, y: 0, z: 0 }, offset: half },
              { normal: { x: 1, y: 0, z: 0 }, offset: half },
              { normal: { x: 0, y: -1, z: 0 }, offset: -floor },
              { normal: { x: 0, y: 1, z: 0 }, offset: ceiling },
              { normal: { x: 0, y: 0, z: -1 }, offset: half },
              { normal: { x: 0, y: 0, z: 1 }, offset: half },
            ],
          },
        ],
      },
    ],
    boundaries: [
      { id: "coping", kind: "wall", spaces: [space], elements: [] },
      { id: "elsewhere", kind: "wall", spaces: ["other"], elements: [] },
    ],
    openings: [],
    connectors: [],
    surfaces: [],
    walkable: [],
  };
};

/** A water feature binding the default basin environment to a fluid domain. */
export const waterFeature = (
  overrides: Partial<IAutoMovieWaterFeature> = {},
): IAutoMovieWaterFeature => ({
  id: "atrium-pond",
  environment: "atrium",
  space: "atrium-basin",
  domain: "basin",
  kind: "pond",
  mode: "simulated",
  boundaries: ["coping"],
  material: null,
  ...overrides,
});

/** True when two numeric arrays are bit-for-bit identical, length included. */
export const exactArray = (
  actual: readonly number[],
  expected: readonly number[],
): boolean =>
  actual.length === expected.length &&
  actual.every((value, index) => Object.is(value, expected[index]));

/** True when every value of the array is at least `bound`. */
export const atLeast = (values: readonly number[], bound: number): boolean =>
  values.every((value) => value >= bound);
