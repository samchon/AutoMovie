import {
  type ITtscEvidenceGraphClaim,
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
} from "@ttsc/evidence";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/**
 * A generated production's mutually exclusive evidence topology.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes one of the three project-owned production shapes admitted by the shared contract.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the production shape one explicit value in the generated project's sole lint configuration.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries the production-shape portion of the reusable configuration contract.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Supplies the declared film, brief, or library state to the reusable graph factory.
 * @evidencePart specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state::visible-selection Implements the closed production-kind field of the complete visible declaration.
 */
export type AutoMovieProductionKind = "brief" | "film" | "library";

/**
 * One authoring branch's current enforcement state.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes the branch lifecycle used by every generated production shape.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes every branch stage visible in the generated project's sole lint configuration.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries the lifecycle portion of the reusable configuration contract.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Supplies the closed disabled, draft, evidence, and review lifecycle states.
 * @evidencePart specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state::visible-selection Implements the closed lifecycle field used by every visible branch declaration.
 */
export type AutoMovieEvidenceStage =
  | "disabled"
  | "draft"
  | "evidence"
  | "review";

type ProductionKind = AutoMovieProductionKind;
type Stage = AutoMovieEvidenceStage;

/**
 * One generated project's complete evidence-graph declaration.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Exposes the complete project-owned input to the reusable evidence contract.
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Carries the full project-owned selection without a scaffold-local configuration module or hidden host default.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Carries every input field required to construct and validate the production graph.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Implements the exact location, kind, branch-stage, and additive-claim input state.
 * @evidencePart specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state::visible-selection Implements the complete visible declaration without an external configuration seam.
 */
export interface IAutoMovieEvidenceConfigProps {
  /** Absolute generated-project root whose physical populations are validated. */
  location: string;
  /** Mutually exclusive production shape, or null before selection. */
  kind: ProductionKind | null;
  /** Canonical production-settings document stage. */
  settings: Stage;
  /** Optional external-research ledger stage. */
  research: Stage;
  /** Model design-document stage. */
  models: Stage;
  /** Built-space and environment design-document stage. */
  spaces: Stage;
  /** Material and surface design-document stage. */
  materials: Stage;
  /** Placed instance and arrangement design-document stage. */
  instances: Stage;
  /** Time-varying motion design-document stage. */
  motions: Stage;
  /** Coupled service and behavior-system design-document stage. */
  systems: Stage;
  /** Film-only narrative-treatment stage. */
  storylines: Stage;
  /** Film-only physical scene-progression stage. */
  scenarios: Stage;
  /** Film-only final audiovisual screenplay stage. */
  script: Stage;
  /** Brief-only bounded audiovisual contract stage. */
  briefs: Stage;
  /** TypeScript model construction-source stage. */
  modelSources: Stage;
  /** TypeScript space construction-source stage. */
  spaceSources: Stage;
  /** TypeScript material construction-source stage. */
  materialSources: Stage;
  /** TypeScript instance construction-source stage. */
  instanceSources: Stage;
  /** TypeScript motion construction-source stage. */
  motionSources: Stage;
  /** TypeScript system construction-source stage. */
  systemSources: Stage;
  /** Authored shot and acceptance-source stage. */
  shots: Stage;
  /** Production-design serialization-source stage. */
  productionSources: Stage;
  /** Final editorial timeline-source stage. */
  filmSources: Stage;
  /** Production-local claims may extend, but never replace, the shared graph. */
  claims?: ITtscEvidenceGraphClaim[];
}

type IProductionGraph = IAutoMovieEvidenceConfigProps;

type MarkdownLayer =
  | "briefs"
  | "instances"
  | "materials"
  | "models"
  | "motions"
  | "research"
  | "scenarios"
  | "script"
  | "settings"
  | "spaces"
  | "storylines"
  | "systems";
type SourceLayer =
  | "filmSources"
  | "instanceSources"
  | "materialSources"
  | "modelSources"
  | "motionSources"
  | "productionSources"
  | "shots"
  | "spaceSources"
  | "systemSources";

interface IMarkdownPopulation {
  headings: readonly (2 | 3 | 4)[];
  obligation: boolean;
  principle: string;
}

interface ISourcePopulation {
  design: Exclude<
    MarkdownLayer,
    "briefs" | "research" | "scenarios" | "script" | "settings" | "storylines"
  > | null;
  files: readonly string[];
  ownerKinds: readonly ("class" | "function" | "property")[];
  ownerSymbols: readonly ("function" | "property" | "type")[];
  principle: string;
  symbols: readonly ("function" | "property" | "type")[];
}

