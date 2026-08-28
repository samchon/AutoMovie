import { AutoMovieGuidePass } from "../cinematics";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";
import {
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieRenderBundleManifest,
} from "./IAutoMovieProductionOracle";
import {
  AutoMovieRepaintReferenceRole,
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintRuntimeIdentity,
} from "./capture/IAutoMovieRepaintShot";

/**
 * Host input for one structure-preserving shot repaint.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `IAutoMovieProductionRepaintInput` as the portable data boundary for the repaint reference roles requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `IAutoMovieProductionRepaintInput` for the asset spec repaint controls references system contract.
 */
export interface IAutoMovieProductionRepaintInput {
  /**
   * Attempt-scoped cancellation boundary.
   *
   * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Lets the host stop a timed-out or explicitly cancelled external execution instead of leaving an unbounded call.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Types cancellation as part of one distinct attempt rather than a request mutation.
   */
  signal: AbortSignal;
  /**
   * Active project root.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `projectRoot` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `projectRoot` for the asset spec repaint controls references system contract.
   */
  projectRoot: string;
  /**
   * Active production namespace.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `productionId` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `productionId` for the asset spec repaint controls references system contract.
   */
  productionId: string;
  /**
   * Current compiler-owned registry fingerprint.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `compileFingerprint` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `compileFingerprint` for the asset spec repaint controls references system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Exact compiled shot id.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `shot` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `shot` for the asset spec repaint controls references system contract.
   */
  shot: string;
  /**
   * Verified deterministic source identity and bytes.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `source` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `source` for the asset spec repaint controls references system contract.
   */
  source: {
    /** Project-relative content-addressed source bundle. */
    bundle: string;
    /** Verified source bundle manifest. */
    manifest: IAutoMovieRenderBundleManifest;
    /** Digest over the verified manifest and frame bytes. */
    fingerprint: AutoMovieContentDigest;
    /** Current decoded source frames. */
    frames: Array<{
      /** Frame index. */
      index: number;
      /** Frame time. */
      time: number;
      /** Beauty or structural pass. */
      pass: AutoMovieGuidePass;
      /** Exact PNG digest. */
      digest: AutoMovieContentDigest;
      /** Raw verified PNG bytes. */
      bytes: Uint8Array;
    }>;
    /** Capture runtime that produced the deterministic controls. */
    captureRuntime: IAutoMovieCaptureRuntimeIdentity;
  };
  /**
   * Verified fixed reference bytes.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `references` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `references` for the asset spec repaint controls references system contract.
   */
  references: Array<{
    /** Exact non-collapsible role; `character` means identity. */
    role: AutoMovieRepaintReferenceRole;
    /** Project-relative asset-manifest path. */
    path: string;
    /** Current digest. */
    digest: AutoMovieContentDigest;
    /** Current bytes. */
    bytes: Uint8Array;
  }>;
  /**
   * Exact generation controls.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `parameters` as the portable data boundary for the repaint reference roles requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `parameters` for the asset spec repaint controls references system contract.
   */
  parameters: IAutoMovieRepaintParameters;
}

/**
 * Host-owned optional diffusion adapter.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles Exposes `AutoMovieProductionShotRepaint` as the portable data boundary for the repaint reference roles requirement.
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Carries provider-reported cost into the bounded attempt policy without granting the adapter control over that policy.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-controls-references Types `AutoMovieProductionShotRepaint` for the asset spec repaint controls references system contract.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Returns metered cost from one attempt so orchestration can enforce the reviewed request budget.
 */
export type AutoMovieProductionShotRepaint = (
  input: IAutoMovieProductionRepaintInput,
) => Promise<{
  /** Actual encoded rendition bytes. */
  bytes: Uint8Array;
  /** Required video media type. */
  mediaType: "video/mp4";
  /** Structured provider/model identity. */
  runtimeIdentity: IAutoMovieRepaintRuntimeIdentity;
  /** Non-negative metered cost in the unit declared by the execution policy. */
  costUnits?: number;
}>;
