import { IAutoMovieTransition } from "../cinematics/IAutoMovieTransition";
import { IAutoMovieTrim } from "../cinematics/IAutoMovieTrim";
import { IAutoMovieColor } from "../color/IAutoMovieColor";
import { IAutoMovieNamedId } from "../core/IAutoMovieNamedId";
import { IAutoMovieQuaternion } from "../geometry/IAutoMovieQuaternion";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieActionCall } from "../harness/IAutoMovieActionCall";
import { IAutoMovieMountBinding } from "../harness/IAutoMovieMountBinding";
import { IAutoMovieNodeTarget } from "../harness/IAutoMovieNodeTarget";
import { IAutoMoviePointTarget } from "../harness/IAutoMoviePointTarget";
import {
  IAutoMovieReviewNote,
  IAutoMovieScript,
} from "../harness/IAutoMovieSlate";
import { IAutoMovieTimingAnchor } from "../harness/IAutoMovieTimingAnchor";
import { IAutoMovieModel } from "../model/IAutoMovieModel";
import { IAutoMovieShotContract } from "../production/IAutoMovieProductionDesign";
import {
  IAutoMovieCameraClearanceEnvelope,
  IAutoMovieCameraDepthPrecisionConstraint,
} from "../scene/IAutoMovieCamera";
import { IAutoMovieFog } from "../scene/IAutoMovieFog";
import { IAutoMovieLightShadow } from "../scene/IAutoMovieLight";
import { IAutoMovieSceneEnvironment } from "../scene/IAutoMovieSceneEnvironment";
import { IAutoMovieSpace } from "../scene/IAutoMovieSpace";

/**
 * Models the coding-agent-owned set before a shot is performed.
 *
 * This is an engine input, not an LLM application payload. Positions and
 * couplings are kept declarative so {@code stageScene} can validate every
 * identity and lower the set into deterministic scene data.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMovieStage` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMovieStage` for the spec authoring source input system contract.
 */
export interface IAutoMovieStage {
  /**
   * Stable scene identity cited by every registered shot that uses this set.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `scene` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `scene` for the spec authoring source input system contract.
   */
  scene: IAutoMovieNamedId;
  /**
   * Human-readable geometric rationale retained beside the authored values.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `plan` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `plan` for the spec authoring source input system contract.
   */
  plan: string;
  /**
   * One placement for every scripted cast node that appears on the set.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `actors` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `actors` for the spec authoring source input system contract.
   */
  actors: IAutoMovieStageActor[];
  /**
   * Optional static set geometry; these nodes never perform an action.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `set` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `set` for the spec authoring source input system contract.
   */
  set?: IAutoMovieStageSetPiece[];
  /**
   * Walkable surfaces whose geometry drives grounding and locomotion checks.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `space` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `space` for the spec authoring source input system contract.
   */
  space?: IAutoMovieSpace;
  /**
   * The set's atmosphere, lowered verbatim onto the composed scene's `fog`.
   * Omitted stages a scene with no atmosphere, which renders exactly as every
   * staged scene did before the field existed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `fog` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `fog` for the spec authoring source input system contract.
   */
  fog?: IAutoMovieFog;
  /**
   * Optional image-lighting, exposure, tone mapping, and shadow policy.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `environment` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `environment` for the spec authoring source input system contract.
   */
  environment?: IAutoMovieSceneEnvironment;
  /**
   * Cameras available to the shot and its alternate coverage takes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `cameras` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `cameras` for the spec authoring source input system contract.
   */
  cameras: IAutoMovieStageCamera[];
  /**
   * Physical light declarations lowered into the deterministic scene.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `lights` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `lights` for the spec authoring source input system contract.
   */
  lights: IAutoMovieStageLight[];
}

/**
 * One scripted actor's initial world placement and persistent coupling.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieStageActor` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieStageActor` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieStageActor {
  /**
   * Script cast id; this is also the scene-node identity.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Initial root position in world meters.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `position` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `position` for the spec authoring authority compatibility system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Initial heading in degrees about +Y, where zero faces +Z.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `facingDeg` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `facingDeg` for the spec authoring authority compatibility system contract.
   */
  facingDeg: number;
  /**
   * Film-persistent mount carried through beat-end continuity, when present.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `attach` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `attach` for the spec authoring authority compatibility system contract.
   */
  attach?: IAutoMovieMountBinding;
}

