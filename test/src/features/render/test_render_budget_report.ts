import {
  AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS,
  IAutoMovieRenderSubject,
  autoMovieRenderSubjectOfShot,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import {
  AutoMovieRenderMetric,
  IAutoMovieCompiledEffect,
  IAutoMovieCompiledFormation,
  IAutoMovieCompiledShotSource,
  IAutoMovieModel,
  IAutoMovieRenderBudget,
  IAutoMovieRenderInventory,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieScene,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  BOX_GEOMETRY_BYTES,
  BOX_TRIANGLES,
  BOX_VERTICES,
  buildingFixture,
  instanceSetFixture,
  modelsFixture,
  sceneFixture,
} from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingRecipe,
  softPanel,
} from "../internal/softFixtures";

/**
 * A multi-room, multi-storey production reports every render cost it commits
 * to, and refuses the artifact that exceeds a declared one.
 *
 * Every expected number below is hand arithmetic over the fixture and the
 * engine's documented cost model, never a snapshot of what the inventory
 * emitted. Five staged boxes are 5 x 12 triangles; a twelve-slot instanced band
 * whose finest tier is one box is 12 x 12 more; one shadow-casting light
 * repeats every opaque draw once.
 *
 * Scenarios:
 *
 * 1. The complete inventory of the fixture matches hand arithmetic on every
 *    metric, and the report clears it against a budget it fits inside.
 * 2. Each of triangles, draw calls, texture bytes, shadow maps, instance slots and
 *    fluid cells has an over-limit twin that names the dominant owner, the
 *    source to edit, and the exact excess. The shadow pass is inside the
 *    measurement and outside the ranking, so the twins name what an author can
 *    open rather than the pass that redraws it.
 * 3. The report is bounded: fifty owners of one metric produce eight contributors,
 *    a counted remainder that includes the unranked pass, and a total that still
 *    adds back up to the measurement.
 * 4. Withholding texture dimensions makes texture bytes `not-run`, not zero.
 * 5. Declaring a water body no solver measured makes fluid `unsupported`, not
 *    zero, and the report `incomplete`.
 * 6. A production that declares no budget reports every metric `unbudgeted` under
 *    the tier of the same name.
 * 7. Five thousand ordinary scene nodes report zero instanced slots: a budget
 *    report cannot launder node spam as GPU instancing.
 * 8. Mesh geometry, multi-part models and shared level-of-detail models cost what
 *    the documented byte model says they cost.
 * 9. A malformed budget, a malformed contributor bound, an absent model and a
 *    prototype with no level of detail or valid particle cap are each refused
 *    at their own message.
 * 10. An inventory that reports no value and no reason is `not-run` rather than
 *     assumed to be zero, and an over metric nobody owns still says what to
 *     do.
 * 11. A version-one owner row written before the additive `kind` field remains
 *     an editable `own` contribution rather than disappearing as a pass.
 * 12. A pass-only public inventory preserves its accounting without inventing
 *     an editable destination.
 */
