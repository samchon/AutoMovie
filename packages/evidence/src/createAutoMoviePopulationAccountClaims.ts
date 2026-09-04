import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphMarkdownReference,
} from "@ttsc/evidence";

/**
 * Input for one authored layer's whole-population obligation accounts.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps the account owner, compared population, and obligation families in one graph declaration.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Defines the inputs from which exact-one account claims are derived.
 * @author Samchon
 */
export interface IAutoMoviePopulationAccountClaimsProps {
  /** Authored branch whose complete H2 population is compared. */
  layer: string;
  /** Project-relative authored files selected for that branch. */
  populationFiles: readonly string[];
  /** Shared obligation documents answered once by dedicated account H2s. */
  obligationFiles: readonly string[];
  /** Whether the branch currently enforces evidence. */
  enabled: boolean;
  /** Whether acknowledgement reviews are required. */
  requireReview: boolean;
}

/**
 * Creates one account claim for every whole-population obligation family.
 *
 * An account H2 owns exactly one obligation H2 and must cite every H2 in the
 * population it compares. Unit-local principle and lineage claims remain
 * unchanged, so moving a population comparison does not weaken their graph.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps whole-population accounts inside the same generated-project graph as their authored hosts.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Derives one stable account owner per obligation document without changing graph cardinality.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Separates whole-population comparison hosts from unit-local evidence carriers.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Emits account claims in caller-declared obligation order with exact-one ownership.
 */
export function createAutoMoviePopulationAccountClaims(
  props: IAutoMoviePopulationAccountClaimsProps,
): ITtscEvidenceGraphClaim[] {
  if (!/^[a-z][a-zA-Z]*$/u.test(props.layer))
    throw new Error(
      `Invalid population account layer ${JSON.stringify(props.layer)}.`,
    );
  if (props.populationFiles.length === 0)
    throw new Error(
      `${props.layer} population accounts require authored H2 files.`,
    );
  const population = new Set<string>();
  for (const file of props.populationFiles) {
    if (!file.startsWith(`${props.layer}/`))
      throw new Error(
        `${props.layer} population account cannot select another layer through ${JSON.stringify(file)}.`,
      );
    if (population.has(file))
      throw new Error(`${props.layer} repeats population file ${file}.`);
    population.add(file);
  }
  const seen = new Set<string>();
  return props.obligationFiles.map((file) => {
    if (
      !/^obligations\/(?:core|delivery|design|story)\/[a-z0-9-]+\.md$/u.test(
        file,
      )
    )
      throw new Error(
        `Invalid population obligation path ${JSON.stringify(file)}.`,
      );
    if (seen.has(file))
      throw new Error(`${props.layer} repeats population obligation ${file}.`);
    seen.add(file);
    const obligation: ITtscEvidenceGraphMarkdownReference = {
      type: "markdown",
      root: "docs",
      files: [file],
      symbol: "h2",
      noEvidenceExclude: true,
      uniqueEvidence: true,
      singleEvidencePerSymbol: true,
      requireReview: props.requireReview,
    };
    const population: ITtscEvidenceGraphMarkdownReference = {
      type: "markdown",
      root: "docs",
      files: [...props.populationFiles],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
      requireReview: props.requireReview,
    };
    return {
      name: `${props.layer} population accounts answer each ${file} obligation once`,
      type: "markdown",
      root: "docs",
      files: [
        `accounts/${props.layer}/${file.replace(/^obligations\//u, "").replaceAll("/", "-")}`,
      ],
      symbol: "h2",
      disabled: !props.enabled,
      reference: [obligation, population],
    };
  });
}