/**
 * One non-performing piece of visible environment geometry.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieStageSetPiece` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieStageSetPiece` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieStageSetPiece {
  /**
   * Unique scene-node identity.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Runtime model identity used to render the piece.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `model` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `model` for the spec authoring authority compatibility system contract.
   */
  model: string;
  /**
   * World-space placement in meters.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `position` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `position` for the spec authoring authority compatibility system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Optional heading in degrees about +Y.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `facingDeg` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `facingDeg` for the spec authoring authority compatibility system contract.
   */
  facingDeg?: number;
  /**
   * Optional full world rotation for sloped, vertical, or arbitrarily oriented
   * architecture. Mutually exclusive with the simpler `facingDeg` spelling.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `rotation` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `rotation` for the spec authoring authority compatibility system contract.
   */
  rotation?: IAutoMovieQuaternion;
  /**
   * Positive uniform or per-axis scale applied to the model.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `scale` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `scale` for the spec authoring authority compatibility system contract.
   */
  scale?: number | IAutoMovieVector3;
}

/**
 * One camera available to the registered shot.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieStageCamera` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieStageCamera` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieStageCamera {
  /**
   * Unique scene camera identity used by {@code frame} actions.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Initial camera position in world meters.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `position` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `position` for the spec authoring authority compatibility system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Initial live subject; stage validation requires it to resolve.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `lookAt` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `lookAt` for the spec authoring authority compatibility system contract.
   */
  lookAt: IAutoMovieNodeTarget | IAutoMoviePointTarget;
  /**
   * Vertical field of view in degrees, strictly between zero and 180.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `fovDeg` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `fovDeg` for the spec authoring authority compatibility system contract.
   */
  fovDeg: number;

  /**
   * Positive near clip distance in camera-space metres.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Exposes the authored near boundary instead of accepting a stage-owned constant.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the near operand lowered without substitution into clipping and precision evaluation.
   */
  near: number;

  /**
   * Far clip distance in camera-space metres, strictly greater than `near`.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Exposes the authored far boundary instead of accepting a stage-owned constant.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the far operand lowered without substitution into clipping and precision evaluation.
   */
  far: number;

  /**
   * Minimum standard depth capability and maximum adjacent step in metres.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Makes precision acceptance an authored numeric boundary rather than an inferred renderer default.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the precision constraint lowered onto the resolved camera and evaluated against current required bounds.
   */
  depthPrecision: IAutoMovieCameraDepthPrecisionConstraint;

  /**
   * Camera-local physical body and optional parent-rig clearance envelopes.
   *
   * Omit only when this authored camera makes no physical-clearance claim.
   * Stage validation refuses malformed centres and non-positive radii before
   * lowering the same envelope onto the resolved scene camera.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Exposes the authored camera and rig bodies whose scene penetration must be refused.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Types the physical input lowered into swept-path evaluation.
   */
  clearance?: IAutoMovieCameraClearanceEnvelope;
}

/**
 * One physical light placed on the authored set.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieStageLight` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieStageLight` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieStageLight {
  /**
   * Unique light identity.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Optional dramatic annotation; lowering reads the physical fields below.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `role` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `role` for the spec authoring authority compatibility system contract.
   */
  role?: "key" | "fill" | "rim" | "ambient" | "sun";
  /**
   * Light family; omitted means a directional source.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `type` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `type` for the spec authoring authority compatibility system contract.
   */
  type?: "directional" | "point" | "spot" | "area";
  /**
   * Required aim for directional, spot and area sources; forbidden for point.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `direction` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `direction` for the spec authoring authority compatibility system contract.
   */
  direction?: IAutoMovieVector3;
  /**
   * Required origin for point, spot and area sources; forbidden for
   * directional.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `position` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `position` for the spec authoring authority compatibility system contract.
   */
  position?: IAutoMovieVector3;
  /**
   * Linear light color; omitted means neutral white.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `color` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `color` for the spec authoring authority compatibility system contract.
   */
  color?: IAutoMovieColor;
  /**
   * Finite non-negative relative brightness.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `intensity` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `intensity` for the spec authoring authority compatibility system contract.
   */
  intensity: number;
  /**
   * Point/spot falloff distance, where zero means unbounded.
   *
   * An area panel has none: its falloff follows from the emitting area below,
   * so a second distance here would contradict it.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `range` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `range` for the spec authoring authority compatibility system contract.
   */
  range?: number;
  /**
   * Spot half-angle in degrees, greater than zero and at most 90.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `coneAngle` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `coneAngle` for the spec authoring authority compatibility system contract.
   */
  coneAngle?: number;
  /**
   * Area-panel width in meters along its local X axis, finite and greater than
   * zero. Required on an area source and forbidden on every other family.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `width` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `width` for the spec authoring authority compatibility system contract.
   */
  width?: number;
  /**
   * Area-panel height in meters along its local Y axis, finite and greater than
   * zero. Required on an area source and forbidden on every other family.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `height` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `height` for the spec authoring authority compatibility system contract.
   */
  height?: number;
  /**
   * Whether this source casts shadows.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `castShadow` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `castShadow` for the spec authoring authority compatibility system contract.
   */
  castShadow?: boolean;
  /**
   * Optional shadow-map camera and bias tuning.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `shadow` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `shadow` for the spec authoring authority compatibility system contract.
   */
  shadow?: IAutoMovieLightShadow;
}

