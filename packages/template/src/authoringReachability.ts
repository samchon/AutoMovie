import type {
  IAutoMovieActionCall,
  IAutoMovieExternalMotionAdoptionMode,
  IAutoMovieProductionDesign,
} from "@automovie/interface";

/**
 * Production shapes whose authoring routes are published by the scaffold.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Keeps the shape selector inside the same public route inventory the author queries.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Types the closed shape dimension of every capability row.
 */
export type AutoMovieAuthoringProductionKind = "film" | "brief" | "library";

type AutoMovieCameraAction = Extract<
  IAutoMovieActionCall,
  { verb: "frame" }
>["move"];

/**
 * Closed literal vocabularies, each pinned to the interface union it publishes.
 *
 * `satisfies Record<Union, true>` fails to compile when the interface gains or
 * loses a literal, so the route matrix cannot advertise a choice the compiler
 * does not accept or hide one it does.
 */
const CAMERA_ACTION_REGISTRY = {
  static: true,
  follow: true,
  orbit: true,
  "push-in": true,
  truck: true,
  whip: true,
} satisfies Record<AutoMovieCameraAction, true>;

const VISUAL_DELIVERY_REGISTRY = {
  deterministic: true,
  repainted: true,
  mixed: true,
} satisfies Record<IAutoMovieProductionDesign["visualDelivery"], true>;

const EXTERNAL_MOTION_MODE_REGISTRY = {
  native: true,
  "humanoid-retarget": true,
} satisfies Record<IAutoMovieExternalMotionAdoptionMode["kind"], true>;

const RENDER_TIER_REGISTRY = {
  proxy: true,
  final: true,
} satisfies Record<
  keyof NonNullable<IAutoMovieProductionDesign["renderTiers"]>,
  true
>;

/**
 * Closed camera-action vocabulary consumed by the shot compiler.
 *
 * @evidence requirements/product/authorability.md#product-explicit-control Gives the author the exact executable camera literals instead of broader film terminology.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Publishes the compiler-supported camera choices through the authoring route.
 */
export const AUTO_MOVIE_CAMERA_ACTIONS: readonly AutoMovieCameraAction[] =
  Object.freeze(Object.keys(CAMERA_ACTION_REGISTRY) as AutoMovieCameraAction[]);

const VISUAL_DELIVERIES = Object.freeze(Object.keys(VISUAL_DELIVERY_REGISTRY));
const EXTERNAL_MOTION_MODES = Object.freeze(
  Object.keys(EXTERNAL_MOTION_MODE_REGISTRY),
);
const RENDER_TIERS = Object.freeze(Object.keys(RENDER_TIER_REGISTRY));

/**
 * Versioned byte-inspection profiles the generated `external:inspect` command
 * accepts. `@automovie/ingest` owns the runtime vocabulary; the template cannot
 * depend on it, so this copy is held equal to that export by the route test.
 */
const EXTERNAL_MODEL_INSPECTION_PROFILES = Object.freeze([
  "gltf-static-v1",
  "gltf-humanoid-v1",
  "gltf-motion-v1",
  "vrm-humanoid-v1",
]);

type AutoMovieProductionDesignField = keyof IAutoMovieProductionDesign;

type AutoMovieAuthoringCapability =
  | "settings"
  | "design-branches"
  | "production-design-field"
  | "production-sources"
  | "film-sources"
  | "external-model-inspection"
  | "acceptance"
  | "examples"
  | "camera-actions";

type AutoMovieAuthoringRoute =
  | ".agents/skills/production-lifecycle/settings.md"
  | ".agents/skills/production-lifecycle/configuration.md"
  | ".agents/skills/production-lifecycle/screenplays.md"
  | ".agents/skills/production-lifecycle/briefs.md"
  | ".agents/skills/source-authoring/index.md"
  | ".agents/skills/source-authoring/design-branches.md"
  | ".agents/skills/source-authoring/compilation.md"
  | ".agents/skills/source-authoring/models-and-motions.md"
  | ".agents/skills/source-authoring/composition.md"
  | ".agents/skills/source-authoring/cinematography.md"
  | ".agents/skills/source-authoring/sound.md"
  | ".agents/skills/source-authoring/spatial-design.md";

