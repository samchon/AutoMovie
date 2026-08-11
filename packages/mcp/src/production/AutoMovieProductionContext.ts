import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionGuideName,
  IAutoMovieCompileProjectOutput,
} from "@automovie/interface";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { AutoMovieProductionReviewService } from "./AutoMovieProductionReviewService";
import {
  findAutoMovieProjectRoot,
  openAutoMovieProduction,
} from "./openAutoMovieProduction";
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";

/**
 * Active services for one resident production repository.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Groups services under one explicit production identity.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Keeps compiler, evidence, and review operations on the same namespace.
 */
export interface IAutoMovieProductionServices {
  /**
   * Tracked production project.
   *
   * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Owns the fixed root and production identifiers.
   * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Supplies the physical scope behind the logical production identity.
   */
  project: AutoMovieProductionProject;
  /**
   * Deterministic compiler.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Compiles the tracked authored source without replacing its choices.
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Binds each compile result to the exact tracked input snapshot.
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility Recomputes affected compile and review identities when tracked input changes.
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Reconstructs compilation from tracked source and public package contracts in a fresh checkout.
   * @evidence requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes Keeps adopted project bytes authoritative over cache or remote aliases.
   * @evidence requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal Refuses source or asset identity that cannot be tied to the tracked project.
   * @evidence requirements/agent-authoring/partial-work.md#agent-resumable-authoring Reopens compile state from tracked source and receipts without hidden session memory.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Treats tracked production source as the authoritative compiler input.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Returns compile lineage bound to the source snapshot and artifact digest.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report Makes changed inputs stale without rewriting unrelated identities.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure Rejects ambiguous source ownership and identity.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility Reconstructs compiler state from public tracked inputs.
   */
  compiler: AutoMovieProductionCompiler;
  /**
   * Geometry and actual-frame oracle.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-host-evidence Exposes current measurements and host-produced pixels as evidence.
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Attributes measurements and pixels to the host service that produced them.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Keeps observation delivery separate from source authoring.
   */
  oracle: AutoMovieProductionOracleService;
  /**
   * Evidence-bound review ledger.
   *
   * @evidence requirements/review/scope-and-authority.md#review-validation-decision-boundary Validates externally authored worksheets without deciding their observations.
   * @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-criterion-verdicts Preserves the delegated criterion outcome instead of promoting an automated check to a verdict.
   * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary Keeps ledger validation findings distinct from the reviewer's judgment.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-automated-check-boundary Keeps automated ledger checks separate from reviewer judgment.
   */
  review: AutoMovieProductionReviewService;
  /**
   * Read-only source-gate status without review-queue recursion.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Supplies current compile state to evidence consumers.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Prevents current evidence from relying on a stale compiler result.
   */
  compileStatus: () => IAutoMovieCompileProjectOutput;
}

/**
 * Session context: guide reads, fixed root and current production services.
 *
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance Coordinates read-only contract guidance and scoped evidence services.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Consumes the host catalogue without selecting production-specific content.
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Fixes the root, production, and host adapters when the context opens.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Keeps contract guidance within the MCP knowledge-output boundary.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Keeps system capability distinct from repository content selection.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Uses one stable physical and logical namespace for all resolved services.
 */
export class AutoMovieProductionContext {
  private readonly guides = new Set<AutoMovieProductionGuideName>();
  private readonly root: string;
  private readonly services = new Map<string, IAutoMovieProductionServices>();

  /** Open one host-fixed MCP production context. */
  public constructor(
    private readonly capture?: AutoMovieProductionFrameCapture,
    projectRoot?: string,
    private readonly defaultProductionId?: string,
    /** Archetype catalogue every production opened here is judged against. */
    private readonly archetypes?: AutoMovieModelArchetypeRegistry,
  ) {
    validateProductionId(defaultProductionId);
    this.root = findAutoMovieProjectRoot(projectRoot);
  }

  /**
   * Record delivery of one exact guide.
   *
   * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Credits only the exact topic document delivered in this session.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Keeps guide delivery identity explicit.
   */
  public recordGuide(name: AutoMovieProductionGuideName): void {
    this.guides.add(name);
  }

  /**
   * Whether one exact guide received session credit.
   *
   * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Checks delivery of one named topic rather than assuming broad guidance.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Preserves exact guide identity in prerequisite checks.
   */
  public hasGuide(name: AutoMovieProductionGuideName): boolean {
    return this.guides.has(name);
  }

  /**
   * Resolve one production under the immutable host root.
   *
   * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Requires an explicit registered production when the host default is ambiguous.
   * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Prevents production aliases or request-local root changes from creating a new scope.
   */
  public forProduction(productionId?: string): IAutoMovieProductionServices {
    validateProductionId(productionId);
    const registered = AutoMovieProductionProject.registeredProductionIds(
      this.root,
    );
    let selected = productionId ?? this.defaultProductionId;
    if (selected === undefined) {
      if (registered.length !== 1)
        throw new Error(
          registered.length === 0
            ? "The project has no registered production. Create and compile one through the non-MCP project API before requesting evidence."
            : `The project has ${registered.length} registered productions. Configure one productionId from: ${registered.join(", ")}.`,
        );
      selected = registered[0]!;
    }
    if (registered.includes(selected) === false)
      throw new Error(
        `Production "${selected}" is not registered. Choose one current productionId from: ${registered.join(", ")}.`,
      );
    const retained = this.services.get(selected);
    if (retained !== undefined) return retained;
    const opened = openAutoMovieProduction({
      projectRoot: this.root,
      productionId: selected,
      capture: this.capture,
      archetypes: this.archetypes,
    });
    this.services.set(opened.project.productionId, opened);
    return opened;
  }
}

const validateProductionId = (productionId: string | undefined): void => {
  if (
    productionId !== undefined &&
    (productionId.trim().length === 0 || productionId.trim() !== productionId)
  )
    throw new Error(
      "Host productionId must be a trimmed non-empty production namespace.",
    );
};
