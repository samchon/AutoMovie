import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieScene,
} from "@automovie/interface";

/**
 * A two-storey building with sealed and connected rooms, an instanced window
 * band, and a declared water body.
 *
 * One fixture rather than several, because the budget report, the semantic mask
 * and the portal hint all have to describe the SAME production for their ids to
 * line up; three fixtures would prove three consistent worlds and nothing about
 * the one that ships.
 *
 * The geometry is deliberately trivial: every drawable is one box part, so the
 * expected triangle and vertex numbers below are hand arithmetic over the
 * engine's own box tessellation rather than a snapshot of what the inventory
 * happened to produce.
 */

/** Triangles the engine's box tessellation emits: six quads, two each. */
export const BOX_TRIANGLES = 12;

/** Vertices the engine's box tessellation emits: six faces of four corners. */
export const BOX_VERTICES = 24;

/** Indices the engine's box tessellation emits. */
export const BOX_INDICES = 36;

/** Device bytes one box part occupies: 24 vertices of pos+normal, 36 indices. */
export const BOX_GEOMETRY_BYTES = BOX_VERTICES * 24 + BOX_INDICES * 4;

/** One flat material with an optional base-colour texture binding. */
export const material = (id: string, texture?: string): IAutoMovieMaterial => ({
  id,
  name: null,
  baseColor: { r: 0.5, g: 0.5, b: 0.5, a: 1, hex: null },
  metallic: 0,
  roughness: 1,
  emissive: null,
  opacity: 1,
  baseColorTexture: texture ?? null,
});

/** A single-box model with `parts` identical parts. */
export const boxModel = (props: {
  id: string;
  parts?: number;
  materials?: IAutoMovieMaterial[];
}): IAutoMovieModel => ({
  id: props.id,
  name: null,
  origin: "generated",
  parts: Array.from({ length: props.parts ?? 1 }, (_, index) => ({
    id: `${props.id}-part-${index}`,
    name: null,
    geometry: {
      type: "primitive" as const,
      shape: { type: "box" as const, width: 1, height: 1, depth: 1 },
    },
    material: (props.materials ?? [])[index]?.id ?? null,
    attachedBone: null,
    transform: null,
  })),
  skeleton: null,
  body: null,
  materials: props.materials ?? [],
  asset: null,
});

/** An axis-aligned box cell as six half-space planes. */
export const boxCell = (props: {
  id: string;
  min: [number, number, number];
  max: [number, number, number];
}): IAutoMovieBuiltEnvironment["spaces"][number]["cells"][number] => ({
  id: props.id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: props.max[0] },
    { normal: { x: -1, y: 0, z: 0 }, offset: -props.min[0] },
    { normal: { x: 0, y: 1, z: 0 }, offset: props.max[1] },
    { normal: { x: 0, y: -1, z: 0 }, offset: -props.min[1] },
    { normal: { x: 0, y: 0, z: 1 }, offset: props.max[2] },
    { normal: { x: 0, y: 0, z: -1 }, offset: -props.min[2] },
  ],
});

const identity = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * Two storeys, three rooms.
 *
 * - `ground-hall` and `ground-vault` share a wall. The wall between them has NO
 *   opening, so the vault is sealed from the hall.
 * - `ground-hall` has an exterior window, so it can see and be seen from outside.
 * - `upper-loft` is joined to `ground-hall` by a stair connector.
 * - `ground-vault` is sealed from everything: no opening, no connector.
 */
