import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphMarkdownReference,
} from "@ttsc/evidence";
import { isDeepStrictEqual } from "node:util";

import { AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS } from "./AutoMovieAuthoredDocumentLayer";
import type { IAutoMovieEvidenceConfigProps } from "./createAutoMovieEvidenceConfig";
import {
  type AutoMovieProductionContractClaim,
  createAutoMovieProductionObligationClaim,
} from "./createAutoMovieProductionContractClaim";

/**
 * Refuses a local binding whose native claim disagrees with its typed owner.
 *
 * Account references and claim severity are reconstructed through the public
 * factory so a caller cannot retain admission metadata while narrowing or
 * disabling its duty, including through native claim-level severity.
 * Native claims with no AutoMovie binding remain additive native claims.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Preserves the local extension boundary without allowing an account declaration to weaken its generated relationship.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Checks exact account references and metadata against the owning layer, stage, population scope, and disposition.
 */
export function validateAutoMovieLocalContractClaims(
  graph: IAutoMovieEvidenceConfigProps,
): void {
  for (const raw of graph.claims ?? []) {
    const claim = raw as Partial<AutoMovieProductionContractClaim>;
    if (claim.autoMovieBinding === undefined) continue;
    const binding = claim.autoMovieBinding;
    if (
      raw.type !== "markdown" ||
      binding === null ||
      typeof binding !== "object" ||
      !(AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS as readonly unknown[]).includes(
        binding.layer,
      ) ||
      binding.stage !== graph[binding.layer] ||
      !isDeepStrictEqual(binding.populationScope, graph.populationScope) ||
      (binding.disposition !== "binding" &&
        binding.disposition !== "inapplicable") ||
      (raw.disabled === true) !==
        (binding.stage === "disabled" ||
          binding.stage === "draft" ||
          binding.disposition === "inapplicable") ||
      (binding.disposition === "inapplicable" &&
        binding.populationScope?.mode !== "first-pilot")
    )
      throw new Error(
        `Production-local claim ${JSON.stringify(raw.name)} does not match its declared layer, stage, population scope, or disposition.`,
      );
    const references = Array.isArray(raw.reference)
      ? raw.reference
      : [raw.reference];
    if (binding.account === undefined) {
      if (
        references.some(
          (reference) =>
            reference.type === "markdown" && reference.checklist !== true,
        )
      )
        throw new Error(
          `Production-local claim ${JSON.stringify(raw.name)} uses authored obligation coverage; migrate it to createAutoMovieProductionObligationClaim with an account path.`,
        );
      continue;
    }
    const obligation = references[0];
    if (obligation?.type !== "markdown" || obligation.files.length !== 1)
      throw new Error(
        `Production-local account ${binding.account} requires one obligation document reference.`,
      );
    const expected = createAutoMovieProductionObligationClaim({
      name: raw.name ?? "",
      account: binding.account,
      document: obligation.files[0]!,
      documentRoot: obligation.root,
      layer: binding.layer,
      stage: binding.stage,
      populationScope: binding.populationScope,
      inapplicable: binding.disposition === "inapplicable",
    });
    if (
      !isDeepStrictEqual(
        {
          severity: raw.severity,
          root: raw.root,
          files: raw.files,
          symbol: raw.symbol,
          reference: raw.reference,
        },
        {
          severity: expected.severity,
          root: expected.root,
          files: expected.files,
          symbol: expected.symbol,
          reference: expected.reference,
        },
      )
    )
      throw new Error(
        `Production-local account ${binding.account} must retain its canonical claim severity, exact owner, obligation reference, and complete authored H2 population.`,
      );
  }
}

/**
 * Separates local contract targets from an account's compared population.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Reports the exact contract, account owner, population, and scope without making compared authored units look like contract rules.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Projects validated local claims into positive bindings and explicit pilot-only audits with separate population references.
 */
