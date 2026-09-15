import { AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES } from "@automovie/ingest";
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
 * loses a literal, so the route matrix cannot advertise a choice the builder
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
 * Closed camera-action vocabulary consumed by the shot builder.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Publishes the exact executable camera literals as the queryable choice set instead of broader film terminology.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Makes the builder-supported camera choices discoverable through the authoring route.
 */
export const AUTO_MOVIE_CAMERA_ACTIONS: readonly AutoMovieCameraAction[] =
  Object.freeze(Object.keys(CAMERA_ACTION_REGISTRY) as AutoMovieCameraAction[]);

const VISUAL_DELIVERIES = Object.freeze(Object.keys(VISUAL_DELIVERY_REGISTRY));
const EXTERNAL_MOTION_MODES = Object.freeze(
  Object.keys(EXTERNAL_MOTION_MODE_REGISTRY),
);
const RENDER_TIERS = Object.freeze(Object.keys(RENDER_TIER_REGISTRY));

type AutoMovieProductionDesignField = keyof IAutoMovieProductionDesign;

type AutoMovieAuthoringCapability =
  | "settings"
  | "design-branches"
  | "production-design-field"
  | "production-sources"
  | "film-sources"
  | "external-model-inspection"
  | "acceptance"
  | "camera-actions";

type AutoMovieAuthoringRoute =
  | ".agents/skills/production-lifecycle/settings.md"
  | ".agents/skills/production-lifecycle/configuration.md"
  | ".agents/skills/production-lifecycle/screenplays.md"
  | ".agents/skills/production-lifecycle/naturalness.md"
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
 * Runtime copy of the route union, so a row handed to the inspector at runtime
 * is held to the same closed document set the type admits at compile time.
 */
const ROUTE_REGISTRY = {
  ".agents/skills/production-lifecycle/settings.md": true,
  ".agents/skills/production-lifecycle/configuration.md": true,
  ".agents/skills/production-lifecycle/screenplays.md": true,
  ".agents/skills/production-lifecycle/naturalness.md": true,
  ".agents/skills/production-lifecycle/briefs.md": true,
  ".agents/skills/source-authoring/index.md": true,
  ".agents/skills/source-authoring/design-branches.md": true,
  ".agents/skills/source-authoring/compilation.md": true,
  ".agents/skills/source-authoring/models-and-motions.md": true,
  ".agents/skills/source-authoring/composition.md": true,
  ".agents/skills/source-authoring/cinematography.md": true,
  ".agents/skills/source-authoring/sound.md": true,
  ".agents/skills/source-authoring/spatial-design.md": true,
} satisfies Record<AutoMovieAuthoringRoute, true>;

/**
 * One public capability's complete route from author decision to consumer.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Carries the owner, input, consumer, and route fields one capability needs to be provably reachable, or its concrete inapplicable reason.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Is the typed row the production-kind route query returns.
 * @author Samchon
 */
export interface IAutoMovieAuthoringReachabilityRow {
  /** Addressable capability family. */
  capability: AutoMovieAuthoringCapability;
  /** Closed executable choices when the capability has a literal vocabulary. */
  choices: readonly string[] | null;
  /** Runtime or builder symbol that consumes the authored value. */
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
  /** Typed value or document passed directly to the named public consumer. */
  input: string | null;
}

