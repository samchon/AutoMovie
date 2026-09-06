import {
  IAutoMovieRenderSubject,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  plantingBudget,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import {
  IAutoMovieRenderBudget,
  IAutoMovieRenderInventory,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieScene,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, throwsError } from "../internal/predicates";
import { boxModel, material, modelsFixture } from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingRecipe,
  softPanel,
} from "../internal/softFixtures";

/**
 * Cloth, planting and water cost what they draw, and the budget sees it.
 *
 * A simulated drawable is held by no scene node, so an inventory that measured
 * only nodes, ground and instance sets reported a triangle count for a room the
 * curtain, the fern bed and the pond are missing from — and then cleared it
 * against a budget. Every number below is hand arithmetic over the lattice, the
 * grid and the stated prototype, never a snapshot of what the inventory
 * emitted: a `c x r` panel is `c*r` vertices and `2*(c-1)*(r-1)` triangles, a
 * `c x r` water grid is the same shape plus a two-float flow vector per vertex,
 * and a cluster is its worst-case instance count times the prototype the
 * renderer builds.
 *
 * Scenarios:
 *
 * 1. A panel, a fern bed and a bound pond report their exact drawn geometry, draw
 *    calls, nodes, memory and fluid cost in one inventory.
 * 2. Each is addressable in the mask under its own stable id, joined to the scene
 *    by the viewer name its own builder assigns, and reordering the subject's
 *    lists reproduces a byte-identical mask.
 * 3. A bound domain measures fluid cells and particles exactly; a body with
 *    neither a domain nor a proved count is still `unsupported`, never zero; a
 *    hand-supplied count is still honoured.
 * 4. Over-limit twins name the drawable to edit and its source, on every metric.
 *    Triangles and draw calls are submitted once per pass, so the pass is in
 *    the measurement and stated in the recovery, but it is not a record anyone
 *    can open and it never leads the ranking.
 * 5. A one-particle-wide panel and a one-cell-wide pond draw nothing at all, and
 *    cost no draw call for the mesh they never submit.
 * 6. A cluster stating no prototype cost leaves geometry `not-run` while draw
 *    calls, instance slots and nodes stay exact, and the report `incomplete`.
 * 7. A named material is counted once however many drawables bind it and drags its
 *    textures in; an unnamed one is exactly one material per drawable; an
 *    absent or conflicting cross-model definition is refused rather than
 *    selected by model order.
 * 8. A fractional or negative prototype cost is refused at its own message.
 * 9. A leafless cluster submits one batch, not two.
 */