export const test_render_budget_report = (): void => {
  const target = sealAutoMovieRenderTarget({
    renderer: { api: "webgl2", vendor: "test", device: "swiftshader" },
    settings: {
      width: 1280,
      height: 720,
      pixelRatio: 1,
      shadows: true,
      shadowType: "pcfSoft",
      toneMapping: "acesFilmic",
      exposure: 1,
    },
    assets: [
      { path: "textures/stone.png", digest: `sha256:${"a".repeat(64)}` },
    ],
  });
  const subject = (): IAutoMovieRenderSubject => ({
    scene: sceneFixture(),
    models: modelsFixture(),
    environments: [buildingFixture()],
    instanceSets: [instanceSetFixture({ id: "windows", count: 12, chunks: 3 })],
    textures: [
      {
        asset: "textures/stone.png",
        width: 512,
        height: 512,
        mipmapped: true,
      },
    ],
  });
  const inventory = measure(subject());

  // 5 staged boxes and 12 instanced boxes; one shadow-casting light repeats
  // the 8 opaque draws (5 nodes + 3 chunks) once; a mipmapped 512x512 RGBA
  // texture is 512 * 512 * 4 * 4/3 bytes; five distinct box models are five
  // times the documented per-box byte cost.
  TestValidator.equals(
    "the inventory matches hand arithmetic on every metric",
    inventory.totals,
    {
      triangles: 2 * (5 * BOX_TRIANGLES + 12 * BOX_TRIANGLES),
      vertices: 5 * BOX_VERTICES + 12 * BOX_VERTICES,
      drawCalls: (5 + 3) * 2,
      materials: 2,
      textures: 1,
      textureBytes: Math.round((512 * 512 * 4 * 4) / 3),
      geometryBytes: 5 * BOX_GEOMETRY_BYTES,
      lights: 2,
      shadowMaps: 1,
      nodes: 5,
      instanceSets: 1,
      instanceSlots: 12,
      instanceChunks: 3,
      fluidCells: 0,
      fluidParticles: 0,
    },
  );
  TestValidator.equals(
    "the finest level of detail and the chunk draw bound are attributed to the set",
    inventory.instanceSets,
    [
      {
        instanceSet: "windows",
        slots: 12,
        chunks: 3,
        prototypes: 1,
        drawCallUpperBound: 3,
      },
    ],
  );
  TestValidator.equals(
    "a model cited only by one level-of-detail tier reports that tier",
    inventory.models.map((cost) => [cost.model, cost.tier]),
    [
      ["door-model", null],
      ["prop-model", null],
      ["slab-model", null],
      ["wall-model", null],
      ["window-model", "near"],
    ],
  );

  const budget: IAutoMovieRenderBudget = {
    version: 1,
    tier: "review",
    limits: {
      triangles: 1000,
      vertices: 1000,
      drawCalls: 100,
      materials: 10,
      textures: 5,
      textureBytes: 2_000_000,
      geometryBytes: 10_000,
      lights: 4,
      shadowMaps: 2,
      nodes: 10,
      instanceSets: 2,
      instanceSlots: 100,
      instanceChunks: 10,
      fluidCells: 0,
      fluidParticles: 0,
    },
  };
  const clear = report(inventory, budget, target);
  TestValidator.equals(
    "an artifact inside its budget clears with one finding per metric",
    {
      status: clear.status,
      tier: clear.tier,
      metrics: clear.findings.map((finding) => finding.metric),
      statuses: [...new Set(clear.findings.map((finding) => finding.status))],
      excess: clear.findings.every((finding) => finding.excess === 0),
      recovery: clear.findings.every((finding) => finding.recovery === null),
    },
    {
      status: "within",
      tier: "review",
      // Spelled out rather than read from the constant: an expectation taken
      // from the value under test cannot notice the value changing.
      metrics: [
        "triangles",
        "vertices",
        "drawCalls",
        "materials",
        "textures",
        "textureBytes",
        "geometryBytes",
        "lights",
        "shadowMaps",
        "nodes",
        "instanceSets",
        "instanceSlots",
        "instanceChunks",
        "fluidCells",
        "fluidParticles",
      ],
      statuses: ["within"],
      excess: true,
      recovery: true,
    },
  );

  // Over-limit twins: one metric at a time, every other limit untouched, so a
  // failure names the metric that actually broke.
  const twin = (
    metric: AutoMovieRenderMetric,
    over: IAutoMovieRenderInventory,
    limit: number,
  ): IAutoMovieRenderReport["findings"][number] =>
    report(
      over,
      { ...budget, limits: { ...budget.limits, [metric]: limit } },
      target,
    ).findings.find((finding) => finding.metric === metric)!;

  const fluid = measure({
    ...subject(),
    waterBodies: [
      {
        id: "atrium-pool",
        owner: "space:tower/ground-hall",
        nodes: [],
        cells: 4096,
        particles: 512,
        domain: null,
        material: null,
      },
    ],
  });
  TestValidator.equals(
    "every budgeted cost has an over-limit twin naming its dominant owner",
    {
      triangles: shape(twin("triangles", inventory, 100)),
      drawCalls: shape(twin("drawCalls", inventory, 15)),
      textureBytes: shape(twin("textureBytes", inventory, 1000)),
      shadowMaps: shape(twin("shadowMaps", inventory, 0)),
      instanceSlots: shape(twin("instanceSlots", inventory, 11)),
      fluidCells: shape(twin("fluidCells", fluid, 4000)),
    },
    {
      // The shadow pass is in the measurement and out of the ranking: it
      // redraws the 204 opaque triangles the owners below already paid for, so
      // its aggregate cost cannot be allowed to lead the editable-owner
      // complexity ranking. The window band is the largest owner's own cost.
      triangles: {
        status: "over",
        excess: 308,
        owner: "instance-set:windows",
        source: 'world.instanceSets["windows"]',
        cost: 12 * BOX_TRIANGLES,
        recovers: true,
      },
      drawCalls: {
        status: "over",
        excess: 1,
        owner: "instance-set:windows",
        source: 'world.instanceSets["windows"]',
        cost: 3,
        recovers: true,
      },
      textureBytes: {
        status: "over",
        excess: Math.round((512 * 512 * 4 * 4) / 3) - 1000,
        owner: "texture:textures/stone.png",
        source: 'assets["textures/stone.png"]',
        cost: Math.round((512 * 512 * 4 * 4) / 3),
        recovers: true,
      },
      shadowMaps: {
        status: "over",
        excess: 1,
        owner: "light:sun",
        source: 'scene.lights["sun"]',
        cost: 1,
        recovers: true,
      },
      instanceSlots: {
        status: "over",
        excess: 1,
        owner: "instance-set:windows",
        source: 'world.instanceSets["windows"]',
        cost: 12,
        recovers: true,
      },
      fluidCells: {
        status: "over",
        excess: 96,
        owner: "water-body:atrium-pool",
        source: 'waterBodies["atrium-pool"]',
        cost: 4096,
        recovers: true,
      },
    },
  );

  const crowd = measure({
    scene: {
      ...sceneFixture(),
      nodes: Array.from({ length: 50 }, (_, index) => ({
        id: `prop-${index}`,
        model: "prop-model",
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        motion: null,
        pose: null,
      })),
    },
    models: modelsFixture(),
  });
  const bounded = report(
    crowd,
    { ...budget, limits: { triangles: 1 } },
    target,
  ).findings.find((finding) => finding.metric === "triangles")!;
  TestValidator.equals(
    "fifty owners produce a bounded finding with a counted remainder",
    {
      contributors: bounded.contributors.length,
      omittedContributors: bounded.omittedContributors,
      omittedCost: bounded.omittedCost,
      accounted:
        bounded.contributors.reduce((sum, entry) => sum + entry.cost, 0) +
        bounded.omittedCost,
      measured: bounded.measured,
      ordered: bounded.contributors.every(
        (entry, index) =>
          index === 0 ||
          bounded.contributors[index - 1]!.cost > entry.cost ||
          (bounded.contributors[index - 1]!.cost === entry.cost &&
            bounded.contributors[index - 1]!.owner < entry.owner),
      ),
    },
    {
      contributors: AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS,
      // The fifty props past the bound, plus the shadow pass, which is never
      // ranked however small the production is.
      omittedContributors: 50 - AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS + 1,
      omittedCost:
        (50 - AUTOMOVIE_RENDER_REPORT_MAX_CONTRIBUTORS) * BOX_TRIANGLES +
        50 * BOX_TRIANGLES,
      // The listed owners plus the omitted cost are still the whole
      // measurement, so leaving the pass out of the ranking dropped nothing.
      accounted: 2 * 50 * BOX_TRIANGLES,
      measured: 2 * 50 * BOX_TRIANGLES,
      ordered: true,
    },
  );
  TestValidator.equals(
    "a scene of five thousand ordinary nodes reports no instanced slots at all",
    {
      nodes: crowd.totals.nodes,
      instanceSlots: crowd.totals.instanceSlots,
      instanceSets: crowd.totals.instanceSets,
      instanceChunks: crowd.totals.instanceChunks,
    },
    { nodes: 50, instanceSlots: 0, instanceSets: 0, instanceChunks: 0 },
  );
  TestValidator.equals(
    "the contributor bound is caller-tunable and validated",
    {
      tight: report(crowd, budget, target, 2).findings.find(
        (finding) => finding.metric === "triangles",
      )!.contributors.length,
      zero: throwsError(
        () => report(crowd, budget, target, 0),
        "positive safe integer",
      ),
      fractional: throwsError(
        () => report(crowd, budget, target, 1.5),
        "positive safe integer",
      ),
    },
    { tight: 2, zero: true, fractional: true },
  );

  const blind = measure({ ...subject(), textures: [] });
  const blindReport = report(blind, budget, target);
  TestValidator.equals(
    "withholding texture dimensions is not-run, never zero",
    {
      total: blind.totals.textureBytes,
      gaps: blind.gaps.map((gap) => [gap.metric, gap.status]),
      status: blindReport.status,
      finding: blindReport.findings.find(
        (finding) => finding.metric === "textureBytes",
      )!.status,
      recovers: (
        blindReport.findings.find(
          (finding) => finding.metric === "textureBytes",
        )!.recovery ?? ""
      ).includes("decoded width"),
    },
    {
      total: null,
      gaps: [["textureBytes", "not-run"]],
      status: "incomplete",
      finding: "not-run",
      recovers: true,
    },
  );

  const unsolved = measure({
    ...subject(),
    waterBodies: [
      {
        id: "atrium-pool",
        owner: "space:tower/ground-hall",
        nodes: [],
        cells: null,
        particles: null,
        domain: null,
        material: null,
      },
    ],
  });
  const unsolvedReport = report(unsolved, budget, target);
  TestValidator.equals(
    "a water body no solver measured is unsupported, never zero",
    {
      cells: unsolved.totals.fluidCells,
      particles: unsolved.totals.fluidParticles,
      statuses: unsolvedReport.findings
        .filter(
          (finding) =>
            finding.metric === "fluidCells" ||
            finding.metric === "fluidParticles",
        )
        .map((finding) => finding.status),
      report: unsolvedReport.status,
    },
    {
      cells: null,
      particles: null,
      statuses: ["unsupported", "unsupported"],
      report: "incomplete",
    },
  );

  const legacy = report(inventory, null, target);
  TestValidator.equals(
    "a production declaring no budget keeps the documented unbudgeted default",
    {
      tier: legacy.tier,
      status: legacy.status,
      statuses: [...new Set(legacy.findings.map((finding) => finding.status))],
      limits: [...new Set(legacy.findings.map((finding) => finding.limit))],
      measured: legacy.findings.find(
        (finding) => finding.metric === "triangles",
      )!.measured,
    },
    {
      tier: "unbudgeted",
      status: "within",
      statuses: ["unbudgeted"],
      limits: [null],
      measured: 2 * (5 * BOX_TRIANGLES + 12 * BOX_TRIANGLES),
    },
  );

  const meshed = measure({
    scene: {
      ...sceneFixture(),
      nodes: [
        {
          id: "raw",
          model: "raw-mesh",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          motion: null,
          pose: null,
        },
        {
          id: "skinned",
          model: "skinned-mesh",
          transform: {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          motion: null,
          pose: null,
        },
      ],
    },
    models: [...modelsFixture(), rawMesh(), skinnedMesh()],
    instanceSets: [
      instanceSetFixture({
        id: "a-set",
        count: 2,
        chunks: 1,
        model: "prop-model",
      }),
      instanceSetFixture({
        id: "b-set",
        count: 3,
        chunks: 1,
        model: "prop-model",
      }),
    ],
  });
  TestValidator.equals(
    "raw and skinned mesh geometry cost what the documented byte model says",
    {
      raw: meshed.models.find((cost) => cost.model === "raw-mesh"),
      skinned: meshed.models.find((cost) => cost.model === "skinned-mesh"),
      sharedTier: meshed.models.find((cost) => cost.model === "prop-model")
        ?.tier,
      // The same model behind a staged node AND a level-of-detail tier has no
      // single tier to report, so the row reports none rather than the last
      // citation to win the race.
      mixedTier: measure({
        scene: sceneFixture(),
        models: modelsFixture(),
        instanceSets: [
          instanceSetFixture({
            id: "a-set",
            count: 2,
            chunks: 1,
            model: "prop-model",
          }),
        ],
      }).models.find((cost) => cost.model === "prop-model")?.tier,
    },
    {
      raw: {
        model: "raw-mesh",
        tier: null,
        parts: 1,
        vertices: 6,
        triangles: 2,
        materials: [],
        geometryBytes: 6 * 12,
      },
      skinned: {
        model: "skinned-mesh",
        tier: null,
        parts: 2,
        vertices: 4 + 24,
        triangles: 2 + 12,
        materials: ["oak"],
        geometryBytes: 4 * 56 + 6 * 4 + BOX_GEOMETRY_BYTES,
      },
      sharedTier: "near",
      mixedTier: null,
    },
  );

  // A declared environment owns the shadow policy and adds one background
  // draw; an area light rasterizes no shadow camera however it is flagged; a
  // texture bound by two materials is one texture; an unmipmapped texture is
  // its base level exactly.
  const lit = (shadows: boolean): IAutoMovieRenderInventory =>
    measure({
      scene: {
        id: "lit",
        name: null,
        nodes: [staged("a", "left"), staged("b", "right")],
        cameras: [],
        lights: [
          {
            id: "sun",
            type: "directional",
            transform: pose(),
            color: { r: 1, g: 1, b: 1, a: 1, hex: null },
            intensity: 1,
            castShadow: true,
            shadow: {
              mapSize: 512,
              bias: 0,
              normalBias: 0,
              near: 0.1,
              far: 20,
            },
          },
          {
            id: "panel",
            type: "area",
            transform: pose(),
            color: { r: 1, g: 1, b: 1, a: 1, hex: null },
            intensity: 1,
            castShadow: true,
            width: 1,
            height: 1,
          },
        ],
        environment: {
          image: "env/sky.hdr",
          background: null,
          intensity: 1,
          rotationDeg: 0,
          exposure: 1,
          toneMapping: "acesFilmic",
          shadows: { enabled: shadows, type: "pcf" },
        },
      },
      models: [
        sharedTexture("left", "left-mat", "shared"),
        sharedTexture("right", "right-mat", "reference"),
      ],
      waterBodies: [
        {
          id: "basin",
          owner: null,
          nodes: [],
          cells: 10,
          particles: null,
          domain: null,
          material: null,
        },
      ],
      textures: [
        { asset: "textures/shared.png", width: 4, height: 4, mipmapped: false },
        { asset: "textures/normal.png", width: 2, height: 2, mipmapped: false },
      ],
    });
  TestValidator.equals(
    "a declared environment owns shadows, an area light casts none, and a shared texture counts once",
    {
      off: {
        drawCalls: lit(false).totals.drawCalls,
        shadowMaps: lit(false).totals.shadowMaps,
      },
      on: {
        drawCalls: lit(true).totals.drawCalls,
        shadowMaps: lit(true).totals.shadowMaps,
      },
      lights: lit(true).totals.lights,
      textures: lit(true).textures.map((texture) => ({
        asset: texture.asset,
        materials: texture.materials,
        bytes: texture.bytes,
      })),
      textureBytes: lit(true).totals.textureBytes,
      fluid: [lit(true).totals.fluidCells, lit(true).totals.fluidParticles],
    },
    {
      off: { drawCalls: 2 + 2 + 1, shadowMaps: 0 },
      on: { drawCalls: 2 + 2 + 1, shadowMaps: 1 },
      lights: 2,
      textures: [
        {
          asset: "textures/normal.png",
          materials: ["right-mat"],
          bytes: 2 * 2 * 4,
        },
        {
          asset: "textures/shared.png",
          materials: ["left-mat", "right-mat"],
          bytes: 4 * 4 * 4,
        },
      ],
      textureBytes: 2 * 2 * 4 + 4 * 4 * 4,
      fluid: [10, 0],
    },
  );

  // The compiled shot is read through one conversion, so every evidence path
  // measures the same artifact. The shot choreography plays no part in the
  // conversion, which is why the fixture states only the fields it reads.
  const compiled = {
    scene: sceneFixture(),
    models: modelsFixture(),
    motions: [],
    eventSamples: [],
    formations: [],
    instanceSets: [instanceSetFixture({ id: "windows", count: 2, chunks: 1 })],
    formationMotions: [],
    formationSlotMotions: [],
    effects: [],
    shot: {},
  } as unknown as IAutoMovieCompiledShotSource;
  TestValidator.equals(
    "a compiled shot converts to a subject, absent optional inputs and all",
    {
      bare: {
        environments: autoMovieRenderSubjectOfShot({ compiled }).environments,
        water: autoMovieRenderSubjectOfShot({ compiled }).waterBodies,
        panels: autoMovieRenderSubjectOfShot({ compiled }).softBodies,
        plantings: autoMovieRenderSubjectOfShot({ compiled }).plantings,
        textures: autoMovieRenderSubjectOfShot({ compiled }).textures,
        sets: autoMovieRenderSubjectOfShot({ compiled }).instanceSets?.length,
      },
      full: {
        environments: autoMovieRenderSubjectOfShot({
          compiled: { ...compiled, builtEnvironments: [buildingFixture()] },
          waterBodies: [
            {
              id: "basin",
              owner: null,
              nodes: [],
              domain: null,
              cells: 1,
              particles: 2,
              material: null,
            },
          ],
          textures: [
            {
              asset: "textures/stone.png",
              width: 2,
              height: 2,
              mipmapped: false,
            },
          ],
        }).environments?.map((environment) => environment.id),
        water: autoMovieRenderSubjectOfShot({
          compiled,
          waterBodies: [
            {
              id: "basin",
              owner: null,
              nodes: [],
              domain: null,
              cells: 1,
              particles: 2,
              material: null,
            },
          ],
        }).waterBodies?.map((body) => body.id),
        textures: autoMovieRenderSubjectOfShot({
          compiled,
          textures: [
            {
              asset: "textures/stone.png",
              width: 2,
              height: 2,
              mipmapped: false,
            },
          ],
        }).textures?.map((texture) => texture.asset),
        // Cloth and planting reach the subject the same way water does: the
        // compiled shot does not carry them, so a conversion that dropped them
        // would produce a report that reads complete over an unfurnished room.
        panels: autoMovieRenderSubjectOfShot({
          compiled,
          softBodies: [
            {
              domain: softPanel({ columns: 2, rows: 2 }),
              owner: null,
              material: null,
            },
          ],
        }).softBodies?.map((body) => body.domain.id),
        plantings: autoMovieRenderSubjectOfShot({
          compiled,
          plantings: [
            {
              domain: plantingRecipe(),
              cluster: plantingCluster(),
              owner: null,
              branchMaterial: null,
              leafMaterial: null,
              branch: null,
              leaf: null,
            },
          ],
        }).plantings?.map((planting) => planting.cluster.id),
      },
    },
    {
      bare: {
        environments: [],
        water: [],
        panels: [],
        plantings: [],
        textures: [],
        sets: 1,
      },
      full: {
        environments: ["tower"],
        water: ["basin"],
        textures: ["textures/stone.png"],
        panels: ["panel"],
        plantings: ["atrium-bed"],
      },
    },
  );

  // The ground is measured through the same tessellator the viewer draws it
  // with: a convex quad footprint is one fan of two triangles over four
  // vertices, and a footprint enclosing no area draws nothing at all.
  const grounded = measure({
    scene: {
      ...sceneFixture(),
      nodes: [],
      lights: [],
      space: {
        id: "yard",
        walkable: ["slab"],
        surfaces: [
          {
            id: "slab",
            kind: "floor",
            polygon: [
              { x: 0, y: 0, z: 0 },
              { x: 4, y: 0, z: 0 },
              { x: 4, y: 0, z: 4 },
              { x: 0, y: 0, z: 4 },
            ],
            height: { kind: "constant", value: 0 },
          },
          {
            id: "sliver",
            kind: "floor",
            polygon: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 2, y: 0, z: 0 },
            ],
            height: { kind: "constant", value: 0 },
          },
        ],
      },
    },
    models: modelsFixture(),
  });
  TestValidator.equals(
    "the standable ground is counted exactly, and an empty footprint costs nothing",
    {
      triangles: grounded.totals.triangles,
      vertices: grounded.totals.vertices,
      drawCalls: grounded.totals.drawCalls,
      geometryBytes: grounded.totals.geometryBytes,
      nodes: grounded.totals.nodes,
      owner: grounded.owners.find(
        (entry) => entry.metric === "triangles" && entry.owner === "node:yard",
      )?.source,
    },
    {
      triangles: 4,
      vertices: 4,
      drawCalls: 2,
      geometryBytes: 4 * 24 + 6 * 4,
      nodes: 1,
      owner: "scene.space.surfaces",
    },
  );

  const partial = deriveAutoMovieSemanticMask({
    scene: { ...sceneFixture(), nodes: [sceneFixture().nodes[4]!] },
    models: modelsFixture(),
  });
  TestValidator.equals(
    "a mask that does not cover a staged node still attributes its cost",
    measureAutoMovieRenderInventory({
      subject: subject(),
      mask: partial,
    }).owners.filter(
      (entry) =>
        entry.metric === "triangles" && entry.owner.includes("hall-wall"),
    ),
    [
      {
        owner: "node:tower/hall-wall",
        source: 'scene.nodes["tower/hall-wall"]',
        metric: "triangles",
        cost: BOX_TRIANGLES,
        kind: "own",
      },
    ],
  );

  const formation = {
    id: "crowd",
    anonymousCount: 10,
    chunks: [{}, {}],
    lod: [{ tier: "near", model: "window-model" }],
  } as unknown as IAutoMovieCompiledFormation;
  const effect = {
    id: "haze",
    recipe: { budget: { maxParticles: 5 } },
  } as unknown as IAutoMovieCompiledEffect;
  const compact = measure({
    scene: { ...sceneFixture(), nodes: [], lights: [] },
    models: modelsFixture(),
    formations: [formation],
    effects: [effect],
  });
  TestValidator.equals(
    "compact formations, effects, and the largest frame pass are bounded",
    compact.totals,
    {
      triangles: 2 * (10 * BOX_TRIANGLES + 5 * 2),
      vertices: 10 * BOX_VERTICES + 5 * 4,
      drawCalls: 2 * (2 + 1),
      materials: 2,
      textures: 0,
      textureBytes: 0,
      geometryBytes: BOX_GEOMETRY_BYTES + 4 * (12 + 12 + 8) + 6 * 4,
      lights: 0,
      shadowMaps: 0,
      nodes: 2,
      instanceSets: 0,
      instanceSlots: 15,
      instanceChunks: 2,
      fluidCells: 0,
      fluidParticles: 0,
    },
  );
  TestValidator.equals(
    "a formation without a representation is not priced as zero",
    throwsError(
      () =>
        measure({
          scene: { ...sceneFixture(), nodes: [], lights: [] },
          models: modelsFixture(),
          formations: [{ ...formation, lod: [] }],
        }),
      "declares no level of detail",
    ),
    true,
  );

  TestValidator.equals(
    "a legacy owner and an explicit own row are summed, not listed twice",
    report(
      {
        ...inventory,
        owners: [
          {
            owner: "node:lantern",
            source: 'scene.nodes["lantern"]',
            metric: "triangles",
            cost: 7,
          },
          {
            owner: "node:lantern",
            source: 'scene.nodes["lantern"]',
            metric: "triangles",
            cost: 5,
            kind: "own",
          },
        ],
      },
      { ...budget, limits: { triangles: 1 } },
      target,
    ).findings.find((finding) => finding.metric === "triangles")!.contributors,
    [{ owner: "node:lantern", source: 'scene.nodes["lantern"]', cost: 12 }],
  );

  TestValidator.equals(
    "malformed budgets and unmeasurable subjects are each refused at their own message",
    namedFacts([
      [
        "negative limit",
        () =>
          throwsError(
            () =>
              report(
                inventory,
                { ...budget, limits: { triangles: -1 } },
                target,
              ),
            "at or above zero",
          ),
      ],
      [
        "fractional limit",
        () =>
          throwsError(
            () =>
              report(
                inventory,
                { ...budget, limits: { triangles: 1.5 } },
                target,
              ),
            "at or above zero",
          ),
      ],
      [
        "absent model",
        () =>
          throwsError(
            () => measure({ scene: sceneFixture(), models: [] }),
            'model "wall-model" is absent',
          ),
      ],
      [
        "prototype without level of detail",
        () =>
          throwsError(() => {
            const set = instanceSetFixture({
              id: "windows",
              count: 1,
              chunks: 1,
            });
            set.prototypes = [
              {
                id: "bare",
                modelRecipe: "window",
                weight: 1,
                lod: [],
                projectionRadius: 1,
              },
            ];
            return measure({
              scene: sceneFixture(),
              models: modelsFixture(),
              instanceSets: [set],
            });
          }, "declares no level of detail"),
      ],
      [
        "zero effect cap",
        () =>
          throwsError(
            () =>
              measure({
                scene: { ...sceneFixture(), nodes: [], lights: [] },
                models: modelsFixture(),
                effects: [
                  {
                    ...effect,
                    recipe: { budget: { maxParticles: 0 } },
                  } as unknown as IAutoMovieCompiledEffect,
                ],
              }),
            "maxParticles must be a positive safe integer",
          ),
      ],
      [
        "fractional effect cap",
        () =>
          throwsError(
            () =>
              measure({
                scene: { ...sceneFixture(), nodes: [], lights: [] },
                models: modelsFixture(),
                effects: [
                  {
                    ...effect,
                    recipe: { budget: { maxParticles: 1.5 } },
                  } as unknown as IAutoMovieCompiledEffect,
                ],
              }),
            "maxParticles must be a positive safe integer",
          ),
      ],
    ]),
    {
      "negative limit": true,
      "fractional limit": true,
      "absent model": true,
      "prototype without level of detail": true,
      "zero effect cap": true,
      "fractional effect cap": true,
    },
  );

  const silent: IAutoMovieRenderInventory = {
    ...inventory,
    totals: { ...inventory.totals, vertices: null },
    owners: inventory.owners.filter((entry) => entry.metric !== "materials"),
    gaps: [],
  };
  const silentReport = report(
    silent,
    { ...budget, limits: { ...budget.limits, materials: 0 } },
    target,
  );
  TestValidator.equals(
    "a value with no reason is not-run, and an unowned overrun still says what to do",
    {
      vertices: silentReport.findings.find(
        (finding) => finding.metric === "vertices",
      )!.status,
      reason: (
        silentReport.findings.find((finding) => finding.metric === "vertices")!
          .recovery ?? ""
      ).includes("declared no reason"),
      materials: silentReport.findings.find(
        (finding) => finding.metric === "materials",
      )!.contributors.length,
      unowned: (
        silentReport.findings.find((finding) => finding.metric === "materials")!
          .recovery ?? ""
      ).includes("attributed none of it to an editable owner"),
      status: silentReport.status,
    },
    {
      vertices: "not-run",
      reason: true,
      materials: 0,
      unowned: true,
      status: "over",
    },
  );

  const passOnly = report(
    {
      ...inventory,
      totals: { ...inventory.totals, triangles: BOX_TRIANGLES },
      owners: [
        {
          owner: "render-pass:outline",
          source: "render.pass.outline",
          metric: "triangles",
          cost: BOX_TRIANGLES,
          kind: "pass",
        },
      ],
      gaps: [],
    },
    { ...budget, limits: { ...budget.limits, triangles: 0 } },
    target,
  ).findings.find((finding) => finding.metric === "triangles")!;
  TestValidator.equals(
    "a pass-only boundary has accounting but no false edit destination",
    {
      status: passOnly.status,
      contributors: passOnly.contributors,
      omittedContributors: passOnly.omittedContributors,
      omittedCost: passOnly.omittedCost,
      explainsNoEditableOwner: (passOnly.recovery ?? "").includes(
        "attributed none of it to an editable owner",
      ),
      explainsPass: (passOnly.recovery ?? "").includes(
        `a further ${BOX_TRIANGLES} of that total is frame passes redrawing the opaque owners, the largest "render-pass:outline" at ${BOX_TRIANGLES}`,
      ),
      inventsEdit: (passOnly.recovery ?? "").includes("edited at"),
    },
    {
      status: "over",
      contributors: [],
      omittedContributors: 1,
      omittedCost: BOX_TRIANGLES,
      explainsNoEditableOwner: true,
      explainsPass: true,
      inventsEdit: false,
    },
  );
};

