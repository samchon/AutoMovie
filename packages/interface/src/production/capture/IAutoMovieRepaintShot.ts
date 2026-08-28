import { AutoMovieGuidePass } from "../../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieProductionMediaProbe,
} from "../IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "../IAutoMovieProductionDesign";

/**
 * One explicit purpose assigned to a fixed repaint reference.
 *
 * `character` means identity rather than costume or material. `structure` is
 * appearance guidance only: deterministic control passes remain authoritative
 * for geometry, motion, contact, camera, timing, and clearance.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes the complete non-collapsible repaint reference-role vocabulary.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types distinct structural-guidance, identity, costume, style, material, color, and environment references.
 */
export type AutoMovieRepaintReferenceRole =
  | "structure"
  | "character"
  | "costume"
  | "style"
  | "material"
  | "color"
  | "environment";

/**
 * One fixed, role-specific reference consumed by repaint.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IAutoMovieRepaintReferenceInput` as the portable data boundary for the repaint reference roles requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IAutoMovieRepaintReferenceInput` for the asset spec repaint controls references system contract.
 */
export interface IAutoMovieRepaintReferenceInput {
  /**
   * How the adapter must use this reference.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `role` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `role` for the asset spec repaint controls references system contract.
   */
  role: AutoMovieRepaintReferenceRole;
  /**
   * Exact project-relative asset-manifest path.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `path` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `path` for the asset spec repaint controls references system contract.
   */
  path: string;
}

/**
 * Stable, serializable diffusion controls stored in the receipt.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IAutoMovieRepaintParameters` as the portable data boundary for the repaint reference roles requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IAutoMovieRepaintParameters` for the asset spec repaint controls references system contract.
 */
export interface IAutoMovieRepaintParameters {
  /**
   * Non-blank positive prompt.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `prompt` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `prompt` for the asset spec repaint controls references system contract.
   */
  prompt: string;
  /**
   * Optional negative prompt.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `negativePrompt` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `negativePrompt` for the asset spec repaint controls references system contract.
   */
  negativePrompt?: string;
  /**
   * Explicit deterministic request seed.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `seed` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `seed` for the asset spec repaint controls references system contract.
   */
  seed: number;
  /**
   * Finite structural-preservation strength in [0, 1].
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `strength` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `strength` for the asset spec repaint controls references system contract.
   */
  strength: number;
  /**
   * Additional adapter-defined scalar controls.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `controls` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `controls` for the asset spec repaint controls references system contract.
   */
  controls?: Record<string, string | number | boolean>;
}

/**
 * Structured identity of the host repaint implementation.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IAutoMovieRepaintRuntimeIdentity` as the portable data boundary for the repaint reference roles requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IAutoMovieRepaintRuntimeIdentity` for the asset spec repaint controls references system contract.
 */
export interface IAutoMovieRepaintRuntimeIdentity {
  /**
   * Identity protocol.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `protocolVersion` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `protocolVersion` for the asset spec repaint controls references system contract.
   */
  protocolVersion: "automovie.repaint-runtime.v1";
  /**
   * Adapter/provider family.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `provider` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `provider` for the asset spec repaint controls references system contract.
   */
  provider: string;
  /**
   * Exact model id.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `model` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `model` for the asset spec repaint controls references system contract.
   */
  model: string;
  /**
   * Exact model or deployment version.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `version` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `version` for the asset spec repaint controls references system contract.
   */
  version: string;
  /**
   * Local, API, or another explicit execution boundary.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `execution` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `execution` for the asset spec repaint controls references system contract.
   */
  execution: "local" | "api" | "other";
}

/**
 * Reviewed adoption facts for the external generator behind repaint.
 *
 * Credentials are deliberately absent. This record travels with every
 * accepted rendition so a provider, rights, terms, cost, or consumer change is
 * a new generation identity rather than untracked metadata.
 *
 * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-provider-terms Carries the current rights and terms review beside the selected provider and model.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types the rights, terms, cost, and reasoned-consumer portion of repaint output provenance.
 */
export interface IAutoMovieRepaintGeneratorProvenance {
  /** Stable provider, repository, or local-tool source address. */
  source: string;
  /** License identifier or stable terms location reviewed for this use. */
  license: string;
  /** Calendar date, `YYYY-MM-DD`, on which current terms were checked. */
  termsCheckedAt: string;
  /** Authored cost basis, including an explicit local-compute basis. */
  cost: string;
  /** Typed production consumer and authored reason for this adoption. */
  consumer: {
    /** Exact generated-content lane. */
    kind: "repaint";
    /** Why this production needs a repainted appearance rendition. */
    reason: string;
  };
}