const DOCS = "docs";
const MARKDOWN: Record<MarkdownLayer, IMarkdownPopulation> = {
  settings: { headings: [2], obligation: true, principle: "settings.md" },
  research: { headings: [2], obligation: false, principle: "research.md" },
  models: { headings: [2], obligation: true, principle: "models.md" },
  spaces: { headings: [2], obligation: true, principle: "spaces.md" },
  materials: { headings: [2], obligation: true, principle: "materials.md" },
  instances: { headings: [2], obligation: true, principle: "instances.md" },
  motions: { headings: [2], obligation: true, principle: "motions.md" },
  systems: { headings: [2], obligation: true, principle: "systems.md" },
  storylines: {
    headings: [2, 3, 4],
    obligation: true,
    principle: "storylines.md",
  },
  scenarios: {
    headings: [2, 3, 4],
    obligation: false,
    principle: "scenarios.md",
  },
  script: {
    headings: [2, 3, 4],
    obligation: false,
    principle: "scripts.md",
  },
  briefs: {
    headings: [2, 3, 4],
    obligation: false,
    principle: "briefs.md",
  },
};
const SOURCES: Record<SourceLayer, ISourcePopulation> = {
  modelSources: {
    design: "models",
    files: ["src/models/**/*.ts"],
    ownerKinds: ["class"],
    ownerSymbols: ["type"],
    principle: "model-sources.md",
    symbols: ["type", "property", "function"],
  },
  spaceSources: {
    design: "spaces",
    files: ["src/spaces/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    principle: "space-sources.md",
    symbols: ["type", "property", "function"],
  },
  materialSources: {
    design: "materials",
    files: ["src/materials/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    principle: "material-sources.md",
    symbols: ["type", "property", "function"],
  },
  instanceSources: {
    design: "instances",
    files: ["src/instances/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    principle: "instance-sources.md",
    symbols: ["type", "property", "function"],
  },
  motionSources: {
    design: "motions",
    files: ["src/motions/**/*.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    principle: "motion-sources.md",
    symbols: ["type", "property", "function"],
  },
  systemSources: {
    design: "systems",
    files: ["src/systems/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    principle: "system-sources.md",
    symbols: ["type", "property", "function"],
  },
  shots: {
    design: null,
    files: ["src/shots/**/*.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    principle: "shots.md",
    symbols: ["property", "function"],
  },
  productionSources: {
    design: null,
    files: ["src/production.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    principle: "production-sources.md",
    symbols: ["property", "function"],
  },
  filmSources: {
    design: null,
    files: ["src/film.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    principle: "film-sources.md",
    symbols: ["property", "function"],
  },
};
const DESIGN_LAYERS = [
  "models",
  "spaces",
  "materials",
  "instances",
  "motions",
  "systems",
] as const satisfies readonly MarkdownLayer[];
type DesignLayer = (typeof DESIGN_LAYERS)[number];

type DiscoveryTarget =
  | "briefs"
  | "common"
  | "films"
  | "scenarios"
  | "scripts"
  | "settings"
  | "storylines";

const DISCOVERY_TARGETS: Record<MarkdownLayer, readonly DiscoveryTarget[]> = {
  settings: ["common", "settings"],
  research: ["common"],
  models: ["common"],
  spaces: ["common"],
  materials: ["common"],
  instances: ["common"],
  motions: ["common"],
  systems: ["common"],
  storylines: ["common", "films", "storylines"],
  scenarios: ["common", "films", "scenarios"],
  script: ["common", "films", "scripts"],
  briefs: ["common", "briefs"],
};

/**
 * Upstream design families whose reviewed units the selected host population
 * must account for. A host cites only the units it actually consumes; omission
 * from another host is not an exclusion, while a genuinely unused target needs
 * one truthful population-wide exclusion.
 */
const DESIGN_FOUNDATIONS: Partial<
  Record<MarkdownLayer, readonly DesignLayer[]>
> = {
  models: ["spaces"],
  materials: ["models", "spaces"],
  instances: ["models", "spaces", "materials"],
  motions: ["models", "spaces", "materials", "instances", "systems"],
  systems: ["models", "spaces", "materials", "instances", "motions"],
  briefs: DESIGN_LAYERS,
};

const EXPECTED_CONTRACTS = [
  {
    file: "discovery/briefs.md",
    anchors: ["work-specific-brief-requirements"],
  },
  {
    file: "discovery/common.md",
    anchors: ["shared-local-boundary", "canonical-realization"],
  },
  {
    file: "discovery/films.md",
    anchors: ["work-specific-film-requirements"],
  },
  {
    file: "discovery/scenarios.md",
    anchors: ["work-specific-scenario-requirements"],
  },
  {
    file: "discovery/scripts.md",
    anchors: ["work-specific-screenplay-requirements"],
  },
  {
    file: "discovery/settings.md",
    anchors: [
      "directive-promise-subject-requirements",
      "planned-delivery-backcast",
    ],
  },
  {
    file: "discovery/storylines.md",
    anchors: ["work-specific-storyline-requirements"],
  },
  {
    file: "obligations/common.md",
    anchors: [
      "scope-preservation",
      "substantive-completion",
      "proportionate-development",
      "evidence-content-conformance",
    ],
  },
  {
    file: "obligations/instances.md",
    anchors: [
      "instance-prototype-membership",
      "instance-identity-transform",
      "instance-variation-tiers",
      "instance-placement-review",
    ],
  },
  {
    file: "obligations/materials.md",
    anchors: [
      "material-identity-assembly",
      "material-surface-assignment",
      "material-response",
      "material-review-set",
    ],
  },
  {
    file: "obligations/models.md",
    anchors: [
      "representation-ceiling",
      "reference-scale",
      "articulation-ownership",
      "model-review-set",
    ],
  },
  {
    file: "obligations/motions.md",
    anchors: [
      "time-base",
      "contact-policy",
      "composition-interruption",
      "motion-review-set",
    ],
  },
  {
    file: "obligations/settings.md",
    anchors: [
      "delivery-scope",
      "governing-aim",
      "audience-operator-access",
      "coordinate-unit-convention",
      "delivery-review-condition",
      "settings-coverage-map",
      "operative-subject-inventory",
    ],
  },
  {
    file: "obligations/spaces.md",
    anchors: [
      "space-reference-topology",
      "space-envelope-interface",
      "space-access-circulation",
      "space-review-set",
    ],
  },
  {
    file: "obligations/storylines.md",
    anchors: ["opening-condition", "terminal-condition", "audience-route"],
  },
  {
    file: "obligations/subjects.md",
    anchors: [
      "situated-conditions",
      "drives-and-pressures",
      "knowledge-and-perception",
      "expression-and-behavior",
      "bidirectional-relationships",
      "change-boundaries",
    ],
  },
  {
    file: "obligations/systems.md",
    anchors: [
      "system-ownership-interfaces",
      "system-state-clock",
      "system-budget-degradation",
      "system-review-set",
    ],
  },
  {
    file: "principles/briefs.md",
    anchors: [
      "single-scope-eligibility",
      "observable-progression",
      "no-narrative-smuggling",
    ],
  },
  {
    file: "principles/common.md",
    anchors: [
      "purpose-fit",
      "layer-boundary",
      "declared-basis",
      "production-language",
    ],
  },
  {
    file: "principles/film-sources.md",
    anchors: [
      "editorial-only-assembly",
      "authored-auxiliary-tracks",
      "deterministic-timeline",
    ],
  },
  {
    file: "principles/instance-sources.md",
    anchors: [
      "instance-source-design-ownership",
      "instance-source-stable-membership",
      "instance-source-invalid-placement",
    ],
  },
  {
    file: "principles/instances.md",
    anchors: [
      "addressable-instance-decisions",
      "instance-information-structure",
      "instance-prototype-boundary",
      "instance-derivation-authority",
      "instance-verification-address",
    ],
  },
  {
    file: "principles/material-sources.md",
    anchors: [
      "material-source-design-ownership",
      "material-source-renderer-mapping",
      "material-source-invalid-state",
    ],
  },
  {
    file: "principles/materials.md",
    anchors: [
      "addressable-material-decisions",
      "material-information-structure",
      "material-construction-appearance",
      "material-binding-interface",
      "material-verification-address",
    ],
  },
  {
    file: "principles/model-sources.md",
    anchors: [
      "design-owned-construction",
      "deterministic-build",
      "unsupported-fidelity-is-explicit",
    ],
  },
  {
    file: "principles/models.md",
    anchors: [
      "addressable-model-decisions",
      "model-information-structure",
      "representation-contract",
      "spatial-convention",
      "reviewable-structure",
    ],
  },
  {
    file: "principles/motion-sources.md",
    anchors: [
      "design-owned-transition",
      "pure-time-mapping",
      "invalid-input-is-visible",
    ],
  },
  {
    file: "principles/motions.md",
    anchors: [
      "addressable-motion-decisions",
      "motion-information-structure",
      "state-endpoints",
      "temporal-phases",
      "spatial-relation",
      "parameter-domain",
    ],
  },
  {
    file: "principles/narratives.md",
    anchors: [
      "unit-function",
      "unit-addressability",
      "unit-connection",
      "horizontal-state-continuity",
      "audience-investment",
      "character-continuity",
      "information-entry",
      "specificity",
      "unit-identity",
      "state-continuity",
      "observable-inheritance",
    ],
  },
  {
    file: "principles/production-sources.md",
    anchors: [
      "settings-only-serialization",
      "delivery-identity",
      "shared-visual-grammar",
    ],
  },
  {
    file: "principles/research.md",
    anchors: [
      "source-identity",
      "production-consequence",
      "uncertainty-boundary",
    ],
  },
  {
    file: "principles/scenarios.md",
    anchors: [
      "staging-blocks",
      "scene-entry-state",
      "scene-exit-state",
      "executable-progression",
      "dialogue-action",
      "knowledge-state",
      "scenario-boundary",
    ],
  },
  {
    file: "principles/scripts.md",
    anchors: [
      "screenplay-blocks",
      "filmable-expression",
      "audiovisual-voice",
      "block-continuity",
      "audience-access",
      "pacing-rhythm",
      "audience-orientation",
      "dialogue-sound-voice",
      "emotional-grounding",
      "audiovisual-selection",
      "timing-allocation",
      "realization-ready-contract",
    ],
  },
  {
    file: "principles/settings.md",
    anchors: [
      "addressable-canon",
      "information-structure",
      "fact-status",
      "source-support",
      "capability-boundary",
      "constraint-sufficiency",
      "observable-identity",
      "minimal-departure",
      "internal-coherence",
    ],
  },
  {
    file: "principles/shots.md",
    anchors: [
      "contract-only-composition",
      "explicit-inputs-and-time",
      "acceptance-travels-with-delivery",
    ],
  },
  {
    file: "principles/space-sources.md",
    anchors: [
      "space-source-design-ownership",
      "space-source-stable-identities",
      "space-source-invalid-topology",
    ],
  },
  {
    file: "principles/spaces.md",
    anchors: [
      "addressable-spatial-decisions",
      "space-information-structure",
      "space-topology",
      "space-boundary-authority",
      "space-verification-address",
    ],
  },
  {
    file: "principles/storylines.md",
    anchors: [
      "treatment-paragraphs",
      "causal-turn",
      "audience-change",
      "information-design",
      "resolution-aftermath",
      "thematic-development",
      "treatment-boundary",
    ],
  },
  {
    file: "principles/system-sources.md",
    anchors: [
      "system-source-design-ownership",
      "system-source-explicit-evaluation",
      "system-source-failure-budget",
    ],
  },
  {
    file: "principles/systems.md",
    anchors: [
      "addressable-system-decisions",
      "system-information-structure",
      "system-authority-confinement",
      "system-dependency-basis",
      "system-verification-address",
    ],
  },
] as const;

const isActive = (stage: Stage): boolean => stage !== "disabled";
const requiresEvidence = (stage: Stage): boolean =>
  stage === "evidence" || stage === "review";
const requiresReview = (stage: Stage): boolean => stage === "review";
const posix = (value: string): string => value.replaceAll("\\", "/");
const compareCodeUnits = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);
const PRODUCTION_KINDS: readonly unknown[] = [null, "brief", "film", "library"];
const EVIDENCE_STAGES: readonly unknown[] = [
  "disabled",
  "draft",
  "evidence",
  "review",
];
const describeDeclarationValue = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

const validateDeclaration = (graph: IProductionGraph): void => {
  if (typeof graph.location !== "string" || !path.isAbsolute(graph.location))
    throw new Error(
      `Production evidence location must be an absolute string; received ${describeDeclarationValue(graph.location)}.`,
    );
  if (!fs.existsSync(graph.location))
    throw new Error(
      `Production evidence location does not exist: ${posix(graph.location)}.`,
    );
  if (!fs.statSync(graph.location).isDirectory())
    throw new Error(
      `Production evidence location is not a directory: ${posix(graph.location)}.`,
    );
  const kind: unknown = graph.kind;
  if (!PRODUCTION_KINDS.includes(kind))
    throw new Error(
      `Unsupported production kind ${describeDeclarationValue(kind)}.`,
    );
  for (const name of [
    ...(Object.keys(MARKDOWN) as MarkdownLayer[]),
    ...(Object.keys(SOURCES) as SourceLayer[]),
  ]) {
    const stage: unknown = graph[name];
    if (!EVIDENCE_STAGES.includes(stage))
      throw new Error(
        `${name} has unsupported evidence stage ${describeDeclarationValue(stage)}.`,
      );
  }
  if (graph.claims !== undefined && !Array.isArray(graph.claims))
    throw new Error(
      "Production evidence claims must be an array when present.",
    );
};

const walkFiles = (root: string, extension: ".md" | ".ts"): string[] => {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return root.endsWith(extension) ? [root] : [];
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(extension))
        output.push(absolute);
    }
  };
  visit(root);
  return output;
};

interface IHeadingIdentity {
  anchor: string;
  depth: 2 | 3 | 4;
  lineage: string;
  line: number;
  title: string;
}

interface IMarkdownHeading {
  anchor: string | undefined;
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  line: number;
  title: string;
}

interface ITargetIdentityRegistry {
  anchors: Map<string, string>;
  titles: Map<string, string>;
}

const normalizeTargetTitle = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/gu, " ");

const visibleMarkdownLines = (source: string): string[] => {
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let htmlComment = false;
  for (const sourceLine of source.split(/\r?\n/u)) {
    if (fence !== undefined) {
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      output.push("");
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) {
          line += " ".repeat(sourceLine.length - cursor);
          break;
        }
        line += " ".repeat(close + 3 - cursor);
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += sourceLine.slice(cursor, open) + "    ";
        cursor = open + 4;
        htmlComment = true;
      }
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker !== undefined) {
      fence = {
        character: marker[0] as "`" | "~",
        length: marker.length,
      };
      output.push("");
      continue;
    }
    output.push(line);
  }
  return output;
};

const markdownHeadings = (file: string): IMarkdownHeading[] => {
  const output: IMarkdownHeading[] = [];
  for (const [index, line] of visibleMarkdownLines(
    fs.readFileSync(file, "utf8"),
  ).entries()) {
    const heading = /^(#{1,6})(?!#)\s+(\S.*)$/u.exec(line);
    if (heading === null) continue;
    const depth = heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
    const text = heading[2]!;
    const anchored = /[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(text);
    output.push({
      anchor: anchored?.[1],
      depth,
      line: index + 1,
      title: text.replace(/[ \t]+\{#[^{}\s]+\}[ \t]*$/u, ""),
    });
  }
  return output;
};

const markdownIdentities = (
  file: string,
  headings: readonly (2 | 3 | 4)[],
): IHeadingIdentity[] => {
  const required = new Set(headings);
  const seenDepths = new Set<number>();
  const anchors = new Set<string>();
  const output: IHeadingIdentity[] = [];
  let h2: string | undefined;
  let h3: string | undefined;
  for (const heading of markdownHeadings(file)) {
    if (heading.depth === 1) continue;
    const depth =
      heading.depth === 2 || heading.depth === 3 || heading.depth === 4
        ? heading.depth
        : undefined;
    if (depth === undefined || !required.has(depth))
      throw new Error(
        `${posix(file)}:${heading.line} uses H${heading.depth} outside the configured ${headings.map((value) => `H${value}`).join("/")} authored-unit topology.`,
      );
    seenDepths.add(depth);
    const anchor = heading.anchor;
    if (anchor === undefined)
      throw new Error(
        `${posix(file)}:${heading.line} has an active H${depth} without an explicit {#anchor}.`,
      );
    if (anchors.has(anchor))
      throw new Error(
        `${posix(file)}:${heading.line} repeats #${anchor}; anchors are unique within one file.`,
      );
    anchors.add(anchor);
    if (depth === 2) {
      h2 = anchor;
      h3 = undefined;
    } else if (depth === 3) {
      if (h2 === undefined)
        throw new Error(
          `${posix(file)}:${heading.line} has an H3 before an H2.`,
        );
      h3 = anchor;
    } else if (h2 === undefined || h3 === undefined)
      throw new Error(
        `${posix(file)}:${heading.line} has an H4 before its H2/H3 parents.`,
      );
    output.push({
      anchor,
      depth,
      lineage: [
        h2,
        depth >= 3 ? h3 : undefined,
        depth === 4 ? anchor : undefined,
      ]
        .filter((value): value is string => value !== undefined)
        .join("/"),
      line: heading.line,
      title: heading.title,
    });
  }
  for (const depth of headings)
    if (!seenDepths.has(depth))
      throw new Error(`${posix(file)} is active but has no H${depth} unit.`);
  return output;
};

const EVIDENCE_TAG = /@evidence[A-Za-z]*\b/u;

const validateTargetForm = (
  relative: string,
  file: string,
): IHeadingIdentity[] => {
  const source = fs.readFileSync(file, "utf8");
  const headings = markdownHeadings(file);
  const h1 = headings.filter((heading) => heading.depth === 1);
  if (
    h1.length !== 1 ||
    headings[0]?.depth !== 1 ||
    /^#(?!#)[ \t]+\S/u.test(source.trimStart()) === false
  )
    throw new Error(
      `${relative} must begin with exactly one H1; received ${h1.length}.`,
    );
  const deeper = headings.find((heading) => heading.depth >= 3);
  if (deeper !== undefined)
    throw new Error(
      `${relative}:${deeper.line} uses H${deeper.depth}; evidence targets use only H1 and anchored H2 units.`,
    );
  const units = markdownIdentities(file, [2]);
  const lines = visibleMarkdownLines(source);
  const scope = lines
    .slice(h1[0]!.line, units[0]!.line - 1)
    .join("\n")
    .trim();
  if (scope.length === 0)
    throw new Error(
      `${relative} must state its target scope between H1 and H2.`,
    );
  for (const [index, unit] of units.entries()) {
    const nextLine = units[index + 1]?.line;
    const body = lines.slice(
      unit.line,
      nextLine === undefined ? lines.length : nextLine - 1,
    );
    const reviewQuestions = body.filter((line) =>
      /^Review question:\s+\S/u.test(line),
    );
    const sources = body.filter((line) => /^Sources:\s+\S/u.test(line));
    if (reviewQuestions.length !== 1 || sources.length !== 1)
      throw new Error(
        `${relative}#${unit.anchor} must contain exactly one Review question and one Sources line; received ${reviewQuestions.length} and ${sources.length}.`,
      );
    let last: string | undefined;
    for (let cursor = body.length - 1; cursor >= 0; cursor--)
      if (body[cursor]!.trim().length !== 0) {
        last = body[cursor];
        break;
      }
    if (last?.startsWith("Sources: ") !== true)
      throw new Error(
        `${relative}#${unit.anchor} must end with its Sources line.`,
      );
  }
  return units;
};

const hasExportedOwner = (
  file: string,
  kinds: readonly ("class" | "function" | "property")[],
): boolean => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const localExports = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier !== undefined ||
      statement.isTypeOnly ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    )
      continue;
    for (const element of statement.exportClause.elements)
      if (!element.isTypeOnly)
        localExports.add((element.propertyName ?? element.name).text);
  }
  const directlyExported = (statement: ts.Statement): boolean =>
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  const declared = (statement: ts.Statement): boolean =>
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
    );
  return source.statements.some(
    (statement) =>
      (kinds.includes("class") &&
        ts.isClassDeclaration(statement) &&
        statement.name !== undefined &&
        (directlyExported(statement) ||
          localExports.has(statement.name.text)) &&
        !declared(statement) &&
        (ts.getModifiers(statement) ?? []).every(
          (modifier) => modifier.kind !== ts.SyntaxKind.AbstractKeyword,
        )) ||
      (kinds.includes("function") &&
        ts.isFunctionDeclaration(statement) &&
        statement.name !== undefined &&
        (directlyExported(statement) ||
          localExports.has(statement.name.text)) &&
        statement.body !== undefined &&
        !declared(statement)) ||
      (kinds.includes("property") &&
        ts.isVariableStatement(statement) &&
        !declared(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.initializer !== undefined &&
            (directlyExported(statement) ||
              localExports.has(declaration.name.text)),
        )),
  );
};

const validateContracts = (location: string): ITargetIdentityRegistry => {
  const root = path.join(location, DOCS);
  const actual = [
    ...walkFiles(path.join(root, "discovery"), ".md"),
    ...walkFiles(path.join(root, "obligations"), ".md"),
    ...walkFiles(path.join(root, "principles"), ".md"),
  ]
    .map((file) => posix(path.relative(root, file)))
    .sort(compareCodeUnits);
  const expected = [...EXPECTED_CONTRACTS].sort((left, right) =>
    compareCodeUnits(left.file, right.file),
  );
  if (
    actual.length !== expected.length ||
    actual.some((file, index) => file !== expected[index]!.file)
  )
    throw new Error(
      `Shared contract inventory changed without graph wiring. Received [${actual.join(", ")}], expected [${expected.map((contract) => contract.file).join(", ")}].`,
    );
  const anchors = new Map<string, string>();
  const titles = new Map<string, string>();
  for (const [index, relative] of actual.entries()) {
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, "utf8");
    if (EVIDENCE_TAG.test(source))
      throw new Error(
        `${relative} is a shared target and must not carry host-side @evidence tags.`,
      );
    const units = validateTargetForm(relative, file);
    for (const unit of units) {
      const previousAnchor = anchors.get(unit.anchor);
      if (previousAnchor !== undefined)
        throw new Error(
          `${relative}#${unit.anchor} reuses shared H2 anchor already owned by ${previousAnchor}.`,
        );
      anchors.set(unit.anchor, `${relative}#${unit.anchor}`);
      const normalizedTitle = normalizeTargetTitle(unit.title);
      const previousTitle = titles.get(normalizedTitle);
      if (previousTitle !== undefined)
        throw new Error(
          `${relative}#${unit.anchor} repeats shared H2 title ${JSON.stringify(unit.title)} already owned by ${previousTitle}.`,
        );
      titles.set(normalizedTitle, `${relative}#${unit.anchor}`);
    }
    const expectedAnchors = expected[index]!.anchors;
    const receivedAnchors = units.map((unit) => unit.anchor);
    if (
      receivedAnchors.length !== expectedAnchors.length ||
      receivedAnchors.some(
        (anchor, anchorIndex) => anchor !== expectedAnchors[anchorIndex],
      )
    )
      throw new Error(
        `${relative} H2 inventory changed without graph wiring. Received [${receivedAnchors.join(", ")}], expected [${expectedAnchors.join(", ")}].`,
      );
  }
  return { anchors, titles };
};