/** Derive the mask and measure one subject in one step. */
const measure = (subject: IAutoMovieRenderSubject): IAutoMovieRenderInventory =>
  measureAutoMovieRenderInventory({
    subject,
    mask: deriveAutoMovieSemanticMask(subject),
  });

/** Evaluate one inventory, always against the same sealed target. */
const report = (
  inventory: IAutoMovieRenderInventory,
  budget: IAutoMovieRenderBudget | null,
  target: IAutoMovieRenderTarget,
  maxContributors?: number,
): IAutoMovieRenderReport =>
  evaluateAutoMovieRenderBudget({
    inventory,
    budget,
    mask: {
      version: 2,
      protocol: "automovie.semantic-mask.v2",
      background: "#000000",
      entries: [],
      unaddressed: [],
      digest: `sha256:${"0".repeat(64)}`,
    },
    target,
    maxContributors,
  });

/** The part of a finding an over-limit twin has to state. */
const shape = (
  finding: IAutoMovieRenderReport["findings"][number],
): Record<string, unknown> => ({
  status: finding.status,
  excess: finding.excess,
  owner: finding.contributors[0]?.owner,
  source: finding.contributors[0]?.source,
  cost: finding.contributors[0]?.cost,
  recovers:
    (finding.recovery ?? "").includes("over") &&
    (finding.recovery ?? "").includes(finding.contributors[0]?.owner ?? "!"),
});

