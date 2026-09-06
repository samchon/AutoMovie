import { AutoMovieGuidePass } from "../../cinematics";
import { IAutoMovieSemanticMaskReceipt } from "../../render/IAutoMovieSemanticMask";
import {
  IAutoMovieDiagnostic,
  IAutoMovieReviewTarget,
} from "../IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "../IAutoMovieProductionDesign";

/**
 * One compiler-registry target accepted by the evidence capture tool.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `AutoMovieCaptureTarget` as the portable data boundary for the agent host evidence requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `AutoMovieCaptureTarget` for the spec authoring host evidence output system contract.
 */
export type AutoMovieCaptureTarget =
  | {
      /** Current compiled shot frame. */
      kind: "shot";
      /** Exact production namespace owning the compiled shot. */
      productionId: string;
      /** Registry-owned shot id. */
      id: string;
      /** Finite non-negative shot-local time in seconds. */
      time: number;
      /** Requested beauty or structural render pass. */
      pass?: AutoMovieGuidePass;
    }
  | {
      /** Current compiled asset turntable frame. */
      kind: "asset";
      /** Optional production namespace; required when the host has no default. */
      productionId?: string;
      /** Registry-owned asset id. */
      id: string;
      /** Finite turntable azimuth in degrees. */
      angleDeg: number;
      /** Finite camera elevation in degrees, zero by default. */
      elevationDeg?: number;
      /** Rest or extreme-range rig pose, rest by default. */
      pose?: "rest" | "rom-extremes";
      /**
       * Compiled part id to frame instead of the whole model.
       *
       * The turntable fits that one part, which is how a mullion, a hinge, or a
       * hand is inspected without exporting a model for it. A part view is a
       * diagnostic look and never discharges a required asset review view,
       * because what that review judges is the whole silhouette.
       */
      part?: string;
      /** Requested beauty or structural render pass. */
      pass?: AutoMovieGuidePass;
    };

/**
 * Persisted provenance returned for one verified capture.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `IAutoMovieCaptureReceipt` as the portable data boundary for the agent contract guidance requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `IAutoMovieCaptureReceipt` for the spec authoring knowledge request output system contract.
 */
export interface IAutoMovieCaptureReceipt {
  /**
   * Receipt format.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `version` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `version` for the spec authoring knowledge request output system contract.
   */
  version: 2;
  /**
   * Production namespace used to resolve the registry target.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `productionId` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `productionId` for the spec authoring knowledge request output system contract.
   */
  productionId: string;
  /**
   * Exact evidence target.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `target` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `target` for the spec authoring knowledge request output system contract.
   */
  target: AutoMovieCaptureTarget;
  /**
   * Current compiler-owned target registry fingerprint.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `compileFingerprint` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `compileFingerprint` for the spec authoring knowledge request output system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Target-local render fingerprint from the verified bundle manifest.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `targetFingerprint` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `targetFingerprint` for the spec authoring knowledge request output system contract.
   */
  targetFingerprint: AutoMovieContentDigest;
  /**
   * Canonical structured capture-runtime identity.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `rendererIdentity` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `rendererIdentity` for the spec authoring knowledge request output system contract.
   */
  rendererIdentity: string;
  /**
   * Content-addressed project-relative render bundle.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `bundle` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `bundle` for the spec authoring knowledge request output system contract.
   */
  bundle: string;
  /**
   * Verified PNG digest.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Exposes `outputDigest` as the portable data boundary for the agent contract guidance requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Types `outputDigest` for the spec authoring knowledge request output system contract.
   */
  outputDigest: AutoMovieContentDigest;
  /** Semantic dependency of a shot mask, or null for every other product. */
  semanticMask: IAutoMovieSemanticMaskReceipt | null;
}

/**
 * Result of producing one actual current evidence frame.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `IAutoMovieCaptureFrame` as the portable data boundary for the agent host evidence requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `IAutoMovieCaptureFrame` for the spec authoring host evidence output system contract.
 */
export interface IAutoMovieCaptureFrame {
  /**
   * True only after decoded pixels and their receipt are atomically committed.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `captured` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `captured` for the spec authoring host evidence output system contract.
   */
  captured: boolean;
  /**
   * Production namespace used for the attempt.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `productionId` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `productionId` for the spec authoring host evidence output system contract.
   */
  productionId: string;
  /**
   * Review surface whose current evidence changed, when captured.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `reviewTarget` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `reviewTarget` for the spec authoring host evidence output system contract.
   */
  reviewTarget: IAutoMovieReviewTarget | null;
  /**
   * Verified receipt, or null on refusal.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `receipt` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `receipt` for the spec authoring host evidence output system contract.
   */
  receipt: IAutoMovieCaptureReceipt | null;
  /**
   * Verified current PNG, or null on refusal.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `frame` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `frame` for the spec authoring host evidence output system contract.
   */
  frame: {
    /** Snapped frame index. */
    index: number;
    /** Snapped time in seconds. */
    time: number;
    /** Captured pass. */
    pass: AutoMovieGuidePass;
    /** Project-relative PNG path. */
    path: string;
    /** Exact PNG digest. */
    digest: AutoMovieContentDigest;
    /** Decoded pixel width. */
    width: number;
    /** Decoded pixel height. */
    height: number;
  } | null;
  /**
   * Exact refusal diagnostics, empty on success.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `diagnostics` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `diagnostics` for the spec authoring host evidence output system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieCaptureFrame {
  /**
   * One actual evidence-frame request.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `IProps` as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `IProps` for the spec authoring host evidence output system contract.
   */
  export interface IProps {
    /**
     * Compiler-registry target and its frame identity.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `target` as the portable data boundary for the agent host evidence requirement.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `target` for the spec authoring host evidence output system contract.
     */
    target: AutoMovieCaptureTarget;
    /**
     * Optional positive integer width no larger than production width.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `width` as the portable data boundary for the agent host evidence requirement.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `width` for the spec authoring host evidence output system contract.
     */
    width?: number;
    /**
     * Optional positive integer height no larger than production height.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `height` as the portable data boundary for the agent host evidence requirement.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `height` for the spec authoring host evidence output system contract.
     */
    height?: number;
  }
}