/**
 * Exact runtime and reviewed provenance selected for repaint generation.
 *
 * @evidence requirements/repaint/providers-models-and-credentials.md#repaint-execution-boundary Keeps the chosen execution boundary explicit beside the provider and model.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-execution-eligibility Binds the host adapter to one selected runtime and adoption record.
 */
export interface IAutoMovieRepaintGeneratorAdoption {
  /** Provider, model, version, and execution boundary the adapter must report. */
  runtimeIdentity: IAutoMovieRepaintRuntimeIdentity;
  /** Reviewed source, rights, terms, cost, and reasoned consumer. */
  generatorProvenance: IAutoMovieRepaintGeneratorProvenance;
}

/** Failure classes that an authored repaint retry policy may admit. */
export type AutoMovieRepaintFailureClass =
  | "timeout"
  | "rate-limit"
  | "transport"
  | "provider-refusal"
  | "invalid-output"
  | "cancelled"
  | "input-stale"
  | "budget-exhausted"
  | "internal";

/**
 * Complete bounded execution policy for one immutable repaint request.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Makes attempts, timeout, elapsed time, cost, retryability, and deterministic backoff authored inputs rather than hidden host behavior.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Types the bounded request policy consumed before an external call.
 */
export interface IAutoMovieRepaintExecutionPolicy {
  /** Maximum provider calls belonging to one request. */
  maximumAttempts: number;
  /** Per-attempt cancellation deadline in milliseconds. */
  attemptTimeoutMs: number;
  /** Whole-request wall-time ceiling in milliseconds. */
  maximumElapsedMs: number;
  /** Maximum metered cost in the adapter's declared cost unit. */
  maximumCostUnits: number;
  /** One deterministic delay for every possible retry. */
  backoffMs: number[];
  /** Exact failure classes allowed to consume another attempt. */
  retryableFailures: AutoMovieRepaintFailureClass[];
}

/** Stable authored evidence addresses retained by one repaint request. */
export interface IAutoMovieRepaintRequestEvidence {
  /** Prompt and negative-prompt owner. */
  prompt: string;
  /** Applicable versioned continuity owner, or null outside film continuity. */
  continuity: string | null;
  /** Settings decision governing delivery and shared visual grammar. */
  settings: string;
  /** Design owner governing the exact subject or space appearance. */
  design: string;
  /** Screenplay or bounded brief owner that requires the shot. */
  screenplayOrBrief: string;
  /** Exact shot-source owner and acceptance surface. */
  shot: string;
}

/**
 * Immutable provenance for one accepted repaint rendition.
 *
 * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `IAutoMovieRepaintReceipt` as the portable data boundary for the repaint independent artifact requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `IAutoMovieRepaintReceipt` for the asset spec repaint output provenance system contract.
 */