/** The identity placement every ad-hoc fixture node uses. */
const pose = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** One staged node of a named model. */
const staged = (
  id: string,
  model: string,
): IAutoMovieScene["nodes"][number] => ({
  id,
  model,
  transform: pose(),
  motion: null,
  pose: null,
});

/**
 * One box model whose material binds a shared texture, either as the legacy
 * bare asset id or as the complete sampling declaration.
 */
const sharedTexture = (
  id: string,
  material: string,
  binding: "shared" | "reference",
): IAutoMovieModel => ({
  id,
  name: null,
  origin: "generated",
  parts: [
    {
      id: `${id}-part`,
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 1, height: 1, depth: 1 },
      },
      material,
      attachedBone: null,
      transform: null,
    },
  ],
  skeleton: null,
  body: null,
  materials: [
    {
      id: material,
      name: null,
      baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
      metallic: 0,
      roughness: 1,
      emissive: null,
      opacity: 1,
      baseColorTexture:
        binding === "shared"
          ? "textures/shared.png"
          : {
              asset: "textures/shared.png",
              texCoord: 0,
              colorSpace: "srgb",
            },
      normalTexture:
        binding === "reference"
          ? { asset: "textures/normal.png", texCoord: 0, colorSpace: "linear" }
          : null,
    },
  ],
  asset: null,
});

