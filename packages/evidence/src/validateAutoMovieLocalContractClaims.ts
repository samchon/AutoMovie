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
  createAutoMovieProductionPrincipleClaim,
} from "./createAutoMovieProductionContractClaim";

/**
 * Refuses a local binding whose native claim disagrees with its typed owner.
 *
 * Principle and account policy are reconstructed through their public factories
 * so a caller cannot retain admission metadata while narrowing or disabling its
 * duty, including through native claim-level severity.
 * Native claims with no AutoMovie binding remain additive native claims.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension Preserves native extensions while keeping AutoMovie-bound principles and accounts at their declared strength.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-additive-extension Reconstructs canonical principle and account policy from the owning layer, stage, population scope, and disposition.
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
      (binding.pass !== "construction" && binding.pass !== "naturalness") ||
      binding.stage !==
        (binding.pass === "naturalness"
          ? graph.naturalness.screenplays
          : graph[binding.layer]) ||
      !isDeepStrictEqual(binding.populationScope, graph.populationScope) ||
      (binding.disposition !== "binding" &&
        binding.disposition !== "inapplicable") ||
      (raw.disabled === true) !==
        (binding.stage === "disabled" ||
          binding.stage === "draft" ||
          binding.disposition === "inapplicable") ||
      (binding.disposition === "inapplicable" &&
        binding.populationScope?.mode !== "first-pilot") ||
      (binding.pass === "naturalness" && binding.layer !== "screenplays")
    )
      throw new Error(
        `Production-local claim ${JSON.stringify(raw.name)} does not match its declared layer, stage, population scope, or disposition.`,
      );
    const references = Array.isArray(raw.reference)
      ? raw.reference
      : [raw.reference];
    if (binding.account === undefined) {
      const first = references[0];
      if (first?.type !== "markdown")
        throw new Error(
          `Production-local principle ${JSON.stringify(raw.name)} requires a nonempty Markdown contract reference inventory.`,
        );
      const documents = references.map((reference) => {
        if (reference.type !== "markdown" || reference.files.length !== 1)
          throw new Error(
            `Production-local principle ${JSON.stringify(raw.name)} requires one contract document per Markdown reference.`,
          );
        return reference.files[0]!;
      });
      const expected = createAutoMovieProductionPrincipleClaim({
        name: raw.name ?? "",
        document: documents,
        documentRoot: first.root,
        files: raw.files,
        symbol: raw.symbol,
        layer: binding.layer,
        pass: binding.pass,
        stage: binding.stage,
        populationScope: binding.populationScope,
        inapplicable: binding.disposition === "inapplicable",
      });
      if (
        raw.severity !== expected.severity ||
        raw.root !== expected.root ||
        !isDeepStrictEqual(references, expected.reference)
      )
        throw new Error(
          `Production-local principle ${JSON.stringify(raw.name)} must retain its canonical claim severity, authored heading hosts, and complete no-exclusion H2 checklist references with owning-stage review.`,
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
      pass: binding.pass,
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
        `Production-local account ${binding.account} must retain its canonical claim severity, obligation reference, and complete authored H2 host population.`,
      );
  }
}

/**
 * Projects local contract targets and their eligible authored population.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Reports the exact contract, eligible owners, population, and scope.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Projects validated local claims into positive bindings and explicit pilot-only audits with authored host populations.
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
      binding.account === undefined
        ? undefined
        : {
            root: claim.root ?? ".",
            files: raw.files.slice(1),
            symbols: symbols(raw.symbol),
          };
    const projection: IAutoMovieLocalContractProjection = {
      claim: raw.name ?? "",
      layer: binding.layer,
      pass: binding.pass,
      stage: binding.stage,
      enforced: raw.disabled !== true,
      populationScope: binding.populationScope,
      relationship:
        binding.account === undefined ? "checklist" : "distributed-coverage",
      host: {
        root: claim.root ?? ".",
        files: [...raw.files],
        symbols: symbols(raw.symbol),
      },
      targets: references.map(projectReference),
      ...(population === undefined ? {} : { population }),
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
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Keeps a local obligation's eligible authored population separate from its contract target.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Names coverage/checklist ownership, enforcement, and eligible authored populations.
 * @author Samchon
 */
export interface IAutoMovieLocalContractProjection {
  /** Native claim's diagnostic name, or an empty string when it is unnamed. */
  claim: string;
  /** Authored branch whose declared stage and population govern this binding. */
  layer: AutoMovieProductionContractClaim["autoMovieBinding"]["layer"];
  /** Construction or final-screenplay naturalness host pass. */
  pass: AutoMovieProductionContractClaim["autoMovieBinding"]["pass"];
  /** Owning branch's current lifecycle stage, including inactive declarations. */
  stage: AutoMovieProductionContractClaim["autoMovieBinding"]["stage"];
  /** Whether the claim is not explicitly disabled, not an evidence verdict. */
  enforced: boolean;
  /** Exact pilot, complete-production, or reset scope retained from the binding. */
  populationScope: AutoMovieProductionContractClaim["autoMovieBinding"]["populationScope"];
  /** Distinguishes per-unit principles from collective obligation coverage. */
  relationship: "checklist" | "distributed-coverage";
  /**
   * Native host root, file selectors, and symbols for the accountable units.
   * An omitted root becomes "." and an omitted symbol selector becomes [].
   */
  host: { root: string; files: readonly string[]; symbols: readonly string[] };
  /**
   * Markdown contract references.
   * Roots and symbols use the same omitted-value normalization as the host.
   */
  targets: readonly {
    root: string;
    files: readonly string[];
    symbols: readonly string[];
  }[];
  /**
   * Complete authored H2 population eligible to fulfill the obligation.
   * Checklist bindings answer independently through their host population.
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
