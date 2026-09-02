import { AutoMovieGuidePass } from "../../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieReviewTarget,
} from "../IAutoMovieProductionCompiler";

/**
 * One view an asset review must be able to see before it can complete.
 *
 * The set is declared by the review contract rather than by the caller, so a
 * turntable request cannot under-cover the asset by choosing convenient angles.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `IAutoMovieAssetTurntableView` as the portable data boundary for the host evidence one asset review view carries.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the per-view host evidence result the tool boundary returns.
 * @author Samchon
 */
export interface IAutoMovieAssetTurntableView {
  /**
   * Stable view id the asset review inventories, such as `turntable-front`.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Names which required view this host evidence answers for.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the view identity the evidence output carries.
   */
  id: string;
  /**
   * Turntable azimuth in degrees.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence States the azimuth the host actually opened this view from.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the azimuth the evidence output carries.
   */
  angleDeg: number;
  /**
   * Camera elevation in degrees.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence States the elevation the host actually opened this view from.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the elevation the evidence output carries.
   */
  elevationDeg: number;
  /**
   * Rig pose the view was opened in.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence States which rig pose this host evidence shows.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the pose the evidence output carries.
   */
  pose: "rest" | "rom-extremes";
  /**
   * Render pass the view was captured in.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence States which render pass this host evidence shows.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the pass the evidence output carries.
   */
  pass: AutoMovieGuidePass;
  /**
   * Project-relative PNG path, or null when this view was refused.
   *
   * A null path is not a gap the caller may fill by choosing another angle. The
   * diagnostic naming this view states what to correct.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Points at the verified host pixels, or states that this view produced none.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the committed evidence path the tool boundary returns.
   */
  frame: string | null;
}

/**
 * Result of capturing the complete review-required turntable of one asset.
 *
 * Every view carries the same proof one captured frame carries: current
 * compilation, decoded pixels, runtime identity, and a receipt the frame
 * reopens through. What this adds is completeness. The asset review requires an
 * exact view set, and reproducing it by hand is where a reviewer silently
 * skipped the angle that would have shown the defect.
 *
 * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes `IAutoMovieCaptureTurntable` as the portable data boundary for the agent host evidence requirement.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types `IAutoMovieCaptureTurntable` for the spec authoring host evidence output system contract.
 * @author Samchon
 */
export interface IAutoMovieCaptureTurntable {
  /**
   * True only when every required view committed verified current pixels.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes this field as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types this field for the spec authoring host evidence output system contract.
   */
  captured: boolean;
  /**
   * Production namespace used for the attempt.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes this field as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types this field for the spec authoring host evidence output system contract.
   */
  productionId: string;
  /**
   * Review surface whose current evidence changed, or null when none did.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes this field as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types this field for the spec authoring host evidence output system contract.
   */
  reviewTarget: IAutoMovieReviewTarget | null;
  /**
   * Every required view in canonical order, captured or not.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes this field as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types this field for the spec authoring host evidence output system contract.
   */
  views: IAutoMovieAssetTurntableView[];
  /**
   * Exact refusal diagnostics, empty on success.
   *
   * A diagnostic whose `target` reads `<asset>#<view id>` belongs to that one
   * view; a diagnostic targeting the bare asset id refused the whole request
   * before any view was opened.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Exposes the refusal as the portable data boundary for the agent host evidence requirement.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the refusal for the spec authoring host evidence output system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieCaptureTurntable {
  /**
   * One complete asset turntable request.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Names the asset whose host evidence set is requested.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the request the host evidence boundary accepts.
   * @author Samchon
   */
  export interface IProps {
    /**
     * Optional production namespace; required when the host has no default.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Selects the production the host evidence is produced in.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the production scope of the request.
     */
    productionId?: string;
    /**
     * Registry-owned asset id.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Names the registry target the host opens.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the requested evidence target.
     */
    asset: string;
    /**
     * Optional positive integer width no larger than production width.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Bounds the raster the host renders each view at.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the requested raster width.
     */
    width?: number;
    /**
     * Optional positive integer height no larger than production height.
     *
     * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence Bounds the raster the host renders each view at.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Types the requested raster height.
     */
    height?: number;
  }
}