/**
 * Models one shot's intent before dense motion is synthesized.
 *
 * The engine checks this plan against script, stage, prior beat state and the
 * final action program. Prose explains craft; typed anchors and camera fields
 * carry the facts that can be checked deterministically.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieBlocking` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieBlocking` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieBlocking {
  /**
   * Script beat identity realized by this plan.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `beat` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `beat` for the spec authoring authority compatibility system contract.
   */
  beat: string;
  /**
   * Dramatic purpose used by later visual review.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `analysis` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `analysis` for the spec authoring authority compatibility system contract.
   */
  analysis: string;
  /**
   * Why the chosen placement, coverage and timing serve that purpose.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `rationale` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `rationale` for the spec authoring authority compatibility system contract.
   */
  rationale: string;
  /**
   * Actor-local intent and optional causal timing anchors.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `actors` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `actors` for the spec authoring authority compatibility system contract.
   */
  actors: IAutoMovieBlockingActor[];
  /**
   * Hero camera coverage the action program must realize.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `camera` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `camera` for the spec authoring authority compatibility system contract.
   */
  camera: IAutoMovieBlockingCamera;
  /**
   * Additional independently renderable camera takes.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `coverage` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `coverage` for the spec authoring authority compatibility system contract.
   */
  coverage?: IAutoMovieBlockingCoverage[];
  /**
   * Positive shot-local duration in seconds.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `duration` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `duration` for the spec authoring authority compatibility system contract.
   */
  duration: number;
}

/**
 * One actor's ordered prose intent and sparse authoritative moments.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieBlockingActor` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieBlockingActor` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieBlockingActor {
  /**
   * Staged actor node.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Ordered action intent; dense motion remains engine-owned.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `beats` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `beats` for the spec authoring authority compatibility system contract.
   */
  beats: string;
  /**
   * Sparse causal anchors the action spans must cover in listed order.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `anchors` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `anchors` for the spec authoring authority compatibility system contract.
   */
  anchors?: IAutoMovieTimingAnchor[];
}

/**
 * Camera grammar shared by hero and alternate takes.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieBlockingCamera` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieBlockingCamera` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieBlockingCamera {
  /**
   * Shot size the compiled camera must deliver.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `framing` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `framing` for the spec authoring authority compatibility system contract.
   */
  framing: "wide" | "full" | "medium" | "close";
  /**
   * Deterministic move family.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `move` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `move` for the spec authoring authority compatibility system contract.
   */
  move: "static" | "follow" | "orbit" | "push-in" | "truck" | "whip";
  /**
   * Staged node or literal point the camera must favor.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `on` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `on` for the spec authoring authority compatibility system contract.
   */
  on: IAutoMovieNodeTarget | IAutoMoviePointTarget;
}

/**
 * One additional take and the staged camera that owns it.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieBlockingCoverage` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieBlockingCoverage` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieBlockingCoverage extends IAutoMovieBlockingCamera {
  /**
   * Distinct staged camera identity for this take.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `camera` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `camera` for the spec authoring authority compatibility system contract.
   */
  camera: string;
}

/**
 * Thin verb program compiled into one dense, ROM-checked shot.
 *
 * {@link draft} is the first complete program and {@link revise} records the code
 * author's own correction decision. The engine executes exactly {@code
 * revise.final ?? draft}; handwritten keyframes remain available only through
 * the explicit {@code enact} escape hatch.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMoviePerformance` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMoviePerformance` for the spec authoring source input system contract.
 */
export interface IAutoMoviePerformance {
  /**
   * Script beat and registered shot identity realized by this program.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `beat` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `beat` for the spec authoring source input system contract.
   */
  beat: string;
  /**
   * How the intended action decomposes into engine verbs and timing.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `plan` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `plan` for the spec authoring source input system contract.
   */
  plan: string;
  /**
   * First complete action program, including camera actions.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `draft` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `draft` for the spec authoring source input system contract.
   */
  draft: IAutoMovieActionCall[];
  /**
   * Auditable self-review and optional corrected program.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `revise` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `revise` for the spec authoring source input system contract.
   */
  revise: {
    /** Range, causality, region, camera and timing assessment. */
    review: string;
    /** Corrected action program, or null when the draft already stands. */
    final: IAutoMovieActionCall[] | null;
  };
  /**
   * Positive shot-local duration in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `duration` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `duration` for the spec authoring source input system contract.
   */
  duration: number;
}