/**
 * One public capability's complete route from author decision to consumer.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Carries the fields needed to prove that a capability is reachable.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Distinguishes a complete route from a truthful inapplicability reason.
 */
export interface IAutoMovieAuthoringReachabilityRow {
  /** Addressable capability family. */
  capability: AutoMovieAuthoringCapability;
  /** Closed executable choices when the capability has a literal vocabulary. */
  choices: readonly string[] | null;
  /** Runtime or compiler symbol that consumes the authored value. */
  consumer: string | null;
  /** Production-design field, only for a field-level row. */
  field: AutoMovieProductionDesignField | null;
  /** Concrete reason the selected production kind cannot use this row. */
  inapplicableReason: string | null;
  /** Production shape to which the row applies. */
  kind: AutoMovieAuthoringProductionKind;
  /** Generated-project document or source location that owns the decision. */
  owner: string | null;
  /** Generated-project skill that teaches the author how to reach the owner. */
  route: AutoMovieAuthoringRoute | null;
  /** Concrete emitter or record that carries the authored decision. */
  serializer: string | null;
}

interface IAuthoringRouteDefinition {
  choices?: readonly string[];
  consumer: string;
  owner: string;
  route: AutoMovieAuthoringRoute;
  serializer: string;
}

interface IProductionFieldRouteDefinition {
  choices?: readonly string[];
  consumer: string;
  route: AutoMovieAuthoringRoute;
}

const KIND_REGISTRY = {
  film: true,
  brief: true,
  library: true,
} satisfies Record<AutoMovieAuthoringProductionKind, true>;

/**
 * Every production shape the route matrix answers for, in ladder order.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Publishes the closed shape vocabulary the route query accepts.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Keeps the runtime kind inventory equal to the typed shape dimension.
 */
export const AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS: readonly AutoMovieAuthoringProductionKind[] =
  Object.freeze(
    Object.keys(KIND_REGISTRY) as AutoMovieAuthoringProductionKind[],
  );

/**
 * Whether an untyped selection names one production shape the matrix covers.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Lets a command refuse a shape the matrix does not publish instead of printing an empty route set.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Decides shape membership from the same closed inventory the matrix is built from.
 */
export const isAutoMovieAuthoringProductionKind = (
  value: unknown,
): value is AutoMovieAuthoringProductionKind =>
  typeof value === "string" && Object.hasOwn(KIND_REGISTRY, value);

const KINDS = AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS;

/**
 * The production design record is authored in `src/production.ts`, published
 * by the generated `scripts/emitDesign.ts`, and read back only by the timed
 * compile. `AutoMovieProductionCompiler.run` dispatches a library to
 * `runLibrary` before the record is opened, so every field row below is
 * applicable to film and brief alike and inapplicable to a library.
 */
const PRODUCTION_DESIGN_OWNER = "docs/settings -> src/production.ts";
const PRODUCTION_DESIGN_SERIALIZER =
  "scripts/emitDesign.ts -> AutoMovieProductionProject.setProductionDesign";

const field = (
  consumer: string,
  route: AutoMovieAuthoringRoute,
  choices?: readonly string[],
): IProductionFieldRouteDefinition => ({
  ...(choices === undefined ? {} : { choices }),
  consumer,
  route,
});

