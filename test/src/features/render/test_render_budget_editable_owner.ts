import {
  IAutoMovieRenderSubject,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import {
  AutoMovieRenderMetric,
  IAutoMovieModel,
  IAutoMovieRenderBudget,
  IAutoMovieRenderInventory,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieScene,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import {
  BOX_TRIANGLES,
  boxModel,
  instanceSetFixture,
  modelsFixture,
} from "../internal/renderFixtures";

/**
 * An over-limit refusal names somewhere the production can actually be edited.
 *
 * A frame pass draws the opaque geometry again, so its cost is the sum of every
 * drawable that preceded it. Ranked among the owners it therefore wins the two
 * metrics a pass multiplies in every production with more than one drawable,
 * ties in a production with one, and for the outline guide pass it wins under a
 * name no production declares and no author can open: the refusal read "edited
 * at render.pass.outline". The peak itself is not in dispute. The spec wants
 * frame-pass work inside the conservative one-frame bound, so the accounting
 * is unchanged here and only the ranking moves.
 *
 * Every number is hand arithmetic over the box tessellation and the documented
 * pass model: a three-part model is `3 x 12` triangles and three draws, a
 * one-part model is twelve and one, a `3 x 2` water grid is `2 * 2 * 1`
 * triangles in one draw, and one pass repeats every opaque draw once.
 *
 * Scenarios:
 *
 * 1. Two drawables and no light: the outline pass doubles triangles and draw
 *    calls, and both refusals name the larger drawable and the scene path that
 *    holds it.
 * 2. The measured total, the listed owners and the omitted cost still add up,
 *    pass included, so the ranking moved and the accounting did not.
 * 3. A production that lights nothing casting a shadow is the case that has no
 *    remedy at all: the outline pass is assumed regardless, so no ranking may
 *    offer a `render-pass:` id as somewhere to edit.
 * 4. One drawable is the equality boundary. The pass costs exactly what the
 *    single drawable costs, and the drawable is still what gets named.
 * 5. A shadow caster is stated as a pass in the recovery rather than ranked as
 *    the largest owner, while the `lights` and `shadowMaps` rankings, which are
 *    the light's own cost, still name the light.
 * 6. Regression: the resident metrics no pass multiplies, `instanceSlots` and
 *    `fluidCells`, rank exactly as before and carry no pass clause.
 */
export const test_render_budget_editable_owner = (): void => {
  // A three-part hall and a one-part stool, so the two drawables differ and the
  // ranking has something to choose between.
  const HALL_TRIANGLES = 3 * BOX_TRIANGLES;
  const HALL_DRAWS = 3;
  const STOOL_TRIANGLES = BOX_TRIANGLES;
  const STOOL_DRAWS = 1;
  // A 3 x 2 basin: two quads, two triangles each, submitted as one surface.
  const WATER_TRIANGLES = 4;
  // The outline guide pass, or one shadow map's depth pass, is one further
  // complete submission of every opaque draw.
  const PASSES = 2;

  const pair = report({
    subject: staging({ nodes: [staged("hall"), staged("stool")], lights: [] }),
    metric: "triangles",
    limit: 50,
  });
  const pairDraws = report({
    subject: staging({ nodes: [staged("hall"), staged("stool")], lights: [] }),
    metric: "drawCalls",
    limit: 5,
  });
  TestValidator.equals(
    "an unlit pair is refused at the larger drawable, not at the pass that doubles it",
    { triangles: shape(pair), drawCalls: shape(pairDraws) },
    {
      triangles: {
        status: "over",
        measured: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
        excess: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES) - 50,
        owner: "node:hall",
        source: 'scene.nodes["hall"]',
        cost: HALL_TRIANGLES,
        // The pass is one owner the report declines to name, and it carries
        // exactly the opaque total it redraws.
        omittedContributors: 1,
        omittedCost: HALL_TRIANGLES + STOOL_TRIANGLES,
        accounted: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
        namesTheOwner: true,
        namesThePass: true,
        sendsNobodyToAPass: true,
      },
      drawCalls: {
        status: "over",
        measured: PASSES * (HALL_DRAWS + STOOL_DRAWS),
        excess: PASSES * (HALL_DRAWS + STOOL_DRAWS) - 5,
        owner: "node:hall",
        source: 'scene.nodes["hall"]',
        cost: HALL_DRAWS,
        omittedContributors: 1,
        omittedCost: HALL_DRAWS + STOOL_DRAWS,
        accounted: PASSES * (HALL_DRAWS + STOOL_DRAWS),
        namesTheOwner: true,
        namesThePass: true,
        sendsNobodyToAPass: true,
      },
    },
  );
  TestValidator.equals(
    "the recovery states the owner to edit and the pass cost as separate facts",
    pair.recovery,
    `"triangles" measures ${PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES)} against a limit of 50, ${
      PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES) - 50
    } over; the largest owner is "node:hall" at ${HALL_TRIANGLES}, edited at scene.nodes["hall"]; a further ${
      HALL_TRIANGLES + STOOL_TRIANGLES
    } of that total is frame passes redrawing the opaque owners, the largest "render-pass:outline" at ${
      HALL_TRIANGLES + STOOL_TRIANGLES
    }`,
  );

  // The production the defect had no remedy for. A light that casts no shadow
  // leaves the outline pass as the frame-wide peak, and `IAutoMovieRenderBudget`
  // declares no passes, so an author told to edit `render.pass.outline` has
  // nowhere to go.
  const shadowless = report({
    subject: staging({
      nodes: [staged("hall"), staged("stool")],
      lights: [
        {
          id: "key",
          type: "directional",
          transform: pose(),
          color: { r: 1, g: 1, b: 1, a: 1, hex: null },
          intensity: 1,
          castShadow: false,
        },
      ],
    }),
    metric: "triangles",
    limit: 50,
  });
  TestValidator.equals(
    "a lit production casting no shadow is still refused at a drawable",
    shape(shadowless),
    {
      status: "over",
      measured: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
      excess: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES) - 50,
      owner: "node:hall",
      source: 'scene.nodes["hall"]',
      cost: HALL_TRIANGLES,
      omittedContributors: 1,
      omittedCost: HALL_TRIANGLES + STOOL_TRIANGLES,
      accounted: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
      namesTheOwner: true,
      namesThePass: true,
      sendsNobodyToAPass: true,
    },
  );

  // The boundary the old ranking decided on an identifier: with one drawable
  // the pass costs exactly what that drawable costs, and `render-pass:outline`
  // sorts before `water-body:pool`, so the tie went to the pass.
  const single = report({
    subject: {
      scene: staging({ nodes: [], lights: [] }).scene,
      models: models(),
      waterBodies: [
        {
          id: "pool",
          owner: null,
          nodes: [],
          domain: flatBasin({ columns: 3, rows: 2, depth: 1 }),
          cells: null,
          particles: null,
          material: null,
        },
      ],
    },
    metric: "triangles",
    limit: PASSES * WATER_TRIANGLES - 1,
  });
  TestValidator.equals(
    "one drawable ties the pass exactly and the drawable is still named",
    {
      ...shape(single),
      // The tie the ranking used to lose: an owner id sorting after the pass.
      tied: single.contributors[0]?.cost === single.omittedCost,
    },
    {
      status: "over",
      measured: PASSES * WATER_TRIANGLES,
      excess: 1,
      owner: "water-body:pool",
      source: 'waterBodies["pool"]',
      cost: WATER_TRIANGLES,
      omittedContributors: 1,
      omittedCost: WATER_TRIANGLES,
      accounted: PASSES * WATER_TRIANGLES,
      namesTheOwner: true,
      namesThePass: true,
      sendsNobodyToAPass: true,
      tied: true,
    },
  );

  const sun = (): IAutoMovieScene["lights"][number] => ({
    id: "sun",
    type: "directional",
    transform: pose(),
    color: { r: 1, g: 1, b: 1, a: 1, hex: null },
    intensity: 1,
    castShadow: true,
    shadow: { mapSize: 512, bias: 0, normalBias: 0, near: 0.1, far: 20 },
  });
  const lit = staging({
    nodes: [staged("hall"), staged("stool")],
    lights: [sun()],
  });
  const caster = report({ subject: lit, metric: "triangles", limit: 50 });
  const maps = report({ subject: lit, metric: "shadowMaps", limit: 0 });
  const sources = report({ subject: lit, metric: "lights", limit: 0 });
  TestValidator.equals(
    "a shadow caster is stated as a pass, and still ranked for its own cost",
    {
      triangles: {
        ...shape(caster),
        namesTheCaster: (caster.recovery ?? "").includes(
          `the largest "light:sun" at ${HALL_TRIANGLES + STOOL_TRIANGLES}`,
        ),
      },
      shadowMaps: shape(maps),
      lights: shape(sources),
    },
    {
      triangles: {
        status: "over",
        measured: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
        excess: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES) - 50,
        owner: "node:hall",
        source: 'scene.nodes["hall"]',
        cost: HALL_TRIANGLES,
        omittedContributors: 1,
        omittedCost: HALL_TRIANGLES + STOOL_TRIANGLES,
        accounted: PASSES * (HALL_TRIANGLES + STOOL_TRIANGLES),
        namesTheOwner: true,
        namesThePass: true,
        sendsNobodyToAPass: true,
        namesTheCaster: true,
      },
      // The shadow map itself, and the light that exists at all, are the
      // light's own cost rather than a redraw of anyone else's, so they are
      // ranked and the author is sent to the light.
      shadowMaps: {
        status: "over",
        measured: 1,
        excess: 1,
        owner: "light:sun",
        source: 'scene.lights["sun"]',
        cost: 1,
        omittedContributors: 0,
        omittedCost: 0,
        accounted: 1,
        namesTheOwner: true,
        namesThePass: false,
        sendsNobodyToAPass: true,
      },
      lights: {
        status: "over",
        measured: 1,
        excess: 1,
        owner: "light:sun",
        source: 'scene.lights["sun"]',
        cost: 1,
        omittedContributors: 0,
        omittedCost: 0,
        accounted: 1,
        namesTheOwner: true,
        namesThePass: false,
        sendsNobodyToAPass: true,
      },
    },
  );

  // Regression. A resident cost is allocated once and reused by every pass, so
  // no pass row competes with the drawable that owns it and these two rankings
  // were never wrong. They must not move.
  const resident = (): IAutoMovieRenderSubject => ({
    scene: staging({ nodes: [], lights: [] }).scene,
    models: models(),
    instanceSets: [instanceSetFixture({ id: "windows", count: 12, chunks: 3 })],
    waterBodies: [
      {
        id: "pool",
        owner: null,
        nodes: [],
        domain: null,
        cells: 4096,
        particles: 0,
        material: null,
      },
    ],
  });
  TestValidator.equals(
    "the metrics no pass multiplies rank exactly as before",
    {
      instanceSlots: shape(
        report({ subject: resident(), metric: "instanceSlots", limit: 11 }),
      ),
      fluidCells: shape(
        report({ subject: resident(), metric: "fluidCells", limit: 4000 }),
      ),
    },
    {
      instanceSlots: {
        status: "over",
        measured: 12,
        excess: 1,
        owner: "instance-set:windows",
        source: 'world.instanceSets["windows"]',
        cost: 12,
        omittedContributors: 0,
        omittedCost: 0,
        accounted: 12,
        namesTheOwner: true,
        namesThePass: false,
        sendsNobodyToAPass: true,
      },
      fluidCells: {
        status: "over",
        measured: 4096,
        excess: 96,
        owner: "water-body:pool",
        source: 'waterBodies["pool"]',
        cost: 4096,
        omittedContributors: 0,
        omittedCost: 0,
        accounted: 4096,
        namesTheOwner: true,
        namesThePass: false,
        sendsNobodyToAPass: true,
      },
    },
  );
};

