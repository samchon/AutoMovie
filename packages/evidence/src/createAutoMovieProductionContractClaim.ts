import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphReference,
} from "@ttsc/evidence";

import type { AutoMovieEvidenceStage } from "./createAutoMovieEvidenceConfig";

type MarkdownClaim = Extract<ITtscEvidenceGraphClaim, { type: "markdown" }>;
type MarkdownSymbol = Extract<
  ITtscEvidenceGraphReference,
  { type: "markdown" }
>["symbol"];

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

  /** Stage of the authored layer that owns {@link files}. */
  stage: AutoMovieEvidenceStage;

  /**
   * Markdown units that answer the contract.
   *
   * @default "file"
   */
  symbol?: MarkdownSymbol;

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
): MarkdownClaim {
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
): MarkdownClaim {
  return createClaim(props, false);
}

/** Builds one validated local Markdown claim in its selected cardinality. */
function createClaim(
  props: IAutoMovieProductionContractClaimProps,
  checklist: boolean,
): MarkdownClaim {
  const name: string = props.name.trim();
  if (name.length === 0)
    throw new Error("A production-local contract claim requires a name.");

  const files: string[] = [...props.files];
  requirePositivePopulation(files, "host");

  const documents: string[] = Array.isArray(props.document)
    ? [...props.document]
    : [props.document];
  requirePositivePopulation(documents, "contract");

  if (
    !(["disabled", "draft", "evidence", "review"] as const).includes(
      props.stage,
    )
  )
    throw new Error(
      `A production-local contract claim has unsupported host stage ${JSON.stringify(props.stage)}.`,
    );

  return {
    name,
    type: "markdown",
    root: "docs",
    files,
    symbol: props.symbol ?? "file",
    disabled:
      props.stage === "disabled" ||
      props.stage === "draft" ||
      props.inapplicable === true,
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
}