const normalizeGlob = (source: string): string => {
  let output = posix(source);
  while (output.startsWith("./")) output = output.slice(2);
  if (output.endsWith("/")) output = output.slice(0, -1);
  return output;
};

const matchesGlobSegment = (value: string, pattern: string): boolean => {
  let source = "^";
  for (const character of pattern) {
    if (character === "*") source += "[\\s\\S]*";
    else if (character === "?") source += "[\\s\\S]";
    else {
      if ("\\^$+.()[]{}|".includes(character)) source += "\\";
      source += character;
    }
  }
  return new RegExp(`${source}$`, "u").test(value);
};

const matchesGlob = (file: string, source: string): boolean => {
  const pathSegments = posix(file).split("/");
  const patternSegments = normalizeGlob(source).split("/");
  const memo = new Map<string, boolean>();
  const visit = (patternIndex: number, pathIndex: number): boolean => {
    const key = `${patternIndex}:${pathIndex}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let result: boolean;
    if (patternIndex === patternSegments.length)
      result = pathIndex === pathSegments.length;
    else if (patternSegments[patternIndex] === "**")
      result =
        visit(patternIndex + 1, pathIndex) ||
        (pathIndex < pathSegments.length && visit(patternIndex, pathIndex + 1));
    else
      result =
        pathIndex < pathSegments.length &&
        matchesGlobSegment(
          pathSegments[pathIndex]!,
          patternSegments[patternIndex]!,
        ) &&
        visit(patternIndex + 1, pathIndex + 1);
    memo.set(key, result);
    return result;
  };
  return visit(0, 0);
};

const evidenceRoot = (population: object): string =>
  "root" in population && typeof population.root === "string"
    ? population.root
    : ".";

const matchesPatterns = (
  file: string,
  patterns: readonly string[],
): boolean => {
  let selected = false;
  for (const source of patterns) {
    const negative = source.startsWith("!");
    const pattern = normalizeGlob(negative ? source.slice(1) : source);
    if (matchesGlob(file, pattern)) selected = !negative;
  }
  return selected;
};

const populationHasFiles = (
  graph: IProductionGraph,
  type: "markdown" | "typescript",
  root: string,
  patterns: readonly string[],
): boolean => {
  const base = path.resolve(graph.location, root);
  return walkFiles(base, type === "markdown" ? ".md" : ".ts")
    .map((file) => posix(path.relative(base, file)))
    .some((file) => matchesPatterns(file, patterns));
};

const validateProductionTargets = (
  graph: IProductionGraph,
  identities: ITargetIdentityRegistry,
): void => {
  const root = path.join(graph.location, DOCS);
  const reserved = new Set<string>([
    "discovery",
    "obligations",
    "principles",
    ...Object.keys(MARKDOWN),
  ]);
  const targets = walkFiles(root, ".md")
    .map((file) => posix(path.relative(root, file)))
    .filter(
      (file) => file !== "README.md" && !reserved.has(file.split("/", 1)[0]!),
    );
  const selectors: Array<{
    disabled: boolean;
    h2: boolean;
    patterns: string[];
    root: string;
  }> = [];
  for (const claim of graph.claims ?? []) {
    const references = Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];
    for (const reference of references) {
      if (reference.type !== "markdown") continue;
      const referenceRoot = path.resolve(graph.location, reference.root ?? ".");
      selectors.push({
        disabled: claim.disabled === true,
        h2: Array.isArray(reference.symbol)
          ? reference.symbol.includes("h2")
          : reference.symbol === "h2",
        patterns: [...reference.files],
        root: referenceRoot,
      });
    }
    if (claim.disabled === true) continue;
    if (claim.type !== "markdown" && claim.type !== "typescript") continue;
    if (
      !populationHasFiles(graph, claim.type, evidenceRoot(claim), claim.files)
    )
      throw new Error(
        `Active production claim ${claim.name} selects no host file.`,
      );
    if (references.length === 0)
      throw new Error(
        `Active production claim ${claim.name} selects no reference population.`,
      );
    for (const reference of references) {
      if (reference.type !== "markdown" && reference.type !== "typescript")
        continue;
      if (reference.type === "typescript" && reference.package !== undefined)
        continue;
      if (
        !populationHasFiles(
          graph,
          reference.type,
          evidenceRoot(reference),
          reference.files ?? [],
        )
      )
        throw new Error(
          `Active production claim ${claim.name} has an empty reference population.`,
        );
    }
  }
  for (const target of targets) {
    const file = path.join(root, target);
    if (EVIDENCE_TAG.test(fs.readFileSync(file, "utf8")))
      throw new Error(
        `${target} is a production target and must not carry host-side @evidence tags.`,
      );
    for (const unit of validateTargetForm(target, file)) {
      const previousAnchor = identities.anchors.get(unit.anchor);
      if (previousAnchor !== undefined)
        throw new Error(
          `${target}#${unit.anchor} duplicates target anchor already owned by ${previousAnchor}.`,
        );
      identities.anchors.set(unit.anchor, `${target}#${unit.anchor}`);
      const normalizedTitle = normalizeTargetTitle(unit.title);
      const previousTitle = identities.titles.get(normalizedTitle);
      if (previousTitle !== undefined)
        throw new Error(
          `${target}#${unit.anchor} duplicates target title ${JSON.stringify(unit.title)} already owned by ${previousTitle}.`,
        );
      identities.titles.set(normalizedTitle, `${target}#${unit.anchor}`);
    }
    if (
      !selectors.some((entry) => {
        const relative = posix(path.relative(entry.root, file));
        return (
          entry.h2 &&
          relative !== ".." &&
          !relative.startsWith("../") &&
          matchesPatterns(relative, entry.patterns)
        );
      })
    )
      throw new Error(
        `${target} is a production target with no additive claim reference.`,
      );
  }
  for (const selector of selectors) {
    if (selector.disabled) continue;
    for (const sourcePattern of selector.patterns) {
      if (sourcePattern.startsWith("!")) continue;
      const pattern = normalizeGlob(sourcePattern);
      const wildcard = pattern.search(/[*?]/u);
      const concrete = (
        wildcard === -1 ? pattern : pattern.slice(0, wildcard)
      ).replace(/[/]+$/u, "");
      const prefix = path.resolve(selector.root, concrete);
      const relativePrefix = posix(path.relative(root, prefix));
      if (
        relativePrefix === ".." ||
        relativePrefix.startsWith("../") ||
        relativePrefix.length === 0
      )
        continue;
      const first = relativePrefix.split("/", 1)[0]!;
      if (reserved.has(first) || relativePrefix === "README.md") continue;
      if (
        !targets.some((target) => {
          const absolute = path.join(root, target);
          const relative = posix(path.relative(selector.root, absolute));
          return (
            relative !== ".." &&
            !relative.startsWith("../") &&
            matchesGlob(relative, pattern)
          );
        })
      )
        throw new Error(
          `Active production target pattern ${pattern} selects no Markdown target.`,
        );
    }
  }
};

