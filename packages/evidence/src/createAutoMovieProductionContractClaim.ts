import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphReference,
} from "@ttsc/evidence";

import type { AutoMoviePopulationScope } from "./AutoMoviePopulationScope";
import type { AutoMovieEvidenceStage } from "./createAutoMovieEvidenceConfig";

type MarkdownClaim = Extract<ITtscEvidenceGraphClaim, { type: "markdown" }>;
type MarkdownSymbol = Extract<
  ITtscEvidenceGraphReference,
  { type: "markdown" }
>["symbol"];

const PRODUCTION_CONTRACT_LAYERS = [
  "briefs",
  "instances",
  "maps",
  "materials",
  "models",
  "motions",
  "research",
  "screenplays",
  "scripts",
  "settings",
  "spaces",
  "systems",
  "treatments",
] as const;

/**
 * Authored Markdown layer that may answer a production-local contract.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes local claim ownership an explicit layer identity.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the closed local-claim layer vocabulary.
 */
export type AutoMovieProductionContractLayer =
  (typeof PRODUCTION_CONTRACT_LAYERS)[number];

/**
 * Additive graph claim retaining its project-specific binding identity.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Preserves the layer, scope, and positive-or-negative disposition beside the native graph claim.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the typed local binding projection consumed by the manifest reader.
 */
export type AutoMovieProductionContractClaim = MarkdownClaim & {
  /** AutoMovie-only identity ignored by the generic evidence evaluator. */
  autoMovieBinding: {
    /** Authored layer that owns the host population. */
    layer: AutoMovieProductionContractLayer;
    /** Exact population in which this declaration was made. */
    populationScope: AutoMoviePopulationScope;
    /** Exact owning layer stage in which this declaration was made. */
    stage: AutoMovieEvidenceStage;
    /** Positive binding or explicit pilot-only negative audit entry. */
    disposition: "binding" | "inapplicable";
  };
};

/**
 * Inputs shared by the two production-local contract claim factories.
 *
 * A production keeps adopted rules in its flat `docs/contracts` inventory,
 * while this declaration says which authored Markdown population answers
 * those rules. The host stage is explicit so the local claim follows the same
 * `draft -> evidence -> review` lifecycle as the shared graph rather than
 * becoming an independently enabled side graph.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Takes the owning host population's visible stage and describes one production-owned additive claim without inventing hidden configuration.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Reuses the generated project's closed evidence-stage vocabulary and additive-claim input shape for local wiring.
 */
export interface IAutoMovieProductionContractClaimProps {
  /** Diagnostic identity stating what the selected hosts must establish. */
  name: string;

  /**
   * Production-local contract paths as hosts cite them.
   *
   * Several paths become several independent references, so every document
   * retains its own complete H2 coverage obligation.
   */
  document: string | readonly string[];

  /**
   * Directory the contract paths resolve against.
   *
   * @default "docs"
   */
  documentRoot?: string;

  /** Markdown files whose selected units answer the contract. */
  files: readonly string[];

  /** Authored layer that owns every selected host file. */
  layer: AutoMovieProductionContractLayer;

  /** Stage of the authored layer that owns {@link files}. */
  stage: AutoMovieEvidenceStage;

  /** Exact production population to which this local relationship applies. */
  populationScope: AutoMoviePopulationScope;

  /**
   * Markdown units that answer the contract. Principles select authored
   * H2/H3/H4 units, while obligations select only primary H2 owners.
   */
  symbol: MarkdownSymbol;

  /**
   * Turns the claim off for a reason other than the host stage.
   *
   * Use this only when the contract itself is inapplicable to the declared
   * production scope. A duty every realized host owes stays active regardless
   * of how small that population is.
   *
   * @default false
   */
  inapplicable?: boolean;
}

/**
 * Creates one production-local principle claim.
 *
 * Every selected host answers every H2 item for itself. An exclusion cannot
 * discharge an answer, and review-stage answers carry the cited item's current
 * fingerprint. Draft and disabled hosts carry no evidence tags, so their local
 * contract claim remains declared but disabled alongside the shared graph.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Preserves the required no-exclusion per-host checklist meaning of a principle.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Produces one production-owned claim without exposing or replacing shared claims.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Emits the checklist, exclusion, and review flags that define principle wiring.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Returns only the additive claim consumed by the generated project's claims array.
 */
export function createAutoMovieProductionPrincipleClaim(
  props: IAutoMovieProductionContractClaimProps,
): AutoMovieProductionContractClaim {
  requireSymbol(props.symbol, true);
  return createClaim(props, true);
}

/**
 * Creates one production-local obligation claim.
 *
 * The selected host population distributes each H2 role one or more times. It
 * is deliberately not a checklist: one primary H2 may discharge an obligation
 * for its layer, while H3 and H4 never repeat that population duty. Exclusions
 * remain forbidden because an obligation is something the selected population
 * owes, not a question one host may declare irrelevant.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Preserves the required no-exclusion population coverage meaning of an obligation.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Produces one production-owned claim without exposing or replacing shared claims.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Emits ordinary H2 coverage rather than turning an obligation into a per-host checklist.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Returns only the additive claim consumed by the generated project's claims array.
 */