export interface IAutoMovieRepaintReceipt {
  /**
   * Receipt format.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `version` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `version` for the asset spec repaint output provenance system contract.
   */
  version: 3 | 4;
  /**
   * Owning production namespace.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `productionId` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `productionId` for the asset spec repaint output provenance system contract.
   */
  productionId: string;
  /**
   * Exact compiled shot id.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `shot` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `shot` for the asset spec repaint output provenance system contract.
   */
  shot: string;
  /**
   * Current compiler registry fingerprint.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `compileFingerprint` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `compileFingerprint` for the asset spec repaint output provenance system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Digest over deterministic source manifest and frame bytes.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `sourceRenderFingerprint` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `sourceRenderFingerprint` for the asset spec repaint output provenance system contract.
   */
  sourceRenderFingerprint: AutoMovieContentDigest;
  /**
   * Immutable identity shared by the transport attempts of one request.
   *
   * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Separates a request from the attempts that retry it.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Carries the stable request side of request/attempt identity.
   */
  requestId?: string;
  /**
   * Host-generated identity of this repaint invocation.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `attemptId` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `attemptId` for the asset spec repaint output provenance system contract.
   */
  attemptId: string;
  /** UTC instant captured immediately before this provider call. */
  startedAt?: string;
  /** UTC instant captured when the validated candidate completed. */
  completedAt?: string;
  /** Metered cost charged to this successful attempt. */
  costUnits?: number;
  /** Complete bounded policy under which the request executed. */
  executionPolicy?: IAutoMovieRepaintExecutionPolicy;
  /**
   * Content-addressed deterministic source bundle.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `sourceBundle` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `sourceBundle` for the asset spec repaint output provenance system contract.
   */
  sourceBundle: string;
  /**
   * Structural passes supplied to the adapter.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `controls` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `controls` for the asset spec repaint output provenance system contract.
   */
  controls: Array<{
    /** Structural pass name. */
    pass: Exclude<AutoMovieGuidePass, "beauty">;
    /** Ordered source-frame digests for this pass. */
    frameDigests: AutoMovieContentDigest[];
  }>;
  /**
   * Fixed reference identities supplied to the adapter.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `references` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `references` for the asset spec repaint output provenance system contract.
   */
  references: Array<{
    /** Exact non-collapsible reference role. */
    role: AutoMovieRepaintReferenceRole;
    /** Project-relative manifest path. */
    path: string;
    /** Current byte digest. */
    digest: AutoMovieContentDigest;
  }>;
  /**
   * Canonical structured adapter/model identity.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `adapterIdentity` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `adapterIdentity` for the asset spec repaint output provenance system contract.
   */
  adapterIdentity: string;
  /**
   * Reviewed generator adoption retained with the exact rendition bytes.
   *
   * @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Makes missing generator terms and adoption provenance a malformed output identity.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Carries the selected generator's rights, terms, cost, and consumer into the immutable receipt.
   */
  generatorProvenance: IAutoMovieRepaintGeneratorProvenance;
  /**
   * Authority boundary of the derived appearance.
   *
   * The rendition may be the audience-visible delivery, but it never becomes
   * geometry, motion, contact, camera, timing, or prototype-fidelity truth.
   *
   * @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-repaint-boundary Keeps the deterministic blocking pass authoritative for structure.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-eligibility-source-lock Marks the output as a derived appearance rather than a replacement source.
   */
  structuralAuthority: "deterministic-source-only";
  /**
   * Exact generation parameters.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `parameters` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `parameters` for the asset spec repaint output provenance system contract.
   */
  parameters: IAutoMovieRepaintParameters;
  /** Stable evidence addresses from which this immutable request was formed. */
  evidence?: IAutoMovieRepaintRequestEvidence;
  /**
   * Verified rendition output.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `output` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `output` for the asset spec repaint output provenance system contract.
   */
  output: {
    /** Render-root-relative content-addressed path. */
    path: string;
    /** Exact output bytes digest. */
    digest: AutoMovieContentDigest;
    /** Exact output byte length. */
    bytes: number;
    /** Parsed media facts. */
    probe: IAutoMovieProductionMediaProbe;
  };
}

/**
 * Result of one optional diffusion rendition request.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IAutoMovieRepaintShot` as the portable data boundary for the repaint reference roles requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IAutoMovieRepaintShot` for the asset spec repaint controls references system contract.
 */
export interface IAutoMovieRepaintShot {
  /**
   * True only after media parsing and atomic receipt commit.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `repainted` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `repainted` for the asset spec repaint controls references system contract.
   */
  repainted: boolean;
  /** True only when a separate guarded selection transaction made it active. */
  selected: boolean;
  /**
   * Immutable request identity that a transport retry resumes, or null when
   * validation refused before a request existed.
   *
   * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Makes a failed attempt addressable by the explicit retry operation without changing its request controls.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Returns the stable request side of the stored request/attempt lineage.
   */
  requestId: string | null;
  /**
   * Current production namespace.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `productionId` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `productionId` for the asset spec repaint controls references system contract.
   */
  productionId: string;
  /**
   * Compiled shot id.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `shot` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `shot` for the asset spec repaint controls references system contract.
   */
  shot: string;
  /**
   * Accepted receipt, or null on refusal.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `receipt` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `receipt` for the asset spec repaint controls references system contract.
   */
  receipt: IAutoMovieRepaintReceipt | null;
  /**
   * Provisioning or evidence diagnostics, empty on success.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `diagnostics` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `diagnostics` for the asset spec repaint controls references system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieRepaintShot {
  /**
   * One structure-preserving shot rendition request.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IProps` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IProps` for the asset spec repaint controls references system contract.
   */
  export interface IProps {
    /**
     * Exact production namespace owning the shot.
     *
     * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `productionId` as the portable data boundary for the repaint reference roles requirement.
     * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `productionId` for the asset spec repaint controls references system contract.
     */
    productionId: string;
    /**
     * Exact current compiler-registry shot id.
     *
     * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `shot` as the portable data boundary for the repaint reference roles requirement.
     * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `shot` for the asset spec repaint controls references system contract.
     */
    shot: string;
    /**
     * Fixed non-collapsible role-specific references from the asset manifest.
     *
     * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `references` as the portable data boundary for the repaint reference roles requirement.
     * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `references` for the asset spec repaint controls references system contract.
     */
    references: IAutoMovieRepaintReferenceInput[];
    /**
     * Exact adapter controls stored in the rendition receipt.
     *
     * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `parameters` as the portable data boundary for the repaint reference roles requirement.
     * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `parameters` for the asset spec repaint controls references system contract.
     */
    parameters: IAutoMovieRepaintParameters;
  }
}