/**
 * Coding-agent-authored stand-in model inventory for a script cast.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieForgePlan` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieForgePlan` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieForgePlan {
  /**
   * Exactly one generated stand-in for every cast member without a model.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `entries` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `entries` for the spec authoring authority compatibility system contract.
   */
  entries: IAutoMovieForgeEntry[];
}

/**
 * One cast node and the generated rig that embodies it.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieForgeEntry` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieForgeEntry` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieForgeEntry {
  /**
   * Script cast node; the model id must equal this join key.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `node` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `node` for the spec authoring authority compatibility system contract.
   */
  node: string;
  /**
   * Generated model whose skeleton and geometry pass engine validation.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `model` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `model` for the spec authoring authority compatibility system contract.
   */
  model: IAutoMovieModel;
}

/**
 * Evidence-first human or agent decision about one performed shot.
 *
 * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Exposes `IAutoMovieShotReviewWrite` as the portable data boundary for the agent evidence producer authority requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `IAutoMovieShotReviewWrite` for the spec authoring runtime evidence authority invariant system contract.
 */
export interface IAutoMovieShotReviewWrite {
  /**
   * Reviewed script beat.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Exposes `beat` as the portable data boundary for the agent evidence producer authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `beat` for the spec authoring runtime evidence authority invariant system contract.
   */
  beat: string;
  /**
   * Concrete observations from current render evidence.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Exposes `observations` as the portable data boundary for the agent evidence producer authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `observations` for the spec authoring runtime evidence authority invariant system contract.
   */
  observations: string;
  /**
   * Pass only when no correction note remains open.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Exposes `verdict` as the portable data boundary for the agent evidence producer authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `verdict` for the spec authoring runtime evidence authority invariant system contract.
   */
  verdict: "pass" | "revise";
  /**
   * Located corrections; non-empty exactly when verdict is revise.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority Exposes `notes` as the portable data boundary for the agent evidence producer authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `notes` for the spec authoring runtime evidence authority invariant system contract.
   */
  notes: IAutoMovieReviewNote[];
}

/**
 * Coding-agent-owned edit over already validated shot artifacts.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMovieEditPlan` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMovieEditPlan` for the spec authoring source input system contract.
 */
export interface IAutoMovieEditPlan {
  /**
   * Stable finished-film identity and optional display name.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `sequence` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `sequence` for the spec authoring source input system contract.
   */
  sequence: IAutoMovieNamedId;
  /**
   * Positive playback frame rate.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `fps` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `fps` for the spec authoring source input system contract.
   */
  fps: number;
  /**
   * Shot placements in playback order.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `entries` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `entries` for the spec authoring source input system contract.
   */
  entries: IAutoMovieEditEntry[];
  /**
   * Why the trims and transitions serve the film's rhythm.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `pacing` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `pacing` for the spec authoring source input system contract.
   */
  pacing: string;
  /**
   * How adjacent opening/end states connect across each cut.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `continuity` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `continuity` for the spec authoring source input system contract.
   */
  continuity: string;
}

/**
 * One shot placement in the finished edit.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `IAutoMovieEditEntry` as the portable data boundary for the agent authoring tool replaceability requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `IAutoMovieEditEntry` for the spec authoring authority compatibility system contract.
 */
export interface IAutoMovieEditEntry {
  /**
   * Existing compiled shot identity.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `shot` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `shot` for the spec authoring authority compatibility system contract.
   */
  shot: string;
  /**
   * Optional positive source subrange.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `trim` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `trim` for the spec authoring authority compatibility system contract.
   */
  trim: IAutoMovieTrim | null;
  /**
   * Incoming transition, or null for a hard cut.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Exposes `transition` as the portable data boundary for the agent authoring tool replaceability requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility Types `transition` for the spec authoring authority compatibility system contract.
   */
  transition: IAutoMovieTransition | null;
}

/**
 * Context-free shot program returned by a registered source builder.
 *
 * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `IAutoMovieShotProgram` as the portable data boundary for the coding agent's authority to choose technique, structure, and parameters within the public contract.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMovieShotProgram` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMovieShotProgram` for the spec authoring source input system contract.
 */
