import {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftFurnishing,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Builders for soft-body and planting scenarios.
 *
 * Every default is chosen to be a **dyadic rational** (an exact binary
 * fraction), so a hand-computed expectation is reproducible bit for bit on any
 * IEEE-754 machine rather than merely close on the one that ran it. Gravity is
 * `8` rather than `9.81` for the same reason: a free fall whose expectation is
 * a repeating binary fraction proves nothing about exactness.
 */
export const softPanel = (props: {
  columns: number;
  rows: number;
  /** Lattice spacing along the panel's two axes. */
  spacing?: { u: number; v: number };
  /** World position of particle `(0, 0)`. */
  origin?: IAutoMovieVector3;
  /** Direction the column index advances along; defaults to `+x`. */
  axisU?: IAutoMovieVector3;
  /** Direction the row index advances along; defaults to `-y` (a curtain). */
  axisV?: IAutoMovieVector3;
  overrides?: Partial<IAutoMovieSoftBodyDomain>;
}): IAutoMovieSoftBodyDomain => {
  const spacing = props.spacing ?? { u: 0.25, v: 0.25 };
  const origin = props.origin ?? { x: 0, y: 0, z: 0 };
  const axisU = props.axisU ?? { x: 1, y: 0, z: 0 };
  const axisV = props.axisV ?? { x: 0, y: -1, z: 0 };
  const rest: number[] = [];
  for (let row = 0; row < props.rows; ++row)
    for (let column = 0; column < props.columns; ++column)
      rest.push(
        origin.x + axisU.x * column * spacing.u + axisV.x * row * spacing.v,
        origin.y + axisU.y * column * spacing.u + axisV.y * row * spacing.v,
        origin.z + axisU.z * column * spacing.u + axisV.z * row * spacing.v,
      );
  return {
    version: 1,
    id: "panel",
    units: "meter",
    lattice: { columns: props.columns, rows: props.rows },
    solver: {
      fixedStepSeconds: 0.015625,
      gravity: { x: 0, y: -8, z: 0 },
      drag: 0,
      iterations: 2,
      stiffness: { structural: 1, shear: 0.5, bend: 0.25 },
      referenceSpeed: 4,
      maxSteps: 1_000,
    },
    rest,
    mass: new Array(props.columns * props.rows).fill(0.125),
    anchors: [],
    states: [],
    colliders: [],
    wind: null,
    selfCollision: false,
    ...props.overrides,
  };
};

/** A soft furnishing binding the default room environment to a panel. */
export const softFurnishing = (
  overrides: Partial<IAutoMovieSoftFurnishing> = {},
): IAutoMovieSoftFurnishing => ({
  id: "window-curtain",
  environment: "suite",
  space: "suite-room",
  domain: "panel",
  kind: "curtain",
  mode: "simulated",
  state: null,
  supports: ["track"],
  material: null,
  ...overrides,
});

/**
 * A minimal built environment: one room, a curtain track, a wall boundary, a
 * floor patch and a stand-pipe element the irrigation port resolves to.
 */
export const roomEnvironment = (
  props: {
    id?: string;
    space?: string;
    /** Half-extent of the room box on `x`/`z`, centred on the origin. */
    half?: number;
    /** Floor height of the room box. */
    floor?: number;
    /** Ceiling height of the room box. */
    ceiling?: number;
    /** Leave the logical space purely semantic (no convex cells). */
    semantic?: boolean;
  } = {},
): IAutoMovieBuiltEnvironment => {
  const id = props.id ?? "suite";
  const space = props.space ?? "suite-room";
  const half = props.half ?? 8;
  const floor = props.floor ?? -4;
  const ceiling = props.ceiling ?? 4;
  const identity = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
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
        transform: identity,
        model: null,
        space,
      },
      {
        id: "track",
        kind: "curtain-track",
        parent: "root",
        transform: identity,
        model: null,
        space,
      },
      {
        id: "stand-pipe",
        kind: "service-port",
        parent: "root",
        transform: identity,
        model: null,
        space,
      },
    ],
    spaces: [
      {
        id: space,
        kind: "room",
        parent: null,
        cells:
          props.semantic === true
            ? []
            : [
                {
                  id: "room-cell",
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
      { id: "window-wall", kind: "wall", spaces: [space], elements: ["track"] },
    ],
    openings: [],
    connectors: [],
    surfaces: [
      {
        space,
        surface: {
          id: "room-floor",
          kind: "floor",
          polygon: [
            { x: -half, y: 0, z: -half },
            { x: half, y: 0, z: -half },
            { x: half, y: 0, z: half },
            { x: -half, y: 0, z: half },
          ],
          anchor: { x: 0, y: 0, z: 0 },
          rampTo: null,
        },
      },
    ],
    walkable: ["room-floor"],
  };
};

/**
 * A planting recipe with no jitter, so every derived coordinate is a hand
 * computation rather than a sample of the code's own output.
 */
export const plantingRecipe = (
  overrides: Partial<IAutoMoviePlantingDomain> = {},
): IAutoMoviePlantingDomain => ({
  version: 1,
  id: "fern",
  units: "meter",
  seed: 20_260_810,
  structure: {
    levels: 3,
    axis: { x: 0, y: 1, z: 0 },
    length: 1,
    radius: 0.0625,
    lengthRatio: 0.5,
    radiusRatio: 0.5,
    children: [
      { id: "a", direction: { x: 1, y: 1, z: 0 }, offset: 0.5 },
      { id: "b", direction: { x: -1, y: 1, z: 0 }, offset: 1 },
    ],
    directionJitter: 0,
    lengthJitter: 0,
    gravitropism: 0,
  },
  growth: { stage: 1, onset: 0.25 },
  pruning: { kind: "none" },
  foliage: null,
  budget: { maxBranches: 64, maxLeaves: 512 },
  ...overrides,
});

/** A planting cluster placing several members of one recipe. */
export const plantingCluster = (
  overrides: Partial<IAutoMoviePlantingCluster> = {},
): IAutoMoviePlantingCluster => ({
  id: "atrium-bed",
  domain: "fern",
  count: 6,
  anchor: { x: 0, y: 0, z: 0 },
  extent: { x: 2, z: 2 },
  seed: 4_242,
  minSpacing: 0.5,
  attempts: 16,
  scale: {
    min: { x: 0.75, y: 0.5, z: 0.75 },
    max: { x: 1.25, y: 1.5, z: 1.25 },
  },
  yawJitter: 1,
  ...overrides,
});

/** A planting installation binding the default room to a cluster. */
export const plantingInstallation = (
  overrides: Partial<IAutoMoviePlantingInstallation> = {},
): IAutoMoviePlantingInstallation => ({
  id: "lobby-planting",
  environment: "suite",
  space: "suite-room",
  cluster: "atrium-bed",
  kind: "planter",
  support: { kind: "surface", surface: "room-floor" },
  branchMaterial: null,
  leafMaterial: null,
  irrigation: {
    port: "stand-pipe",
    demandLitresPerDay: 12,
    medium: "reclaimed",
    fluidDomain: null,
  },
  ...overrides,
});

/** True when two numeric arrays are bit-for-bit identical, length included. */
export const exactValues = (
  actual: readonly number[],
  expected: readonly number[],
): boolean =>
  actual.length === expected.length &&
  actual.every((value, index) => Object.is(value, expected[index]));
