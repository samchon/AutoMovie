import { lowerWaterFeature, validateWaterFeatures } from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMovieFluidSpray,
  IAutoMovieWaterFeature,
} from "@automovie/interface";
import {
  applyRenderMode,
  buildFluidSprayObject,
  buildFluidSurfaceObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts } from "../internal/predicates";

/** The four courts, each a convex box two metres either side of its centre. */
const COURTS = [
  { space: "pond-court", rim: "pond-coping", centre: 0 },
  { space: "channel-court", rim: "channel-kerb", centre: 8 },
  { space: "fountain-court", rim: "fountain-rim", centre: 16 },
  { space: "fall-court", rim: "fall-parapet", centre: 24 },
] as const;

const court = (centre: number) => ({
  id: `cell-${centre}`,
  planes: [
    { normal: { x: -1, y: 0, z: 0 }, offset: 2 - centre },
    { normal: { x: 1, y: 0, z: 0 }, offset: 2 + centre },
    { normal: { x: 0, y: -1, z: 0 }, offset: 1 },
    { normal: { x: 0, y: 1, z: 0 }, offset: 6 },
    { normal: { x: 0, y: 0, z: -1 }, offset: 2 },
    { normal: { x: 0, y: 0, z: 1 }, offset: 2 },
  ],
});

/** One building whose four logical spaces are four water courts. */
const waterCourt = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "water-court",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "court" }],
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
      space: "court",
    },
  ],
  spaces: [
    { id: "court", kind: "room", parent: null, cells: [] },
    ...COURTS.map((one) => ({
      id: one.space,
      kind: "room" as const,
      parent: "court",
      cells: [court(one.centre)],
    })),
  ],
  boundaries: COURTS.map((one) => ({
    id: one.rim,
    kind: "wall" as const,
    spaces: [one.space],
    elements: [],
  })),
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/** A 4×4 lattice centred on one court, walled all round. */
const lattice = (props: {
  id: string;
  centre: number;
  bed: number[];
  depth: number[];
  sources?: IAutoMovieFluidDomain["sources"];
  drains?: IAutoMovieFluidDomain["drains"];
  sprays?: IAutoMovieFluidSpray[];
}): IAutoMovieFluidDomain => ({
  version: 1,
  id: props.id,
  units: "meter",
  grid: {
    columns: 4,
    rows: 4,
    cellX: 0.5,
    cellZ: 0.5,
    origin: { x: props.centre - 1, y: 0, z: -1 },
  },
  solver: {
    fixedStepSeconds: 0.015625,
    gravity: 8,
    drag: 0,
    dryDepth: 0,
    referenceDepth: 2,
    maxSteps: 5_000,
  },
  boundaries: { xMin: "wall", xMax: "wall", zMin: "wall", zMax: "wall" },
  bed: props.bed,
  depth: props.depth,
  solid: new Array(16).fill(false),
  sources: props.sources ?? [],
  drains: props.drains ?? [],
  sprays: props.sprays ?? [],
});

const mist = (column: number, row: number): IAutoMovieFluidSpray => ({
  id: "mist",
  column,
  row,
  rate: 8,
  lifetime: 1,
  speed: 2,
  direction: { x: 0, y: 1, z: 0 },
  spread: 0,
  size: 0.05,
  seed: 11,
  maxParticles: 16,
  lodDistance: 10,
});

const flat = (value: number) => new Array(16).fill(value);

/** Bed and depth of the ledge: the upper two rows stand a metre above. */
const ledge = (upper: number, lower: number) =>
  Array.from({ length: 16 }, (_, cell) => (cell < 8 ? upper : lower));