export const test_render_simulated_budget = (): void => {
  // A 4 x 3 curtain: 12 particles, 3 x 2 quads, two triangles each.
  const PANEL_VERTICES = 12;
  const PANEL_TRIANGLES = 12;
  const PANEL_BYTES = PANEL_VERTICES * (12 + 12 + 8) + PANEL_TRIANGLES * 3 * 4;
  // A 3 x 2 basin: 6 cells, 2 x 1 quads, two triangles each; a water vertex
  // carries the flow vector a ripple scrolls along beside position, normal and
  // texture coordinate.
  const WATER_VERTICES = 6;
  const WATER_TRIANGLES = 4;
  const WATER_BYTES =
    WATER_VERTICES * (12 + 12 + 8 + 8) + WATER_TRIANGLES * 3 * 4;
  // A complete two-child tree of three levels is 1 + 2 + 4 branches, and the
  // cluster places six members of it.
  const BRANCH_INSTANCES = 7 * 6;
  const BRANCH = { vertices: 40, triangles: 24 };
  const LEAF = { vertices: 4, triangles: 2 };
  const BRANCH_BYTES =
    BRANCH.vertices * (12 + 12 + 8) + BRANCH.triangles * 3 * 4;
  const LEAF_BYTES = LEAF.vertices * (12 + 12 + 8) + LEAF.triangles * 3 * 4;
  // Opaque geometry is submitted more than once in a frame, and the inventory
  // reports the conservative one-frame peak rather than the beauty pass alone.
  // These scenes light nothing, so no shadow map re-submits the geometry and
  // the outline guide pass is the frame-wide peak instead: one further
  // complete pass over every opaque draw. Resident cost is not multiplied,
  // because vertices, memory, nodes and instance slots are allocated once and
  // reused by each pass.
  const PASSES = 2;

  const target = sealAutoMovieRenderTarget({
    renderer: { api: "webgl2", vendor: "test", device: "swiftshader" },
    settings: {
      width: 640,
      height: 360,
      pixelRatio: 1,
      shadows: false,
      shadowType: "none",
      toneMapping: "acesFilmic",
      exposure: 1,
    },
    assets: [],
  });
  const scene = (): IAutoMovieScene => ({
    id: "planted-atrium",
    name: null,
    nodes: [],
    cameras: [],
    lights: [],
  });
  const bareRecipe = () =>
    plantingRecipe({ budget: { maxBranches: 64, maxLeaves: 0 } });
  const subject = (): IAutoMovieRenderSubject => ({
    scene: scene(),
    models: modelsFixture(),
    softBodies: [
      {
        domain: softPanel({ columns: 4, rows: 3 }),
        owner: "space:tower/ground-hall",
        material: "oak",
      },
    ],
    plantings: [
      {
        domain: bareRecipe(),
        cluster: plantingCluster(),
        owner: "space:tower/ground-hall",
        branchMaterial: null,
        leafMaterial: null,
        branch: BRANCH,
        leaf: null,
      },
    ],
    waterBodies: [
      {
        id: "atrium-pool",
        owner: "space:tower/ground-hall",
        nodes: [],
        domain: flatBasin({ columns: 3, rows: 2, depth: 1 }),
        cells: null,
        particles: null,
        material: null,
      },
    ],
  });
  const inventory = measure(subject());

  TestValidator.equals(
    "cloth, planting and water are measured beside the staged world",
    inventory.totals,
    {
      triangles:
        PASSES *
        (PANEL_TRIANGLES +
          BRANCH_INSTANCES * BRANCH.triangles +
          WATER_TRIANGLES),
      vertices:
        PANEL_VERTICES + BRANCH_INSTANCES * BRANCH.vertices + WATER_VERTICES,
      // One panel mesh, one branch batch, one water surface, each drawn once
      // per pass. Six ferns are not six draws, which is the whole reason a bed
      // is affordable.
      drawCalls: PASSES * 3,
      // One named fabric plus the two materials the renderer creates for the
      // batch and the surface that named none.
      materials: 3,
      textures: 0,
      textureBytes: 0,
      geometryBytes: PANEL_BYTES + BRANCH_BYTES + WATER_BYTES,
      lights: 0,
      shadowMaps: 0,
      nodes: 3,
      instanceSets: 0,
      instanceSlots: BRANCH_INSTANCES,
      instanceChunks: 0,
      fluidCells: 6,
      fluidParticles: 0,
    },
  );
  TestValidator.equals(
    "every simulated cost is attributed and only the repeated pass is classified as pass work",
    inventory.owners
      .filter((entry) => entry.metric === "triangles" && entry.cost !== 0)
      .map((entry) => [entry.owner, entry.source, entry.cost, entry.kind]),
    [
      [
        "planting:atrium-bed",
        'plantings["atrium-bed"]',
        BRANCH_INSTANCES * 24,
        "own",
      ],
      // The extra pass is charged to the pass rather than smeared back over
      // the drawables, so a reader can tell what the room costs from what
      // drawing it twice costs.
      [
        "render-pass:outline",
        "render.pass.outline",
        PANEL_TRIANGLES + BRANCH_INSTANCES * BRANCH.triangles + WATER_TRIANGLES,
        "pass",
      ],
      ["soft-body:panel", 'softBodies["panel"]', PANEL_TRIANGLES, "own"],
      [
        "water-body:atrium-pool",
        'waterBodies["atrium-pool"]',
        WATER_TRIANGLES,
        "own",
      ],
    ],
  );

  // The mask joins by the name each viewer builder assigns its own object, so
  // a curtain, a bed and a pond resolve to their own colour instead of painting
  // the reserved background as unaddressed geometry.
  const mask = deriveAutoMovieSemanticMask(subject());
  const entry = (id: string): Record<string, unknown> => {
    const found = mask.entries.find((item) => item.id === id);
    return found === undefined
      ? { kind: "ABSENT", owner: "ABSENT", nodes: [] }
      : { kind: found.kind, owner: found.owner, nodes: found.nodes };
  };
  TestValidator.equals(
    "each simulated drawable is addressable under its own stable id",
    {
      panel: entry("soft-body:panel"),
      bed: entry("planting:atrium-bed"),
      pool: entry("water-body:atrium-pool"),
    },
    {
      panel: {
        kind: "soft-body",
        owner: "space:tower/ground-hall",
        nodes: ["soft:panel"],
      },
      bed: {
        kind: "planting",
        owner: "space:tower/ground-hall",
        nodes: ["planting:atrium-bed"],
      },
      pool: {
        kind: "water-body",
        owner: "space:tower/ground-hall",
        nodes: ["water:basin"],
      },
    },
  );
  const crowded = (reverse: boolean): IAutoMovieRenderSubject => {
    const panels = [
      {
        domain: softPanel({ columns: 2, rows: 2 }),
        owner: null,
        material: null,
      },
      {
        domain: softPanel({ columns: 3, rows: 2, overrides: { id: "sheer" } }),
        owner: null,
        material: null,
      },
    ];
    const pools = [
      {
        id: "north-pool",
        owner: null,
        nodes: [],
        domain: null,
        cells: 4,
        particles: 0,
        material: null,
      },
      {
        id: "south-pool",
        owner: null,
        nodes: [],
        domain: null,
        cells: 8,
        particles: 0,
        material: null,
      },
    ];
    return {
      scene: scene(),
      models: modelsFixture(),
      softBodies: reverse ? [...panels].reverse() : panels,
      waterBodies: reverse ? [...pools].reverse() : pools,
    };
  };
  TestValidator.equals(
    "reordering the simulated lists reproduces a byte-identical mask",
    deriveAutoMovieSemanticMask(crowded(true)).digest,
    deriveAutoMovieSemanticMask(crowded(false)).digest,
  );

  // Fluid was permanently `unsupported` while the only way to state a cost was
  // to copy one in by hand. A bound domain states it from the record.
  const unbound = measure({
    ...subject(),
    waterBodies: [
      {
        id: "unknown-pool",
        owner: null,
        nodes: ["pool-surface"],
        domain: null,
        cells: null,
        particles: null,
        material: null,
      },
    ],
  });
  const counted = measure({
    ...subject(),
    waterBodies: [
      {
        id: "foreign-pool",
        owner: null,
        nodes: [],
        domain: null,
        cells: 2048,
        particles: 64,
        material: null,
      },
    ],
  });
  TestValidator.equals(
    "a bound domain measures fluid, an unbound one is unsupported, a counted one is honoured",
    {
      bound: [inventory.totals.fluidCells, inventory.totals.fluidParticles],
      unbound: [
        unbound.totals.fluidCells,
        unbound.totals.fluidParticles,
        unbound.gaps.map((gap) => [gap.metric, gap.status]),
        report(unbound, budget(), target).status,
      ],
      counted: [counted.totals.fluidCells, counted.totals.fluidParticles],
      // A body with no domain draws no surface here, so it adds no geometry of
      // its own beyond whatever scene node happens to draw it.
      countedDraws: counted.totals.drawCalls,
    },
    {
      bound: [6, 0],
      unbound: [
        null,
        null,
        [
          ["fluidCells", "unsupported"],
          ["fluidParticles", "unsupported"],
        ],
        "incomplete",
      ],
      counted: [2048, 64],
      // The panel and the branch batch, each once per pass. A hand-counted
      // pool states cells without a surface to draw, so it adds none.
      countedDraws: PASSES * 2,
    },
  );

  const twin = (
    metric: keyof IAutoMovieRenderBudget["limits"],
    over: IAutoMovieRenderInventory,
    limit: number,
  ): Record<string, unknown> => {
    const finding = report(
      over,
      { ...budget(), limits: { ...budget().limits, [metric]: limit } },
      target,
    ).findings.find((item) => item.metric === metric)!;
    return {
      status: finding.status,
      excess: finding.excess,
      owner: finding.contributors[0]?.owner,
      source: finding.contributors[0]?.source,
      recovers: (finding.recovery ?? "").includes(
        finding.contributors[0]?.owner ?? "!",
      ),
      // The listed owners plus what the report leaves unnamed are still the
      // whole measurement, pass included.
      accounted:
        finding.contributors.reduce((sum, entry) => sum + entry.cost, 0) +
          finding.omittedCost ===
        finding.measured,
      // Whatever else the recovery says, it never sends an author to a pass.
      editable: finding.contributors.every(
        (entry) => !entry.owner.startsWith("render-pass:"),
      ),
    };
  };
  TestValidator.equals(
    "an over-limit simulated cost names the drawable and the record to edit",
    {
      triangles: twin("triangles", inventory, 100),
      drawCalls: twin("drawCalls", inventory, 2),
      instanceSlots: twin("instanceSlots", inventory, 41),
      fluidCells: twin("fluidCells", inventory, 5),
    },
    {
      // The extra pass draws every opaque triangle again, so its cost is the
      // sum of every drawable and it would lead the ranking of the two metrics
      // a pass multiplies for as long as it was ranked at all. It is not a
      // record this production declares. `IAutoMovieRenderBudget` has no pass
      // to turn off, so the ranking is over the drawables and the pass is
      // counted among the owners the report does not name. Instance slots and
      // fluid cells are resident rather than submitted and never had a pass to
      // outrank them.
      triangles: {
        status: "over",
        excess:
          PASSES *
            (PANEL_TRIANGLES +
              BRANCH_INSTANCES * BRANCH.triangles +
              WATER_TRIANGLES) -
          100,
        owner: "planting:atrium-bed",
        source: 'plantings["atrium-bed"]',
        recovers: true,
        accounted: true,
        editable: true,
      },
      // Three drawables, one draw each, so the ranking is decided on the owner
      // id and the bed sorts first.
      drawCalls: {
        status: "over",
        excess: PASSES * 3 - 2,
        owner: "planting:atrium-bed",
        source: 'plantings["atrium-bed"]',
        recovers: true,
        accounted: true,
        editable: true,
      },
      instanceSlots: {
        status: "over",
        excess: 1,
        owner: "planting:atrium-bed",
        source: 'plantings["atrium-bed"]',
        recovers: true,
        accounted: true,
        editable: true,
      },
      fluidCells: {
        status: "over",
        excess: 1,
        owner: "water-body:atrium-pool",
        source: 'waterBodies["atrium-pool"]',
        recovers: true,
        accounted: true,
        editable: true,
      },
    },
  );

  // A cord is not a surface and a single file of cells is not a pond: both hold
  // no quad, both draw nothing, and inventing a sliver for either would be
  // inventing geometry.
  const degenerate = measure({
    scene: scene(),
    models: modelsFixture(),
    softBodies: [
      {
        domain: softPanel({ columns: 1, rows: 5 }),
        owner: null,
        material: null,
      },
    ],
    waterBodies: [
      {
        id: "rill",
        owner: null,
        nodes: [],
        domain: flatBasin({ columns: 4, rows: 1, depth: 1 }),
        cells: null,
        particles: null,
        material: null,
      },
    ],
  });
  TestValidator.equals(
    "a one-site lattice axis draws nothing and costs no draw call",
    {
      triangles: degenerate.totals.triangles,
      vertices: degenerate.totals.vertices,
      drawCalls: degenerate.totals.drawCalls,
      nodes: degenerate.totals.nodes,
      fluidCells: degenerate.totals.fluidCells,
      geometryBytes: degenerate.totals.geometryBytes,
      // A mesh the renderer never submits binds no material it ever has to
      // prepare, so a cord and a rill cost their buffers and nothing else.
      materials: degenerate.totals.materials,
    },
    {
      triangles: 0,
      vertices: 5 + 4,
      drawCalls: 0,
      nodes: 2,
      fluidCells: 4,
      geometryBytes: 5 * (12 + 12 + 8) + 4 * (12 + 12 + 8 + 8),
      materials: 0,
    },
  );

  const unstated = measure({
    scene: scene(),
    models: modelsFixture(),
    plantings: [
      {
        domain: bareRecipe(),
        cluster: plantingCluster(),
        owner: null,
        branchMaterial: null,
        leafMaterial: null,
        branch: null,
        leaf: null,
      },
    ],
  });
  const unstatedReport = report(unstated, budget(), target);
  TestValidator.equals(
    "an unstated prototype leaves geometry unmeasured and the batching exact",
    {
      triangles: unstated.totals.triangles,
      vertices: unstated.totals.vertices,
      geometryBytes: unstated.totals.geometryBytes,
      drawCalls: unstated.totals.drawCalls,
      instanceSlots: unstated.totals.instanceSlots,
      nodes: unstated.totals.nodes,
      gaps: unstated.gaps.map((gap) => [gap.metric, gap.status]),
      statuses: unstatedReport.findings
        .filter((finding) =>
          ["triangles", "vertices", "geometryBytes"].includes(finding.metric),
        )
        .map((finding) => finding.status),
      remedies: unstatedReport.findings
        .filter((finding) => finding.metric === "triangles")
        .every((finding) => (finding.recovery ?? "").includes("atrium-bed")),
      report: unstatedReport.status,
    },
    {
      triangles: null,
      vertices: null,
      geometryBytes: null,
      // The one branch batch, submitted once per pass. An unmeasured prototype
      // costs an unknown number of triangles, never an unknown number of
      // draws: the batch is submitted whatever it turns out to contain.
      drawCalls: PASSES * 1,
      instanceSlots: BRANCH_INSTANCES,
      nodes: 1,
      gaps: [
        ["triangles", "not-run"],
        ["vertices", "not-run"],
        ["geometryBytes", "not-run"],
      ],
      statuses: ["not-run", "not-run", "not-run"],
      remedies: true,
      report: "incomplete",
    },
  );

  // A fabric declared once and hung twice is one material and one texture, not
  // two of each; the renderer's own default is one object per drawable.
  const shared = measure({
    scene: scene(),
    models: modelsFixture(),
    softBodies: [
      {
        domain: softPanel({ columns: 2, rows: 2, overrides: { id: "left" } }),
        owner: null,
        material: "stone",
      },
      {
        domain: softPanel({ columns: 2, rows: 2, overrides: { id: "right" } }),
        owner: null,
        material: "stone",
      },
      {
        domain: softPanel({ columns: 2, rows: 2, overrides: { id: "bare" } }),
        owner: null,
        material: null,
      },
    ],
    textures: [
      { asset: "textures/stone.png", width: 2, height: 2, mipmapped: false },
    ],
  });
  TestValidator.equals(
    "a shared fabric is one material and one texture; a default is one per drawable",
    {
      materials: shared.totals.materials,
      textures: shared.textures.map((texture) => [
        texture.asset,
        texture.materials,
        texture.bytes,
      ]),
      textureBytes: shared.totals.textureBytes,
      defaults: shared.owners
        .filter((item) => item.metric === "materials")
        .map((item) => item.owner),
    },
    {
      materials: 2,
      textures: [["textures/stone.png", ["stone"], 2 * 2 * 4]],
      textureBytes: 2 * 2 * 4,
      defaults: ["material:soft-body:bare/default", "material:stone"],
    },
  );

  // A leafy cluster submits a second batch and pays a second material; a
  // leafless one pays for neither.
  const leafy = plantingRecipe({
    foliage: {
      density: 2,
      minLevel: 1,
      size: { x: 0.125, y: 0.0625, z: 0.125 },
      scaleJitter: 0,
      rollJitter: 0,
    },
    budget: { maxBranches: 64, maxLeaves: 32 },
  });
  // The law relating a recipe to its leaf count belongs to the planting domain,
  // not to the inventory; what is under test here is that the inventory
  // multiplies that declared worst case by the prototype the renderer builds.
  const leaves = plantingBudget({
    domain: leafy,
    cluster: plantingCluster(),
  }).worstCaseLeafInstances;
  const foliated = measure({
    scene: scene(),
    models: modelsFixture(),
    plantings: [
      {
        domain: leafy,
        cluster: plantingCluster(),
        owner: null,
        branchMaterial: "oak",
        leafMaterial: null,
        branch: BRANCH,
        leaf: LEAF,
      },
    ],
  });
  TestValidator.equals(
    "a leafy cluster draws a second batch and a leafless one does not",
    {
      leafy: {
        drawCalls: foliated.totals.drawCalls,
        instanceSlots: foliated.totals.instanceSlots,
        triangles: foliated.totals.triangles,
        vertices: foliated.totals.vertices,
        geometryBytes: foliated.totals.geometryBytes,
        materials: foliated.totals.materials,
      },
      bare: {
        drawCalls: unstated.totals.drawCalls,
        materials: unstated.totals.materials,
      },
      // A leaf-bearing recipe has to actually bear leaves, or this case would
      // prove the second batch exists by never asking for one.
      bearing: leaves > 0,
    },
    {
      leafy: {
        // A branch batch and a leaf batch, each submitted once per pass.
        drawCalls: PASSES * 2,
        instanceSlots: BRANCH_INSTANCES + leaves,
        triangles:
          PASSES *
          (BRANCH_INSTANCES * BRANCH.triangles + leaves * LEAF.triangles),
        vertices: BRANCH_INSTANCES * BRANCH.vertices + leaves * LEAF.vertices,
        geometryBytes: BRANCH_BYTES + LEAF_BYTES,
        materials: 2,
      },
      bare: { drawCalls: PASSES * 1, materials: 1 },
      bearing: true,
    },
  );

  /** One cluster whose branch prototype carries the stated cost. */
  const prototyped = (branch: {
    vertices: number;
    triangles: number;
  }): IAutoMovieRenderSubject => ({
    scene: scene(),
    models: modelsFixture(),
    plantings: [
      {
        domain: bareRecipe(),
        cluster: plantingCluster(),
        owner: null,
        branchMaterial: null,
        leafMaterial: null,
        branch,
        leaf: null,
      },
    ],
  });
  TestValidator.equals(
    "an unresolvable material and a malformed prototype are each refused",
    namedFacts([
      [
        "absent panel material",
        () =>
          throwsError(
            () =>
              measure({
                scene: scene(),
                models: modelsFixture(),
                softBodies: [
                  {
                    domain: softPanel({ columns: 2, rows: 2 }),
                    owner: null,
                    material: "velvet",
                  },
                ],
              }),
            'material "velvet" is absent',
          ),
      ],
      [
        "absent leaf material",
        () =>
          throwsError(
            () =>
              measure({
                scene: scene(),
                models: modelsFixture(),
                plantings: [
                  {
                    domain: leafy,
                    cluster: plantingCluster(),
                    owner: null,
                    branchMaterial: null,
                    leafMaterial: "velvet",
                    branch: BRANCH,
                    leaf: LEAF,
                  },
                ],
              }),
            'material "velvet" is absent',
          ),
      ],
      [
        "absent water material",
        () =>
          throwsError(
            () =>
              measure({
                scene: scene(),
                models: modelsFixture(),
                waterBodies: [
                  {
                    id: "pool",
                    owner: null,
                    nodes: [],
                    domain: flatBasin({ columns: 2, rows: 2, depth: 1 }),
                    cells: null,
                    particles: null,
                    material: "velvet",
                  },
                ],
              }),
            'material "velvet" is absent',
          ),
      ],
      [
        "conflicting panel material",
        () =>
          throwsError(
            () =>
              measure({
                scene: scene(),
                models: [
                  ...modelsFixture(),
                  boxModel({
                    id: "z-conflict",
                    materials: [{ ...material("stone"), roughness: 0.25 }],
                  }),
                ],
                softBodies: [
                  {
                    domain: softPanel({ columns: 2, rows: 2 }),
                    owner: null,
                    material: "stone",
                  },
                ],
              }),
            [
              'soft body "panel"',
              'material "stone" has conflicting definitions',
              '"slab-model", "wall-model", "z-conflict"',
            ],
          ),
      ],
      [
        "fractional prototype",
        () =>
          throwsError(
            () => measure(prototyped({ vertices: 1.5, triangles: 1 })),
            "vertices must be a safe integer",
          ),
      ],
      [
        "negative prototype",
        () =>
          throwsError(
            () => measure(prototyped({ vertices: 1, triangles: -1 })),
            "triangles must be a safe integer",
          ),
      ],
    ]),
    {
      "absent panel material": true,
      "absent leaf material": true,
      "absent water material": true,
      "conflicting panel material": true,
      "fractional prototype": true,
      "negative prototype": true,
    },
  );
};

