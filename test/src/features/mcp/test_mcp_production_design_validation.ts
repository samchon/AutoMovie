import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
} from "@automovie/interface";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/** Every bounded design family emits actionable graph diagnostics. */
export const test_mcp_production_design_validation = (): void => {
  const valid: IAutoMovieProductionDesignGraph = {
    production: productionDesign(),
    models: new Map([["sentinel", modelRecipe()]]),
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
      { id: "", bone: "" },
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
    effectZones: [
      {
        id: "",
        kind: "fog" as const,
        bounds: {
          min: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
          max: { x: 0, y: 0, z: 0 },
        },
        seed: -1,
      },
      {
        id: "",
        kind: "dust" as const,
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
    layout: { kind: "line", ranks: 0, files: 0 },
    spacing: { lateral: 0, depth: Number.NaN },
    anchor: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
    facingDeg: Number.NaN,
    seed: -1,
    capabilities: ["hold", "hold"],
    heroOverrides: [
      { slot: -1, actor: "" },
      { slot: -1, actor: "duplicate" },
    ],
  };
  const invalidShot = {
    ...shotContract(),
    id: "",
    beat: "",
    source: { module: "", export: "" },
    durationSeconds: 0,
    participants: [
      { kind: "formation" as const, id: "absent" },
      { kind: "formation" as const, id: "absent" },
      { kind: "actor" as const, id: "" },
    ],
    opening: [
      { id: "", description: "" },
      { id: "", description: "duplicate" },
    ],
    closing: [
      { id: "", description: "" },
      { id: "", description: "duplicate" },
    ],
    camera: {
      ...shotContract().camera,
      intent: "",
      requiredSubjects: ["", ""],
      maxOcclusionRatio: Number.NaN,
    },
    events: [
      {
        id: "",
        kind: "reveal" as const,
        window: { from: 2, to: 1 },
        subjects: ["", ""],
      },
      {
        id: "",
        kind: "contact" as const,
        window: { from: -1, to: 99 },
        subjects: [],
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
        frame: "signal-apex",
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
          ...formationDesign({ kind: "column", ranks: 1, files: 1 }),
          id: "column",
        },
      ],
      [
        "wedge",
        {
          ...formationDesign({ kind: "wedge", depth: 0 }),
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
  TestValidator.predicate(
    "invalid mega-graph exercises every diagnostic family",
    diagnostics.length > 50 &&
      [
        "design-identity-mismatch",
        "design-range-invalid",
        "design-duplicate-id",
        "design-collection-empty",
        "design-text-empty",
        "design-reference-missing",
        "model-parameter-unsupported",
        "model-parameter-invalid",
      ].every((code) => codes.has(code)),
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
      frame: "signal-apex",
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
  const modelContractDiagnostics = validateAutoMovieProductionGraph({
    ...valid,
    models: new Map([
      [invalidLod.id, invalidLod],
      [invalidPrimitive.id, invalidPrimitive],
      [unknownPrimitive.id, unknownPrimitive],
      [missingPrimitive.id, missingPrimitive],
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
    [
      "model-parameter-missing",
      "model-parameter-invalid",
      "model-parameter-unsupported",
      "model-lod-order-invalid",
      "design-collection-empty",
    ].every((code) => modelContractCodes.has(code)),
  );
  const validFilmFrame: IAutoMovieAcceptanceScenario = {
    ...acceptanceScenarios()[0]!,
    id: "film-signal-frame",
    target: { kind: "film", id: "fixture-film" },
    criterion: {
      kind: "frame",
      shot: "opening",
      frame: "signal-apex",
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
      event: "signal-raised",
      expectation: "",
    },
  };
  const missingFilmShot: IAutoMovieAcceptanceScenario = {
    ...validFilmFrame,
    id: "missing-film-shot",
    criterion: {
      kind: "frame",
      shot: "absent",
      frame: "signal-apex",
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
      frame: "signal-apex",
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
  TestValidator.predicate(
    "ambiguous, absent and mismatched acceptance shot scopes are refused with blank expectations",
    scopedCriteriaDiagnostics.filter(
      (diagnostic) => diagnostic.code === "design-reference-missing",
    ).length === 3 &&
      scopedCriteriaDiagnostics.some(
        (diagnostic) => diagnostic.code === "design-text-empty",
      ),
  );
};