/**
 * The four archetypal water features a building owns — a still indoor pond, a
 * circulating channel, a source-to-drain fountain basin, and a falling water
 * wall — bind to the logical spaces and rims of one built environment, and each
 * one draws in the beauty, normal, depth and mask passes.
 *
 * The four exist as one case because the acceptance is about the seam, not the
 * solver: each is an independent fluid domain that the architecture record
 * knows nothing about, bound to a space and a coping by an
 * `IAutoMovieWaterFeature`, lowered to a frame, and projected by the viewer.
 * The solver behaviour of each shape is proven in its own case; what is proven
 * here is that all four survive the binding, that a building can hold four
 * lattices at once without their names crossing, and that the water reaches the
 * structural passes a diffusion guide reads.
 *
 * Spray is the deliberate opposite of the surface: the fountain's mist and the
 * ledge's curtain are `THREE.Points`, which those same passes hide, because
 * decoration must not colour a segmentation mask or read as geometry in depth.
 *
 * Scenarios:
 *
 * 1. All four features bind clean: every space, rim and domain resolves, every rim
 *    bounds the basin it claims, and every lattice sits inside its court.
 * 2. Each feature lowers to a frame that actually draws: a non-null surface
 *    extent, at least one triangulated quad, and a mesh the viewer marks
 *    visible. The still pond reads its authored step 0 whatever the shot second
 *    is, while the other three read the fixed-step solve at that second.
 * 3. `flowing` is the only mode that asks for scrolling ripples, and exactly the
 *    channel declared it.
 * 4. The depth, normal and mask passes each replace every water material and put
 *    every original back on restore; the beauty pass leaves all four alone.
 * 5. Those same passes hide the two live mists — the fountain's jet and the
 *    curtain at the foot of the ledge — and restore them, and what the viewer
 *    uploaded is exactly the engine's own sample: a steady set of `rate ×
 *    lifetime` particles, taken from the emitter's numbers rather than from
 *    whatever the sampler happened to emit.
 */