export function projectAutoMovieLocalContractClaims(
  claims: readonly ITtscEvidenceGraphClaim[],
): {
  localBindings: IAutoMovieLocalContractProjection[];
  localAudits: IAutoMovieLocalContractProjection[];
} {
  const localBindings: IAutoMovieLocalContractProjection[] = [];
  const localAudits: IAutoMovieLocalContractProjection[] = [];
  for (const raw of claims) {
    const claim = raw as Partial<AutoMovieProductionContractClaim>;
    if (claim.autoMovieBinding === undefined) continue;
    const binding = claim.autoMovieBinding;
    const references = (
      Array.isArray(raw.reference) ? raw.reference : [raw.reference]
    ).filter(
      (reference): reference is ITtscEvidenceGraphMarkdownReference =>
        reference.type === "markdown",
    );
    const population =
      binding.account === undefined ? undefined : references[1]!;
    const projection: IAutoMovieLocalContractProjection = {
      claim: raw.name ?? "",
      layer: binding.layer,
      stage: binding.stage,
      enforced: raw.disabled !== true,
      populationScope: binding.populationScope,
      relationship:
        binding.account === undefined ? "checklist" : "population-account",
      host: {
        root: claim.root ?? ".",
        files: [...raw.files],
        symbols: symbols(raw.symbol),
      },
      targets: (population === undefined
        ? references
        : references.slice(0, 1)
      ).map(projectReference),
      ...(population === undefined
        ? {}
        : { population: projectReference(population) }),
    };
    (binding.disposition === "binding" ? localBindings : localAudits).push(
      projection,
    );
  }
  return { localBindings, localAudits };
}

/**
 * Manifest identity of one local relationship after declaration validation.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Keeps a local obligation's compared population separate from its contract target.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Names account/checklist ownership, enforcement, and optional authored comparison population.
 * @author Samchon
 */
export interface IAutoMovieLocalContractProjection {
  /** Native claim's diagnostic name, or an empty string when it is unnamed. */
  claim: string;
  /** Authored branch whose declared stage and population govern this binding. */
  layer: AutoMovieProductionContractClaim["autoMovieBinding"]["layer"];
  /** Owning branch's current lifecycle stage, including inactive declarations. */
  stage: AutoMovieProductionContractClaim["autoMovieBinding"]["stage"];
  /** Whether the claim is not explicitly disabled, not an evidence verdict. */
  enforced: boolean;
  /** Exact pilot, complete-production, or reset scope retained from the binding. */
  populationScope: AutoMovieProductionContractClaim["autoMovieBinding"]["populationScope"];
  /** Distinguishes authored-unit checklists from dedicated obligation accounts. */
  relationship: "checklist" | "population-account";
  /**
   * Native host root, file selectors, and symbols for the accountable units.
   * An omitted root becomes "." and an omitted symbol selector becomes [].
   */
  host: { root: string; files: readonly string[]; symbols: readonly string[] };
  /**
   * Markdown contract references, excluding an account's compared population.
   * Roots and symbols use the same omitted-value normalization as the host.
   */
  targets: readonly {
    root: string;
    files: readonly string[];
    symbols: readonly string[];
  }[];
  /**
   * Complete authored H2 reference compared by an obligation account.
   * Checklist bindings omit this field because their hosts answer independently.
   */
  population?: {
    root: string;
    files: readonly string[];
    symbols: readonly string[];
  };
}

/** Retain the native omitted-selector meaning rather than inventing units. */
function symbols(value: unknown): string[] {
  return value === undefined
    ? []
    : Array.isArray(value)
      ? [...value]
      : [value as string];
}

/** Project one native reference without changing its paths or selector. */
function projectReference(
  reference: ITtscEvidenceGraphMarkdownReference,
): IAutoMovieLocalContractProjection["host"] {
  return {
    root: reference.root ?? ".",
    files: [...reference.files],
    symbols: symbols(reference.symbol),
  };
}