const requireReviewedParent = (
  childName: string,
  child: Stage,
  parentName: string,
  parent: Stage,
): void => {
  if (isActive(child) && parent !== "review")
    throw new Error(
      `${childName} cannot enter ${child} before ${parentName} is in review.`,
    );
};

const validateStages = (graph: IProductionGraph): void => {
  const stages = [
    ...Object.keys(MARKDOWN).map((name) => graph[name as MarkdownLayer]),
    ...Object.keys(SOURCES).map((name) => graph[name as SourceLayer]),
  ];
  if (graph.kind === null) {
    if (stages.some(isActive))
      throw new Error(
        "Select film, brief, or library before activating a layer.",
      );
    return;
  }
  if (!isActive(graph.settings) && !isActive(graph.research))
    throw new Error(
      `${graph.kind} must begin with research or an active settings layer.`,
    );
  if (graph.kind === "film" && isActive(graph.briefs))
    throw new Error("A film cannot activate the direct-brief layer.");
  if (
    graph.kind === "brief" &&
    [graph.storylines, graph.scenarios, graph.script].some(isActive)
  )
    throw new Error(
      "A brief cannot activate storylines, scenarios, or script; choose film when narrative refinement is required.",
    );
  if (
    graph.kind === "library" &&
    [
      graph.storylines,
      graph.scenarios,
      graph.script,
      graph.briefs,
      graph.shots,
      graph.filmSources,
    ].some(isActive)
  )
    throw new Error(
      "A library cannot activate narrative, brief, shot, or film-source layers.",
    );

  if (isActive(graph.research))
    for (const name of Object.keys(MARKDOWN) as MarkdownLayer[])
      if (name !== "research")
        requireReviewedParent(name, graph[name], "research", graph.research);

  for (const name of [
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
    "storylines",
    "briefs",
  ] as const)
    requireReviewedParent(name, graph[name], "settings", graph.settings);
  requireReviewedParent(
    "scenarios",
    graph.scenarios,
    "storylines",
    graph.storylines,
  );
  requireReviewedParent("script", graph.script, "scenarios", graph.scenarios);

  for (const name of Object.keys(SOURCES) as SourceLayer[]) {
    const design = SOURCES[name].design;
    if (design !== null)
      requireReviewedParent(name, graph[name], design, graph[design]);
  }
  requireReviewedParent(
    "productionSources",
    graph.productionSources,
    "settings",
    graph.settings,
  );
  if (isActive(graph.shots)) {
    const parent = graph.kind === "film" ? "script" : "briefs";
    requireReviewedParent("shots", graph.shots, parent, graph[parent]);
    for (const name of Object.keys(SOURCES) as SourceLayer[]) {
      const design = SOURCES[name].design;
      if (design !== null && isActive(graph[design]))
        requireReviewedParent("shots", graph.shots, name, graph[name]);
    }
  }
  if (isActive(graph.filmSources)) {
    requireReviewedParent(
      "filmSources",
      graph.filmSources,
      "shots",
      graph.shots,
    );
    requireReviewedParent(
      "filmSources",
      graph.filmSources,
      "productionSources",
      graph.productionSources,
    );
  }
};