export interface IAutoMovieShotProgram {
  /**
   * Runtime facts for every articulated stage actor that performs a verb.
   *
   * Geometry and gait curves remain compiler-owned through {@link model}; the
   * source states only the scale-dependent values a generic compiler cannot
   * infer without guessing.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `actors` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `actors` for the spec authoring source input system contract.
   */
  actors: IAutoMovieShotActorProgram[];
  /**
   * Macro treatment containing the registered beat.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `script` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `script` for the spec authoring source input system contract.
   */
  script: IAutoMovieScript;
  /**
   * Set declaration whose scene id must equal the registration's scene.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `stage` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `stage` for the spec authoring source input system contract.
   */
  stage: IAutoMovieStage;
  /**
   * Checked intent that the action program must realize.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `blocking` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `blocking` for the spec authoring source input system contract.
   */
  blocking: IAutoMovieBlocking;
  /**
   * Thin verb program compiled by the engine.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `performance` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `performance` for the spec authoring source input system contract.
   */
  performance: IAutoMoviePerformance;
  /**
   * One authoritative sample time for every declared semantic event.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `eventSamples` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `eventSamples` for the spec authoring source input system contract.
   */
  eventSamples: Array<{
    /** Event-contract identity. */
    id: string;
    /** Shot-local measurement time in seconds. */
    time: number;
  }>;
}

/**
 * Host-compilable runtime facts for one actor in a thin shot program.
 *
 * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Exposes `IAutoMovieShotActorProgram` as the portable data boundary for the agent runtime authority requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `IAutoMovieShotActorProgram` for the spec authoring runtime evidence authority invariant system contract.
 */
export interface IAutoMovieShotActorProgram {
  /**
   * Staged actor node whose actions these facts support.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Exposes `node` as the portable data boundary for the agent runtime authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `node` for the spec authoring runtime evidence authority invariant system contract.
   */
  node: string;
  /**
   * Compiler-owned runtime model id providing the skeleton and gait profiles.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Exposes `model` as the portable data boundary for the agent runtime authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `model` for the spec authoring runtime evidence authority invariant system contract.
   */
  model: string;
  /**
   * Finite positive locomotion speed in world meters per second.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Exposes `speed` as the portable data boundary for the agent runtime authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `speed` for the spec authoring runtime evidence authority invariant system contract.
   */
  speed: number;
  /**
   * Finite non-negative eye height above the staged root, in meters.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority Exposes `eyeHeight` as the portable data boundary for the agent runtime authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant Types `eyeHeight` for the spec authoring runtime evidence authority invariant system contract.
   */
  eyeHeight: number;
}

/**
 * Contract fields embedded in a shot registration rather than its source
 * pointer.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMovieDefinedShotContract` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMovieDefinedShotContract` for the spec authoring source input system contract.
 */
export type IAutoMovieDefinedShotContract = Omit<
  IAutoMovieShotContract,
  "id" | "source"
>;

/**
 * One source-level shot registration.
 *
 * The export is the artifact: id, staged scene, measurable contract, and
 * deterministic builder travel together so a repository compiler can bind
 * module path, export name, and artifact identity without a second manifest
 * claiming what the source contains.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieDefinedShot` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieDefinedShot` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieDefinedShot<Context = undefined> {
  /**
   * Stable shot id; the compiled artifact receives this exact identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `id` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `id` for the spec authoring source derivation state system contract.
   */
  id: string;
  /**
   * Stable staged-scene id the builder must actually produce.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `scene` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `scene` for the spec authoring source derivation state system contract.
   */
  scene: string;
  /**
   * Required participants, states, events, coverage, and review evidence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `contract` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `contract` for the spec authoring source derivation state system contract.
   */
  contract: IAutoMovieDefinedShotContract;
  /**
   * Free deterministic code that emits the typed engine program.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `build` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `build` for the spec authoring source derivation state system contract.
   */
  build(context: Context): IAutoMovieShotProgram;
}

/**
 * The source-authored half accepted by the engine's `defineShot` helper.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `IAutoMovieShotDefinition` as the portable data boundary for the agent ordinary code authoring requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `IAutoMovieShotDefinition` for the spec authoring source input system contract.
 */
export interface IAutoMovieShotDefinition<Context> {
  /**
   * Stable staged-scene id the builder must actually produce.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `scene` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `scene` for the spec authoring source input system contract.
   */
  scene: string;
  /**
   * Required participants, states, events, coverage, and review evidence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `contract` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `contract` for the spec authoring source input system contract.
   */
  contract: IAutoMovieDefinedShotContract;
  /**
   * Free deterministic code that emits the typed engine program.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes `build` as the portable data boundary for the agent ordinary code authoring requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types `build` for the spec authoring source input system contract.
   */
  build(context: Context): IAutoMovieShotProgram;
}
