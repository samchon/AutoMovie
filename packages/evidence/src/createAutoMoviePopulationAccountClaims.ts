import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphMarkdownReference,
} from "@ttsc/evidence";

/**
 * Input for one authored layer's distributed obligation coverage.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps eligible authored and aggregate owners beside their applicable obligation families.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Defines the authored hosts and optional account hosts that collectively cover selected obligations.
 * @author Samchon
 */
export interface IAutoMoviePopulationAccountClaimsProps {
  /** Authored branch whose H2 population collectively fulfills obligations. */
  layer: string;
  /** Project-relative authored files selected for that branch. */
  populationFiles: readonly string[];
  /** Shared obligation documents answered by relevant H2 owners. */
  obligationFiles: readonly string[];
  /** Whether the branch currently enforces evidence. */
  enabled: boolean;
  /** Whether acknowledgement reviews are required. */
  requireReview: boolean;
}

/**
 * Creates distributed coverage for each selected obligation family.
 *
 * Authored H2s and the family's optional aggregate account are equally valid
 * owners. Their evidence collectively covers the obligation targets. The
 * item's substantive scope determines how many contributors it needs.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps whole-population accounts inside the same generated-project graph as their authored hosts.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Derives stable optional account addresses in the declared obligation order.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Selects all relevant authored hosts and the optional aggregate account for ordinary coverage.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Emits coverage claims in caller-declared obligation order.
 * @author Samchon
 */
export function createAutoMoviePopulationAccountClaims(
  props: IAutoMoviePopulationAccountClaimsProps,
): ReturnType<typeof createAutoMoviePopulationAccountClaim>[] {
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
      !/^(?:obligations\/(?:core|delivery|design|story)|language\/obligations)\/[a-z0-9-]+\.md$/u.test(
        file,
      )
    )
      throw new Error(
        `Invalid population obligation path ${JSON.stringify(file)}.`,
      );
    if (seen.has(file))
      throw new Error(`${props.layer} repeats population obligation ${file}.`);
    seen.add(file);
    return createAutoMoviePopulationAccountClaim({
      name: `${props.layer} owners collectively fulfill ${file} obligations`,
      account: `accounts/${props.layer}/${file.replace(/^obligations\//u, "").replaceAll("/", "-")}`,
      document: file,
      documentRoot: "docs",
      populationFiles: props.populationFiles,
      enabled: props.enabled,
      requireReview: props.requireReview,
    });
  });
}

/**
 * Builds ordinary obligation coverage over authored and aggregate owners.
 *
 * Callers validate the shared or production-local path declaration. Each
 * target needs positive evidence from a relevant host in the selected layer.
 * The aggregate account is an available host for a population-wide conclusion.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Lets a layer's relevant authored or aggregate owner fulfill an obligation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Emits one no-exclusion ordinary coverage reference over the selected obligation targets.
 */
export function createAutoMoviePopulationAccountClaim(props: {
  name: string;
  account: string;
  document: string;
  documentRoot: string;
  populationFiles: readonly string[];
  enabled: boolean;
  requireReview: boolean;
}): Extract<ITtscEvidenceGraphClaim, { type: "markdown" }> & {
  reference: [ITtscEvidenceGraphMarkdownReference];
} {
  const obligation: ITtscEvidenceGraphMarkdownReference = {
    type: "markdown",
    severity: "error",
    root: props.documentRoot,
    files: [props.document],
    symbol: "h2",
    noEvidenceExclude: true,
    requireReview: props.requireReview,
  };
  return {
    name: props.name,
    type: "markdown",
    root: "docs",
    files: [props.account, ...props.populationFiles],
    symbol: "h2",
    disabled: !props.enabled,
    reference: [obligation],
  };
}
