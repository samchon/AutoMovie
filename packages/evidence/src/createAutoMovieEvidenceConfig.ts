import {
  type ITtscEvidenceGraphClaim,
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphMarkdownReference,
  type ITtscEvidenceGraphReference,
} from "@ttsc/evidence";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript-compiler";

import type { AutoMoviePopulationScope } from "./AutoMoviePopulationScope";
import { validateAutoMoviePopulationTransition } from "./AutoMoviePopulationTransition";
import {
  type AutoMovieProductionLanguage,
  isAutoMovieProductionLanguage,
} from "./AutoMovieProductionLanguage";
import { assertAutoMovieEvidenceSyntax } from "./assertAutoMovieEvidenceSyntax";
import { assertAutoMovieEvidenceReviewReasons } from "./auditAutoMovieEvidenceReviewReasons";
import { createAutoMoviePopulationAccountClaims } from "./createAutoMoviePopulationAccountClaims";
import { createAutoMoviePopulationFiles } from "./createAutoMoviePopulationFiles";
import type {
  AutoMovieProductionContractClaim,
  AutoMovieProductionContractLayer,
} from "./createAutoMovieProductionContractClaim";
import {
  type IAutoMovieEvidenceTopologyBranch,
  type IAutoMovieEvidenceTopologyDeclaration,
  type IAutoMovieEvidenceTopologyDiagnostic,
  type IAutoMovieEvidenceTopologyEdge,
  inspectAutoMovieEvidenceTopology,
} from "./inspectAutoMovieEvidenceTopology";
import {
  parseAutoMovieEvidenceSyntax,
  projectAutoMovieMarkdownSyntax,
} from "./parseAutoMovieEvidenceSyntax";
import { readAutoMovieContractRules } from "./readAutoMovieContractRules";
import { walkAutoMovieProjectPopulationFiles } from "./walkAutoMovieProjectPopulationFiles";

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
  /** Exact bundled language contract selected for authored documents. */
  language: AutoMovieProductionLanguage;
  /** Exact complete, first-pilot, or post-pilot-reset host population. */
  populationScope: AutoMoviePopulationScope;
  /** Canonical production-settings document stage. */
  settings: Stage;
  /** Optional external-research ledger stage. */
  research: Stage;
  /** Broad-world map design-document stage. */
  maps: Stage;
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
  treatments: Stage;
  /** Film-only physical scene-progression script stage. */
  scripts: Stage;
  /** Film-only final audiovisual screenplay stage. */
  screenplays: Stage;
  /** Brief-only bounded audiovisual contract stage. */
  briefs: Stage;
  /** TypeScript model construction-source stage. */
  modelSources: Stage;
  /** TypeScript resolved-world construction-source stage. */
  mapSources: Stage;
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
  | "maps"
  | "materials"
  | "models"
  | "motions"
  | "research"
  | "screenplays"
  | "scripts"
  | "settings"
  | "spaces"
  | "treatments"
  | "systems";
type SourceLayer =
  | "filmSources"
  | "instanceSources"
  | "mapSources"
  | "materialSources"
  | "modelSources"
  | "motionSources"
  | "productionSources"
  | "shots"
  | "spaceSources"
  | "systemSources";
type EvidenceBranch = MarkdownLayer | SourceLayer;
type ContractDomain = "core" | "delivery" | "design" | "story";
type ContractFamily = "discovery" | "obligations" | "principles" | "upstream";
type ContractRelationship =
  | "checklist"
  | "distributed-coverage"
  | "foundation"
  | "lineage"
  | "population-account";

/**
 * The common-contract routes selected by one production declaration.
 *
 * Every active branch is present even while it is still in draft. `enforced`
 * distinguishes relationships that lint already checks from the complete set
 * the branch will owe at evidence and review. Contract paths are logical
 * domain paths, independent of the package's current physical layout.
 *
 */
interface IAutoMovieContractBindingManifest {
  /** Selected production shape, or null before any branch can be active. */
  kind: ProductionKind | null;
  /** Exact project-local language contract selected for every authored branch. */
  language: AutoMovieProductionLanguage;
  /** Exact authored population selected by the project declaration. */
  populationScope: AutoMoviePopulationScope;
  /** Active authored and source branches in deterministic factory order. */
  branches: readonly {
    name: EvidenceBranch;
    stage: Stage;
  }[];
  /** Every relationship selected for those branches. */
  bindings: readonly {
    branch: EvidenceBranch;
    stage: Stage;
    /** Whether the current lifecycle stage already enables this claim. */
    enforced: boolean;
    /** Stable graph diagnostic that owns the host population. */
    claim: string;
    relationship: ContractRelationship;
    host: {
      type: "markdown" | "typescript";
      root: string;
      files: readonly string[];
      symbols: readonly string[];
    };
    target:
      | {
          type: "contract";
          family: ContractFamily;
          domain: ContractDomain;
          /** Logical family/domain path, not a legacy flat package address. */
          path: string;
          anchors: readonly string[];
        }
      | {
          type: "population";
          root: string;
          files: readonly string[];
          symbols: readonly string[];
        };
  }[];
  /** Positive production-local contract bindings retained with their layer. */
  localBindings: readonly IAutoMovieLocalContractProjection[];
  /** Explicit inapplicable local-contract declarations retained for audit only. */
  localAudits: readonly IAutoMovieLocalContractProjection[];
  /** Canonical provider-consumer matrix and its deterministic audit. */
  topology: {
    branches: readonly IAutoMovieEvidenceTopologyBranch[];
    expected: readonly IAutoMovieEvidenceTopologyEdge[];
    declarations: readonly IAutoMovieEvidenceTopologyDeclaration[];
    diagnostics: readonly IAutoMovieEvidenceTopologyDiagnostic[];
  };
}

interface IAutoMovieLocalContractProjection {
  claim: string;
  layer: AutoMovieProductionContractLayer;
  stage: Stage;
  enforced: boolean;
  populationScope: AutoMoviePopulationScope;
  host: {
    root: string;
    files: readonly string[];
    symbols: readonly string[];
  };
  targets: readonly {
    root: string;
    files: readonly string[];
    symbols: readonly string[];
  }[];
}

interface IMarkdownPopulation {
  headings: readonly (2 | 3 | 4)[];
  obligation: boolean;
  principle: string;
}

interface ISourcePopulation {
  design: Exclude<
    MarkdownLayer,
    | "briefs"
    | "research"
    | "screenplays"
    | "scripts"
    | "settings"
    | "treatments"
  > | null;
  files: readonly string[];
  ownerKinds: readonly ("class" | "function" | "property")[];
  ownerSymbols: readonly ("function" | "property" | "type")[];
  obligation: string;
  symbols: readonly ("function" | "property" | "type")[];
}

const DOCS = "docs";
const CONTRACTS = "contracts";
const CONTRACT_INDEX = `${CONTRACTS}/index.md`;

/**
 * Where the shared contracts actually live.
 *
 * `@automovie/template` ships discovery, upstream, obligation, and principle
 * contracts under their physical `family/domain/file` addresses inside the
 * generated project. The scaffold copies the complete inventory verbatim, so
 * graph lint, instruction sync, and a standalone generated consumer all resolve
 * the same project-owned contract root without reaching back into an installed
 * package. The inventory remains pinned here by domain, filename, and anchor; a
 * missing or locally divergent file is therefore a concrete graph failure.
 */
