import { AutoMovieGuidePass } from "../../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieProductionMediaProbe,
} from "../IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "../IAutoMovieProductionDesign";

/**
 * One fixed style or character reference consumed by repaint.
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
  role: "style" | "character";
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
  version: 2;
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
   * Host-generated identity of this repaint invocation.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `attemptId` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `attemptId` for the asset spec repaint output provenance system contract.
   */
  attemptId: string;
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
    /** Style or character role. */
    role: "style" | "character";
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
   * Exact generation parameters.
   *
   * @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact Exposes `parameters` as the portable data boundary for the repaint independent artifact requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-output-provenance Types `parameters` for the asset spec repaint output provenance system contract.
   */
  parameters: IAutoMovieRepaintParameters;
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
     * Fixed style and character references from the asset manifest.
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
