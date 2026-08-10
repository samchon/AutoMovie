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
 */
export interface IAutoMovieStage {
  /** Stable scene identity cited by every registered shot that uses this set. */
  scene: IAutoMovieNamedId;
  /** Human-readable geometric rationale retained beside the authored values. */
  plan: string;
  /** One placement for every scripted cast node that appears on the set. */
  actors: IAutoMovieStageActor[];
  /** Optional static set geometry; these nodes never perform an action. */
  set?: IAutoMovieStageSetPiece[];
  /** Walkable surfaces whose geometry drives grounding and locomotion checks. */
  space?: IAutoMovieSpace;
  /**
   * The set's atmosphere, lowered verbatim onto the composed scene's `fog`.
   * Omitted stages a scene with no atmosphere, which renders exactly as every
   * staged scene did before the field existed.
   */
  fog?: IAutoMovieFog;
  /** Optional image-lighting, exposure, tone mapping, and shadow policy. */
  environment?: IAutoMovieSceneEnvironment;
  /** Cameras available to the shot and its alternate coverage takes. */
  cameras: IAutoMovieStageCamera[];
  /** Physical light declarations lowered into the deterministic scene. */
  lights: IAutoMovieStageLight[];
}

/** One scripted actor's initial world placement and persistent coupling. */
export interface IAutoMovieStageActor {
  /** Script cast id; this is also the scene-node identity. */
  node: string;
  /** Initial root position in world meters. */
  position: IAutoMovieVector3;
  /** Initial heading in degrees about +Y, where zero faces +Z. */
  facingDeg: number;
  /** Film-persistent mount carried through beat-end continuity, when present. */
  attach?: IAutoMovieMountBinding;
}

/** One non-performing piece of visible environment geometry. */
export interface IAutoMovieStageSetPiece {
  /** Unique scene-node identity. */
  node: string;
  /** Runtime model identity used to render the piece. */
  model: string;
  /** World-space placement in meters. */
  position: IAutoMovieVector3;
  /** Optional heading in degrees about +Y. */
  facingDeg?: number;
  /**
   * Optional full world rotation for sloped, vertical, or arbitrarily oriented
   * architecture. Mutually exclusive with the simpler `facingDeg` spelling.
   */
  rotation?: IAutoMovieQuaternion;
  /** Positive uniform or per-axis scale applied to the model. */
  scale?: number | IAutoMovieVector3;
}

/** One camera available to the registered shot. */
export interface IAutoMovieStageCamera {
  /** Unique scene camera identity used by {@code frame} actions. */
  node: string;
  /** Initial camera position in world meters. */
  position: IAutoMovieVector3;
  /** Initial live subject; stage validation requires it to resolve. */
  lookAt: IAutoMovieNodeTarget | IAutoMoviePointTarget;
  /** Vertical field of view in degrees, strictly between zero and 180. */
  fovDeg: number;
}

/** One physical light placed on the authored set. */
export interface IAutoMovieStageLight {
  /** Unique light identity. */
  node: string;
  /** Optional dramatic annotation; lowering reads the physical fields below. */
  role?: "key" | "fill" | "rim" | "ambient" | "sun";
  /** Light family; omitted means a directional source. */
  type?: "directional" | "point" | "spot" | "area";
  /** Required aim for directional, spot and area sources; forbidden for point. */
  direction?: IAutoMovieVector3;
  /**
   * Required origin for point, spot and area sources; forbidden for
   * directional.
   */
  position?: IAutoMovieVector3;
  /** Linear light color; omitted means neutral white. */
  color?: IAutoMovieColor;
  /** Finite non-negative relative brightness. */
  intensity: number;
  /**
   * Point/spot falloff distance, where zero means unbounded.
   *
   * An area panel has none: its falloff follows from the emitting area below,
   * so a second distance here would contradict it.
   */
  range?: number;
  /** Spot half-angle in degrees, greater than zero and at most 90. */
  coneAngle?: number;
  /**
   * Area-panel width in meters along its local X axis, finite and greater than
   * zero. Required on an area source and forbidden on every other family.
   */
  width?: number;
  /**
   * Area-panel height in meters along its local Y axis, finite and greater than
   * zero. Required on an area source and forbidden on every other family.
   */
  height?: number;
  /** Whether this source casts shadows. */
  castShadow?: boolean;
  /** Optional shadow-map camera and bias tuning. */
  shadow?: IAutoMovieLightShadow;
}

/**
 * Models one shot's intent before dense motion is synthesized.
 *
 * The engine checks this plan against script, stage, prior beat state and the
 * final action program. Prose explains craft; typed anchors and camera fields
 * carry the facts that can be checked deterministically.
 */
export interface IAutoMovieBlocking {
  /** Script beat identity realized by this plan. */
  beat: string;
  /** Dramatic purpose used by later visual review. */
  analysis: string;
  /** Why the chosen placement, coverage and timing serve that purpose. */
  rationale: string;
  /** Actor-local intent and optional causal timing anchors. */
  actors: IAutoMovieBlockingActor[];
  /** Hero camera coverage the action program must realize. */
  camera: IAutoMovieBlockingCamera;
  /** Additional independently renderable camera takes. */
  coverage?: IAutoMovieBlockingCoverage[];
  /** Positive shot-local duration in seconds. */
  duration: number;
}

/** One actor's ordered prose intent and sparse authoritative moments. */
export interface IAutoMovieBlockingActor {
  /** Staged actor node. */
  node: string;
  /** Ordered action intent; dense motion remains engine-owned. */
  beats: string;
  /** Sparse causal anchors the action spans must cover in listed order. */
  anchors?: IAutoMovieTimingAnchor[];
}