const sharedDocsRoot = (_location: string): string => DOCS;
const MARKDOWN: Record<MarkdownLayer, IMarkdownPopulation> = {
  settings: { headings: [2], obligation: true, principle: "settings.md" },
  research: { headings: [2], obligation: false, principle: "research.md" },
  maps: { headings: [2], obligation: true, principle: "maps.md" },
  models: { headings: [2], obligation: true, principle: "models.md" },
  spaces: { headings: [2], obligation: true, principle: "spaces.md" },
  materials: { headings: [2], obligation: true, principle: "materials.md" },
  instances: { headings: [2], obligation: true, principle: "instances.md" },
  motions: { headings: [2], obligation: true, principle: "motions.md" },
  systems: { headings: [2], obligation: true, principle: "systems.md" },
  treatments: {
    headings: [2],
    obligation: true,
    principle: "treatments.md",
  },
  scripts: {
    headings: [2, 3, 4],
    obligation: true,
    principle: "scripts.md",
  },
  screenplays: {
    headings: [2, 3, 4],
    obligation: true,
    principle: "screenplays.md",
  },
  briefs: {
    headings: [2, 3, 4],
    obligation: true,
    principle: "briefs.md",
  },
};
const SOURCES: Record<SourceLayer, ISourcePopulation> = {
  mapSources: {
    design: "maps",
    files: ["src/maps/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    obligation: "map-sources.md",
    symbols: ["type", "property", "function"],
  },
  modelSources: {
    design: "models",
    files: ["src/models/**/*.ts"],
    ownerKinds: ["class"],
    ownerSymbols: ["type"],
    obligation: "model-sources.md",
    symbols: ["type", "property", "function"],
  },
  spaceSources: {
    design: "spaces",
    files: ["src/spaces/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    obligation: "space-sources.md",
    symbols: ["type", "property", "function"],
  },
  materialSources: {
    design: "materials",
    files: ["src/materials/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    obligation: "material-sources.md",
    symbols: ["type", "property", "function"],
  },
  instanceSources: {
    design: "instances",
    files: ["src/instances/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    obligation: "instance-sources.md",
    symbols: ["type", "property", "function"],
  },
  motionSources: {
    design: "motions",
    files: ["src/motions/**/*.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    obligation: "motion-sources.md",
    symbols: ["type", "property", "function"],
  },
  systemSources: {
    design: "systems",
    files: ["src/systems/**/*.ts"],
    ownerKinds: ["class", "property", "function"],
    ownerSymbols: ["type", "property", "function"],
    obligation: "system-sources.md",
    symbols: ["type", "property", "function"],
  },
  shots: {
    design: null,
    files: ["src/shots/**/*.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    obligation: "shots.md",
    symbols: ["type", "property", "function"],
  },
  productionSources: {
    design: null,
    files: ["src/production.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    obligation: "production-sources.md",
    symbols: ["type", "property", "function"],
  },
  filmSources: {
    design: null,
    files: ["src/film.ts"],
    ownerKinds: ["property", "function"],
    ownerSymbols: ["property", "function"],
    obligation: "film-sources.md",
    symbols: ["type", "property", "function"],
  },
};
const DESIGN_LAYERS = [
  "maps",
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
  | "designs"
  | "films"
  | "instances"
  | "maps"
  | "materials"
  | "models"
  | "motions"
  | "screenplays"
  | "scripts"
  | "settings"
  | "spaces"
  | "treatments"
  | "systems";

const DISCOVERY_TARGETS: Record<MarkdownLayer, readonly DiscoveryTarget[]> = {
  settings: ["common", "settings"],
  research: ["common"],
  maps: ["common", "designs", "maps"],
  models: ["common", "designs", "models"],
  spaces: ["common", "designs", "spaces"],
  materials: ["common", "designs", "materials"],
  instances: ["common", "designs", "instances"],
  motions: ["common", "designs", "motions"],
  systems: ["common", "designs", "systems"],
  treatments: ["common", "films", "treatments"],
  scripts: ["common", "films", "scripts"],
  screenplays: ["common", "films", "screenplays"],
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
  spaces: ["maps"],
  models: ["spaces"],
  materials: ["models", "spaces"],
  instances: ["maps", "models", "spaces", "materials"],
  motions: ["maps", "models", "spaces", "materials", "instances", "systems"],
  systems: ["maps", "models", "spaces", "materials", "instances", "motions"],
  briefs: DESIGN_LAYERS,
};

const EXPECTED_CONTRACTS = [
  {
    domain: "delivery",
    file: "discovery/delivery/briefs.md",
    anchors: ["work-specific-brief-requirements"],
  },
  {
    domain: "core",
    file: "discovery/core/common.md",
    anchors: ["shared-local-boundary", "canonical-realization"],
  },
  {
    domain: "design",
    file: "discovery/design/designs.md",
    anchors: ["work-specific-design-requirements"],
  },
  {
    domain: "story",
    file: "discovery/story/films.md",
    anchors: ["work-specific-film-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/instances.md",
    anchors: ["work-specific-instance-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/maps.md",
    anchors: ["work-specific-map-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/materials.md",
    anchors: ["work-specific-material-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/models.md",
    anchors: ["work-specific-model-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/motions.md",
    anchors: ["work-specific-motion-requirements"],
  },
  {
    domain: "story",
    file: "discovery/story/scripts.md",
    anchors: ["work-specific-script-requirements"],
  },
  {
    domain: "story",
    file: "discovery/story/screenplays.md",
    anchors: ["work-specific-screenplay-requirements"],
  },
  {
    domain: "core",
    file: "discovery/core/settings.md",
    anchors: [
      "directive-promise-subject-requirements",
      "planned-delivery-backcast",
    ],
  },
  {
    domain: "design",
    file: "discovery/design/spaces.md",
    anchors: ["work-specific-space-requirements"],
  },
  {
    domain: "story",
    file: "discovery/story/treatments.md",
    anchors: ["work-specific-treatment-requirements"],
  },
  {
    domain: "design",
    file: "discovery/design/systems.md",
    anchors: ["work-specific-system-requirements"],
  },
  {
    domain: "delivery",
    file: "obligations/delivery/briefs.md",
    anchors: [
      "single-scope-eligibility",
      "brief-unit-addressability",
      "observable-progression",
    ],
  },
  {
    domain: "core",
    file: "obligations/core/common.md",
    anchors: [
      "purpose-fit",
      "layer-boundary",
      "production-language",
      "proportionate-development",
    ],
  },
  {
    domain: "core",
    file: "obligations/core/defaults.md",
    anchors: ["recurrent-frame-distribution", "surface-cadence-distribution"],
  },
  {
    domain: "design",
    file: "obligations/design/instances.md",
    anchors: [
      "addressable-instance-decisions",
      "instance-prototype-membership",
      "instance-identity-transform",
      "instance-variation-tiers",
      "instance-placement-review",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/maps.md",
    anchors: [
      "addressable-map-decisions",
      "map-world-site-interface",
      "map-world-content-relations",
      "map-world-temporal-state",
      "map-world-scale-partition",
      "map-world-source-resolution",
      "map-review-set",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/materials.md",
    anchors: [
      "addressable-material-decisions",
      "material-identity-assembly",
      "material-surface-assignment",
      "material-response",
      "material-review-set",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/models.md",
    anchors: [
      "addressable-model-decisions",
      "representation-ceiling",
      "reference-scale",
      "articulation-ownership",
      "model-review-set",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/motions.md",
    anchors: [
      "addressable-motion-decisions",
      "time-base",
      "contact-policy",
      "composition-interruption",
      "motion-review-set",
    ],
  },
  {
    domain: "story",
    file: "obligations/story/narratives.md",
    anchors: [
      "unit-addressability",
      "unit-contribution-distribution",
      "sequence-connection",
      "state-continuity-distribution",
      "character-continuity-distribution",
      "temporal-gear-distribution",
      "speech-distribution",
      "voice-frame-distribution",
      "pacing-arrangement",
    ],
  },
  {
    domain: "story",
    file: "obligations/story/scripts.md",
    anchors: ["release-partition", "script-boundary"],
  },
  {
    domain: "story",
    file: "obligations/story/screenplays.md",
    anchors: [
      "realization-ready-contract",
      "screenplay-format-scene-completeness",
      "screenplay-revision-realization-handoff",
    ],
  },
  {
    domain: "core",
    file: "obligations/core/settings.md",
    anchors: [
      "addressable-canon",
      "delivery-scope",
      "governing-aim",
      "production-visual-grammar",
      "production-fidelity-tier",
      "subject-breakdown-production-scope",
      "audience-operator-access",
      "accessibility-deliverable-states",
      "coordinate-unit-convention",
      "delivery-review-condition",
      "settings-coverage-map",
      "operative-subject-inventory",
      "agency-and-limits",
      "design-dependent-subject-conditions",
      "minimal-departure",
      "internal-coherence",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/spaces.md",
    anchors: [
      "addressable-spatial-decisions",
      "space-reference-topology",
      "space-envelope-interface",
      "space-access-circulation",
      "space-review-set",
    ],
  },
  {
    domain: "story",
    file: "obligations/story/subjects.md",
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
    domain: "story",
    file: "obligations/story/treatments.md",
    anchors: [
      "opening-condition",
      "terminal-condition",
      "audience-route",
      "resolution-aftermath",
      "thematic-development",
      "treatment-boundary",
      "sustained-middle",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/systems.md",
    anchors: [
      "addressable-system-decisions",
      "system-ownership-interfaces",
      "system-state-clock",
      "system-budget-degradation",
      "system-review-set",
    ],
  },
  {
    domain: "delivery",
    file: "principles/delivery/briefs.md",
    anchors: ["brief-information-structure", "no-narrative-smuggling"],
  },
  {
    domain: "core",
    file: "principles/core/common.md",
    anchors: [
      "scope-preservation",
      "substantive-completion",
      "evidence-content-conformance",
      "machine-default",
      "declared-basis",
    ],
  },
  {
    domain: "core",
    file: "principles/core/defaults.md",
    anchors: [
      "purposeful-enumeration",
      "earned-significance",
      "responsive-qualification",
      "functional-formatting",
      "contrastive-definition",
    ],
  },
  {
    domain: "core",
    file: "principles/core/source-units.md",
    anchors: ["source-scope-preservation", "source-substantive-completion"],
  },
  {
    domain: "delivery",
    file: "obligations/delivery/film-sources.md",
    anchors: [
      "editorial-only-assembly",
      "authored-auxiliary-tracks",
      "deterministic-timeline",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/instance-sources.md",
    anchors: [
      "instance-source-design-ownership",
      "instance-source-stable-membership",
      "instance-source-invalid-placement",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/map-sources.md",
    anchors: [
      "map-source-design-ownership",
      "map-source-deterministic-world",
      "map-source-preserved-lineage",
      "map-source-invalid-world",
    ],
  },
  {
    domain: "design",
    file: "principles/design/instances.md",
    anchors: [
      "instance-information-structure",
      "instance-prototype-boundary",
      "instance-derivation-authority",
      "instance-verification-address",
    ],
  },
  {
    domain: "design",
    file: "principles/design/maps.md",
    anchors: [
      "map-addressable-world-identity",
      "map-information-structure",
      "map-coordinate-extent-scale",
      "map-verification-address",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/material-sources.md",
    anchors: [
      "material-source-design-ownership",
      "material-source-renderer-mapping",
      "material-source-invalid-state",
    ],
  },
  {
    domain: "design",
    file: "principles/design/materials.md",
    anchors: [
      "material-information-structure",
      "material-construction-appearance",
      "material-binding-interface",
      "material-verification-address",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/model-sources.md",
    anchors: [
      "design-owned-construction",
      "deterministic-build",
      "unsupported-fidelity-is-explicit",
    ],
  },
  {
    domain: "design",
    file: "principles/design/models.md",
    anchors: [
      "model-information-structure",
      "representation-contract",
      "spatial-convention",
      "reviewable-structure",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/motion-sources.md",
    anchors: [
      "design-owned-transition",
      "pure-time-mapping",
      "invalid-input-is-visible",
    ],
  },
  {
    domain: "design",
    file: "principles/design/motions.md",
    anchors: [
      "motion-information-structure",
      "state-endpoints",
      "temporal-phases",
      "spatial-relation",
      "parameter-domain",
    ],
  },
  {
    domain: "story",
    file: "principles/story/narratives.md",
    anchors: [
      "unit-function",
      "unit-connection",
      "horizontal-state-continuity",
      "narrated-time",
      "audience-investment",
      "character-continuity",
      "information-entry",
      "specificity",
      "closing-line-contribution",
      "parent-differentiation",
      "drive-to-turn",
      "unit-identity",
      "state-continuity",
      "observable-inheritance",
    ],
  },
  {
    domain: "delivery",
    file: "obligations/delivery/production-sources.md",
    anchors: [
      "settings-only-serialization",
      "delivery-identity",
      "shared-visual-grammar",
    ],
  },
  {
    domain: "core",
    file: "principles/core/research.md",
    anchors: [
      "source-identity",
      "production-consequence",
      "uncertainty-boundary",
    ],
  },
  {
    domain: "story",
    file: "principles/story/scripts.md",
    anchors: [
      "staging-blocks",
      "scene-entry-state",
      "scene-exit-state",
      "executable-progression",
      "dialogue-action",
      "knowledge-state",
    ],
  },
  {
    domain: "story",
    file: "principles/story/screenplays.md",
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
      "master-scene-shooting-boundary",
      "screenplay-scene-completion",
      "screenplay-locked-revision",
      "screenplay-heading-identity",
    ],
  },
  {
    domain: "core",
    file: "principles/core/settings.md",
    anchors: [
      "information-structure",
      "fact-status",
      "source-support",
      "capability-boundary",
      "constraint-sufficiency",
      "observable-identity",
    ],
  },
  {
    domain: "delivery",
    file: "obligations/delivery/shots.md",
    anchors: [
      "contract-only-composition",
      "explicit-inputs-and-time",
      "acceptance-travels-with-delivery",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/space-sources.md",
    anchors: [
      "space-source-design-ownership",
      "space-source-stable-identities",
      "space-source-invalid-topology",
    ],
  },
  {
    domain: "design",
    file: "principles/design/spaces.md",
    anchors: [
      "space-information-structure",
      "space-topology",
      "space-boundary-authority",
      "space-verification-address",
    ],
  },
  {
    domain: "story",
    file: "principles/story/treatments.md",
    anchors: [
      "treatment-paragraphs",
      "causal-turn",
      "audience-change",
      "information-design",
    ],
  },
  {
    domain: "design",
    file: "obligations/design/system-sources.md",
    anchors: [
      "system-source-design-ownership",
      "system-source-explicit-evaluation",
      "system-source-failure-budget",
    ],
  },
  {
    domain: "design",
    file: "principles/design/systems.md",
    anchors: [
      "system-information-structure",
      "system-authority-confinement",
      "system-dependency-basis",
      "system-verification-address",
    ],
  },
  {
    domain: "core",
    file: "principles/core/inherited-units.md",
    anchors: ["derived-parent-differentiation"],
  },
  {
    domain: "delivery",
    file: "upstream/delivery/briefs.md",
    anchors: ["parent-revision-from-brief-work"],
  },
  {
    domain: "delivery",
    file: "upstream/delivery/film-sources.md",
    anchors: ["parent-revision-from-film-source-work"],
  },
  {
    domain: "delivery",
    file: "upstream/delivery/production-sources.md",
    anchors: ["settings-revision-from-production-source-work"],
  },
  {
    domain: "delivery",
    file: "upstream/delivery/shots.md",
    anchors: ["parent-revision-from-shot-work"],
  },
  {
    domain: "design",
    file: "upstream/design/instance-sources.md",
    anchors: ["design-revision-from-instance-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/instances.md",
    anchors: ["parent-revision-from-instance-work"],
  },
  {
    domain: "design",
    file: "upstream/design/map-sources.md",
    anchors: ["design-revision-from-map-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/maps.md",
    anchors: ["settings-revision-from-map-work"],
  },
  {
    domain: "design",
    file: "upstream/design/material-sources.md",
    anchors: ["design-revision-from-material-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/materials.md",
    anchors: ["parent-revision-from-material-work"],
  },
  {
    domain: "design",
    file: "upstream/design/model-sources.md",
    anchors: ["design-revision-from-model-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/models.md",
    anchors: ["settings-and-space-revision-from-model-work"],
  },
  {
    domain: "design",
    file: "upstream/design/motion-sources.md",
    anchors: ["design-revision-from-motion-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/motions.md",
    anchors: ["parent-revision-from-motion-work"],
  },
  {
    domain: "design",
    file: "upstream/design/space-sources.md",
    anchors: ["design-revision-from-space-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/spaces.md",
    anchors: ["settings-and-map-revision-from-space-work"],
  },
  {
    domain: "design",
    file: "upstream/design/system-sources.md",
    anchors: ["design-revision-from-system-source-work"],
  },
  {
    domain: "design",
    file: "upstream/design/systems.md",
    anchors: ["parent-revision-from-system-work"],
  },
  {
    domain: "story",
    file: "upstream/story/screenplays.md",
    anchors: ["script-and-canon-revision-from-screenplay-work"],
  },
  {
    domain: "story",
    file: "upstream/story/scripts.md",
    anchors: ["treatment-and-settings-revision-from-script-work"],
  },
  {
    domain: "story",
    file: "upstream/story/treatments.md",
    anchors: ["settings-revision-from-treatment-work"],
  },
] as const;

type ExpectedContract = (typeof EXPECTED_CONTRACTS)[number];

const contractFamily = (contract: ExpectedContract): ContractFamily =>
  contract.file.split("/", 1)[0] as ContractFamily;

const contractBasename = (contract: ExpectedContract): string =>
  contract.file.slice(contract.file.lastIndexOf("/") + 1);

const logicalContractPath = (contract: ExpectedContract): string =>
  `${contractFamily(contract)}/${contract.domain}/${contractBasename(contract)}`;

/** Resolve every graph reference through the canonical physical inventory. */
const expectedContract = (
  family: ContractFamily,
  basename: string,
): ExpectedContract =>
  EXPECTED_CONTRACTS.find(
    (contract) =>
      contractFamily(contract) === family &&
      contractBasename(contract) === basename,
  )!;

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

const validatePopulationScope = (graph: IProductionGraph): void => {
  const scope: unknown = graph.populationScope;
  if (scope === null || typeof scope !== "object" || Array.isArray(scope))
    throw new Error("Production populationScope must be an explicit object.");
  const declaration = scope as Record<string, unknown>;
  const mode = declaration.mode;
  if (
    mode !== "complete-production" &&
    mode !== "complete-production-reset" &&
    mode !== "first-pilot"
  )
    throw new Error(
      `Unsupported production population scope ${describeDeclarationValue(mode)}.`,
    );
  const allowed = new Set(
    mode === "first-pilot"
      ? ["mode", "partitionGroup"]
      : mode === "complete-production-reset"
        ? ["mode", "owner", "transition"]
        : ["mode"],
  );
  const unexpected = Object.keys(declaration).filter(
    (key) => !allowed.has(key),
  );
  if (unexpected.length !== 0)
    throw new Error(
      `Production populationScope has unsupported fields: ${unexpected.join(", ")}.`,
    );
  if (mode === "complete-production") return;
  if (mode === "complete-production-reset") {
    if (graph.kind !== "film" && graph.kind !== "library")
      throw new Error(
        "complete-production-reset is available only after a film or library pilot.",
      );
    if (
      typeof declaration.owner !== "string" ||
      declaration.owner.trim() === ""
    )
      throw new Error(
        "A complete-production-reset requires a non-empty owner.",
      );
    if (
      declaration.transition === null ||
      typeof declaration.transition !== "object" ||
      Array.isArray(declaration.transition)
    )
      throw new Error(
        "A complete-production-reset requires a transition receipt object.",
      );
    return;
  }
  if (graph.kind === "film") {
    createAutoMoviePopulationFiles(
      "scripts",
      scope as AutoMoviePopulationScope,
    );
    return;
  }
  if (graph.kind === "library") {
    if (Object.hasOwn(declaration, "partitionGroup"))
      throw new Error(
        "A library pilot cannot invent a partitionGroup selector.",
      );
    return;
  }
  throw new Error("first-pilot is available only for a film or library.");
};

/** Refuse a production-local claim detached from this graph declaration. */
const validateLocalClaims = (graph: IProductionGraph): void => {
  for (const raw of graph.claims ?? []) {
    const claim = raw as Partial<AutoMovieProductionContractClaim>;
    if (claim.autoMovieBinding === undefined) continue;
    const binding = claim.autoMovieBinding;
    if (
      raw.type !== "markdown" ||
      binding === null ||
      typeof binding !== "object" ||
      !Object.hasOwn(MARKDOWN, binding.layer) ||
      binding.stage !== graph[binding.layer] ||
      !isDeepStrictEqual(binding.populationScope, graph.populationScope) ||
      (binding.disposition !== "binding" &&
        binding.disposition !== "inapplicable") ||
      (raw.disabled === true) !==
        (binding.stage === "disabled" ||
          binding.stage === "draft" ||
          binding.disposition === "inapplicable") ||
      (binding.disposition === "inapplicable" &&
        (binding.populationScope?.mode !== "first-pilot" ||
          raw.disabled !== true))
    )
      throw new Error(
        `Production-local claim ${JSON.stringify(raw.name)} does not match its declared layer, stage, population scope, or disposition.`,
      );
  }
};

const validateDeclaration = (graph: IProductionGraph): void => {
  if (typeof graph.location !== "string" || !path.isAbsolute(graph.location))
    throw new Error(
      `Production evidence location must be an absolute string; received ${describeDeclarationValue(graph.location)}.`,
    );
  if (!fs.existsSync(graph.location))
    throw new Error(
      `Production evidence location does not exist: ${posix(graph.location)}.`,
    );
  const locationEntry = fs.lstatSync(graph.location);
  if (locationEntry.isSymbolicLink())
    walkAutoMovieProjectPopulationFiles(graph.location, graph.location, ".md");
  if (!locationEntry.isDirectory())
    throw new Error(
      `Production evidence location is not a directory: ${posix(graph.location)}.`,
    );
  const kind: unknown = graph.kind;
  if (!PRODUCTION_KINDS.includes(kind))
    throw new Error(
      `Unsupported production kind ${describeDeclarationValue(kind)}.`,
    );
  if (!isAutoMovieProductionLanguage(graph.language))
    throw new Error(
      `Unsupported production language ${describeDeclarationValue(graph.language)}.`,
    );
  validatePopulationScope(graph);
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
  validateLocalClaims(graph);
};

const walkFiles = (root: string, extension: ".md" | ".ts"): string[] => {
  if (!fs.existsSync(root)) return [];
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

/** Walk one local population after proving its physical boundary. */
const walkProjectFiles = (
  graph: IProductionGraph,
  root: string,
  extension: ".md" | ".ts",
): string[] =>
  walkAutoMovieProjectPopulationFiles(graph.location, root, extension);

/**
 * Inventory active populations and inactive residue before any graph walk.
 * The installed shared-contract package is deliberately outside these two
 * project-owned trees, so a workspace link there remains valid.
 */
const validateProjectPopulationBoundary = (graph: IProductionGraph): void => {
  walkProjectFiles(graph, path.join(graph.location, DOCS), ".md");
  walkProjectFiles(graph, path.join(graph.location, "src"), ".ts");
};

const validateReviewReasons = (graph: IProductionGraph): void => {
  const files = [
    ...walkProjectFiles(graph, path.join(graph.location, DOCS), ".md"),
    ...walkProjectFiles(graph, path.join(graph.location, "src"), ".ts"),
  ];
  const documents = files.map((file) => ({
    path: posix(path.relative(graph.location, file)),
    source: fs.readFileSync(file, "utf8"),
  }));
  assertAutoMovieEvidenceSyntax(documents);
  assertAutoMovieEvidenceReviewReasons(documents);
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

const visibleMarkdownLines = (source: string): readonly string[] =>
  projectAutoMovieMarkdownSyntax({
    path: "document.md",
    source,
  }).visibleLines;

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

const POSITIVE_EVIDENCE_TAG = /@evidence(?!Exclude)[A-Za-z]*\b/u;
const EXCLUSION_TAG = /@evidenceExclude[A-Za-z]*\b/u;
const DISCOVERY_EVIDENCE_TAG = /@evidence\s+discovery\/[\w./#-]+/u;
const DISCOVERY_EXCLUSION_TAG = /@evidenceExclude\s+discovery\/[\w./#-]+/u;
const EVIDENCE_TARGET = /@evidence[A-Za-z]*\s+([^\s]+)/gu;

const validateTargetForm = (
  relative: string,
  file: string,
  allowEvidencePreamble = false,
): IHeadingIdentity[] => {
  const source = fs.readFileSync(file, "utf8");
  const headings = markdownHeadings(file);
  const h1 = headings.filter((heading) => heading.depth === 1);
  const h1Offset = source.search(/^#(?!#)[ \t]+\S/mu);
  const preamble = h1Offset === -1 ? source : source.slice(0, h1Offset);
  const preambleIsOnlyComments =
    allowEvidencePreamble &&
    preamble.replace(/<!--[\s\S]*?-->/gu, "").trim().length === 0;
  if (
    h1.length !== 1 ||
    headings[0]?.depth !== 1 ||
    (/^#(?!#)[ \t]+\S/u.test(source.trimStart()) === false &&
      !preambleIsOnlyComments)
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

/** Refuse public source syntax the evidence graph cannot address as a host. */
const assertSourceExportsAreEvidenceAddressable = (
  relative: string,
  file: string,
  text: string,
): void => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const refuse = (form: string, replacement: string): never => {
    throw new Error(
      `${relative} ${form}, which no evidence type, function, or property selector can address. ${replacement}.`,
    );
  };
  const modifiersOf = (node: ts.Node): readonly ts.Modifier[] =>
    ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
  const directlyExported = (node: ts.Node): boolean =>
    modifiersOf(node).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  const bindingNames = (name: ts.BindingName): string[] =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) =>
          ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
        );
  const declarationNames = (statement: ts.Statement): string[] => {
    if (ts.isVariableStatement(statement))
      return statement.declarationList.declarations.flatMap((declaration) =>
        bindingNames(declaration.name),
      );
    if (
      ts.isClassDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    )
      return statement.name === undefined
        ? []
        : [statement.name.getText(source)];
    return [];
  };
  const localDeclarations = new Set(
    source.statements.flatMap((statement) => declarationNames(statement)),
  );
  const namedExportsOf = (
    clause: ts.NamedExportBindings | undefined,
  ): ts.NamedExports => {
    if (clause === undefined)
      return refuse(
        "uses a barrel or namespace export",
        "Export a local named declaration",
      );
    if (!ts.isNamedExports(clause))
      return refuse(
        "uses a namespace export",
        "Export a local named declaration",
      );
    return clause;
  };
  const localExports = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const clause = namedExportsOf(statement.exportClause);
    if (statement.moduleSpecifier !== undefined)
      refuse(
        "uses a barrel or cross-module re-export",
        "Export a named declaration owned by this module",
      );
    for (const element of clause.elements) {
      const local = (element.propertyName ?? element.name).text;
      if (element.name.text === "default" || !localDeclarations.has(local))
        refuse(
          "uses a default alias or imported re-export",
          "Export a stable declaration owned by this module",
        );
      localExports.add(local);
    }
  }
  const validateMembers = (
    owner: string,
    members: readonly ts.Declaration[],
  ): void => {
    for (const member of members) {
      const modifiers = modifiersOf(member);
      if (
        modifiers.some(
          (modifier) =>
            modifier.kind === ts.SyntaxKind.PrivateKeyword ||
            modifier.kind === ts.SyntaxKind.ProtectedKeyword,
        )
      )
        continue;
      const name = ts.getNameOfDeclaration(member);
      if (name !== undefined && ts.isPrivateIdentifier(name)) continue;
      const display = name?.getText(source) ?? "unnamed member";
      if (
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member) ||
        (ts.isPropertyDeclaration(member) &&
          modifiers.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AccessorKeyword,
          ))
      )
        refuse(
          `exports public accessor ${owner}.${display}`,
          "Use a plain readonly property or named method",
        );
      if (name !== undefined && ts.isComputedPropertyName(name))
        refuse(
          `exports computed public member ${owner}.${display}`,
          "Use a stable identifier",
        );
      if (
        name !== undefined &&
        ts.isStringLiteral(name) &&
        (name.text.length === 0 || /\s/u.test(name.text))
      )
        refuse(
          `exports unaddressable public literal member ${owner}.${display}`,
          "Use a non-empty, whitespace-free identifier",
        );
    }
  };

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) continue;
    if (
      ts.isExportAssignment(statement) ||
      ts.isNamespaceExportDeclaration(statement)
    )
      refuse(
        "uses a default export expression or namespace export",
        "Export the named declaration directly from its owning module",
      );
    if (
      !directlyExported(statement) &&
      !declarationNames(statement).some((name) => localExports.has(name))
    )
      continue;
    if (ts.isEnumDeclaration(statement))
      refuse(
        `exports enum ${statement.name.text}`,
        "Use a closed string-literal union",
      );
    if (ts.isModuleDeclaration(statement))
      refuse(
        `exports namespace ${statement.name.getText(source)}`,
        "Use direct named ES-module exports",
      );
    if (
      (ts.isClassDeclaration(statement) ||
        ts.isFunctionDeclaration(statement)) &&
      statement.name === undefined
    )
      refuse(
        "exports an anonymous default declaration",
        "Give the declaration a stable name and export it directly",
      );
    if (ts.isClassDeclaration(statement)) {
      validateMembers(statement.name!.text, statement.members);
      continue;
    }
    if (ts.isInterfaceDeclaration(statement)) {
      validateMembers(statement.name.text, statement.members);
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      if (ts.isTypeLiteralNode(statement.type))
        validateMembers(statement.name.text, statement.type.members);
      continue;
    }
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isVariableStatement(statement)
    )
      continue;
    refuse(
      `exports unsupported ${ts.SyntaxKind[statement.kind]} syntax`,
      "Use a named interface, type alias, class, function, or variable",
    );
  }
};

const validateContracts = (
  location: string,
  language: AutoMovieProductionLanguage,
): ITargetIdentityRegistry => {
  const root = path.resolve(location, sharedDocsRoot(location));
  const actual = [
    ...walkFiles(path.join(root, "discovery"), ".md"),
    ...walkFiles(path.join(root, "obligations"), ".md"),
    ...walkFiles(path.join(root, "principles"), ".md"),
    ...walkFiles(path.join(root, "upstream"), ".md"),
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
    if (parseAutoMovieEvidenceSyntax({ path: relative, source }).length !== 0)
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
  validateStructuredSharedRules(root);
  validateLanguageContract(root, language);
  return { anchors, titles };
};

/** Validate exact routing metadata for the shared rules whose timing is binding. */
const validateStructuredSharedRules = (root: string): void => {
  const principles = readAutoMovieContractRules(path.join(root, "principles"), {
    requireEveryH2In: ["core/defaults.md"],
  });
  const obligations = readAutoMovieContractRules(path.join(root, "obligations"), {
    requireEveryH2In: ["core/defaults.md"],
  });
  const expected = new Map<string, string>([
    ["sh-purposeful-enumeration", "composition-safe"],
    ["sh-earned-significance", "composition-safe"],
    ["sh-responsive-qualification", "composition-safe"],
    ["sh-functional-formatting", "composition-safe"],
    ["sh-material-contrast", "composition-safe"],
    ["sh-closing-line-contribution", "composition-safe"],
    ["sh-recurrent-frame-distribution", "post-draft-frequency"],
    ["sh-surface-cadence-distribution", "population-distribution"],
  ]);
  const received = new Map(
    [...principles, ...obligations].map((rule) => [
      rule.metadata.id,
      rule.metadata.safeApplication,
    ]),
  );
  for (const [id, application] of expected)
    if (received.get(id) !== application)
      throw new Error(
        `${id}: expected one structured ${application} contract rule.`,
      );
};

/** Refuse an omitted, residual, or metadata-mismatched selected language pack. */
const validateLanguageContract = (
  root: string,
  language: AutoMovieProductionLanguage,
): void => {
  const languageRoot = path.join(root, "language");
  const expectedFiles = [
    "discovery/signals.md",
    "obligations/common.md",
    "principles/common.md",
  ];
  const actualFiles = walkFiles(languageRoot, ".md")
    .map((file) => posix(path.relative(languageRoot, file)))
    .sort(compareCodeUnits);
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((file, index) => file !== expectedFiles[index])
  )
    throw new Error(
      `Selected ${language} language contract must contain exactly [${expectedFiles.join(", ")}]; received [${actualFiles.join(", ")}].`,
    );
  const expectedRules = [
    [`${language}-work-specific-conditions`, "observation-only"],
    [`${language}-population-${language === "english" ? "register-frame" : "interference"}-account`, "population-distribution"],
    [`${language}-audience-language-access`, "population-distribution"],
    [
      language === "english"
        ? "english-idiomatic-relation"
        : `${language}-contextual-relation`,
      "composition-safe",
    ],
    [`${language}-register-ownership`, "composition-safe"],
  ] as const;
  const rules = readAutoMovieContractRules(languageRoot, {
    requireEveryH2In: expectedFiles,
  });
  const routes = new Map(
    rules.map((rule) => [rule.metadata.id, rule.metadata.safeApplication]),
  );
  if (
    rules.length !== expectedRules.length ||
    expectedRules.some(([id, application]) => routes.get(id) !== application)
  )
    throw new Error(
      `Selected ${language} language contract carries an incomplete or mismatched structured rule identity.`,
    );
};

/**
 * Refuses a work-specific contract that the flat discovery host cannot see.
 *
 * The filename prefix identifies a local rule's family, so a nested directory
 * would introduce a second, disagreeing family address while `contracts/*.md`
 * silently selected nothing below it. The index is the negative ledger only:
 * retained rules live beside it, and their exclusions cannot be scattered.
 */
const validateWorkSpecificContracts = (graph: IProductionGraph): void => {
  const root = path.join(graph.location, DOCS, CONTRACTS);
  const entries = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true })
    : [];
  const invalidEntry = entries.find(
    (entry) =>
      !(
        (entry.isFile() && path.extname(entry.name) === ".md") ||
        (entry.isFile() && entry.name === ".gitkeep")
      ),
  );
  if (invalidEntry !== undefined)
    throw new Error(
      `${CONTRACTS}/${invalidEntry.name}: contracts are Markdown files directly under docs/contracts, and a nested or non-contract entry is claimed by nothing.`,
    );
  const markdown = entries.filter(
    (entry) => entry.isFile() && path.extname(entry.name) === ".md",
  );
  if (
    (Object.keys(MARKDOWN) as MarkdownLayer[]).some((layer) =>
      isActive(graph[layer]),
    ) &&
    markdown.length === 0
  )
    throw new Error(
      "An active authored layer requires a retained docs/contracts rule or a truthful-negative contracts/index.md ledger.",
    );
  for (const entry of markdown) {
    const relative = `${CONTRACTS}/${entry.name}`;
    const file = path.join(root, entry.name);
    const source = fs.readFileSync(file, "utf8");
    const annotations = parseAutoMovieEvidenceSyntax({
      path: relative,
      source,
    });
    const evidence = annotations
      .map((annotation) => annotation.text)
      .join("\n");
    const headings = markdownHeadings(file);
    const h1 = headings.filter((heading) => heading.depth === 1);
    const h1Offset = source.search(/^#(?!#)[ \t]+\S/mu);
    const preamble = h1Offset === -1 ? source : source.slice(0, h1Offset);
    if (
      h1.length !== 1 ||
      headings[0]?.depth !== 1 ||
      preamble.replace(/<!--[\s\S]*?-->/gu, "").trim().length !== 0
    )
      throw new Error(
        `${relative} must begin with one H1 after a comment-only evidence preamble.`,
      );
    if (annotations.some((annotation) => annotation.line >= h1[0]!.line))
      throw new Error(
        `${relative} may carry discovery host tags only in its comment preamble before H1.`,
      );
    for (const match of evidence.matchAll(EVIDENCE_TARGET))
      if (match[1]?.startsWith("discovery/") !== true)
        throw new Error(
          `${relative} may host only discovery evidence before its H1; received ${match[1]}.`,
        );
    if (relative === CONTRACT_INDEX) {
      if (POSITIVE_EVIDENCE_TAG.test(evidence))
        throw new Error(
          `${CONTRACT_INDEX} carries truthful discovery negatives and nothing positive.`,
        );
      if (headings.some((heading) => heading.depth >= 2))
        throw new Error(
          `${CONTRACT_INDEX} carries the truthful negative ledger and no contract target H2.`,
        );
      if (!DISCOVERY_EXCLUSION_TAG.test(evidence))
        throw new Error(
          `${CONTRACT_INDEX} must record at least one truthful discovery negative.`,
        );
    } else {
      if (EXCLUSION_TAG.test(evidence))
        throw new Error(
          `${relative} cannot scatter a discovery exclusion outside ${CONTRACT_INDEX}.`,
        );
      if (!DISCOVERY_EVIDENCE_TAG.test(evidence))
        throw new Error(
          `${relative} must adopt at least one retained discovery rule.`,
        );
    }
  }
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
  return walkProjectFiles(graph, base, type === "markdown" ? ".md" : ".ts")
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
    "upstream",
    ...Object.keys(MARKDOWN),
  ]);
  const targets = walkProjectFiles(graph, root, ".md")
    .map((file) => posix(path.relative(root, file)))
    .filter(
      (file) =>
        file !== "README.md" &&
        file !== CONTRACT_INDEX &&
        !reserved.has(file.split("/", 1)[0]!),
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
    const localContract = target.startsWith(`${CONTRACTS}/`);
    if (!localContract)
      throw new Error(
        `${target} is a production-only target outside the flat docs/contracts inventory.`,
      );
    for (const unit of validateTargetForm(target, file, localContract)) {
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

/**
 * Refuse a design layer that reaches review over an active but unreviewed
 * foundation.
 *
 * `designFoundations` contributes a foundation's units only once that
 * foundation is itself in review, so a host promoted ahead of its foundation
 * pays nothing for it and reads complete. A production could therefore review
 * `spaces` against a `draft` `maps` with zero map references demanded, and
 * collect that debt only later, when the parent caught up. The window is a
 * false completion rather than permanent unsoundness, which is exactly the kind
 * of gap a stage is supposed to close.
 *
 * The gate is on entering review rather than on entering draft, because
 * `DESIGN_FOUNDATIONS` is not a tree. `motions` and `systems` name each other,
 * so a draft-entry rule would deadlock the pair with no legal order. Gating
 * review lets both sit in draft and evidence while they are written against one
 * another and then promote together in one declaration, which is the only
 * honest way to review a mutual dependency: each is read with the other's
 * reviewed units available.
 *
 * An inactive foundation is skipped rather than demanded. A library that
 * delivers spaces without a map branch owes no map references, and forcing one
 * would manufacture an owner for a decision the production never made.
 */
const requireReviewedFoundations = (graph: IProductionGraph): void => {
  for (const [name, foundations] of Object.entries(DESIGN_FOUNDATIONS) as [
    MarkdownLayer,
    readonly DesignLayer[],
  ][]) {
    if (graph[name] !== "review") continue;
    for (const design of foundations)
      if (isActive(graph[design]) && graph[design] !== "review")
        throw new Error(
          `${name} cannot enter review before ${design} is in review. An active foundation contributes no units until it is reviewed, so reviewing ${name} first pays nothing for ${design}. Promote both in one declaration when they depend on each other.`,
        );
  }
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
  if (graph.populationScope.mode === "complete-production-reset") {
    if (
      graph.kind === "film" &&
      [graph.treatments, graph.scripts, graph.screenplays].some(
        (stage) => stage !== "draft",
      )
    )
      throw new Error(
        "A film complete-production-reset requires treatments, scripts, and screenplays to reset together to draft.",
      );
    if (graph.kind === "library") {
      const hasResetPair = (Object.keys(SOURCES) as SourceLayer[]).some(
        (source) => {
          const design = SOURCES[source].design;
          return (
            design !== null &&
            graph[design] === "draft" &&
            graph[source] === "draft"
          );
        },
      );
      if (!hasResetPair)
        throw new Error(
          "A library complete-production-reset requires at least one matching design and source branch in draft.",
        );
    }
  }
  if (!isActive(graph.settings) && !isActive(graph.research))
    throw new Error(
      `${graph.kind} must begin with research or an active settings layer.`,
    );
  if (graph.kind === "film" && isActive(graph.briefs))
    throw new Error("A film cannot activate the direct-brief layer.");
  if (
    graph.kind === "brief" &&
    [graph.treatments, graph.scripts, graph.screenplays].some(isActive)
  )
    throw new Error(
      "A brief cannot activate treatments, scripts, or screenplays; choose film when narrative refinement is required.",
    );
  if (
    graph.kind === "library" &&
    [
      graph.treatments,
      graph.scripts,
      graph.screenplays,
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
    "maps",
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
    "treatments",
    "briefs",
  ] as const)
    requireReviewedParent(name, graph[name], "settings", graph.settings);
  requireReviewedFoundations(graph);
  if (
    graph.populationScope.mode !== "complete-production-reset" ||
    graph.kind !== "film"
  ) {
    requireReviewedParent(
      "scripts",
      graph.scripts,
      "treatments",
      graph.treatments,
    );
    requireReviewedParent(
      "screenplays",
      graph.screenplays,
      "scripts",
      graph.scripts,
    );
  }

  for (const name of Object.keys(SOURCES) as SourceLayer[]) {
    const design = SOURCES[name].design;
    if (
      design !== null &&
      !(
        graph.populationScope.mode === "complete-production-reset" &&
        graph.kind === "library" &&
        graph[name] === "draft" &&
        graph[design] === "draft"
      )
    )
      requireReviewedParent(name, graph[name], design, graph[design]);
  }
  requireReviewedParent(
    "productionSources",
    graph.productionSources,
    "settings",
    graph.settings,
  );
  if (isActive(graph.shots)) {
    const parent = graph.kind === "film" ? "screenplays" : "briefs";
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

const authoredPopulationFiles = (
  graph: IProductionGraph,
  layer: MarkdownLayer,
): string[] => {
  if (layer === "treatments" || layer === "scripts" || layer === "screenplays")
    return createAutoMoviePopulationFiles(layer, graph.populationScope);
  return [`${layer}/**/*.md`];
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
    return walkProjectFiles(
      graph,
      path.join(graph.location, concrete),
      extension,
    ).filter((file) =>
      matchesGlob(posix(path.relative(graph.location, file)), root),
    );
  });

const markdownPopulationFiles = (
  graph: IProductionGraph,
  layer: MarkdownLayer,
): string[] =>
  layer === "treatments" || layer === "scripts" || layer === "screenplays"
    ? populationFiles(
        graph,
        authoredPopulationFiles(graph, layer).map((file) => `${DOCS}/${file}`),
        ".md",
      )
    : walkProjectFiles(graph, path.join(graph.location, DOCS, layer), ".md");

/** Refuse an enabled population account with no exact physical H2 owners. */
const validatePopulationAccountHosts = (graph: IProductionGraph): void => {
  for (const layer of Object.keys(MARKDOWN) as MarkdownLayer[]) {
    if (!MARKDOWN[layer].obligation || !requiresEvidence(graph[layer]))
      continue;
    const claims = createAutoMoviePopulationAccountClaims({
      layer,
      populationFiles: authoredPopulationFiles(graph, layer),
      obligationFiles: populationObligations(graph, layer),
      enabled: true,
      requireReview: requiresReview(graph[layer]),
    });
    for (const claim of claims) {
      const relative = claim.files[0]!;
      const file = path.join(graph.location, DOCS, relative);
      if (!fs.existsSync(file))
        throw new Error(
          `${relative}: ${layer} cannot enter ${graph[layer]} without its population account.`,
        );
      const references = Array.isArray(claim.reference)
        ? claim.reference
        : [claim.reference];
      const obligation = references.find(
        (reference) =>
          reference.type === "markdown" &&
          reference.files[0]?.startsWith("obligations/") === true,
      ) as ITtscEvidenceGraphMarkdownReference;
      const target = EXPECTED_CONTRACTS.find(
        (contract) => contract.file === obligation.files[0],
      )!;
      const units = markdownIdentities(file, [2]);
      if (units.length !== target.anchors.length)
        throw new Error(
          `${relative}: population account has ${units.length} H2 owners for ${target.anchors.length} ${obligation.files[0]} obligations.`,
        );
    }
  }
};

const NUMBERED_NARRATIVE_NAME = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const narrativeH1 = (file: string): string => {
  const headings = markdownHeadings(file);
  const h1 = headings.filter((heading) => heading.depth === 1);
  if (h1.length !== 1 || headings[0]?.depth !== 1)
    throw new Error(
      `${posix(file)} must begin with exactly one H1 narrative title; received ${h1.length}.`,
    );
  return h1[0]!.title;
};

const validateNarrativePopulationTopology = (graph: IProductionGraph): void => {
  const treatmentRoot = path.join(graph.location, DOCS, "treatments");
  const invalidTreatments = walkProjectFiles(
    graph,
    treatmentRoot,
    ".md",
  ).filter((file) => {
    const relative = posix(path.relative(treatmentRoot, file));
    return (
      relative.includes("/") ||
      !NUMBERED_NARRATIVE_NAME.test(relative.slice(0, -3))
    );
  });
  if (invalidTreatments.length !== 0)
    throw new Error(
      `Treatments are flat numbered event files and may have no group, index, or nested host; received ${invalidTreatments.map((file) => posix(path.relative(graph.location, file))).join(", ")}.`,
    );

  for (const layer of ["scripts", "screenplays"] as const) {
    const directory = path.join(graph.location, DOCS, layer);
    const residents = walkProjectFiles(graph, directory, ".md");
    const invalid = residents.filter((file) => {
      const parts = posix(path.relative(directory, file)).split("/");
      return (
        parts.length !== 2 ||
        !NUMBERED_NARRATIVE_NAME.test(parts[0]!) ||
        (parts[1] !== "index.md" &&
          !NUMBERED_NARRATIVE_NAME.test(parts[1]!.slice(0, -3)))
      );
    });
    if (invalid.length !== 0)
      throw new Error(
        `${layer} use numbered delivery-group directories containing only index.md and numbered unit files; received ${invalid.map((file) => posix(path.relative(graph.location, file))).join(", ")}.`,
      );
    const groups = new Set(
      residents.map(
        (file) => posix(path.relative(directory, file)).split("/")[0]!,
      ),
    );
    for (const group of groups) {
      const index = path.join(directory, group, "index.md");
      if (!fs.existsSync(index))
        throw new Error(
          `${layer}/${group} is a resident delivery group without index.md.`,
        );
      const numberedUnits = residents.filter((file) => {
        const parts = posix(path.relative(directory, file)).split("/");
        return (
          parts[0] === group &&
          parts[1] !== "index.md" &&
          NUMBERED_NARRATIVE_NAME.test(parts[1]!.slice(0, -3))
        );
      });
      if (numberedUnits.length === 0)
        throw new Error(
          `${layer}/${group} is a delivery group without a numbered unit file.`,
        );
      const headings = markdownHeadings(index);
      narrativeH1(index);
      if (headings.some((heading) => heading.depth !== 1))
        throw new Error(
          `${posix(path.relative(graph.location, index))} is a delivery index and may contain only its H1 title and generated unit links.`,
        );
    }
  }
};

const acceptsResetEvidenceTags = (
  graph: IProductionGraph,
  layer: EvidenceBranch,
): boolean => {
  if (graph.populationScope.mode !== "complete-production-reset") return false;
  if (graph.kind === "film")
    return ["treatments", "scripts", "screenplays"].includes(layer);
  if ((DESIGN_LAYERS as readonly string[]).includes(layer))
    return (Object.keys(SOURCES) as SourceLayer[]).some(
      (source) =>
        SOURCES[source].design === layer &&
        graph[layer] === "draft" &&
        graph[source] === "draft",
    );
  const design = SOURCES[layer as SourceLayer].design;
  return (
    design !== null && graph[layer] === "draft" && graph[design] === "draft"
  );
};

/** Exact host population whose passed-pilot tags may survive one reset. */
const resetTransitionHosts = (
  graph: IProductionGraph,
): readonly { path: string; source: string }[] => {
  if (graph.populationScope.mode !== "complete-production-reset") return [];
  let files: readonly string[] = [];
  if (graph.kind === "film")
    files = ["treatments", "scripts", "screenplays"].flatMap((layer) =>
      walkProjectFiles(graph, path.join(graph.location, DOCS, layer), ".md"),
    );
  else if (graph.populationScope.transition.kind === "library") {
    const pairs: readonly unknown[] = Array.isArray(
      graph.populationScope.transition.reviewedPairs,
    )
      ? graph.populationScope.transition.reviewedPairs
      : [];
    files = pairs.flatMap((value) => {
      if (value === null || typeof value !== "object") return [];
      const pair = value as { design?: string; source?: string };
      if (
        typeof pair.design !== "string" ||
        typeof pair.source !== "string" ||
        !Object.hasOwn(SOURCES, pair.source) ||
        SOURCES[pair.source as SourceLayer].design !== pair.design
      )
        return [];
      return [
        ...walkProjectFiles(
          graph,
          path.join(graph.location, DOCS, pair.design),
          ".md",
        ),
        ...populationFiles(
          graph,
          SOURCES[pair.source as SourceLayer].files,
          ".ts",
        ),
      ];
    });
  }
  return [...new Set(files)].sort(compareCodeUnits).map((file) => ({
    path: posix(path.relative(graph.location, file)),
    source: fs.readFileSync(file, "utf8"),
  }));
};

const validateHosts = (graph: IProductionGraph): void => {
  validatePopulationAccountHosts(graph);
  validateNarrativePopulationTopology(graph);
  const identities = new Map<MarkdownLayer, Map<string, IHeadingIdentity[]>>();
  const titles = new Map<MarkdownLayer, Map<string, string>>();
  for (const name of Object.keys(MARKDOWN) as MarkdownLayer[]) {
    const stage = graph[name];
    const directory = path.join(graph.location, DOCS, name);
    const files = markdownPopulationFiles(graph, name);
    const disabledResidents =
      !isActive(stage) &&
      (name === "treatments" || name === "scripts" || name === "screenplays")
        ? walkProjectFiles(graph, directory, ".md")
        : files;
    if (!isActive(stage) && disabledResidents.length !== 0)
      throw new Error(
        `${name} is disabled but governed hosts remain: ${disabledResidents.map((file) => posix(path.relative(graph.location, file))).join(", ")}.`,
      );
    if (isActive(stage) && files.length === 0)
      throw new Error(`${name} cannot enter ${stage} without a Markdown host.`);
    if (!isActive(stage)) continue;
    const layer = new Map<string, IHeadingIdentity[]>();
    const layerTitles = new Map<string, string>();
    for (const file of files) {
      const relative = posix(path.relative(directory, file));
      const source = fs.readFileSync(file, "utf8");
      if (
        stage === "draft" &&
        parseAutoMovieEvidenceSyntax({
          path: posix(path.relative(graph.location, file)),
          source,
        }).length !== 0 &&
        !acceptsResetEvidenceTags(graph, name)
      )
        throw new Error(
          `${posix(path.relative(graph.location, file))} is draft and must be completed before evidence tags are authored.`,
        );
      if (name === "treatments" || name === "scripts" || name === "screenplays")
        layerTitles.set(relative, narrativeH1(file));
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
    titles.set(name, layerTitles);
  }

  assertSourceTreeIsClosed(graph);

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
      const relative = posix(path.relative(graph.location, file));
      assertSourceExportsAreEvidenceAddressable(relative, file, source);
      if (
        stage === "draft" &&
        parseAutoMovieEvidenceSyntax({ path: relative, source }).length !== 0 &&
        !acceptsResetEvidenceTags(graph, name)
      )
        throw new Error(
          `${relative} is draft and must be completed before evidence tags are authored.`,
        );
      if (!hasExportedOwner(file, SOURCES[name].ownerKinds))
        throw new Error(
          `${relative} belongs to active ${name} but has no named exported owner of its required kind (${SOURCES[name].ownerKinds.join(", ")}).`,
        );
    }
  }

  const match = (childName: "screenplays", parentName: "scripts"): void => {
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
      if (
        titles.get(childName)!.get(file) !== titles.get(parentName)!.get(file)
      )
        throw new Error(
          `${childName}/${file} must exactly preserve the ${parentName} H1 title.`,
        );
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
    const groups = new Set(childFiles.map((file) => file.split("/")[0]!));
    for (const group of groups) {
      const childIndex = path.join(
        graph.location,
        DOCS,
        childName,
        group,
        "index.md",
      );
      const parentIndex = path.join(
        graph.location,
        DOCS,
        parentName,
        group,
        "index.md",
      );
      if (narrativeH1(childIndex) !== narrativeH1(parentIndex))
        throw new Error(
          `${childName}/${group}/index.md must exactly preserve the ${parentName} delivery-group H1 title.`,
        );
    }
  };
  match("screenplays", "scripts");
};

/**
 * Creates one reference to a shared authored contract.
 *
 * Every shared family differs in two questions: whether every selected host
 * answers every target for itself, and whether a truthful negative may exist.
 * Keeping both flags here makes the family boundary visible at the only place
 * that can otherwise invert it silently.
 */
const sharedReference = (
  shared: string,
  family: ContractFamily,
  file: string,
  review: boolean,
  checklist: boolean,
  allowExclusion: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: shared,
  files: [expectedContract(family, file).file],
  symbol: "h2",
  ...(checklist ? { checklist: true } : {}),
  ...(allowExclusion ? {} : { noEvidenceExclude: true }),
  requireReview: review,
});

/** A principle is a no-exclusion checklist every selected unit answers. */
const principleReference = (
  shared: string,
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference =>
  sharedReference(shared, "principles", file, review, true, false);

/** An obligation is no-exclusion coverage distributed across one layer. */
const obligationReference = (
  shared: string,
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference =>
  sharedReference(shared, "obligations", file, review, false, false);

/** An upstream duty is an exclusion-permitted checklist for each child unit. */
const upstreamReference = (
  shared: string,
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference =>
  sharedReference(shared, "upstream", file, review, true, true);

const discoveryReferences = (
  shared: string,
  layer: MarkdownLayer,
  review: boolean,
): ITtscEvidenceGraphReference[] => [
  ...DISCOVERY_TARGETS[layer].map((target) =>
    sharedReference(shared, "discovery", `${target}.md`, review, false, true),
  ),
  {
    type: "markdown",
    root: DOCS,
    files: ["language/discovery/signals.md"],
    symbol: "h2",
    requireReview: review,
  },
];

/**
 * Makes one active layer's work-specific contract answer its discovery duties.
 *
 * A retained result is stated by the flat `docs/contracts/*.md` file that
 * adopts the rule. A completed search with no retained result is recorded only
 * by `docs/contracts/index.md`, so every negative a reviewer must audit is in
 * one place. Authored settings, design, narrative, and brief units describe the
 * work and never testify that its contract audit happened.
 */
const discoveryClaim = (
  graph: IProductionGraph,
  layer: MarkdownLayer,
): ITtscEvidenceGraphClaim => ({
  name: `the ${layer} work-specific contract accounts for its open-world discovery duties`,
  type: "markdown",
  root: DOCS,
  files: [`${CONTRACTS}/*.md`],
  evidenceExcludeCarriers: [CONTRACT_INDEX],
  symbol: "file",
  disabled: graph[layer] === "disabled",
  reference: discoveryReferences(
    sharedDocsRoot(graph.location),
    layer,
    requiresReview(graph[layer]),
  ),
});

const referencesPerFile = (
  graph: IProductionGraph,
  directory: MarkdownLayer,
  symbol: "file" | "h2" | "h3" | "h4",
  review: boolean,
  noEvidenceExclude = false,
): ITtscEvidenceGraphReference[] => {
  const root = path.join(graph.location, DOCS);
  return markdownPopulationFiles(graph, directory).map((file) => ({
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
  graph: IProductionGraph,
  layer: "scripts" | "treatments",
  symbol: "file" | "h2" | "h3" | "h4",
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: authoredPopulationFiles(graph, layer),
  symbol,
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
  requireReview: review,
});

const coverage = (
  graph: IProductionGraph,
  review: boolean,
): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: DOCS,
  files: authoredPopulationFiles(graph, "treatments"),
  symbol: "h2",
  noEvidenceExclude: true,
  requireReview: review,
});

interface IBranchClaim {
  branch: EvidenceBranch;
  claim: ITtscEvidenceGraphClaim;
}

const branchClaims = (
  branch: EvidenceBranch,
  ...claims: ITtscEvidenceGraphClaim[]
): IBranchClaim[] => claims.map((claim) => ({ branch, claim }));

/** Shared obligations compared once by a branch-level account population. */
const populationObligations = (
  graph: IProductionGraph,
  layer: MarkdownLayer,
): string[] => {
  if (!MARKDOWN[layer].obligation) return [];
  const domain: ContractDomain =
    layer === "settings"
      ? "core"
      : layer === "briefs"
        ? "delivery"
        : ["treatments", "scripts", "screenplays"].includes(layer)
          ? "story"
          : "design";
  return [
    "obligations/core/common.md",
    "obligations/core/defaults.md",
    "language/obligations/common.md",
    ...(["treatments", "scripts", "screenplays"].includes(layer)
      ? ["obligations/story/narratives.md"]
      : []),
    `obligations/${domain}/${MARKDOWN[layer].principle}`,
    ...(layer === "settings" && graph.kind === "film"
      ? ["obligations/story/subjects.md"]
      : []),
  ];
};

const authoredClaims = (graph: IProductionGraph): IBranchClaim[] => {
  const shared = sharedDocsRoot(graph.location);
  const claims: IBranchClaim[] = [];
  for (const name of Object.keys(MARKDOWN) as MarkdownLayer[]) {
    const stage = graph[name];
    const review = requiresReview(stage);
    claims.push(...branchClaims(name, discoveryClaim(graph, name)));
    if (MARKDOWN[name].obligation)
      claims.push(
        ...branchClaims(
          name,
          ...createAutoMoviePopulationAccountClaims({
            layer: name,
            populationFiles: authoredPopulationFiles(graph, name),
            obligationFiles: populationObligations(graph, name),
            enabled: requiresEvidence(stage),
            requireReview: review,
          }),
        ),
      );
    const principles = [
      principleReference(shared, "common.md", review),
      principleReference(shared, "defaults.md", review),
      {
        type: "markdown" as const,
        root: DOCS,
        files: ["language/principles/common.md"],
        symbol: "h2" as const,
        checklist: true,
        noEvidenceExclude: true,
        requireReview: review,
      },
    ];
    if (["treatments", "scripts", "screenplays"].includes(name))
      principles.push(principleReference(shared, "narratives.md", review));
    if (
      [
        "maps",
        "models",
        "spaces",
        "materials",
        "instances",
        "motions",
        "systems",
        "briefs",
      ].includes(name)
    )
      principles.push(principleReference(shared, "inherited-units.md", review));
    principles.push(
      principleReference(shared, MARKDOWN[name].principle, review),
    );
    const fileParents: ITtscEvidenceGraphReference[] = [];
    if (!["settings", "research"].includes(name))
      fileParents.push(...referencesPerFile(graph, "settings", "h2", review));
    fileParents.push(...designFoundations(graph, name, review));
    if (name === "scripts") fileParents.push(coverage(graph, review));
    if (name === "screenplays")
      fileParents.push(
        lineage(graph, "scripts", "file", review),
        coverage(graph, review),
      );
    if (fileParents.length !== 0)
      claims.push(
        ...branchClaims(name, {
          name: `${name} files account for inherited settings, designs, and parent files`,
          type: "markdown",
          root: DOCS,
          files: authoredPopulationFiles(graph, name),
          symbol: "file",
          disabled: !requiresEvidence(stage),
          reference: fileParents,
        }),
      );
    for (const symbol of MARKDOWN[name].headings) {
      const references: ITtscEvidenceGraphReference[] = [...principles];
      if (!["settings", "research"].includes(name))
        references.push(upstreamReference(shared, `${name}.md`, review));
      if (!["settings", "research"].includes(name))
        references.push(...referencesPerFile(graph, "settings", "h2", review));
      references.push(...designFoundations(graph, name, review));
      if (name === "scripts") references.push(coverage(graph, review));
      if (name === "screenplays")
        references.push(
          lineage(graph, "scripts", `h${symbol}` as "h2" | "h3" | "h4", review),
          coverage(graph, review),
        );
      claims.push(
        ...branchClaims(name, {
          name:
            symbol === 2
              ? `${name} H2 units answer their principle checklists and account for inherited work`
              : `${name} H${symbol} units answer their principle checklists and account for inherited work`,
          type: "markdown",
          root: DOCS,
          files: authoredPopulationFiles(graph, name),
          symbol: `h${symbol}` as "h2" | "h3" | "h4",
          disabled: !requiresEvidence(stage),
          reference: references,
        }),
      );
    }
  }

  claims.push(
    ...branchClaims("settings", {
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
    }),
  );
  return claims;
};

const sourceObligations = (
  shared: string,
  file: string,
  review: boolean,
): ITtscEvidenceGraphReference => obligationReference(shared, file, review);

/** The no-exclusion checklist every selected TypeScript source owner answers. */
const sourceUnitPrinciples = (
  shared: string,
  review: boolean,
): ITtscEvidenceGraphReference =>
  principleReference(shared, "source-units.md", review);

/**
 * Source directories a production owns without answering a design layer for
 * them.
 *
 * `examples` is reference the scaffold ships and a production deletes; it
 * teaches a technique rather than realizing a unit, so it cites nothing.
 */
const UNGOVERNED_SOURCE_DIRECTORIES = ["examples"] as const;

/**
 * Refuse a source file that belongs to no production layer.
 *
 * The ten source populations are a closed list, and a list makes "owes no
 * evidence" the silent default for anything added beside it. `src/props/` and
 * `src/creatures/` are not errors the graph reports today: they compile, ship,
 * and cite nothing, and the omission is invisible precisely because no claim
 * ever looked. A production that needs a prop puts it under one of the seven
 * design layers or under `shots`, and the layer vocabulary is closed on
 * purpose, so anything outside it is a placement mistake rather than a new
 * kind of work.
 *
 * This is the structural half of the graph's own rule: derive the population,
 * then refuse what the derivation did not reach.
 */
const assertSourceTreeIsClosed = (graph: IProductionGraph): void => {
  const root = path.join(graph.location, "src");
  if (!fs.existsSync(root)) return;
  const governed = new Set(
    Object.values(SOURCES).flatMap((source) =>
      source.files.map((pattern) => {
        const wildcard = pattern.search(/[*?]/u);
        return (wildcard === -1 ? pattern : pattern.slice(0, wildcard)).replace(
          /[/]+$/u,
          "",
        );
      }),
    ),
  );
  for (const directory of UNGOVERNED_SOURCE_DIRECTORIES)
    governed.add(`src/${directory}`);
  for (const file of walkProjectFiles(graph, root, ".ts")) {
    const relative = posix(path.relative(graph.location, file));
    if (
      [...governed].some(
        (prefix) => relative === prefix || relative.startsWith(`${prefix}/`),
      )
    )
      continue;
    throw new Error(
      `${relative} belongs to no production source layer. Move it under one of ${[
        ...governed,
      ]
        .sort(compareCodeUnits)
        .join(", ")}, or delete it; the layer vocabulary is closed.`,
    );
  }
};

const sourceClaims = (graph: IProductionGraph): IBranchClaim[] => {
  const shared = sharedDocsRoot(graph.location);
  const claims: IBranchClaim[] = [];
  for (const name of [
    "mapSources",
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
      ...branchClaims(
        name,
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
          name: `${name} owners answer source-unit principle checklists, realize every ${design} unit, and cover source obligations`,
          type: "typescript",
          files: [...source.files],
          symbol: [...source.symbols],
          disabled: !requiresEvidence(graph[name]),
          reference: [
            sourceUnitPrinciples(shared, review),
            upstreamReference(shared, source.obligation, review),
            sourceObligations(shared, source.obligation, review),
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
      ),
    );
  }

  const shotReview = requiresReview(graph.shots);
  claims.push(
    ...branchClaims("shots", {
      name: "shot and acceptance owners each realize one screenplay scene or brief shot",
      type: "typescript",
      files: [...SOURCES.shots.files],
      symbol: [...SOURCES.shots.ownerSymbols],
      disabled: !requiresEvidence(graph.shots),
      reference: {
        type: "markdown",
        root: DOCS,
        files:
          graph.kind === "film" ? ["screenplays/**/*.md"] : ["briefs/**/*.md"],
        symbol: "h3",
        noEvidenceExclude: true,
        singleEvidencePerSymbol: true,
        requireReview: shotReview,
      },
    }),
    ...branchClaims("shots", {
      name: "shot source owners answer source-unit principle checklists and cover every shot-source obligation",
      type: "typescript",
      files: [...SOURCES.shots.files],
      symbol: [...SOURCES.shots.symbols],
      disabled: !requiresEvidence(graph.shots),
      reference: [
        sourceUnitPrinciples(shared, shotReview),
        upstreamReference(shared, "shots.md", shotReview),
        sourceObligations(shared, SOURCES.shots.obligation, shotReview),
      ],
    }),
    ...branchClaims("productionSources", {
      name: "production source owners answer source-unit principle checklists, serialize settings, and cover production-source obligations",
      type: "typescript",
      files: [...SOURCES.productionSources.files],
      symbol: [...SOURCES.productionSources.symbols],
      disabled: !requiresEvidence(graph.productionSources),
      reference: [
        sourceUnitPrinciples(shared, requiresReview(graph.productionSources)),
        upstreamReference(
          shared,
          SOURCES.productionSources.obligation,
          requiresReview(graph.productionSources),
        ),
        sourceObligations(
          shared,
          SOURCES.productionSources.obligation,
          requiresReview(graph.productionSources),
        ),
        ...referencesPerFile(
          graph,
          "settings",
          "h2",
          requiresReview(graph.productionSources),
        ),
      ],
    }),
    ...branchClaims("filmSources", {
      name: "film source owners answer source-unit principle checklists, assemble every screenplay sequence or brief delivery, and cover film-source obligations",
      type: "typescript",
      files: [...SOURCES.filmSources.files],
      symbol: [...SOURCES.filmSources.symbols],
      disabled: !requiresEvidence(graph.filmSources),
      reference: [
        sourceUnitPrinciples(shared, requiresReview(graph.filmSources)),
        upstreamReference(
          shared,
          SOURCES.filmSources.obligation,
          requiresReview(graph.filmSources),
        ),
        sourceObligations(
          shared,
          SOURCES.filmSources.obligation,
          requiresReview(graph.filmSources),
        ),
        {
          type: "markdown",
          root: DOCS,
          files:
            graph.kind === "film"
              ? ["screenplays/**/*.md"]
              : ["briefs/**/*.md"],
          symbol: "h2",
          noEvidenceExclude: true,
          requireReview: requiresReview(graph.filmSources),
        },
      ],
    }),
  );
  return claims;
};

const symbolsOf = (symbol: string | readonly string[]): string[] =>
  Array.isArray(symbol) ? [...symbol] : [symbol as string];

const contractForReference = (
  reference: ITtscEvidenceGraphMarkdownReference,
): ExpectedContract | undefined => {
  return EXPECTED_CONTRACTS.find(
    (contract) => contract.file === reference.files[0],
  );
};

const relationshipOf = (
  binding: IBranchClaim,
  reference: ITtscEvidenceGraphReference,
  contract: ExpectedContract | undefined,
): ContractRelationship => {
  if (contract !== undefined)
    return ["principles", "upstream"].includes(contractFamily(contract))
      ? "checklist"
      : "distributed-coverage";
  if (
    binding.claim.type === "markdown" &&
    binding.claim.files.every((file) => file.startsWith("accounts/"))
  )
    return "population-account";
  if (
    reference.type === "markdown" &&
    (reference.uniqueEvidence === true ||
      reference.singleEvidencePerSymbol === true)
  )
    return "lineage";
  if (
    binding.claim.type === "typescript" &&
    binding.branch !== "productionSources"
  )
    return "lineage";
  return "foundation";
};

const validateProductionGraph = (
  graph: IProductionGraph,
): ITargetIdentityRegistry => {
  validateDeclaration(graph);
  validateProjectPopulationBoundary(graph);
  validateReviewReasons(graph);
  const targetIdentities = validateContracts(graph.location, graph.language);
  validateStages(graph);
  if (graph.populationScope.mode === "complete-production-reset") {
    const stages = Object.fromEntries(
      [
        ...(Object.keys(MARKDOWN) as MarkdownLayer[]),
        ...(Object.keys(SOURCES) as SourceLayer[]),
      ].map((branch) => [branch, graph[branch]]),
    );
    validateAutoMoviePopulationTransition({
      kind: graph.kind as "film" | "library",
      productionLocation: graph.location,
      owner: graph.populationScope.owner,
      receipt: graph.populationScope.transition,
      stages,
      hosts: resetTransitionHosts(graph),
    });
  }
  validateHosts(graph);
  validateWorkSpecificContracts(graph);
  validateProductionTargets(graph, targetIdentities);
  return targetIdentities;
};

const sharedClaimBindings = (graph: IProductionGraph): IBranchClaim[] => [
  ...authoredClaims(graph),
  ...sourceClaims(graph),
];

const TOPOLOGY_ORDER: Readonly<Record<MarkdownLayer, number>> = {
  settings: 0,
  research: 1,
  maps: 1,
  spaces: 2,
  models: 3,
  materials: 4,
  instances: 5,
  motions: 6,
  systems: 6,
  treatments: 1,
  scripts: 2,
  screenplays: 3,
  briefs: 7,
};

/** Project the complete selected foundation matrix and audit it in one pass. */
const topologyOf = (
  graph: IProductionGraph,
): IAutoMovieContractBindingManifest["topology"] => {
  const branches = (Object.keys(MARKDOWN) as MarkdownLayer[]).map((name) => ({
    name,
    active: isActive(graph[name]),
    order: TOPOLOGY_ORDER[name],
  }));
  const expected: IAutoMovieEvidenceTopologyEdge[] = [
    ...(Object.keys(MARKDOWN) as MarkdownLayer[])
      .filter((consumer) => !["settings", "research"].includes(consumer))
      .map((consumer) => ({ provider: "settings", consumer })),
    ...(
      Object.entries(DESIGN_FOUNDATIONS) as [
        MarkdownLayer,
        readonly DesignLayer[],
      ][]
    ).flatMap(([consumer, providers]) =>
      providers.map((provider) => ({
        provider,
        consumer,
        simultaneous:
          (provider === "motions" && consumer === "systems") ||
          (provider === "systems" && consumer === "motions"),
      })),
    ),
  ];
  const active = new Map<string, boolean>(
    branches.map((branch) => [branch.name, branch.active]),
  );
  const declarations: IAutoMovieEvidenceTopologyDeclaration[] = expected.map(
    (edge) => {
      const status =
        active.get(edge.provider) === true && active.get(edge.consumer) === true
          ? "uses"
          : "inapplicable";
      return {
        provider: edge.provider,
        consumer: edge.consumer,
        status,
        reason:
          status === "uses"
            ? `${edge.consumer} consumes the selected ${edge.provider} foundation population.`
            : `${edge.consumer} or its ${edge.provider} foundation is outside the selected production population.`,
      };
    },
  );
  return {
    branches,
    expected,
    declarations,
    diagnostics: inspectAutoMovieEvidenceTopology({
      branches,
      expected,
      declarations,
    }),
  };
};

/** The authored Markdown branch selected by a project-local population. */
const referencedMarkdownBranch = (
  reference: ITtscEvidenceGraphMarkdownReference,
): MarkdownLayer | undefined => {
  // No root guard. Every reference this walks declares `docs`, so a guard on
  // that would be an alternative nothing reaches, and the lookup below already
  // answers `undefined` for any first segment that is not a layer name --
  // which is what a reference rooted elsewhere would produce anyway.
  const roots = new Set(
    reference.files.map((file) => normalizeGlob(file).split("/")[0]!),
  );
  const root = [...roots][0]!;
  return (Object.keys(MARKDOWN) as MarkdownLayer[]).find(
    (branch) => branch === root,
  );
};

/**
 * Derive the selected common-contract and population routes from the same
 * validated claims used by `createAutoMovieEvidenceConfig`.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Implements a reusable, human-readable view of the selected production contract.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Exposes exact shared contract files without a separately maintained binding list.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Selects routes from the declared film, brief, or library branch combination.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Reports the concrete host and reference populations after the same physical validation as lint configuration.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Returns the factory's deterministic branch, claim, and reference ordering.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Implements the reusable routing projection of the evidence configuration system.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Projects contract paths, domains, and anchors from the canonical inventory and live graph references.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Includes every active branch and preserves pending draft relationships beside current enforcement state.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Reuses the validated flat-treatment, grouped-delivery, direct-coverage, and same-depth lineage populations.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Preserves the canonical factory order without filesystem-dependent resorting.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract::shared-contract Resolves every public contract route through the same inventory entry that builds its graph reference.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage::shape-stage-machine Filters only disabled branches while retaining later-stage duties as unenforced routes.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity::physical-population-integrity Runs the complete graph validation before publishing any route.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result::deterministic-failure Returns no partial manifest after a validation failure.
 * @author Samchon
 */
export const createAutoMovieContractBindingManifest = (
  graph: IProductionGraph,
): IAutoMovieContractBindingManifest => {
  validateProductionGraph(graph);
  const branches = [
    ...(Object.keys(MARKDOWN) as MarkdownLayer[]),
    ...(Object.keys(SOURCES) as SourceLayer[]),
  ]
    .filter((branch) => isActive(graph[branch]))
    .map((name) => ({ name, stage: graph[name] }));
  const active = new Set<EvidenceBranch>(branches.map((branch) => branch.name));
  const bindings: IAutoMovieContractBindingManifest["bindings"][number][] = [];
  for (const binding of sharedClaimBindings(graph)) {
    if (!active.has(binding.branch)) continue;
    const references = Array.isArray(binding.claim.reference)
      ? binding.claim.reference
      : [binding.claim.reference];
    for (const sourceReference of references) {
      const reference =
        sourceReference as ITtscEvidenceGraphMarkdownReference & {
          files: string[];
          symbol: string | string[];
        };
      const contract = contractForReference(reference);
      const referencedBranch = referencedMarkdownBranch(reference);
      if (
        contract === undefined &&
        referencedBranch !== undefined &&
        !isActive(graph[referencedBranch])
      )
        continue;
      bindings.push({
        branch: binding.branch,
        stage: graph[binding.branch],
        enforced: binding.claim.disabled !== true,
        claim: binding.claim.name!,
        relationship: relationshipOf(binding, reference, contract),
        host: {
          type: binding.claim.type as "markdown" | "typescript",
          root: evidenceRoot(binding.claim),
          files: [...binding.claim.files],
          symbols: symbolsOf(
            binding.claim.symbol as string | readonly string[],
          ),
        },
        target:
          contract === undefined
            ? {
                type: "population",
                root: evidenceRoot(reference),
                files: [...reference.files],
                symbols: symbolsOf(reference.symbol),
              }
            : {
                type: "contract",
                family: contractFamily(contract),
                domain: contract.domain,
                path: logicalContractPath(contract),
                anchors: [...contract.anchors],
              },
      });
    }
  }
  const localBindings: IAutoMovieLocalContractProjection[] = [];
  const localAudits: IAutoMovieLocalContractProjection[] = [];
  for (const raw of graph.claims ?? []) {
    const claim = raw as Partial<AutoMovieProductionContractClaim>;
    if (claim.autoMovieBinding === undefined) continue;
    const references = (
      Array.isArray(claim.reference) ? claim.reference : [claim.reference]
    ).filter(
      (reference): reference is ITtscEvidenceGraphMarkdownReference =>
        reference?.type === "markdown",
    );
    const projection: IAutoMovieLocalContractProjection = {
      claim: claim.name ?? "",
      layer: claim.autoMovieBinding.layer,
      stage: claim.autoMovieBinding.stage,
      enforced: raw.disabled !== true,
      populationScope: claim.autoMovieBinding.populationScope,
      host: {
        root: evidenceRoot(raw),
        files: [...raw.files],
        symbols: symbolsOf(raw.symbol as string | readonly string[]),
      },
      targets: references.map((reference) => ({
        root: evidenceRoot(reference),
        files: [...reference.files],
        symbols: symbolsOf(reference.symbol as string | readonly string[]),
      })),
    };
    (claim.autoMovieBinding.disposition === "binding"
      ? localBindings
      : localAudits
    ).push(projection);
  }
  return {
    kind: graph.kind,
    language: graph.language,
    populationScope: graph.populationScope,
    branches,
    bindings,
    localBindings,
    localAudits,
    topology: topologyOf(graph),
  };
};

/**
 * Build the immutable shared graph and append production-owned claims.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Implements the reusable graph behind the project-owned production declaration.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Applies the same exact shared principles, obligations, and discovery inventory to every generated project.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-discovery Distinguishes a completed production-specific search from an omitted search on every authored layer's separate contract audit surface.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Enforces the mutually exclusive production shapes and staged parent-child progression.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Validates real target identities, hosts, owners, and lineage before returning a graph.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Appends production-owned claims without exposing a replacement seam for the shared graph.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Produces one deterministic graph or fails with the concrete contradictory state.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Implements the shared construction and validation boundary for generated projects.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Reads and validates the fixed shared contract inventory before constructing claims.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-discovery Wires common, settings, design-shared, design-layer, film, narrative-layer, and brief discovery targets to each active layer's flat work-specific contract population while research remains common-only.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Implements the film, brief, and library stage state machine.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Enumerates actual non-linked project populations and enforces flat treatment events, grouped script and screenplay units, direct treatment coverage, and exact same-depth screenplay lineage.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Constructs shared claims first and composes local claims after them.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Uses deterministic identities and ordering and returns no partial graph after a validation failure.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract::shared-contract Validates the canonical common document and H2 inventory before building shared claims.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-discovery::discovery-coverage Adds draft-active contract discovery coverage with reviewed, index-only exclusions for a true no-result.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage::shape-stage-machine Enforces production-kind compatibility, lifecycle order, and parent review prerequisites.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity::physical-population-integrity Validates real hosts, residue, identities, ownership cardinality, and lineage.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension::additive-local-claims Appends local claims only after the immutable shared claim population.
 * @evidencePart specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result::deterministic-failure Completes every deterministic validation before returning any graph.
 * @author Samchon
 */
export const createAutoMovieEvidenceConfig = (
  graph: IProductionGraph,
): ITtscEvidenceGraphConfig => {
  validateProductionGraph(graph);
  const shared = [
    ...sharedClaimBindings(graph).map((binding) => binding.claim),
    {
      name: "the reserved evidence-lint canary proves the generated graph is running",
      type: "typescript" as const,
      files: ["test/__evidenceGraphCanary.ts"],
      symbol: "property" as const,
      reference: principleReference(
        sharedDocsRoot(graph.location),
        "common.md",
        false,
      ),
    },
  ];
  return {
    claims: [...shared, ...(graph.claims ?? [])],
  };
};