interface IAuthoringRouteDefinition {
  choices?: readonly string[];
  consumer: string;
  owner: string;
  route: AutoMovieAuthoringRoute;
  input: string;
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
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Decides shape membership from the same closed inventory the route query is built from.
 */
export const isAutoMovieAuthoringProductionKind = (
  value: unknown,
): value is AutoMovieAuthoringProductionKind =>
  typeof value === "string" && Object.hasOwn(KIND_REGISTRY, value);

const KINDS = AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS;

/**
 * Design rows describe source values and the public APIs that accept them.
 * They do not promise an installed emitter, fixed source filename, serialized
 * project store, or ready-made renderer. A project authors its own composition
 * and passes these values to the selected validation or runtime boundary.
 */
const PRODUCTION_DESIGN_OWNER =
  "docs/settings and project-authored source under src";
const PRODUCTION_DESIGN_INPUT =
  "@automovie/interface IAutoMovieProductionDesign value in a caller-owned design graph";

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
    "@automovie/production validateAutoMovieProductionGraph identity validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  title: field(
    "@automovie/production validateAutoMovieProductionGraph text validation",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  logline: field(
    "@automovie/production validateAutoMovieProductionGraph text validation",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  targetRuntimeSeconds: field(
    "@automovie/production validateAutoMovieProductionGraph runtime validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  visualDelivery: field(
    "@automovie/production validateAutoMovieProductionGraph delivery configuration validation",
    ".agents/skills/production-lifecycle/configuration.md",
    VISUAL_DELIVERIES,
  ),
  visualDeliveryLanes: field(
    "@automovie/production validateAutoMovieProductionGraph occurrence-lane validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  mixedVisualDeliveryPolicy: field(
    "@automovie/production validateAutoMovieProductionGraph lane-crossing validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  storyClock: field(
    "@automovie/engine autoMovieStoryTime",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  lighting: field(
    "@automovie/engine resolveProductionLighting",
    ".agents/skills/source-authoring/cinematography.md",
  ),
  renderBudgets: field(
    "@automovie/render assessAutoMovieRenderBudget",
    ".agents/skills/source-authoring/composition.md",
  ),
  externalMotions: field(
    "@automovie/ingest adoptAutoMovieExternalMotion",
    ".agents/skills/source-authoring/models-and-motions.md",
    EXTERNAL_MOTION_MODES,
  ),
  captionReadabilityProfiles: field(
    "@automovie/production validateAutoMovieProductionGraph caption profile validation",
    ".agents/skills/source-authoring/sound.md",
  ),
  sound: field(
    "@automovie/engine deriveProductionSoundPlan",
    ".agents/skills/source-authoring/sound.md",
  ),
  renderTiers: field(
    "@automovie/production validateAutoMovieProductionGraph render tier validation",
    ".agents/skills/production-lifecycle/configuration.md",
    RENDER_TIERS,
  ),
  repaint: field(
    "@automovie/production validateAutoMovieProductionGraph repaint configuration validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  simulation: field(
    "@automovie/production validateAutoMovieProductionGraph simulation configuration validation",
    ".agents/skills/source-authoring/design-branches.md",
  ),
  environmentContext: field(
    "@automovie/engine validateAutoMovieEnvironmentContext",
    ".agents/skills/source-authoring/spatial-design.md",
  ),
  frameFormat: field(
    "@automovie/engine resolveProductionFrameRate",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  artDirection: field(
    "@automovie/production validateAutoMovieProductionGraph art-direction validation",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  deliverables: field(
    "@automovie/production validateAutoMovieProductionGraph deliverable validation",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
} satisfies Record<
  AutoMovieProductionDesignField,
  IProductionFieldRouteDefinition
>;

const BASE_ROUTE_DEFINITIONS = {
  settings: {
    owner: "docs/settings",
    input: "Markdown H2 evidence hosts",
    consumer: "@automovie/evidence production graph",
    route: ".agents/skills/production-lifecycle/settings.md",
  },
  "design-branches": {
    owner:
      "docs/{maps,models,spaces,materials,instances,motions,systems} -> src/<branch>",
    input:
      "reviewed TypeScript values passed directly to selected package APIs",
    consumer:
      "@automovie/engine geometry, material, spatial, instance and motion APIs",
    route: ".agents/skills/source-authoring/design-branches.md",
  },
  "production-sources": {
    owner: "project-authored TypeScript modules under src",
    input:
      "src/lint.config.ts source populations and their typed source exports",
    consumer:
      "@automovie/evidence source graph and selected public runtime APIs",
    route: ".agents/skills/source-authoring/compilation.md",
  },
  "external-model-inspection": {
    choices: AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES,
    owner: "project-owned external bytes and their reviewed source adoption",
    input: "exact source bytes and an explicit inspection profile",
    consumer:
      "@automovie/ingest inspectAutoMovieExternalModelBytes; automovie inspect-external",
    route: ".agents/skills/source-authoring/models-and-motions.md",
  },
} satisfies Record<
  Exclude<
    AutoMovieAuthoringCapability,
    "production-design-field" | "film-sources" | "acceptance" | "camera-actions"
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
  input: definition.input,
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
  input: null,
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
          `A library selects reusable source capabilities rather than a timed-production design; production-design.${name} belongs to that timed composition.`,
          name,
        )
      : applicable(
          kind,
          "production-design-field",
          {
            ...definition,
            owner: PRODUCTION_DESIGN_OWNER,
            input: PRODUCTION_DESIGN_INPUT,
          },
          name,
        ),
  );

const timedRows = (
  kind: "film" | "brief",
): IAutoMovieAuthoringReachabilityRow[] => [
  applicable(kind, "film-sources", {
    owner: kind === "film" ? "docs/final/screenplays" : "docs/briefs",
    input: "IAutoMovieDefinedShot exports and caller-owned sequence inputs",
    consumer: "@automovie/engine compileDefinedShot and cutSequence",
    route:
      kind === "film"
        ? ".agents/skills/production-lifecycle/naturalness.md"
        : ".agents/skills/production-lifecycle/briefs.md",
  }),
  applicable(kind, "acceptance", {
    owner: "project-authored shot contracts and review expectations under src",
    input:
      "IAutoMovieDefinedShot registration, build callback, context and runtime",
    consumer: "@automovie/engine compileDefinedShot contract realization",
    route: ".agents/skills/source-authoring/compilation.md",
  }),
  applicable(kind, "camera-actions", {
    choices: AUTO_MOVIE_CAMERA_ACTIONS,
    owner: "project-authored frame actions under src",
    input: 'IAutoMovieActionCall verb "frame" move',
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
    "A library has no shot or film to target.",
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
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Publishes owner, input, consumer, and truthful inapplicability as one typed answer.
 */
export const AUTO_MOVIE_AUTHORING_REACHABILITY: readonly IAutoMovieAuthoringReachabilityRow[] =
  Object.freeze(
    KINDS.flatMap((kind) => [
      ...commonRows(kind),
      ...(kind === "library" ? LIBRARY_ROWS : timedRows(kind)),
      ...fieldRows(kind),
    ]).map((row) => Object.freeze(row)),
  );

const FIELDS: ReadonlySet<string> = new Set(
  Object.keys(PRODUCTION_DESIGN_FIELD_ROUTES),
);
const CAPABILITIES: ReadonlySet<string> = new Set<AutoMovieAuthoringCapability>(
  [
    ...(Object.keys(BASE_ROUTE_DEFINITIONS) as Array<
      keyof typeof BASE_ROUTE_DEFINITIONS
    >),
    "film-sources",
    "acceptance",
    "camera-actions",
    "production-design-field",
  ],
);
const ROUTES: ReadonlySet<string> = new Set(Object.keys(ROUTE_REGISTRY));

const rowKey = (row: {
  capability: AutoMovieAuthoringCapability;
  field: AutoMovieProductionDesignField | null;
  kind: AutoMovieAuthoringProductionKind;
}): string =>
  `${row.kind}:${row.capability}${row.field === null ? "" : `:${row.field}`}`;

/** Every kind, capability, and field-level address the matrix must answer. */
const EXPECTED_ROW_KEYS: ReadonlySet<string> = new Set(
  KINDS.flatMap((kind) =>
    [...CAPABILITIES].flatMap((capability) =>
      capability === "production-design-field"
        ? [...FIELDS].map((designField) =>
            rowKey({
              capability,
              field: designField as AutoMovieProductionDesignField,
              kind,
            }),
          )
        : [
            rowKey({
              capability: capability as AutoMovieAuthoringCapability,
              field: null,
              kind,
            }),
          ],
    ),
  ),
);

const blank = (value: string | null): boolean =>
  value === null || value.trim().length === 0;

/**
 * Reject a capability matrix that hides a missing route as applicability.
 *
 * Every finding names the row it was observed on, so the command that prints
 * the matrix can refuse the whole answer rather than publish a route an author
 * would have to complete by guessing.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Refuses to claim a capability whose owner, input, consumer, or route the author could not find, and refuses an absent capability presented as a blank path.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Diagnoses blank supported fields, duplicated kind and capability addresses, and inapplicable rows that also claim a route.
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
    if (isAutoMovieAuthoringProductionKind(row.kind) === false)
      findings.push(
        `${key} names unknown production kind ${JSON.stringify(row.kind)}.`,
      );
    if (CAPABILITIES.has(row.capability) === false)
      findings.push(
        `${key} names unknown capability ${JSON.stringify(row.capability)}.`,
      );
    else if (row.capability === "production-design-field") {
      if (row.field === null || FIELDS.has(row.field) === false)
        findings.push(`${key} must name one production design field.`);
    } else if (row.field !== null)
      findings.push(`${key} takes no production design field.`);
    if (
      row.choices !== null &&
      (row.choices.length === 0 ||
        row.choices.some(
          (choice, index) =>
            choice.trim().length === 0 ||
            row.choices!.indexOf(choice) !== index,
        ))
    )
      findings.push(`${key} has invalid closed choices.`);
    if (row.inapplicableReason === null) {
      for (const [name, value] of [
        ["owner", row.owner],
        ["input", row.input],
        ["consumer", row.consumer],
        ["route", row.route],
      ] as const)
        if (blank(value)) findings.push(`${key} has no ${name}.`);
      if (row.route !== null && ROUTES.has(row.route) === false)
        findings.push(
          `${key} names unknown generated-project route ${JSON.stringify(row.route)}.`,
        );
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
        row.input !== null ||
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