const PRODUCTION_DESIGN_FIELD_ROUTES = {
  id: field(
    "AutoMovieProductionProject.setProductionDesign production address gate and AutoMovieProductionCompiler film identity",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  title: field(
    "validateProductionDesign non-blank text gate",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  logline: field(
    "validateProductionDesign non-blank text gate",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  targetRuntimeSeconds: field(
    "AutoMovieProductionCompiler film runtime and caption verification",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  visualDelivery: field(
    "AutoMovieProductionCompiler delivery-lane planner and scripts/renderPublicationRuntime.ts",
    ".agents/skills/production-lifecycle/configuration.md",
    VISUAL_DELIVERIES,
  ),
  visualDeliveryLanes: field(
    "AutoMovieProductionCompiler occurrence-lane planner",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  mixedVisualDeliveryPolicy: field(
    "AutoMovieProductionCompiler lane-crossing verifier",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  storyClock: field(
    "validateProductionDesign story-pin admission and @automovie/engine autoMovieStoryTime",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  lighting: field(
    "AutoMovieProductionCompiler shot build context and @automovie/engine production lighting sampler",
    ".agents/skills/source-authoring/cinematography.md",
  ),
  renderBudgets: field(
    "scripts/renderBudgetSnapshot.ts budget preflight",
    ".agents/skills/source-authoring/composition.md",
  ),
  externalMotions: field(
    "AutoMovieProductionCompiler external motion admission",
    ".agents/skills/source-authoring/models-and-motions.md",
    EXTERNAL_MOTION_MODES,
  ),
  captionReadabilityProfiles: field(
    "openAutoMovieProduction caption readability verdicts",
    ".agents/skills/source-authoring/sound.md",
  ),
  sound: field(
    "AutoMovieProductionCompiler sound planning and scripts/renderSoundRuntime.ts",
    ".agents/skills/source-authoring/sound.md",
  ),
  renderTiers: field(
    "scripts/productionConfiguration.ts render tier selection",
    ".agents/skills/production-lifecycle/configuration.md",
    RENDER_TIERS,
  ),
  repaint: field(
    "AutoMovieProductionRepaintService and scripts/repaint.ts",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  simulation: field(
    "scripts/productionConfiguration.ts soft-body admission and scripts/generatedShotPlugin.ts",
    ".agents/skills/source-authoring/design-branches.md",
  ),
  environmentContext: field(
    "AutoMovieProductionCompiler environment analyses",
    ".agents/skills/source-authoring/spatial-design.md",
  ),
  frameFormat: field(
    "AutoMovieProductionCompiler frame clock, productionRenderJob, and scripts/renderPlanningRuntime.ts",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  artDirection: field(
    "validateProductionDesign art-direction gate",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  deliverables: field(
    "AutoMovieProductionCompiler deliverable contracts and productionRenderJob",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
} satisfies Record<
  AutoMovieProductionDesignField,
  IProductionFieldRouteDefinition
>;

const BASE_ROUTE_DEFINITIONS = {
  settings: {
    owner: "docs/settings",
    serializer: "Markdown H2 evidence hosts",
    consumer: "@automovie/evidence production graph",
    route: ".agents/skills/production-lifecycle/settings.md",
  },
  "design-branches": {
    owner:
      "docs/{maps,models,spaces,materials,instances,motions,systems} -> src/<branch>",
    serializer: "scripts/emitDesign.ts records and reviewed source-owner exports",
    consumer: "AutoMovieProductionCompiler source scope",
    route: ".agents/skills/source-authoring/design-branches.md",
  },
  "production-sources": {
    owner: "src/production.ts",
    serializer: "lint.config.ts productionSources source-owner bindings",
    consumer: "AutoMovieProductionCompiler",
    route: ".agents/skills/source-authoring/compilation.md",
  },
  "external-model-inspection": {
    choices: EXTERNAL_MODEL_INSPECTION_PROFILES,
    owner: "public assets registered in automovie/assets.json",
    serializer: "npm run external:inspect -- <project-path> --profile <profile>",
    consumer:
      "automovie/assets.json provenance and the author's explicit model or motion adoption record",
    route: ".agents/skills/source-authoring/models-and-motions.md",
  },
  examples: {
    owner: "src/examples",
    serializer: "typed TypeScript exports",
    consumer:
      "production-owned source adaptation; never imported by delivered source",
    route: ".agents/skills/source-authoring/index.md",
  },
} satisfies Record<
  Exclude<
    AutoMovieAuthoringCapability,
    | "production-design-field"
    | "film-sources"
    | "acceptance"
    | "camera-actions"
  >,
  IAuthoringRouteDefinition
>;

const applicable = (
  kind: AutoMovieAuthoringProductionKind,
  capability: AutoMovieAuthoringCapability,
  definition: IAuthoringRouteDefinition,
  designField: AutoMovieProductionDesignField | null = null,
): IAutoMovieAuthoringReachabilityRow => ({
  capability,
  choices: definition.choices ?? null,
  consumer: definition.consumer,
  field: designField,
  inapplicableReason: null,
  kind,
  owner: definition.owner,
  route: definition.route,
  serializer: definition.serializer,
});

const inapplicable = (
  kind: AutoMovieAuthoringProductionKind,
  capability: AutoMovieAuthoringCapability,
  reason: string,
  designField: AutoMovieProductionDesignField | null = null,
): IAutoMovieAuthoringReachabilityRow => ({
  capability,
  choices: null,
  consumer: null,
  field: designField,
  inapplicableReason: reason,
  kind,
  owner: null,
  route: null,
  serializer: null,
});

const fieldRows = (
  kind: AutoMovieAuthoringProductionKind,
): IAutoMovieAuthoringReachabilityRow[] =>
  (
    Object.entries(PRODUCTION_DESIGN_FIELD_ROUTES) as Array<
      [AutoMovieProductionDesignField, IProductionFieldRouteDefinition]
    >
  ).map(([name, definition]) =>
    kind === "library"
      ? inapplicable(
          kind,
          "production-design-field",
          `A library compiles its selected design and source branches directly; no library path reads production-design.${name}.`,
          name,
        )
      : applicable(
          kind,
          "production-design-field",
          {
            ...definition,
            owner: PRODUCTION_DESIGN_OWNER,
            serializer: PRODUCTION_DESIGN_SERIALIZER,
          },
          name,
        ),
  );

const timedRows = (
  kind: "film" | "brief",
): IAutoMovieAuthoringReachabilityRow[] => [
  applicable(kind, "film-sources", {
    owner: kind === "film" ? "docs/screenplays" : "docs/briefs",
    serializer: "src/shots/**/*.ts and src/film.ts",
    consumer: "AutoMovieProductionCompiler edit assembly",
    route:
      kind === "film"
        ? ".agents/skills/production-lifecycle/screenplays.md"
        : ".agents/skills/production-lifecycle/briefs.md",
  }),
  applicable(kind, "acceptance", {
    owner: "acceptance scenario exports beside src/shots/**/*.ts",
    serializer:
      "scripts/emitDesign.ts -> AutoMovieProductionProject.setAcceptanceScenario",
    consumer: "AutoMovieProductionCompiler review and final scopes",
    route: ".agents/skills/source-authoring/compilation.md",
  }),
  applicable(kind, "camera-actions", {
    choices: AUTO_MOVIE_CAMERA_ACTIONS,
    owner: "src/shots/**/*.ts frame actions",
    serializer: 'IAutoMovieActionCall verb "frame" move',
    consumer: "@automovie/engine compileCameraMove",
    route: ".agents/skills/source-authoring/cinematography.md",
  }),
];

const LIBRARY_ROWS: IAutoMovieAuthoringReachabilityRow[] = [
  inapplicable(
    "library",
    "film-sources",
    "A library has no timed edit or film-source population.",
  ),
  inapplicable(
    "library",
    "acceptance",
    "A library has no shot or film to target; npm run library:review records its observation receipts.",
  ),
  inapplicable(
    "library",
    "camera-actions",
    "A library has no shot camera; neutral inspection owns its views.",
  ),
];

const commonRows = (
  kind: AutoMovieAuthoringProductionKind,
): IAutoMovieAuthoringReachabilityRow[] =>
  Object.entries(BASE_ROUTE_DEFINITIONS).map(([capability, definition]) =>
    applicable(
      kind,
      capability as keyof typeof BASE_ROUTE_DEFINITIONS,
      definition,
    ),
  );

/**
 * Canonical production-kind capability matrix shipped to every author.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Makes every supported capability reachable through a named author route rather than package archaeology.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Publishes owner, serializer, consumer, and truthful inapplicability as one typed answer.
 */
export const AUTO_MOVIE_AUTHORING_REACHABILITY: readonly IAutoMovieAuthoringReachabilityRow[] =
  Object.freeze(
    KINDS.flatMap((kind) => [
      ...commonRows(kind),
      ...(kind === "library" ? LIBRARY_ROWS : timedRows(kind)),
      ...fieldRows(kind),
    ]).map((row) => Object.freeze(row)),
  );

const FIELDS = Object.keys(
  PRODUCTION_DESIGN_FIELD_ROUTES,
) as AutoMovieProductionDesignField[];
const CAPABILITIES: readonly AutoMovieAuthoringCapability[] = [
  ...(Object.keys(BASE_ROUTE_DEFINITIONS) as Array<
    keyof typeof BASE_ROUTE_DEFINITIONS
  >),
  "film-sources",
  "acceptance",
  "camera-actions",
  "production-design-field",
];

const rowKey = (row: {
  capability: AutoMovieAuthoringCapability;
  field: AutoMovieProductionDesignField | null;
  kind: AutoMovieAuthoringProductionKind;
}): string =>
  `${row.kind}:${row.capability}${row.field === null ? "" : `:${row.field}`}`;

/** Every kind, capability, and field-level address the matrix must answer. */
const EXPECTED_ROW_KEYS: ReadonlySet<string> = new Set(
  KINDS.flatMap((kind) =>
    CAPABILITIES.flatMap((capability) =>
      capability === "production-design-field"
        ? FIELDS.map((designField) =>
            rowKey({ capability, field: designField, kind }),
          )
        : [rowKey({ capability, field: null, kind })],
    ),
  ),
);

const blank = (value: string | null): boolean =>
  value === null || value.trim().length === 0;

/**
 * Reject a capability matrix that hides a missing route as applicability.
 *
 * @evidence requirements/product/authorability.md#product-hidden-inference-refusal Refuses rows whose missing owner or consumer would force the author to guess.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Returns stable, located route diagnostics.
 */
export const inspectAutoMovieAuthoringReachability = (
  rows: readonly IAutoMovieAuthoringReachabilityRow[],
): string[] => {
  const findings: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = rowKey(row);
    if (seen.has(key)) findings.push(`${key} is duplicated.`);
    seen.add(key);
    if (EXPECTED_ROW_KEYS.has(key) === false)
      findings.push(`${key} is not a supported kind, capability, or field.`);
    if (
      row.choices !== null &&
      (row.choices.length === 0 ||
        row.choices.some(
          (choice, index) =>
            choice.trim().length === 0 || row.choices!.indexOf(choice) !== index,
        ))
    )
      findings.push(`${key} has invalid closed choices.`);
    if (row.inapplicableReason === null) {
      for (const [name, value] of [
        ["owner", row.owner],
        ["serializer", row.serializer],
        ["consumer", row.consumer],
        ["route", row.route],
      ] as const)
        if (blank(value)) findings.push(`${key} has no ${name}.`);
      if (row.owner !== null && /(^|\/)packages\//u.test(row.owner))
        findings.push(
          `${key} names a repository path instead of its generated-project owner.`,
        );
    } else {
      if (blank(row.inapplicableReason))
        findings.push(`${key} has a blank inapplicable reason.`);
      if (
        row.choices !== null ||
        row.owner !== null ||
        row.serializer !== null ||
        row.consumer !== null ||
        row.route !== null
      )
        findings.push(`${key} mixes an inapplicable reason with a route.`);
    }
  }
  for (const expected of EXPECTED_ROW_KEYS)
    if (seen.has(expected) === false) findings.push(`${expected} is missing.`);
  return findings;
};