/** The identity placement every node and light in this scenario uses. */
const pose = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A three-part hall beside the one-part models the shared fixture declares. */
const models = (): IAutoMovieModel[] => [
  ...modelsFixture(),
  boxModel({ id: "hall-model", parts: 3 }),
];

/** One staged node whose model is its own id plus `-model`. */
const staged = (id: "hall" | "stool"): IAutoMovieScene["nodes"][number] => ({
  id,
  model: id === "hall" ? "hall-model" : "prop-model",
  transform: pose(),
  motion: null,
  pose: null,
});

/** One subject staging the given nodes under the given lights. */
const staging = (props: {
  nodes: IAutoMovieScene["nodes"];
  lights: IAutoMovieScene["lights"];
}): IAutoMovieRenderSubject => ({
  scene: {
    id: "budget-scene",
    name: null,
    nodes: props.nodes,
    cameras: [],
    lights: props.lights,
  },
  models: models(),
});

/** A budget generous everywhere but the one metric a case is testing. */
const budget = (
  metric: AutoMovieRenderMetric,
  limit: number,
): IAutoMovieRenderBudget => ({
  version: 1,
  tier: "review",
  limits: {
    triangles: 1_000_000,
    vertices: 1_000_000,
    drawCalls: 1_000_000,
    materials: 1_000_000,
    textures: 1_000_000,
    textureBytes: 1_000_000,
    geometryBytes: 1_000_000,
    lights: 1_000_000,
    shadowMaps: 1_000_000,
    nodes: 1_000_000,
    instanceSets: 1_000_000,
    instanceSlots: 1_000_000,
    instanceChunks: 1_000_000,
    fluidCells: 1_000_000,
    fluidParticles: 1_000_000,
    [metric]: limit,
  },
});