const populationFiles = (
  graph: IProductionGraph,
  roots: readonly string[],
  extension: ".md" | ".ts",
): string[] =>
  roots.flatMap((root) => {
    const wildcard = root.search(/[*?]/u);
    const concrete = (wildcard === -1 ? root : root.slice(0, wildcard)).replace(
      /[\\/]+$/u,
      "",
    );
    return walkFiles(path.join(graph.location, concrete), extension);
  });

const validateHosts = (graph: IProductionGraph): void => {
  const identities = new Map<MarkdownLayer, Map<string, IHeadingIdentity[]>>();
  for (const name of Object.keys(MARKDOWN) as MarkdownLayer[]) {
    const stage = graph[name];
    const directory = path.join(graph.location, DOCS, name);
    const files = walkFiles(directory, ".md");
    if (!isActive(stage) && files.length !== 0)
      throw new Error(
        `${name} is disabled but governed hosts remain: ${files.map((file) => posix(path.relative(graph.location, file))).join(", ")}.`,
      );
    if (isActive(stage) && files.length === 0)
      throw new Error(`${name} cannot enter ${stage} without a Markdown host.`);
    if (!isActive(stage)) continue;
    const layer = new Map<string, IHeadingIdentity[]>();
    for (const file of files) {
      const relative = posix(path.relative(directory, file));
      const source = fs.readFileSync(file, "utf8");
      if (stage === "draft" && EVIDENCE_TAG.test(source))
        throw new Error(
          `${posix(path.relative(graph.location, file))} is draft and must be completed before evidence tags are authored.`,
        );
      layer.set(relative, markdownIdentities(file, MARKDOWN[name].headings));
    }
    const seen = new Set<string>();
    for (const units of layer.values())
      for (const unit of units) {
        if (seen.has(unit.anchor))
          throw new Error(
            `${name} repeats #${unit.anchor}; identities are unique across the layer.`,
          );
        seen.add(unit.anchor);
      }
    identities.set(name, layer);
  }

  for (const name of Object.keys(SOURCES) as SourceLayer[]) {
    const stage = graph[name];
    const files = populationFiles(graph, SOURCES[name].files, ".ts");
    if (!isActive(stage) && files.length !== 0)
      throw new Error(
        `${name} is disabled but governed hosts remain: ${files.map((file) => posix(path.relative(graph.location, file))).join(", ")}.`,
      );
    if (isActive(stage) && files.length === 0)
      throw new Error(
        `${name} cannot enter ${stage} without a TypeScript host.`,
      );
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (stage === "draft" && EVIDENCE_TAG.test(source))
        throw new Error(
          `${posix(path.relative(graph.location, file))} is draft and must be completed before evidence tags are authored.`,
        );
      if (!hasExportedOwner(file, SOURCES[name].ownerKinds))
        throw new Error(
          `${posix(path.relative(graph.location, file))} belongs to active ${name} but has no named exported owner of its required kind (${SOURCES[name].ownerKinds.join(", ")}).`,
        );
    }
  }

  const match = (
    childName: "scenarios" | "script",
    parentName: "scenarios" | "storylines",
  ): void => {
    const child = identities.get(childName);
    if (child === undefined) return;
    const parent = identities.get(parentName)!;
    const childFiles = [...child.keys()];
    const parentFiles = [...parent.keys()];
    if (
      childFiles.length !== parentFiles.length ||
      childFiles.some((file, index) => file !== parentFiles[index])
    )
      throw new Error(
        `${childName} filenames must exactly preserve ${parentName}; received [${childFiles.join(", ")}], expected [${parentFiles.join(", ")}].`,
      );
    for (const file of childFiles) {
      const signature = (items: readonly IHeadingIdentity[]): string[] =>
        items.map((item) => `H${item.depth}:${item.lineage}`);
      const received = signature(child.get(file)!);
      const expected = signature(parent.get(file)!);
      if (
        received.length !== expected.length ||
        received.some((value, index) => value !== expected[index])
      )
        throw new Error(
          `${childName}/${file} must exactly preserve ${parentName} identity, nesting, and order; received [${received.join(", ")}], expected [${expected.join(", ")}].`,
        );
    }
  };
  match("scenarios", "storylines");
  match("script", "scenarios");
  match("script", "storylines");
};