export function createAutoMovieProductionObligationClaim(
  props: IAutoMovieProductionContractClaimProps,
): AutoMovieProductionContractClaim {
  requireSymbol(props.symbol, false);
  return createClaim(props, false);
}

/** Builds one validated local Markdown claim in its selected cardinality. */
function createClaim(
  props: IAutoMovieProductionContractClaimProps,
  checklist: boolean,
): AutoMovieProductionContractClaim {
  const name: string = props.name.trim();
  if (name.length === 0)
    throw new Error("A production-local contract claim requires a name.");
  if (!(PRODUCTION_CONTRACT_LAYERS as readonly unknown[]).includes(props.layer))
    throw new Error(
      `A production-local contract claim has unsupported layer ${String(props.layer)}.`,
    );

  const files: string[] = [...props.files];
  requirePositivePopulation(files, "host");
  for (const file of files) validateHostPattern(props.layer, file);

  const documents: string[] = Array.isArray(props.document)
    ? [...props.document]
    : [props.document];
  requirePositivePopulation(documents, "contract");
  for (const document of documents)
    validateContractPath(props.documentRoot, document);

  if (
    !(["disabled", "draft", "evidence", "review"] as const).includes(
      props.stage,
    )
  )
    throw new Error(
      `A production-local contract claim has unsupported host stage ${JSON.stringify(props.stage)}.`,
    );
  if (
    props.inapplicable === true &&
    props.populationScope.mode !== "first-pilot"
  )
    throw new Error(
      "A production-local contract claim may be inapplicable only to a first-pilot population.",
    );

  return {
    name,
    type: "markdown",
    root: "docs",
    files,
    symbol: props.symbol,
    disabled:
      props.stage === "disabled" ||
      props.stage === "draft" ||
      props.inapplicable === true,
    autoMovieBinding: {
      layer: props.layer,
      populationScope: props.populationScope,
      stage: props.stage,
      disposition: props.inapplicable === true ? "inapplicable" : "binding",
    },
    reference: documents.map((document) => ({
      type: "markdown" as const,
      root: props.documentRoot ?? "docs",
      files: [document],
      symbol: "h2" as const,
      ...(checklist ? { checklist: true as const } : {}),
      noEvidenceExclude: true,
      requireReview: props.stage === "review",
    })),
  };
}

/** Keep one host glob normalized and confined to its declared authored layer. */
function validateHostPattern(
  layer: AutoMovieProductionContractLayer,
  pattern: string,
): void {
  const file = pattern.replace(/^!/u, "");
  if (
    file.includes("\\") ||
    file.startsWith("/") ||
    /^[A-Za-z]:/u.test(file) ||
    file
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    !file.startsWith(`${layer}/`)
  )
    throw new Error(
      `A production-local contract claim for ${layer} contains a host outside that layer.`,
    );
}

/** Refuse local contract selectors that do not name one flat target document. */
function validateContractPath(
  root: string | undefined,
  document: string,
): void {
  const raw = `${root ?? "docs"}/${document}`;
  const resolved = raw.replaceAll("\\", "/");
  if (
    resolved !== raw ||
    resolved.startsWith("/") ||
    /^[A-Za-z]:/u.test(resolved) ||
    resolved
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    !/^docs\/contracts\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/u.test(resolved) ||
    resolved.endsWith("/index.md")
  )
    throw new Error(
      `A production-local contract claim requires one flat docs/contracts/*.md target, not ${JSON.stringify(resolved)}.`,
    );
}

/** Refuse a layer/symbol combination that changes claim cardinality. */
function requireSymbol(symbol: MarkdownSymbol, checklist: boolean): void {
  const symbols = Array.isArray(symbol) ? [...symbol] : [symbol];
  const accepted = checklist ? ["h2", "h3", "h4"] : ["h2"];
  if (
    symbols.length === 0 ||
    symbols.some((candidate) => !accepted.includes(candidate as string))
  )
    throw new Error(
      checklist
        ? "A production-local principle claim selects only H2, H3, or H4 authored units."
        : "A production-local obligation claim selects only H2 primary owners.",
    );
}

/** Refuses an empty or purely subtractive glob population at the API boundary. */
function requirePositivePopulation(
  patterns: readonly string[],
  role: "contract" | "host",
): void {
  if (
    patterns.length === 0 ||
    !patterns.some(
      (pattern) => pattern.trim().length !== 0 && !pattern.startsWith("!"),
    )
  )
    throw new Error(
      `A production-local contract claim requires a positive ${role} population.`,
    );
  if (patterns.some((pattern) => pattern.trim().length === 0))
    throw new Error(
      `A production-local contract claim ${role} population contains a blank pattern.`,
    );
  if (new Set(patterns).size !== patterns.length)
    throw new Error(
      `A production-local contract claim ${role} population contains a duplicate pattern.`,
    );
}