/** Camera grammar shared by hero and alternate takes. */
export interface IAutoMovieBlockingCamera {
  /** Shot size the compiled camera must deliver. */
  framing: "wide" | "full" | "medium" | "close";
  /** Deterministic move family. */
  move: "static" | "follow" | "orbit" | "push-in" | "truck" | "whip";
  /** Staged node or literal point the camera must favor. */
  on: IAutoMovieNodeTarget | IAutoMoviePointTarget;
}

/** One additional take and the staged camera that owns it. */
export interface IAutoMovieBlockingCoverage extends IAutoMovieBlockingCamera {
  /** Distinct staged camera identity for this take. */
  camera: string;
}

/**
 * Thin verb program compiled into one dense, ROM-checked shot.
 *
 * {@link draft} is the first complete program and {@link revise} records the code
 * author's own correction decision. The engine executes exactly {@code
 * revise.final ?? draft}; handwritten keyframes remain available only through
 * the explicit {@code enact} escape hatch.
 */
export interface IAutoMoviePerformance {
  /** Script beat and registered shot identity realized by this program. */
  beat: string;
  /** How the intended action decomposes into engine verbs and timing. */
  plan: string;
  /** First complete action program, including camera actions. */
  draft: IAutoMovieActionCall[];
  /** Auditable self-review and optional corrected program. */
  revise: {
    /** Range, causality, region, camera and timing assessment. */
    review: string;
    /** Corrected action program, or null when the draft already stands. */
    final: IAutoMovieActionCall[] | null;
  };
  /** Positive shot-local duration in seconds. */
  duration: number;
}

/** Coding-agent-authored stand-in model inventory for a script cast. */
export interface IAutoMovieForgePlan {
  /** Exactly one generated stand-in for every cast member without a model. */
  entries: IAutoMovieForgeEntry[];
}

/** One cast node and the generated rig that embodies it. */
export interface IAutoMovieForgeEntry {
  /** Script cast node; the model id must equal this join key. */
  node: string;
  /** Generated model whose skeleton and geometry pass engine validation. */
  model: IAutoMovieModel;
}

/** Evidence-first human or agent decision about one performed shot. */
export interface IAutoMovieShotReviewWrite {
  /** Reviewed script beat. */
  beat: string;
  /** Concrete observations from current render evidence. */
  observations: string;
  /** Pass only when no correction note remains open. */
  verdict: "pass" | "revise";
  /** Located corrections; non-empty exactly when verdict is revise. */
  notes: IAutoMovieReviewNote[];
}

/** Coding-agent-owned edit over already validated shot artifacts. */
export interface IAutoMovieEditPlan {
  /** Stable finished-film identity and optional display name. */
  sequence: IAutoMovieNamedId;
  /** Positive playback frame rate. */
  fps: number;
  /** Shot placements in playback order. */
  entries: IAutoMovieEditEntry[];
  /** Why the trims and transitions serve the film's rhythm. */
  pacing: string;
  /** How adjacent opening/end states connect across each cut. */
  continuity: string;
}

/** One shot placement in the finished edit. */
export interface IAutoMovieEditEntry {
  /** Existing compiled shot identity. */
  shot: string;
  /** Optional positive source subrange. */
  trim: IAutoMovieTrim | null;
  /** Incoming transition, or null for a hard cut. */
  transition: IAutoMovieTransition | null;
}

/** Context-free shot program returned by a registered source builder. */
export interface IAutoMovieShotProgram {
  /**
   * Runtime facts for every articulated stage actor that performs a verb.
   *
   * Geometry and gait curves remain compiler-owned through {@link model}; the
   * source states only the scale-dependent values a generic compiler cannot
   * infer without guessing.
   */
  actors: IAutoMovieShotActorProgram[];
  /** Macro treatment containing the registered beat. */
  script: IAutoMovieScript;
  /** Set declaration whose scene id must equal the registration's scene. */
  stage: IAutoMovieStage;
  /** Checked intent that the action program must realize. */
  blocking: IAutoMovieBlocking;
  /** Thin verb program compiled by the engine. */
  performance: IAutoMoviePerformance;
  /** One authoritative sample time for every declared semantic event. */
  eventSamples: Array<{
    /** Event-contract identity. */
    id: string;
    /** Shot-local measurement time in seconds. */
    time: number;
  }>;
}

/** Host-compilable runtime facts for one actor in a thin shot program. */
export interface IAutoMovieShotActorProgram {
  /** Staged actor node whose actions these facts support. */
  node: string;
  /** Compiler-owned runtime model id providing the skeleton and gait profiles. */
  model: string;
  /** Finite positive locomotion speed in world meters per second. */
  speed: number;
  /** Finite non-negative eye height above the staged root, in meters. */
  eyeHeight: number;
}

/**
 * Contract fields embedded in a shot registration rather than its source
 * pointer.
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
 */
export interface IAutoMovieDefinedShot<Context = undefined> {
  /** Stable shot id; the compiled artifact receives this exact identity. */
  id: string;
  /** Stable staged-scene id the builder must actually produce. */
  scene: string;
  /** Required participants, states, events, coverage, and review evidence. */
  contract: IAutoMovieDefinedShotContract;
  /** Free deterministic code that emits the typed engine program. */
  build(context: Context): IAutoMovieShotProgram;
}

/** The source-authored half accepted by the engine's `defineShot` helper. */
export interface IAutoMovieShotDefinition<Context> {
  /** Stable staged-scene id the builder must actually produce. */
  scene: string;
  /** Required participants, states, events, coverage, and review evidence. */
  contract: IAutoMovieDefinedShotContract;
  /** Free deterministic code that emits the typed engine program. */
  build(context: Context): IAutoMovieShotProgram;
}