/** Six loose vertices: no indices, no normals, no texture coordinates. */
const rawMesh = (): IAutoMovieModel => ({
  id: "raw-mesh",
  name: null,
  origin: "imported",
  parts: [
    {
      id: "raw-part",
      name: null,
      geometry: {
        type: "mesh",
        mesh: {
          positions: Array.from({ length: 18 }, (_, index) => index),
          normals: null,
          uvs: null,
          indices: null,
          skin: null,
        },
      },
      material: null,
      attachedBone: null,
      transform: null,
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
});

/** An indexed, normalled, textured, skinned quad beside one primitive box. */
const skinnedMesh = (): IAutoMovieModel => ({
  id: "skinned-mesh",
  name: null,
  origin: "imported",
  parts: [
    {
      id: "skin-part",
      name: null,
      geometry: {
        type: "mesh",
        mesh: {
          positions: Array.from({ length: 12 }, (_, index) => index),
          normals: Array.from({ length: 12 }, () => 0),
          uvs: Array.from({ length: 8 }, () => 0),
          indices: [0, 1, 2, 0, 2, 3],
          skin: {
            joints: ["hips"],
            boneIndices: Array.from({ length: 16 }, () => 0),
            weights: Array.from({ length: 16 }, () => 0.25),
          },
        },
      },
      material: "oak",
      attachedBone: null,
      transform: null,
    },
    {
      id: "box-part",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 1, height: 1, depth: 1 },
      },
      material: "oak",
      attachedBone: null,
      transform: null,
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
});