/** Derive the mask and measure one subject in one step. */
const measure = (subject: IAutoMovieRenderSubject): IAutoMovieRenderInventory =>
  measureAutoMovieRenderInventory({
    subject,
    mask: deriveAutoMovieSemanticMask(subject),
  });

/** A budget generous enough that only the twin under test can break it. */
const budget = (): IAutoMovieRenderBudget => ({
  version: 1,
  tier: "review",
  limits: {
    triangles: 100_000,
    vertices: 100_000,
    drawCalls: 100,
    materials: 100,
    textures: 100,
    textureBytes: 1_000_000,
    geometryBytes: 1_000_000,
    lights: 10,
    shadowMaps: 10,
    nodes: 100,
    instanceSets: 10,
    instanceSlots: 100_000,
    instanceChunks: 100,
    fluidCells: 100_000,
    fluidParticles: 100_000,
  },
});

/** Evaluate one inventory, always against the same sealed target. */
const report = (
  inventory: IAutoMovieRenderInventory,
  limits: IAutoMovieRenderBudget,
  target: IAutoMovieRenderTarget,
): IAutoMovieRenderReport =>
  evaluateAutoMovieRenderBudget({
    inventory,
    budget: limits,
    mask: {
      version: 2,
      protocol: "automovie.semantic-mask.v2",
      background: "#000000",
      entries: [],
      unaddressed: [],
      digest: `sha256:${"0".repeat(64)}`,
    },
    target,
  });
