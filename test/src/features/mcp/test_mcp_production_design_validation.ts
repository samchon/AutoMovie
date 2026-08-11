import {
  AutoMovieDiagnosticCode,
  IAutoMovieAcceptanceScenario,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AUTOMOVIE_MAX_FORMATION_MEMBERS,
  AUTOMOVIE_MAX_FRAME_PIXELS,
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/**
 * Every bounded production-design family emits actionable graph diagnostics
 * while a complete starter-shaped graph remains valid.
 *
 * Scenarios:
 *
 * 1. Production raster, runtime, palette, deliverable, and aggregate collection
 *    budgets accept their exact limits and reject empty, duplicate, off-clock,
 *    non-finite, and oversized inputs.
 * 2. Model recipes validate identity, archetype parameters, palette, LOD order,
 *    runtime references, capabilities, attachments, and cumulative payload
 *    limits.
 * 3. World landmarks, surfaces, routes, effect recipes, and effect zones reject
 *    malformed geometry, missing references, duplicate identities, and unsafe
 *    numeric ranges.
 * 4. Formations validate bounded layouts, slots, heroes, LOD memory, source
 *    identity, and exact per-production payload constraints.
 * 5. Shot participants, source modules, durations, states, events, camera
 *    subjects, and review frames reject missing, duplicate, off-clock, or
 *    unmeasurable contracts.
 * 6. One shot rejects a hero actor owned by two participating formations, while
 *    the same actor may belong to different formations in different shots.
 * 7. Acceptance frame/event/metric criteria resolve exact targets and reject
 *    missing evidence addresses, invalid operators, and target mismatches.
 * 8. Portable case-folding and source-path rules catch cross-artifact identity
 *    collisions without rejecting deliberate shared canonical source modules.
 */
export const test_mcp_production_design_validation = (): void => {
  const valid: IAutoMovieProductionDesignGraph = {
    production: productionDesign(),
    models: new Map([["soloist", modelRecipe()]]),
    world: worldDesign(),
    formations: new Map([["line", formationDesign()]]),
    shots: new Map([["opening", shotContract()]]),
    acceptance: new Map(acceptanceScenarios().map((item) => [item.id, item])),
  };
  TestValidator.equals(
    "valid starter graph",
    validateAutoMovieProductionGraph(valid),
    [],
  );
  TestValidator.predicate(
    "repainted delivery requires one non-optional feature",
    validateAutoMovieProductionGraph({
      ...valid,
      production: {
        ...productionDesign(),
        visualDelivery: "repainted",
        deliverables: [
          { id: "preview", kind: "preview", required: true },
          { id: "optional-feature", kind: "feature", required: false },
        ],
      },
    }).some(
      (diagnostic) => diagnostic.code === "design-repaint-feature-required",
    ),
  );
  TestValidator.predicate(
    "duplicate shot style intent is diagnosed at its own field",
    validateAutoMovieProductionGraph({
      ...valid,
      shots: new Map([
        [
          "opening",
          {
            ...shotContract(),
            styleIntent: ["jump-cut", "jump-cut"],
          },
        ],
      ]),
    }).some(
      (diagnostic) =>
        diagnostic.code === "design-duplicate-id" &&
        diagnostic.message.includes("styleIntent"),
    ),
  );
  const oversizedFormation = formationDesign();
  oversizedFormation.count = AUTOMOVIE_MAX_FORMATION_MEMBERS + 1;
  const cumulativeFormation = formationDesign();
  cumulativeFormation.id = "second-line";
  cumulativeFormation.count =
    Math.floor(AUTOMOVIE_MAX_FORMATION_MEMBERS / 2) + 1;
  cumulativeFormation.layout = {
    kind: "line",
    ranks: cumulativeFormation.count,
    files: 1,
    spacing: { lateral: 0.8, depth: 0.9 },
  };
  const firstCumulativeFormation = structuredClone(cumulativeFormation);
  firstCumulativeFormation.id = "first-line";
  const twoTierModel = structuredClone(modelRecipe());
  twoTierModel.lod = [
    { tier: "hero", maxDistance: 5, recipe: twoTierModel.id },
    { tier: "near", maxDistance: 20, recipe: twoTierModel.id },
    { tier: "far", maxDistance: null, recipe: twoTierModel.id },
  ];
  const matrixHeavyFormation = {
    ...formationDesign(),
    count: 70_000,
    layout: {
      kind: "line" as const,
      ranks: 70_000,
      files: 1,
      spacing: { lateral: 0.8, depth: 0.9 },
    },
    heroOverrides: [],
  };
  const runtimeHeavyFormation = {
    ...formationDesign(),
    count: 256,
    layout: {
      kind: "line" as const,
      ranks: 256,
      files: 1,
      spacing: { lateral: 0.8, depth: 0.9 },
    },
    heroOverrides: Array.from({ length: 256 }, (_, slot) => ({
      slot,
      actor: `hero-${slot}`,
    })),
  };
  const heroLimitFormation = {
    ...runtimeHeavyFormation,
    id: "hero-limit",
    count: 257,
    layout: {
      ...runtimeHeavyFormation.layout,
      ranks: 257,
    },
    heroOverrides: Array.from({ length: 257 }, (_, slot) => ({
      slot,
      actor: `limit-hero-${slot}`,
    })),
  };
  const unboundedFormation = {
    ...formationDesign(),
    id: "unbounded",
    anchor: { x: 1_000_000_001, y: 0, z: 0 },
    facingDeg: 360_001,
    layout: {
      kind: "line" as const,
      ranks: 2,
      files: 3,
      spacing: { lateral: 10_001, depth: 1 },
    },
  };
  const identityHeavyFormation = {
    ...formationDesign(),
    id: "identity-heavy",
    count: 1,
    layout: {
      kind: "line" as const,
      ranks: 1,
      files: 1,
      spacing: { lateral: 1, depth: 1 },
    },
    heroOverrides: [{ slot: 0, actor: "hero".repeat(40_000) }],
  };
  TestValidator.equals(
    "explicit formation nodes stay inside one honest per-production bound",
    namedFacts([
      [
        "validateAutoMovieProductionGraphValidFormations",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([[oversizedFormation.id, oversizedFormation]]),
            shots: new Map(),
            acceptance: new Map(),
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-range-invalid" &&
              diagnostic.target === `formation:${oversizedFormation.id}`,
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidFormations2",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([
              [firstCumulativeFormation.id, firstCumulativeFormation],
              [cumulativeFormation.id, cumulativeFormation],
            ]),
            shots: new Map(),
            acceptance: new Map(),
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-range-invalid" &&
              diagnostic.target === "formations",
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidModels",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            models: new Map([[twoTierModel.id, twoTierModel]]),
            formations: new Map([
              [matrixHeavyFormation.id, matrixHeavyFormation],
            ]),
            shots: new Map(),
            acceptance: new Map(),
          }).some((diagnostic) => diagnostic.message.includes("viewer budget")),
      ],
      [
        "validateAutoMovieProductionGraphValidFormations3",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([
              [runtimeHeavyFormation.id, runtimeHeavyFormation],
            ]),
            shots: new Map(),
            acceptance: new Map(),
          }).some((diagnostic) =>
            diagnostic.message.includes("generated payload budget"),
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidFormations4",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([[heroLimitFormation.id, heroLimitFormation]]),
            shots: new Map(),
            acceptance: new Map(),
          }).some((diagnostic) =>
            diagnostic.message.includes("above the explicit-node limit"),
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidFormations5",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([[unboundedFormation.id, unboundedFormation]]),
            shots: new Map(),
            acceptance: new Map(),
          }).filter(
            (diagnostic) =>
              diagnostic.target === `formation:${unboundedFormation.id}` &&
              diagnostic.code === "design-range-invalid",
          ).length >= 3,
      ],
      [
        "validateAutoMovieProductionGraphValidFormations6",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([
              [identityHeavyFormation.id, identityHeavyFormation],
            ]),
            shots: new Map(),
            acceptance: new Map(),
          }).some((diagnostic) =>
            diagnostic.message.includes("generated payload budget"),
          ),
      ],
    ]),
    {
      validateAutoMovieProductionGraphValidFormations: true,
      validateAutoMovieProductionGraphValidFormations2: true,
      validateAutoMovieProductionGraphValidModels: true,
      validateAutoMovieProductionGraphValidFormations3: true,
      validateAutoMovieProductionGraphValidFormations4: true,
      validateAutoMovieProductionGraphValidFormations5: true,
      validateAutoMovieProductionGraphValidFormations6: true,
    },
  );
  const noReviewFrames = shotContract();
  noReviewFrames.reviewFrames = [];
  TestValidator.predicate(
    "every shot requires at least one observable review frame",
    validateAutoMovieProductionGraph({
      ...valid,
      shots: new Map([[noReviewFrames.id, noReviewFrames]]),
      acceptance: new Map(),
    }).some(
      (diagnostic) =>
        diagnostic.code === "design-collection-empty" &&
        diagnostic.target === "shot:opening",
    ),
  );
  const firstHeroFormation = {
    ...formationDesign(),
    id: "first-heroes",
    heroOverrides: [{ slot: 0, actor: "shared-hero" }],
  };
  const secondHeroFormation = {
    ...formationDesign(),
    id: "second-heroes",
    heroOverrides: [{ slot: 1, actor: "shared-hero" }],
  };
  const sharedHeroShot = {
    ...shotContract(),
    participants: [
      { kind: "formation" as const, id: firstHeroFormation.id },
      { kind: "formation" as const, id: secondHeroFormation.id },
    ],
  };
  const crossFormationMessage = "belongs to participating formations";
  TestValidator.equals(
    "one shot cannot assign the same hero actor to two formations",
    namedFacts([
      [
        "validateAutoMovieProductionGraphValidFormations",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([
              [firstHeroFormation.id, firstHeroFormation],
              [secondHeroFormation.id, secondHeroFormation],
            ]),
            shots: new Map([[sharedHeroShot.id, sharedHeroShot]]),
            acceptance: new Map(),
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-duplicate-id" &&
              diagnostic.message.includes(crossFormationMessage),
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidFormations2",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            formations: new Map([
              [firstHeroFormation.id, firstHeroFormation],
              [secondHeroFormation.id, secondHeroFormation],
            ]),
            shots: new Map([
              [
                "first-shot",
                {
                  ...shotContract(),
                  id: "first-shot",
                  participants: [
                    { kind: "formation" as const, id: firstHeroFormation.id },
                  ],
                },
              ],
              [
                "second-shot",
                {
                  ...shotContract(),
                  id: "second-shot",
                  source: {
                    ...shotContract().source,
                    module: "src/shots/second.ts",
                  },
                  participants: [
                    { kind: "formation" as const, id: secondHeroFormation.id },
                  ],
                },
              ],
            ]),
            acceptance: new Map(),
          }).every(
            (diagnostic) =>
              diagnostic.message.includes(crossFormationMessage) === false,
          ),
      ],
    ]),
    {
      validateAutoMovieProductionGraphValidFormations: true,
      validateAutoMovieProductionGraphValidFormations2: true,
    },
  );
  const maximumRaster = {
    ...productionDesign(),
    frameFormat: {
      ...productionDesign().frameFormat,
      width: 4_096,
      height: 4_096,
    },
  };
  const oversizedRaster = {
    ...maximumRaster,
    frameFormat: { ...maximumRaster.frameFormat, width: 4_097 },
  };
  TestValidator.equals(
    "the shared preview pixel budget accepts its boundary and rejects one pixel column beyond it",
    namedFacts([
      [
        "maximumRasterFrameFormatWidth",
        () =>
          maximumRaster.frameFormat.width * maximumRaster.frameFormat.height ===
          AUTOMOVIE_MAX_FRAME_PIXELS,
      ],
      [
        "validateAutoMovieProductionGraphValidProduction",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            production: maximumRaster,
          }).every((diagnostic) => diagnostic.code !== "design-range-invalid"),
      ],
      [
        "validateAutoMovieProductionGraphValidProduction2",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            production: oversizedRaster,
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-range-invalid" &&
              diagnostic.message.includes("width times height"),
          ),
      ],
    ]),
    {
      maximumRasterFrameFormatWidth: true,
      validateAutoMovieProductionGraphValidProduction: true,
      validateAutoMovieProductionGraphValidProduction2: true,
    },
  );
  const missingShotMembers = {
    ...valid,
    acceptance: new Map([
      [
        "missing-frame",
        {
          ...acceptanceScenarios()[0]!,
          id: "missing-frame",
          criterion: {
            kind: "frame" as const,
            frame: "absent",
            pass: "beauty" as const,
            expectation: "The frame must exist.",
          },
        },
      ],
      [
        "missing-event",
        {
          ...acceptanceScenarios()[0]!,
          id: "missing-event",
          criterion: {
            kind: "event" as const,
            event: "absent",
            expectation: "The event must exist.",
          },
        },
      ],
    ]),
  };
  TestValidator.equals(
    "acceptance checks address current frame and event ids",
    validateAutoMovieProductionGraph(missingShotMembers).filter(
      (diagnostic) => diagnostic.code === "design-reference-missing",
    ).length,
    2,
  );

  const invalidModel: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "",
    parameters: {
      height: 99,
      headRadius: "wrong",
      unsupported: 1,
    },
    palette: { "": "" },
    lod: [
      { tier: "hero", maxDistance: -1, recipe: "absent" },
      { tier: "hero", maxDistance: null, recipe: "different" },
    ],
    capabilities: ["", ""],
    attachments: [
      { id: "", bone: "" as never },
      { id: "", bone: "head" },
    ],
  };
  const invalidWorld = {
    ...worldDesign(),
    id: "",
    landmarks: [
      {
        id: "",
        position: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
        radius: 0,
        meaning: "",
      },
      {
        id: "",
        position: { x: 0, y: 0, z: 0 },
        radius: 1,
        meaning: "duplicate",
      },
    ],
    surfaces: [
      {
        id: "",
        polygon: [{ x: Number.NaN, z: Number.NaN }],
        height: { kind: "constant" as const, value: Number.NaN },
        walkable: true,
      },
      {
        id: "",
        polygon: [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
        ],
        height: {
          kind: "plane" as const,
          originHeight: Number.NaN,
          slopeX: Number.NaN,
          slopeZ: Number.NaN,
        },
        walkable: true,
      },
    ],
    routes: [
      {
        id: "",
        waypoints: [{ x: Number.NaN, z: Number.NaN }],
        allowedFormationWidth: 0,
      },
      {
        id: "",
        waypoints: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
        allowedFormationWidth: 1,
      },
    ],
    effectRecipes: [
      {
        ...worldDesign().effectRecipes[0]!,
        id: "",
        seed: -1,
        emission: { rate: Number.NaN, burst: -1, duration: 0 },
        particle: {
          lifetime: { min: 31, max: 1 },
          size: { min: 21, max: 0 },
          color: "invalid",
          opacity: { min: 2, max: -1 },
        },
        motion: {
          wind: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
          rise: 51,
          turbulence: -1,
        },
        budget: { maxParticles: 0, lodDistance: 0 },
      },
      {
        ...worldDesign().effectRecipes[0]!,
        id: "",
        emission: { rate: 100, burst: 100, duration: 1 },
        particle: {
          ...worldDesign().effectRecipes[0]!.particle,
          lifetime: { min: 10, max: 10 },
        },
        budget: { maxParticles: 1, lodDistance: 10 },
      },
    ],
    effectZones: [
      {
        id: "",
        recipe: "absent",
        bounds: {
          min: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
          max: { x: 0, y: 0, z: 0 },
        },
        seed: -1,
      },
      {
        id: "",
        recipe: "absent",
        bounds: {
          min: { x: 1, y: 1, z: 1 },
          max: { x: 0, y: 0, z: 0 },
        },
        seed: 1,
      },
    ],
  };
  const invalidFormation: IAutoMovieFormationDesign = {
    ...formationDesign(),
    id: "",
    modelRecipe: "",
    count: 0,
    layout: {
      kind: "line",
      ranks: 0,
      files: 0,
      spacing: { lateral: 0, depth: Number.NaN },
    },
    anchor: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
    facingDeg: Number.NaN,
    seed: -1,
    capabilities: ["hold", "hold"],
    heroOverrides: [
      { slot: -1, actor: "duplicate" },
      { slot: -1, actor: "duplicate" },
    ],
  };
  const invalidShot = {
    ...shotContract(),
    id: "",
    beat: "",
    source: { module: "", export: "" },
    durationSeconds: 0,
    styleIntent: ["jump-cut" as const, "jump-cut" as const],
    participants: [
      { kind: "formation" as const, id: "absent" },
      { kind: "formation" as const, id: "absent" },
      { kind: "actor" as const, id: "" },
    ],
    opening: [
      { id: "", description: "", predicates: [] },
      { id: "", description: "duplicate", predicates: [] },
    ],
    closing: [
      { id: "", description: "", predicates: [] },
      { id: "", description: "duplicate", predicates: [] },
    ],
    camera: {
      ...shotContract().camera,
      intent: "",
      requiredSubjects: [],
      maxOcclusionRatio: Number.NaN,
    },
    events: [
      {
        id: "",
        kind: "reveal" as const,
        window: { from: 2, to: 1 },
        subjects: ["", ""],
        predicates: [],
      },
      {
        id: "",
        kind: "contact" as const,
        window: { from: -1, to: 99 },
        subjects: [],
        predicates: [],
      },
    ],
    reviewFrames: [
      {
        id: "",
        time: Number.NaN,
        passes: ["beauty" as const, "beauty" as const],
      },
      { id: "", time: 99, passes: [] },
    ],
  };
  const invalidAcceptance: IAutoMovieAcceptanceScenario[] = [
    {
      ...acceptanceScenarios()[0]!,
      id: "",
      target: { kind: "shot", id: "" },
    },
    {
      ...acceptanceScenarios()[0]!,
      id: "missing-frame",
      target: { kind: "shot", id: "opening" },
      criterion: {
        kind: "frame",
        frame: "absent",
        pass: "beauty",
        expectation: "",
      },
    },
    {
      ...acceptanceScenarios()[0]!,
      id: "missing-event",
      target: { kind: "shot", id: "opening" },
      criterion: { kind: "event", event: "absent", expectation: "" },
    },
    {
      ...acceptanceScenarios()[0]!,
      id: "missing-pass",
      target: { kind: "shot", id: "opening" },
      criterion: {
        kind: "frame",
        frame: "cue-apex",
        pass: "depth",
        expectation: "The requested pass must exist.",
      },
    },
    {
      ...acceptanceScenarios()[0]!,
      id: "bad-metric",
      target: { kind: "film", id: "wrong-film" },
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: Number.NaN,
      },
    },
  ];
  const invalid: IAutoMovieProductionDesignGraph = {
    production: {
      ...productionDesign(),
      id: "",
      title: "",
      logline: "",
      targetRuntimeSeconds: 0,
      visualDelivery: "unsupported" as "deterministic",
      frameFormat: {
        ...productionDesign().frameFormat,
        width: 15,
        height: 20_000,
        fps: 0,
      },
      artDirection: {
        ...productionDesign().artDirection,
        palette: ["", ""],
        silhouettePriority: "",
        scaleGrammar: "",
      },
      deliverables: [
        { id: "", kind: "preview", required: false },
        { id: "", kind: "feature", required: true },
      ],
    },
    models: new Map([["wrong-key", invalidModel]]),
    world: invalidWorld,
    formations: new Map([
      ["wrong-key", invalidFormation],
      [
        "column",
        {
          ...formationDesign({
            kind: "column",
            ranks: 1,
            files: 1,
            spacing: { lateral: 1, depth: 1 },
          }),
          id: "column",
        },
      ],
      [
        "wedge",
        {
          ...formationDesign({
            kind: "wedge",
            depth: 0,
            spacing: { lateral: 1, depth: 1 },
          }),
          id: "wedge",
        },
      ],
      [
        "arc",
        {
          ...formationDesign({
            kind: "arc",
            radius: 0,
            arcDegrees: 361,
          }),
          id: "arc",
        },
      ],
      [
        "scatter",
        {
          ...formationDesign({ kind: "scatter", radius: 0, seed: -1 }),
          id: "scatter",
        },
      ],
    ]),
    shots: new Map([["wrong-key", invalidShot]]),
    acceptance: new Map(
      invalidAcceptance.map((item, index) => [
        index === 0 ? "wrong-key" : item.id,
        item,
      ]),
    ),
  };
  const diagnostics = validateAutoMovieProductionGraph(invalid);
  const codes = new Set(diagnostics.map((item) => item.code));
  TestValidator.equals(
    "invalid mega-graph exercises every diagnostic family",
    namedFacts([
      ["diagnosticsLength", () => diagnostics.length > 50],
      [
        "designIdentityMismatch",
        () =>
          diagnostics.length > 50 &&
          (
            [
              "design-identity-mismatch",
              "design-range-invalid",
              "design-enum-invalid",
              "design-duplicate-id",
              "design-collection-empty",
              "design-text-empty",
              "design-reference-missing",
              "model-parameter-unsupported",
              "model-parameter-invalid",
            ] satisfies AutoMovieDiagnosticCode[]
          ).every((code) => codes.has(code)),
      ],
    ]),
    { diagnosticsLength: true, designIdentityMismatch: true },
  );
  const expensiveEffectRecipe = {
    ...worldDesign().effectRecipes[0]!,
    id: "expensive-effect",
    emission: { rate: 0, burst: 4_096, duration: 1 },
    budget: { maxParticles: 4_096, lodDistance: 100 },
  };
  TestValidator.predicate(
    "production-wide effect instance budget refuses excessive zone reservation",
    validateAutoMovieProductionGraph({
      ...valid,
      world: {
        ...worldDesign(),
        effectRecipes: [expensiveEffectRecipe],
        effectZones: Array.from({ length: 5 }, (_, index) => ({
          id: `effect-zone-${index}`,
          recipe: expensiveEffectRecipe.id,
          bounds: {
            min: { x: index * 2, y: 0, z: 0 },
            max: { x: index * 2 + 1, y: 1, z: 1 },
          },
          seed: index,
        })),
      },
    }).some(
      (diagnostic) =>
        diagnostic.code === "design-budget-exceeded" &&
        diagnostic.message.includes("above the production budget"),
    ),
  );
  const shortEmissionRecipe = {
    ...worldDesign().effectRecipes[0]!,
    id: "short-emission",
    emission: { rate: 0.5, burst: 1, duration: 1 },
    particle: {
      ...worldDesign().effectRecipes[0]!.particle,
      lifetime: { min: 10, max: 10 },
    },
    budget: { maxParticles: 1, lodDistance: 100 },
  };
  TestValidator.equals(
    "effect live budget stops adding particles when emission ends",
    validateAutoMovieProductionGraph({
      ...valid,
      world: {
        ...worldDesign(),
        effectRecipes: [shortEmissionRecipe],
        effectZones: [
          {
            ...worldDesign().effectZones[0]!,
            recipe: shortEmissionRecipe.id,
          },
        ],
      },
    }),
    [],
  );
  const exactExpiryRecipe = {
    ...shortEmissionRecipe,
    id: "exact-expiry",
    emission: { rate: 1, burst: 1, duration: 10 },
    particle: {
      ...shortEmissionRecipe.particle,
      lifetime: { min: 1, max: 1 },
    },
  };
  TestValidator.equals(
    "effect burst expires when the first regular particle spawns",
    validateAutoMovieProductionGraph({
      ...valid,
      world: {
        ...worldDesign(),
        effectRecipes: [exactExpiryRecipe],
        effectZones: [
          {
            ...worldDesign().effectZones[0]!,
            recipe: exactExpiryRecipe.id,
          },
        ],
      },
    }),
    [],
  );
  TestValidator.predicate(
    "world effect declarations remain structurally bounded",
    validateAutoMovieProductionGraph({
      ...valid,
      world: {
        ...worldDesign(),
        effectRecipes: Array.from(
          { length: 257 },
          (_, index) =>
            ({
              ...worldDesign().effectRecipes[0]!,
              id: `effect-recipe-${index}`,
            }) as typeof expensiveEffectRecipe,
        ),
      },
    }).some((diagnostic) =>
      diagnostic.message.includes("within 256 recipes and 256 zones"),
    ),
  );
  const emptyCollections = validateAutoMovieProductionGraph({
    ...valid,
    production: {
      ...productionDesign(),
      artDirection: {
        ...productionDesign().artDirection,
        palette: [],
      },
      deliverables: [],
    },
  });
  TestValidator.equals(
    "production requires a palette and at least one deliverable",
    emptyCollections.filter(
      (diagnostic) => diagnostic.code === "design-collection-empty",
    ).length,
    2,
  );
  const missingPass = {
    ...acceptanceScenarios()[0]!,
    id: "missing-pass",
    criterion: {
      kind: "frame" as const,
      frame: "cue-apex",
      pass: "depth" as const,
      expectation: "The requested pass must exist.",
    },
  };
  TestValidator.equals(
    "acceptance frame pass must exist on its referenced review frame",
    validateAutoMovieProductionGraph({
      ...valid,
      acceptance: new Map([[missingPass.id, missingPass]]),
    }).filter((diagnostic) => diagnostic.code === "design-reference-missing")
      .length,
    1,
  );
  const offClockShot = shotContract();
  offClockShot.reviewFrames[0]!.time = 1 / 25;
  TestValidator.predicate(
    "review evidence times must lie on the production frame clock",
    validateAutoMovieProductionGraph({
      ...valid,
      shots: new Map([[offClockShot.id, offClockShot]]),
    }).some((diagnostic) => diagnostic.code === "design-frame-clock-invalid"),
  );
  const offClockProduction = {
    ...productionDesign(),
    targetRuntimeSeconds: 6.01,
  };
  const offClockDuration = shotContract();
  offClockDuration.durationSeconds = 6.01;
  TestValidator.equals(
    "production and shot runtimes must be exactly renderable on the frame clock",
    namedFacts([
      [
        "validateAutoMovieProductionGraphValidProduction",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            production: offClockProduction,
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-frame-clock-invalid" &&
              diagnostic.target === "production",
          ),
      ],
      [
        "validateAutoMovieProductionGraphValidShots",
        () =>
          validateAutoMovieProductionGraph({
            ...valid,
            shots: new Map([[offClockDuration.id, offClockDuration]]),
            acceptance: new Map(),
          }).some(
            (diagnostic) =>
              diagnostic.code === "design-frame-clock-invalid" &&
              diagnostic.target === "shot:opening",
          ),
      ],
    ]),
    {
      validateAutoMovieProductionGraphValidProduction: true,
      validateAutoMovieProductionGraphValidShots: true,
    },
  );
  const longClockShot = shotContract();
  longClockShot.durationSeconds = 50_000;
  longClockShot.reviewFrames[0]!.time = 1_000_000 / 24;
  TestValidator.predicate(
    "large valid frame indices survive floating-point scale",
    validateAutoMovieProductionGraph({
      ...valid,
      shots: new Map([[longClockShot.id, longClockShot]]),
    }).every((diagnostic) => diagnostic.code !== "design-frame-clock-invalid"),
  );
  const polygonVariants = [
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 0 },
    ],
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
    ],
    [
      { x: 0, z: 0 },
      { x: 3, z: 3 },
      { x: 0, z: 3 },
      { x: 2, z: 0 },
    ],
    [
      { x: 2, z: 0 },
      { x: 0, z: 3 },
      { x: 3, z: 3 },
      { x: 0, z: 0 },
    ],
    [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 1, z: 0 },
      { x: 3, z: 2 },
      { x: 0, z: 2 },
    ],
    [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 3 },
      { x: 1, z: 3 },
      { x: 1, z: 0 },
      { x: 3, z: 0 },
    ],
  ];
  TestValidator.predicate(
    "world surfaces reject duplicate, zero-area, crossing and overlapping polygons",
    polygonVariants.every((polygon, index) => {
      const world = worldDesign();
      world.surfaces = [
        {
          ...world.surfaces[0]!,
          id: `invalid-polygon-${index}`,
          polygon,
        },
      ];
      return validateAutoMovieProductionGraph({
        ...valid,
        world,
      }).some((diagnostic) => diagnostic.code === "design-polygon-invalid");
    }),
  );
  const invalidLod: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "invalid-lod",
    parameters: { height: 1.8, headRadius: 0.16 },
    lod: [
      { tier: "near", maxDistance: null, recipe: "invalid-lod" },
      { tier: "hero", maxDistance: 1, recipe: "invalid-lod" },
      { tier: "far", maxDistance: 1, recipe: "invalid-lod" },
    ],
  };
  const invalidPrimitive: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "invalid-primitive",
    role: "prop",
    archetype: "primitive-prop",
    parameters: {
      shape: "box",
      width: 1,
      height: 1,
      radius: 1,
      rigged: true,
    },
    palette: {},
    lod: [],
  };
  const unknownPrimitive: IAutoMovieModelRecipe = {
    ...invalidPrimitive,
    id: "unknown-primitive",
    parameters: { shape: "pyramid" },
    palette: { body: "#fff" },
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "unknown-primitive",
      },
    ],
  };
  const missingPrimitive: IAutoMovieModelRecipe = {
    ...unknownPrimitive,
    id: "missing-primitive",
    parameters: {},
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "missing-primitive",
      },
    ],
  };
  const attachedProp: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "attached-prop",
    role: "prop",
    archetype: "primitive-prop",
    parameters: {
      shape: "box",
      width: 2.2,
      height: 1.7,
      depth: 0.9,
    },
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "attached-prop",
      },
    ],
    attachments: [{ id: "socket", bone: "hips" }],
  };
  const unsupportedStickmanAttachment: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "unsupported-stickman-attachment",
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "unsupported-stickman-attachment",
      },
    ],
    attachments: [{ id: "boot", bone: "rightFoot" }],
  };
  // The positive control the two refusals above are only refusals against: an
  // archetype that declares bones, carrying a socket on one of them. Without a
  // socket the gate accepts, a pass that refused EVERY attachment would read
  // exactly as green as one that refused the right ones.
  const supportedAttachment: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "supported-attachment",
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "supported-attachment",
      },
    ],
    attachments: [{ id: "held", bone: "rightHand" }],
  };
  const multiplePaletteMaterials: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "multiple-palette-materials",
    palette: { uniform: "#123456", skin: "#abcdef" },
    lod: [
      {
        tier: "hero",
        maxDistance: null,
        recipe: "multiple-palette-materials",
      },
    ],
  };
  const modelContractDiagnostics = validateAutoMovieProductionGraph({
    ...valid,
    models: new Map([
      [invalidLod.id, invalidLod],
      [invalidPrimitive.id, invalidPrimitive],
      [unknownPrimitive.id, unknownPrimitive],
      [missingPrimitive.id, missingPrimitive],
      [attachedProp.id, attachedProp],
      [unsupportedStickmanAttachment.id, unsupportedStickmanAttachment],
      [supportedAttachment.id, supportedAttachment],
      [multiplePaletteMaterials.id, multiplePaletteMaterials],
    ]),
    formations: new Map(),
    shots: new Map(),
    acceptance: new Map(),
  });
  const modelContractCodes = new Set(
    modelContractDiagnostics.map((diagnostic) => diagnostic.code),
  );
  TestValidator.predicate(
    "model recipes require complete parameters, material palette, usable LOD order and shape-specific primitive dimensions",
    (
      [
        "model-parameter-missing",
        "model-parameter-invalid",
        "model-parameter-unsupported",
        "model-lod-order-invalid",
        "design-attachment-unsupported",
        "design-collection-empty",
        "design-collection-cardinality-invalid",
      ] satisfies AutoMovieDiagnosticCode[]
    ).every((code) => modelContractCodes.has(code)),
  );
  TestValidator.predicate(
    "primitive props cannot silently claim an unimplemented rig",
    modelContractDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "model-parameter-unsupported" &&
        diagnostic.message.includes('"rigged"'),
    ),
  );
  TestValidator.equals(
    "stickman sockets and palette entries cannot claim discarded runtime data",
    namedFacts([
      [
        "modelContractDiagnosticsSomeDiagnostic",
        () =>
          modelContractDiagnostics.some(
            (diagnostic) =>
              diagnostic.code === "design-attachment-unsupported" &&
              diagnostic.message.includes("rightFoot"),
          ),
      ],
      [
        "aSocketOnADeclaredBoneIsAccepted",
        () =>
          modelContractDiagnostics.every(
            (diagnostic) => diagnostic.target !== "model:supported-attachment",
          ),
      ],
      [
        "modelContractDiagnosticsSomeDiagnostic2",
        () =>
          modelContractDiagnostics.some(
            (diagnostic) =>
              diagnostic.code === "design-collection-cardinality-invalid" &&
              diagnostic.target === "model:multiple-palette-materials",
          ),
      ],
    ]),
    {
      modelContractDiagnosticsSomeDiagnostic: true,
      aSocketOnADeclaredBoneIsAccepted: true,
      modelContractDiagnosticsSomeDiagnostic2: true,
    },
  );
  const validFilmFrame: IAutoMovieAcceptanceScenario = {
    ...acceptanceScenarios()[0]!,
    id: "film-signal-frame",
    target: { kind: "film", id: "fixture-film" },
    criterion: {
      kind: "frame",
      shot: "opening",
      frame: "cue-apex",
      pass: "beauty",
      expectation: "The film contains the current signal apex frame.",
    },
  };
  TestValidator.equals(
    "film criteria bind an explicit owning shot",
    validateAutoMovieProductionGraph({
      ...valid,
      acceptance: new Map([[validFilmFrame.id, validFilmFrame]]),
    }),
    [],
  );
  const ambiguousFilmEvent: IAutoMovieAcceptanceScenario = {
    ...acceptanceScenarios()[0]!,
    id: "ambiguous-film-event",
    target: { kind: "film", id: "fixture-film" },
    criterion: {
      kind: "event",
      event: "cue-raised",
      expectation: "",
    },
  };
  const missingFilmShot: IAutoMovieAcceptanceScenario = {
    ...validFilmFrame,
    id: "missing-film-shot",
    criterion: {
      kind: "frame",
      shot: "absent",
      frame: "cue-apex",
      pass: "beauty",
      expectation: "The named shot must own this frame.",
    },
  };
  const mismatchedShot: IAutoMovieAcceptanceScenario = {
    ...acceptanceScenarios()[0]!,
    id: "mismatched-shot",
    criterion: {
      kind: "frame",
      shot: "another-shot",
      frame: "cue-apex",
      pass: "beauty",
      expectation: "The target shot must own this frame.",
    },
  };
  const scopedCriteriaDiagnostics = validateAutoMovieProductionGraph({
    ...valid,
    acceptance: new Map([
      [ambiguousFilmEvent.id, ambiguousFilmEvent],
      [missingFilmShot.id, missingFilmShot],
      [mismatchedShot.id, mismatchedShot],
    ]),
  });
  TestValidator.equals(
    "ambiguous, absent and mismatched acceptance shot scopes are refused with blank expectations",
    namedFacts([
      [
        "scopedCriteriaDiagnosticsFilterDiagnostic",
        () =>
          scopedCriteriaDiagnostics.filter(
            (diagnostic) => diagnostic.code === "design-reference-missing",
          ).length === 3,
      ],
      [
        "scopedCriteriaDiagnosticsSomeDiagnostic",
        () =>
          scopedCriteriaDiagnostics.some(
            (diagnostic) => diagnostic.code === "design-text-empty",
          ),
      ],
    ]),
    {
      scopedCriteriaDiagnosticsFilterDiagnostic: true,
      scopedCriteriaDiagnosticsSomeDiagnostic: true,
    },
  );
  const predicateShot: IAutoMovieShotContract = {
    ...shotContract(),
    opening: [
      {
        id: "invalid-spatial-predicates",
        description: "These operands deliberately fail graph validation.",
        predicates: [
          {
            kind: "position",
            subject: {
              kind: "point",
              position: { x: Number.NaN, y: 0, z: 0 },
            },
            axis: "x",
            operator: "==",
            value: Number.NaN,
            tolerance: -1,
          },
          {
            kind: "position",
            subject: { kind: "formation", id: "absent-formation" },
            axis: "x",
            operator: ">=",
            value: 0,
            tolerance: Number.NaN,
          },
          {
            kind: "distance",
            from: { kind: "landmark", id: "absent-landmark" },
            to: { kind: "node", id: "" },
            operator: "<=",
            value: 1,
            tolerance: 0,
          },
          {
            kind: "joint-angle",
            actor: "",
            bone: "hips",
            axis: "twist",
            operator: "==",
            value: 0,
            tolerance: 0,
          },
        ],
      },
    ],
  };
  const predicateDiagnostics = validateAutoMovieProductionGraph({
    ...valid,
    shots: new Map([[predicateShot.id, predicateShot]]),
  });
  TestValidator.equals(
    "typed predicates validate point vectors, graph selectors, scalar bounds and actor text",
    namedFacts([
      [
        "predicateDiagnosticsDiagnosticDiagnostic",
        () =>
          predicateDiagnostics.filter(
            (diagnostic) => diagnostic.code === "design-reference-missing",
          ).length === 2,
      ],
      [
        "predicateDiagnosticsDiagnosticDiagnostic2",
        () =>
          predicateDiagnostics.some(
            (diagnostic) => diagnostic.code === "design-range-invalid",
          ),
      ],
      [
        "predicateDiagnosticsDiagnosticDiagnostic3",
        () =>
          predicateDiagnostics.some(
            (diagnostic) => diagnostic.code === "design-text-empty",
          ),
      ],
    ]),
    {
      predicateDiagnosticsDiagnosticDiagnostic: true,
      predicateDiagnosticsDiagnosticDiagnostic2: true,
      predicateDiagnosticsDiagnosticDiagnostic3: true,
    },
  );
};