export const buildingFixture = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "tower",
  units: "meter",
  buildings: [{ id: "unit-a", element: "shell", space: "site" }],
  models: [],
  modelReferences: ["wall-model", "door-model", "slab-model"],
  elements: [
    {
      id: "shell",
      kind: "building",
      parent: null,
      transform: identity,
      model: null,
      space: "site",
    },
    {
      id: "hall-wall",
      kind: "wall",
      parent: "shell",
      transform: identity,
      model: "wall-model",
      space: "ground-hall",
    },
    {
      id: "vault-wall",
      kind: "wall",
      parent: "shell",
      transform: identity,
      model: "wall-model",
      space: "ground-vault",
    },
    {
      id: "hall-door-leaf",
      kind: "door-leaf",
      parent: "hall-wall",
      transform: identity,
      model: "door-model",
      space: "ground-hall",
    },
    {
      id: "loft-slab",
      kind: "slab",
      parent: "shell",
      transform: identity,
      model: "slab-model",
      space: "upper-loft",
    },
  ],
  spaces: [
    { id: "site", kind: "building", parent: null, cells: [] },
    { id: "ground", kind: "storey", parent: "site", cells: [] },
    { id: "upper", kind: "storey", parent: "site", cells: [] },
    {
      id: "ground-hall",
      kind: "room",
      parent: "ground",
      cells: [boxCell({ id: "hall", min: [0, 0, 0], max: [10, 3, 10] })],
    },
    {
      id: "ground-vault",
      kind: "room",
      parent: "ground",
      cells: [boxCell({ id: "vault", min: [10, 0, 0], max: [16, 3, 10] })],
    },
    {
      id: "upper-loft",
      kind: "room",
      parent: "upper",
      cells: [boxCell({ id: "loft", min: [0, 3, 0], max: [10, 6, 10] })],
    },
  ],
  boundaries: [
    {
      id: "hall-facade",
      kind: "wall",
      spaces: ["ground-hall"],
      elements: ["hall-wall"],
    },
    {
      id: "hall-vault-wall",
      kind: "wall",
      spaces: ["ground-hall", "ground-vault"],
      elements: ["vault-wall"],
    },
  ],
  openings: [
    {
      id: "hall-door",
      kind: "door",
      boundary: "hall-facade",
      fill: "hall-door-leaf",
    },
    { id: "hall-window", kind: "window", boundary: "hall-facade", fill: null },
  ],
  connectors: [
    {
      id: "loft-stair",
      kind: "stair",
      from: "ground-hall",
      to: "upper-loft",
      bidirectional: true,
      route: [
        { x: 1, y: 0, z: 1 },
        { x: 1, y: 3, z: 1 },
      ],
      width: 1.2,
      clearHeight: 2.1,
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** The scene a lowered building plus one ordinary prop stages. */
export const sceneFixture = (props?: {
  /** Stage the nodes in reverse order, to prove order independence. */
  reversed?: boolean;
  /** Add one unrelated prop, to prove an irrelevant edit changes no colour. */
  extra?: boolean;
}): IAutoMovieScene => {
  const nodes = [
    node("tower/hall-wall", "wall-model"),
    node("tower/vault-wall", "wall-model"),
    node("tower/hall-door-leaf", "door-model"),
    node("tower/loft-slab", "slab-model"),
    node("lantern", "prop-model"),
  ];
  if (props?.extra === true) nodes.push(node("crate", "prop-model"));
  return {
    id: "tower-scene",
    name: null,
    nodes: props?.reversed === true ? [...nodes].reverse() : nodes,
    cameras: [],
    lights: [
      {
        id: "sun",
        type: "directional",
        transform: identity,
        color: { r: 1, g: 1, b: 1, a: 1, hex: null },
        intensity: 3,
        castShadow: true,
        shadow: { mapSize: 1024, bias: 0, normalBias: 0, near: 0.1, far: 50 },
      },
      {
        id: "fill",
        type: "point",
        transform: identity,
        color: { r: 1, g: 1, b: 1, a: 1, hex: null },
        intensity: 1,
        range: 0,
      },
    ],
  };
};

const node = (id: string, model: string): IAutoMovieScene["nodes"][number] => ({
  id,
  model,
  transform: identity,
  motion: null,
  pose: null,
});

/** Runtime models the fixture scene and instance set cite. */
export const modelsFixture = (): IAutoMovieModel[] => {
  const stone = material("stone", "textures/stone.png");
  const oak = material("oak");
  return [
    boxModel({ id: "wall-model", materials: [stone] }),
    boxModel({ id: "door-model", materials: [oak] }),
    boxModel({ id: "slab-model", materials: [stone] }),
    boxModel({ id: "prop-model", materials: [oak] }),
    boxModel({ id: "window-model", materials: [oak] }),
  ];
};

/** A compiled instance set of `count` window slots in `chunks` chunks. */
export const instanceSetFixture = (props: {
  id: string;
  count: number;
  chunks: number;
  model?: string;
}): IAutoMovieCompiledInstanceSet => {
  const size = Math.ceil(props.count / props.chunks);
  const bounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 1, y: 1, z: 1 },
  };
  return {
    version: 1,
    id: props.id,
    count: props.count,
    modelRecipe: "window",
    layout: {
      kind: "grid",
      rows: 1,
      columns: props.count,
      spacing: { x: 1, z: 1 },
    },
    route: null,
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 1,
    variation: { scale: { min: 1, max: 1 }, palette: ["#FFFFFF"], traits: [] },
    bounds,
    centroid: { x: 0.5, y: 0.5, z: 0.5 },
    projectionRadius: 1,
    chunks: Array.from({ length: props.chunks }, (_, index) => ({
      index,
      start: index * size,
      count: Math.min(size, props.count - index * size),
      bounds,
      centroid: { x: 0.5, y: 0.5, z: 0.5 },
    })),
    lod: [
      {
        tier: "near",
        maxDistance: null,
        recipe: "window",
        recipeDigest: `sha256:${"0".repeat(64)}`,
        model: props.model ?? "window-model",
      },
    ],
    digest: `sha256:${"1".repeat(64)}`,
  };
};