const checklist = (
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: [`principles/${file}`],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview: review,
});

const commonObligations = (review: boolean): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: ["obligations/common.md"],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview: review,
});

const layerObligation = (
  layer: MarkdownLayer,
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: [`obligations/${layer}.md`],
  symbol: "h2",
  noEvidenceExclude: layer === "motions" ? undefined : true,
  requireReview: review,
});

/**
 * What each operative subject owner must settle, for a film only.
 *
 * `obligations/settings.md#operative-subject-inventory` accounts for the
 * population; these roles are the depth that inventory deliberately does not
 * require. A brief answers one bounded observation and a library exports design
 * branches, so neither owes a cast this deep, and a film that genuinely owes
 * none of it is a brief that chose the wrong shape.
 *
 * Exclusion stays open per role because an observational or non-human film can
 * truthfully establish no consequential relationship, exactly as a production
 * without a motion condition may exclude one motion role.
 */
const subjectObligation = (review: boolean): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: ["obligations/subjects.md"],
  symbol: "h2",
  requireReview: review,
});

const discoveryReferences = (
  layer: MarkdownLayer,
  review: boolean,
): ITtscEvidenceGraphReference[] =>
  DISCOVERY_TARGETS[layer].map((target) => ({
    type: "markdown",
    root: DOCS,
    files: [`discovery/${target}.md`],
    symbol: "h2",
    requireReview: review,
  }));