/** The one sealed target every case in this scenario measures against. */
const target = (): IAutoMovieRenderTarget =>
  sealAutoMovieRenderTarget({
    renderer: { api: "webgl2", vendor: "test", device: "swiftshader" },
    settings: {
      width: 640,
      height: 360,
      pixelRatio: 1,
      shadows: true,
      shadowType: "pcfSoft",
      toneMapping: "acesFilmic",
      exposure: 1,
    },
    assets: [],
  });

/** Measure one subject and read back the finding of one metric. */
const report = (props: {
  subject: IAutoMovieRenderSubject;
  metric: AutoMovieRenderMetric;
  limit: number;
}): IAutoMovieRenderReport["findings"][number] => {
  const inventory: IAutoMovieRenderInventory = measureAutoMovieRenderInventory({
    subject: props.subject,
    mask: deriveAutoMovieSemanticMask(props.subject),
  });
  return evaluateAutoMovieRenderBudget({
    inventory,
    budget: budget(props.metric, props.limit),
    mask: {
      version: 2,
      protocol: "automovie.semantic-mask.v2",
      background: "#000000",
      entries: [],
      unaddressed: [],
      digest: `sha256:${"0".repeat(64)}`,
    },
    target: target(),
  }).findings.find((finding) => finding.metric === props.metric)!;
};

/**
 * What a refusal has to state: the verdict, the arithmetic, the owner it sends
 * an author to, and that the owner it sends them to is not a frame pass.
 */
const shape = (
  finding: IAutoMovieRenderReport["findings"][number],
): Record<string, unknown> => ({
  status: finding.status,
  measured: finding.measured,
  excess: finding.excess,
  owner: finding.contributors[0]?.owner,
  source: finding.contributors[0]?.source,
  cost: finding.contributors[0]?.cost,
  omittedContributors: finding.omittedContributors,
  omittedCost: finding.omittedCost,
  accounted:
    finding.contributors.reduce((sum, entry) => sum + entry.cost, 0) +
    finding.omittedCost,
  namesTheOwner: (finding.recovery ?? "").includes(
    `the largest owner is "${finding.contributors[0]?.owner ?? "!"}"`,
  ),
  namesThePass: (finding.recovery ?? "").includes("is frame passes redrawing"),
  sendsNobodyToAPass: finding.contributors.every(
    (entry) => !entry.owner.startsWith("render-pass:"),
  ),
});