export const test_viewer_water_feature_passes = (): void => {
  const environment = waterCourt();
  const domains: IAutoMovieFluidDomain[] = [
    lattice({
      id: "atrium-pond",
      centre: 0,
      bed: flat(0),
      depth: flat(0.25),
    }),
    lattice({
      id: "cloister-channel",
      centre: 8,
      bed: flat(0),
      depth: flat(0.25),
      sources: [
        { id: "feed", column: 0, row: 1, flowRate: 0.05, start: 0, end: null },
      ],
      drains: [
        {
          id: "return",
          column: 3,
          row: 2,
          flowRate: 0.01,
          sillLevel: 0.2,
          start: 0,
          end: null,
        },
      ],
    }),
    lattice({
      id: "court-fountain",
      centre: 16,
      bed: flat(0),
      depth: flat(0.25),
      sources: [
        { id: "jet", column: 1, row: 1, flowRate: 0.05, start: 0, end: null },
      ],
      drains: [
        {
          id: "sump",
          column: 2,
          row: 2,
          flowRate: 0.01,
          sillLevel: 0.2,
          start: 0,
          end: null,
        },
      ],
      sprays: [mist(1, 1)],
    }),
    lattice({
      id: "wall-fall",
      centre: 24,
      bed: ledge(1, 0),
      depth: ledge(0.5, 0),
      sprays: [mist(1, 2)],
    }),
  ];
  const features: IAutoMovieWaterFeature[] = [
    {
      id: "still-pond",
      environment: "water-court",
      space: "pond-court",
      domain: "atrium-pond",
      kind: "pond",
      mode: "static",
      boundaries: ["pond-coping"],
      material: null,
    },
    {
      id: "circulating-channel",
      environment: "water-court",
      space: "channel-court",
      domain: "cloister-channel",
      kind: "channel",
      mode: "flowing",
      boundaries: ["channel-kerb"],
      material: null,
    },
    {
      id: "fountain-basin",
      environment: "water-court",
      space: "fountain-court",
      domain: "court-fountain",
      kind: "fountain",
      mode: "simulated",
      boundaries: ["fountain-rim"],
      material: null,
    },
    {
      id: "water-wall",
      environment: "water-court",
      space: "fall-court",
      domain: "wall-fall",
      kind: "waterfall",
      mode: "simulated",
      boundaries: ["fall-parapet"],
      material: null,
    },
  ];

  const binding = validateWaterFeatures({ environment, features, domains });
  TestValidator.equals(
    "four independent lattices bind to four courts of one building",
    binding.success,
    true,
  );

  const time = 2;
  const solvedStep = time / domains[0].solver.fixedStepSeconds;
  const frames = features.map((feature, index) =>
    lowerWaterFeature({ feature, domain: domains[index], time }),
  );
  const waters = frames.map((frame, index) =>
    buildFluidSurfaceObject({
      surface: frame.surface,
      mode: features[index].mode,
    }),
  );
  const sprays = frames.map((frame) =>
    buildFluidSprayObject({ sample: frame.spray }),
  );

  TestValidator.equals(
    "every archetype lowers to water a camera can actually see",
    namedFacts([
      ["bounds", () => frames.every((frame) => frame.surface.bounds !== null)],
      [
        "quads",
        () =>
          frames.every(
            (frame) => (frame.surface.mesh.indices ?? []).length >= 6,
          ),
      ],
      ["visible", () => waters.every((water) => water.object.visible === true)],
      [
        "named",
        () =>
          waters.map((water) => water.object.name).join("|") ===
          "water:atrium-pond|water:cloister-channel|water:court-fountain|water:wall-fall",
      ],
      ["staticHolds", () => frames[0].state.step === 0],
      [
        "solvedSeek",
        () => frames.slice(1).every((frame) => frame.state.step === solvedStep),
      ],
      [
        "surfaceFollowsState",
        () => frames.every((frame) => frame.surface.step === frame.state.step),
      ],
      [
        "flowing",
        () =>
          waters
            .map((water) => water.object.userData.flowing === true)
            .join(",") === "false,true,false,false",
      ],
    ]),
    {
      bounds: true,
      quads: true,
      visible: true,
      named: true,
      staticHolds: true,
      solvedSeek: true,
      surfaceFollowsState: true,
      flowing: true,
    },
  );

  const scene = new THREE.Scene();
  for (const water of waters) scene.add(water.object);
  for (const spray of sprays) scene.add(spray.object);
  const originals = waters.map((water) => water.object.material);
  // The two emitters that actually carry particles: the fountain's jet and the
  // curtain at the foot of the ledge. The still pond and the channel declare no
  // emitter, so hiding them would prove nothing.
  const misted = [sprays[2], sprays[3]];

  const structural = (["depth", "normal", "mask"] as const).map((mode) => {
    const handle = applyRenderMode(scene, mode);
    const overridden = waters.every(
      (water, index) => water.object.material !== originals[index],
    );
    const mistHidden = misted.every((spray) => spray.object.visible === false);
    handle.restore();
    return {
      overridden,
      mistHidden,
      restored: waters.every(
        (water, index) => water.object.material === originals[index],
      ),
      mistShown: misted.every((spray) => spray.object.visible === true),
    };
  });
  const beauty = applyRenderMode(scene, "beauty");
  const untouched = waters.every(
    (water, index) => water.object.material === originals[index],
  );
  beauty.restore();

  TestValidator.equals(
    "all four read in every structural pass while their mist does not",
    namedFacts([
      ["overridden", () => structural.every((pass) => pass.overridden)],
      ["restored", () => structural.every((pass) => pass.restored)],
      ["mistHidden", () => structural.every((pass) => pass.mistHidden)],
      ["mistShown", () => structural.every((pass) => pass.mistShown)],
      ["beautyUntouched", () => untouched],
      [
        "mistUploaded",
        () =>
          misted.every(
            (spray, at) =>
              spray.count() === frames[at + 2].spray.particles.length,
          ),
      ],
      [
        // A jet of 8 particles a second, each living one second, is a steady
        // live set of exactly 8 — an oracle from the emitter's own numbers, so
        // an emitter that quietly stopped or doubled would be caught here.
        "mistSteady",
        () => misted.every((spray) => spray.count() === 8),
      ],
    ]),
    {
      overridden: true,
      restored: true,
      mistHidden: true,
      mistShown: true,
      beautyUntouched: true,
      mistUploaded: true,
      mistSteady: true,
    },
  );

  for (const water of waters) water.dispose();
  for (const spray of sprays) spray.dispose();
};