const referencesPerFile = (
  graph: IProductionGraph,
  directory: MarkdownLayer,
  symbol: "file" | "h2" | "h3" | "h4",
  review: boolean,
  noEvidenceExclude = false,
): ITtscEvidenceGraphReference[] => {
  const root = path.join(graph.location, DOCS);
  return walkFiles(path.join(root, directory), ".md").map((file) => ({
    type: "markdown",
    root: DOCS,
    files: [posix(path.relative(root, file))],
    symbol,
    noEvidenceExclude,
    requireReview: review,
  }));
};

const designFoundations = (
  graph: IProductionGraph,
  host: MarkdownLayer,
  review: boolean,
): ITtscEvidenceGraphReference[] =>
  (DESIGN_FOUNDATIONS[host] ?? [])
    .filter((design) => requiresReview(graph[design]))
    .flatMap((design) => referencesPerFile(graph, design, "h2", review));

const lineage = (
  layer: "scenarios" | "storylines",
  symbol: "h2" | "h3" | "h4",
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: [`${layer}/**/*.md`],
  symbol,
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
  requireReview: review,
});

const authoredClaims = (graph: IProductionGraph): ITtscEvidenceGraphClaim[] => {
  const claims: ITtscEvidenceGraphClaim[] = [];
  for (const name of Object.keys(MARKDOWN) as MarkdownLayer[]) {
    const stage = graph[name];
    const review = requiresReview(stage);
    const principles = [checklist("common.md", review)];
    if (["storylines", "scenarios", "script"].includes(name))
      principles.push(checklist("narratives.md", review));
    principles.push(checklist(MARKDOWN[name].principle, review));
    claims.push({
      name: `${name} files answer their complete principle checklists`,
      type: "markdown",
      root: DOCS,
      files: [`${name}/**/*.md`],
      symbol: "file",
      disabled: !requiresEvidence(stage),
      reference: principles,
    });
    for (const symbol of MARKDOWN[name].headings) {
      const references: ITtscEvidenceGraphReference[] = [
        commonObligations(review),
      ];
      if (MARKDOWN[name].obligation && symbol === 2)
        references.push(layerObligation(name, review));
      if (symbol === 2) references.push(...discoveryReferences(name, review));
      if (symbol === 2 && name === "settings" && graph.kind === "film")
        references.push(subjectObligation(review));
      if (!["settings", "research"].includes(name))
        references.push(...referencesPerFile(graph, "settings", "h2", review));
      references.push(...designFoundations(graph, name, review));
      if (name === "scenarios")
        references.push(
          lineage("storylines", `h${symbol}` as "h2" | "h3" | "h4", review),
        );
      if (name === "script")
        references.push(
          lineage("scenarios", `h${symbol}` as "h2" | "h3" | "h4", review),
          lineage("storylines", `h${symbol}` as "h2" | "h3" | "h4", review),
        );
      claims.push({
        name: `${name} H${symbol} units preserve their exact scope and lineage`,
        type: "markdown",
        root: DOCS,
        files: [`${name}/**/*.md`],
        symbol: `h${symbol}` as "h2" | "h3" | "h4",
        disabled: !requiresEvidence(stage),
        reference: references,
      });
    }
  }

  claims.push({
    name: "reviewed research records support the settings decisions that interpret them",
    type: "markdown",
    root: DOCS,
    files: ["settings/**/*.md"],
    symbol: "h2",
    disabled:
      !requiresEvidence(graph.research) || !requiresEvidence(graph.settings),
    reference: {
      type: "markdown",
      root: DOCS,
      files: ["research/**/*.md"],
      symbol: "h2",
      noEvidenceExclude: true,
      requireReview: requiresReview(graph.settings),
    },
  });
  return claims;
};

const sourcePrinciples = (
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: [`principles/${file}`],
  symbol: "h2",
  noEvidenceExclude: true,
  requireReview: review,
});

const sourceClaims = (graph: IProductionGraph): ITtscEvidenceGraphClaim[] => {
  const claims: ITtscEvidenceGraphClaim[] = [];
  for (const name of [
    "modelSources",
    "spaceSources",
    "materialSources",
    "instanceSources",
    "motionSources",
    "systemSources",
  ] as const) {
    const source = SOURCES[name];
    const design = source.design!;
    const review = requiresReview(graph[name]);
    claims.push(
      {
        name: `${name} owners each answer exactly one ${design} design file`,
        type: "typescript",
        files: [...source.files],
        symbol: [...source.ownerSymbols],
        disabled: !requiresEvidence(graph[name]),
        reference: {
          type: "markdown",
          root: DOCS,
          files: [`${design}/**/*.md`],
          symbol: "file",
          noEvidenceExclude: true,
          singleEvidencePerSymbol: true,
          requireReview: review,
        },
      },
      {
        name: `${name} realize every ${design} unit and source principle`,
        type: "typescript",
        files: [...source.files],
        symbol: [...source.symbols],
        disabled: !requiresEvidence(graph[name]),
        reference: [
          sourcePrinciples(source.principle, review),
          {
            type: "markdown",
            root: DOCS,
            files: [`${design}/**/*.md`],
            symbol: "h2",
            noEvidenceExclude: true,
            requireReview: review,
          },
        ],
      },
    );
  }

  const shotReview = requiresReview(graph.shots);
  claims.push(
    {
      name: "shot and acceptance owners each realize one screenplay scene or brief shot",
      type: "typescript",
      files: [...SOURCES.shots.files],
      symbol: [...SOURCES.shots.symbols],
      disabled: !requiresEvidence(graph.shots),
      reference: {
        type: "markdown",
        root: DOCS,
        files: graph.kind === "film" ? ["script/**/*.md"] : ["briefs/**/*.md"],
        symbol: "h3",
        noEvidenceExclude: true,
        singleEvidencePerSymbol: true,
        requireReview: shotReview,
      },
    },
    {
      name: "shot source realizes every shot-source principle",
      type: "typescript",
      files: [...SOURCES.shots.files],
      symbol: [...SOURCES.shots.symbols],
      disabled: !requiresEvidence(graph.shots),
      reference: sourcePrinciples(SOURCES.shots.principle, shotReview),
    },
    {
      name: "production source serializes settings and production-source principles",
      type: "typescript",
      files: [...SOURCES.productionSources.files],
      symbol: [...SOURCES.productionSources.symbols],
      disabled: !requiresEvidence(graph.productionSources),
      reference: [
        sourcePrinciples(
          SOURCES.productionSources.principle,
          requiresReview(graph.productionSources),
        ),
        ...referencesPerFile(
          graph,
          "settings",
          "h2",
          requiresReview(graph.productionSources),
        ),
      ],
    },
    {
      name: "film source assembles every screenplay sequence or brief delivery",
      type: "typescript",
      files: [...SOURCES.filmSources.files],
      symbol: [...SOURCES.filmSources.symbols],
      disabled: !requiresEvidence(graph.filmSources),
      reference: [
        sourcePrinciples(
          SOURCES.filmSources.principle,
          requiresReview(graph.filmSources),
        ),
        {
          type: "markdown",
          root: DOCS,
          files:
            graph.kind === "film" ? ["script/**/*.md"] : ["briefs/**/*.md"],
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: requiresReview(graph.filmSources),
        },
      ],
    },
  );
  return claims;
};

/**
 * Build the immutable shared graph and append production-owned claims.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Implements the reusable graph behind the project-owned production declaration.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Applies the same exact shared principles, obligations, and discovery inventory to every generated project.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-discovery Distinguishes a completed production-specific search from an omitted search across every authored H2 population.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Enforces the mutually exclusive production shapes and staged parent-child progression.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Validates real target identities, hosts, owners, and lineage before returning a graph.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Appends production-owned claims without exposing a replacement seam for the shared graph.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Produces one deterministic graph or fails with the concrete contradictory state.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Implements the shared construction and validation boundary for generated projects.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Reads and validates the fixed shared contract inventory before constructing claims.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-discovery Wires common, settings, film, layer-specific, and brief discovery targets to their exact H2 populations.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Implements the film, brief, and library stage state machine.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Enumerates the actual disk populations and refuses empty, residual, ambiguous, or ownerless hosts.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Constructs shared claims first and composes local claims after them.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Uses deterministic identities and ordering and returns no partial graph after a validation failure.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract::shared-contract Validates the canonical common document and H2 inventory before building shared claims.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-discovery::discovery-coverage Adds stage-aligned discovery coverage with reviewed population-wide exclusions for a true no-result.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage::shape-stage-machine Enforces production-kind compatibility, lifecycle order, and parent review prerequisites.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity::physical-population-integrity Validates real hosts, residue, identities, ownership cardinality, and lineage.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension::additive-local-claims Appends local claims only after the immutable shared claim population.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result::deterministic-failure Completes every deterministic validation before returning any graph.
 * @author Samchon
 */
export const createAutoMovieEvidenceConfig = (
  graph: IProductionGraph,
): ITtscEvidenceGraphConfig => {
  validateDeclaration(graph);
  const targetIdentities = validateContracts(graph.location);
  validateStages(graph);
  validateHosts(graph);
  validateProductionTargets(graph, targetIdentities);
  const shared = [
    ...authoredClaims(graph),
    ...sourceClaims(graph),
    {
      name: "the reserved evidence-lint canary proves the generated graph is running",
      type: "typescript" as const,
      files: ["test/__evidenceGraphCanary.ts"],
      symbol: "property" as const,
      reference: checklist("common.md", false),
    },
  ];
  return {
    claims: [...shared, ...(graph.claims ?? [])],
  };
};
