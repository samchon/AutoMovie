import {
  IAutoMovieActorContext,
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMovieStagedSet,
} from "@automovie/engine";
import {
  AutoMovieEasing,
  AutoMovieGuidePass,
  AutoMovieHumanoidBone,
  IAutoMovieAimDriver,
  IAutoMovieBeatEndState,
  IAutoMovieChannelLimit,
  IAutoMovieConstraintViolation,
  IAutoMovieCopyDriver,
  IAutoMovieDrivenDriver,
  IAutoMovieExpression,
  IAutoMovieGaitRootBob,
  IAutoMovieIKDriver,
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMovieParentDriver,
  IAutoMoviePose,
  IAutoMovieProfileBinding,
  IAutoMovieProfileControl,
  IAutoMovieQuaternion,
  IAutoMovieRenderSpec,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieSpringDriver,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";
import { IAutoMovieGuidePassOutput } from "@automovie/render";

export interface IAutoMovieMcpStoredSlate {
  /** Committed script, or null before SCRIPT exists. */
  script: IAutoMovieScript | null;

  /** Committed staged scene, or null before STAGING exists. */
  scene: IAutoMovieScene | null;

  /** Shots built so far. */
  shots: IAutoMovieShot[];

  /** Resolved end-state snapshots for built beats. */
  beatEnds: IAutoMovieBeatEndState[];

  /** Open review notes. */
  notes: IAutoMovieReviewNote[];
}

/** Writable slate accepted and returned by MCP commit tools. */
export interface IAutoMovieMcpWritableSlate extends IAutoMovieMcpStoredSlate {
  /** Assembled film, or null before CUT has committed. */
  film: IAutoMovieSequence | null;
}

/** The `getScript` query result. */
export interface IAutoMovieGetScriptOutput {
  /** The committed script slice, or null until it exists. */
  script: IAutoMovieScript | null;
}

/** The `getScene` query result. */
export interface IAutoMovieGetSceneOutput {
  /** The committed staged scene, or null until it exists. */
  scene: IAutoMovieScene | null;
}

/** The `getShot` query result. */
export interface IAutoMovieGetShotOutput {
  /** The shot for the requested beat, or null until it exists. */
  shot: IAutoMovieShot | null;
}

/** The `getNotes` query result. */
export interface IAutoMovieGetNotesOutput {
  /** Open review notes, optionally filtered by beat. */
  notes: IAutoMovieReviewNote[];
}

/** The `getBeatEnd` query result. */
export interface IAutoMovieGetBeatEndOutput {
  /** The end-state for the requested beat, or null until it exists. */
  beatEnd: IAutoMovieBeatEndState | null;
}

/**
 * Geometry query context accepted by MCP tools.
 *
 * It keeps only the pieces the queries need: staged scene nodes, model
 * skeletons, compiled MCP-safe motions, and an optional shot to sample.
 */
export interface IAutoMovieMcpGeometryContext {
  /** Staged scene whose node transforms define world space. */
  scene: IAutoMovieScene;

  /** Model id to skeleton lookup; full mesh/material payloads are not needed. */
  models: IAutoMovieMcpGeometryModel[];

  /** Compiled motions, usually the `perform` output's `motions` record. */
  motions: Record<string, IAutoMovieMcpMotion>;

  /** Optional shot whose performances choose which motion each actor samples. */
  shot?: IAutoMovieShot | null;
}

/** Minimal model geometry lookup accepted by MCP query tools. */
export interface IAutoMovieMcpGeometryModel {
  /** Model id referenced by scene nodes. */
  id: string;

  /** Skeleton used for FK and reach queries; null for props. */
  skeleton: IAutoMovieSkeleton | null;
}

/** The `getResolvedPose` query result. */
export interface IAutoMovieGetResolvedPoseOutput {
  /** Actor pose resolved into world-space bone transforms, or null. */
  resolvedPose: IAutoMovieMcpResolvedPose | null;
}

/** Actor pose after sampling motion and running forward kinematics. */
export interface IAutoMovieMcpResolvedPose {
  /** Scene-node id of the resolved actor. */
  node: string;

  /** Model id placed by the scene node. */
  model: string;

  /** Motion id sampled for this query, or null for a held pose. */
  motion: string | null;

  /** Shot-local time used for sampling, seconds. */
  t: number;

  /** Sparse pose sampled or held before FK. */
  pose: IAutoMoviePose;

  /** Bone transforms in scene world space. */
  bones: IAutoMovieMcpResolvedBone[];
}

/** A single resolved bone transform in scene world space. */
export interface IAutoMovieMcpResolvedBone {
  /** Bone name. */
  bone: AutoMovieHumanoidBone;

  /** Local bone rotation after rest and articulation compose. */
  localRotation: IAutoMovieQuaternion;

  /** World-space bone origin. */
  worldPosition: IAutoMovieVector3;

  /** World-space bone orientation. */
  worldRotation: IAutoMovieQuaternion;
}

/** The `getReach` query result. */
export interface IAutoMovieGetReachOutput {
  /** Reach report, or null when actor/target cannot resolve to rigged points. */
  reach: IAutoMovieMcpReachReport | null;
}

/** Reachability report for one actor against one target. */
export interface IAutoMovieMcpReachReport {
  /** Scene-node id of the actor. */
  actor: string;

  /** Target resolved into world space. */
  target: IAutoMovieVector3;

  /** Left arm report, or null when the rig lacks that arm chain. */
  left: IAutoMovieMcpArmReach | null;

  /** Right arm report, or null when the rig lacks that arm chain. */
  right: IAutoMovieMcpArmReach | null;

  /** True when either arm can reach without a positive gap. */
  reachable: boolean;
}

/** Reachability and IK pose for one arm. */
export interface IAutoMovieMcpArmReach {
  /** Arm side. */
  side: "left" | "right";

  /** Distance from shoulder to target in model space. */
  targetDistance: number;

  /** Shoulder-to-hand reach length in model space. */
  maximumDistance: number;

  /** Positive miss distance; zero means reachable. */
  gap: number;

  /** True when the target lies within the arm's reach shell. */
  reachable: boolean;

  /** IK pose that reaches the target, or extends toward it if out of range. */
  pose: IAutoMoviePose | null;
}

/** The `measureDistance` query result. */
export interface IAutoMovieMeasureDistanceOutput {
  /** Distance report, or null when either target is not positional. */
  measurement: IAutoMovieMcpDistanceMeasurement | null;
}

/** Resolved endpoints and their Euclidean distance. */
export interface IAutoMovieMcpDistanceMeasurement {
  /** First endpoint in world space. */
  from: IAutoMovieVector3;

  /** Second endpoint in world space. */
  to: IAutoMovieVector3;

  /** Euclidean distance between endpoints, meters. */
  distance: number;
}

/** Validation tool result. */
export interface IAutoMovieValidateOutput {
  /** Success or field-located violations. */
  validation: IAutoMovieValidation;
}

/** Commit tool result. */
export interface IAutoMovieCommitOutput {
  /** True only when the input artifact was written into the returned slate. */
  committed: boolean;

  /** Updated slate on success; the unchanged input slate on failure. */
  slate: IAutoMovieMcpWritableSlate;

  /** Success or field-located violations explaining why commit was refused. */
  validation: IAutoMovieValidation;
}

/** Render planning result. */
export interface IAutoMoviePlanRenderOutput {
  /** Success or field-located violations explaining why render cannot start. */
  validation: IAutoMovieValidation;

  /** Deterministic render plan, or null when validation failed. */
  plan: IAutoMovieMcpRenderPlan | null;
}

/** Preview-frame planning result. */
export interface IAutoMovieSeeFrameOutput {
  /** Success or field-located violations explaining why preview cannot resolve. */
  validation: IAutoMovieValidation;

  /** Preview frame contract, or null when validation failed. */
  preview: IAutoMovieMcpFramePreview | null;
}

/** Shot or sequence selected for rendering. */
export interface IAutoMovieMcpRenderTarget {
  /** Render target kind. */
  kind: "shot" | "sequence";

  /** Committed shot or sequence id. */
  id: string;
}

/** Deterministic render plan exposed through MCP. */
export interface IAutoMovieMcpRenderPlan {
  /** Selected committed target. */
  target: IAutoMovieMcpRenderTarget;

  /** Target duration in seconds. */
  duration: number;

  /** Number of frames to capture. */
  frameCount: number;

  /** Clip-local sample instants, seconds. */
  times: number[];

  /** Directory where frame files would be written. */
  frameDir: string;

  /** First frame path. */
  firstFrame: string;

  /** Last frame path. */
  lastFrame: string;

  /** Ffmpeg input pattern for the frame sequence. */
  inputPattern: string;

  /** Encoded output path. */
  outputPath: string;

  /** Ffmpeg argument vector for encoding the frames. */
  ffmpegArgs: string[];

  /** Per-pass guide output locations (beauty only unless more requested). */
  passes: IAutoMovieGuidePassOutput[];
}

/**
 * One frame-capture request the server hands the host-injected adapter: which
 * committed target, which frame/time, which guide pass, and where the frame
 * file belongs. The adapter owns the browser/renderer; the server only plans.
 */
export interface IAutoMovieMcpCaptureRequest {
  /** Selected committed target. */
  target: IAutoMovieMcpRenderTarget;

  /** Zero-based frame index. */
  frame: number;

  /** Clip-local sample time in seconds. */
  time: number;

  /** Guide pass to draw. */
  pass: AutoMovieGuidePass;

  /** Deterministic pass-tagged frame path the capture should produce. */
  framePath: string;

  /** Render width in pixels. */
  width: number;

  /** Render height in pixels. */
  height: number;

  /** Tone mapping requested by the render spec. */
  toneMapping: IAutoMovieRenderSpec["toneMapping"];
}

/** The captured image the adapter returns for one request. */
export interface IAutoMovieMcpCapturedImage {
  /** Frame path the adapter actually wrote (normally the requested one). */
  framePath: string;

  /** Image MIME type, or null when the adapter wrote a file only. */
  mimeType: string | null;

  /** Inline image payload for immediate inspection, or null when file-only. */
  dataUrl: string | null;
}

/**
 * Host-injected frame capture: drives a real renderer (a Playwright page over
 * the viewer, a render worker) for one planned frame and returns the image.
 * Failures should throw — a capture error is a host runtime fault, not a
 * validation issue, and propagates as a tool error.
 */
export type AutoMovieMcpFrameCapture = (
  request: IAutoMovieMcpCaptureRequest,
) => Promise<IAutoMovieMcpCapturedImage>;

/** Preview frame returned by `seeFrame`. */
export interface IAutoMovieMcpFramePreview {
  /** Selected committed target. */
  target: IAutoMovieMcpRenderTarget;

  /** Zero-based frame index. */
  frame: number;

  /** Clip-local sample time in seconds. */
  time: number;

  /** Guide pass drawn (or planned, when no adapter is attached). */
  pass: AutoMovieGuidePass;

  /** Deterministic pass-tagged frame path. */
  framePath: string;

  /** Render width in pixels. */
  width: number;

  /** Render height in pixels. */
  height: number;

  /** Tone mapping requested by the render spec. */
  toneMapping: IAutoMovieRenderSpec["toneMapping"];

  /**
   * `captured` when the host's adapter produced the image; `no-capture-adapter`
   * when the server has no adapter and only planned the frame.
   */
  status: "captured" | "no-capture-adapter";

  /** The captured image, or null when no adapter is attached. */
  image: IAutoMovieMcpCapturedImage | null;
}

/** The `stage` tool's result (a single object wrapping the engine's union). */
export interface IAutoMovieStageOutput {
  /** The staged scene on success, or the staging violations on failure. */
  staged: IAutoMovieStagedSet;
}

/** The `block` tool's result. */
export interface IAutoMovieBlockOutput {
  /** The blocked beat on success, or the blocking violations on failure. */
  blocked: IAutoMovieBlockedBeat;
}

/**
 * Actor context accepted by the MCP `perform` tool.
 *
 * This is the JSON-safe subset of the engine's actor context. Gait cubic-bezier
 * tuple fields are intentionally omitted; use named easing curves for
 * MCP-supplied gait limbs.
 */
export interface IAutoMovieMcpActorContext {
  /** Skeleton id every synthesized clip targets. */
  skeleton: string;

  /** Gaits this actor can perform, without tuple-valued bezier controls. */
  gaits: IAutoMovieMcpGait[];

  /** Where the actor stands at the start of the shot (world meters). */
  position: IAutoMovieVector3;

  /** Locomotion speed in meters per second. */
  speed: number;

  /** Heading the actor faces, degrees about +Y (0 = +Z). */
  facingDeg: number;

  /** Eye height above the actor position, meters. */
  eyeHeight: number;

  /** Pose the actor settles into for a `hold`. */
  restPose: IAutoMoviePose;

  /** Optional rig for ROM validation and IK/physics synthesis. */
  rig?: IAutoMovieSkeleton;

  /** Optional clinical rest-frame lookup, paired with the renderer/player. */
  restFrames?: IAutoMovieActorContext["restFrames"];
}

/** JSON-safe gait definition accepted by the MCP `perform` tool. */
export interface IAutoMovieMcpGait {
  /** Stable gait name such as `"walk"` or `"run"`. */
  name: string;

  /** Stride period in seconds. */
  period: number;

  /** Optional vertical body-mass oscillation. */
  rootBob?: IAutoMovieGaitRootBob;

  /** Limb swing channels without tuple-valued bezier controls. */
  limbs: IAutoMovieMcpGaitLimb[];
}

/** JSON-safe gait limb channel accepted by the MCP `perform` tool. */
export interface IAutoMovieMcpGaitLimb {
  /** The bone this limb swing drives. */
  bone: AutoMovieHumanoidBone;

  /** Joint axis this gait channel writes. */
  axis?: "flexion" | "abduction" | "twist";

  /** Cycle phase offset in [0, 1). */
  phase: number;

  /** Fraction of the stride spent in stance. */
  duty: number;

  /** Peak swing on the selected axis, degrees. */
  amplitude: number;

  /** Easing used while the limb is in stance. */
  stanceEasing?: AutoMovieEasing;

  /** Easing used while the limb is in swing. */
  swingEasing?: AutoMovieEasing;

  /** Center the swing oscillates around, degrees. */
  neutral?: number;
}

/**
 * Performed-shot union returned by the MCP `perform` tool.
 *
 * It mirrors the engine result but rewrites motion keyframe bezier tuples into
 * named object fields so MCP schema generation stays JSON-schema compatible.
 */
export type IAutoMovieMcpPerformedShot =
  | IAutoMovieMcpPerformedShot.ISuccess
  | IAutoMovieMcpPerformedShot.IFailure;
export namespace IAutoMovieMcpPerformedShot {
  /** The performance compiled and every clip passed validation. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The shot, ready for the cut. */
    shot: IAutoMovieShot;

    /** The synthesized per-actor clips, keyed by scene-node id. */
    motions: Record<string, IAutoMovieMcpMotion>;
  }

  /** The action list contradicted the stage, or a compiled clip broke ROM. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/** JSON-safe motion clip returned by the MCP `perform` tool. */
export interface IAutoMovieMcpMotion {
  /** Stable id so scenes and exports can cite this clip. */
  id: string;

  /** Which skeleton this clip animates. */
  skeleton: string;

  /** Total clip length, seconds. */
  duration: number;

  /** Whether the clip loops seamlessly. */
  loop: boolean;

  /** Keyframes in strictly increasing time order. */
  keyframes: IAutoMovieMcpKeyframe[];
}

/** JSON-safe keyframe returned by the MCP `perform` tool. */
export interface IAutoMovieMcpKeyframe {
  /** Timestamp within the clip, seconds. */
  time: number;

  /** The body pose held at this instant. */
  pose: IAutoMoviePose;

  /** Optional facial expression at this instant. */
  expression: IAutoMovieExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: AutoMovieEasing;

  /** Cubic-bezier control points as named fields, or null for named easing. */
  bezier: IAutoMovieMcpBezier | null;
}

/** Cubic-bezier control points as named fields, not a tuple. */
export interface IAutoMovieMcpBezier {
  /** First control point x. */
  x1: number;

  /** First control point y. */
  y1: number;

  /** Second control point x. */
  x2: number;

  /** Second control point y. */
  y2: number;
}

/** The `perform` tool's result. */
export interface IAutoMoviePerformOutput {
  /** The performed shot on success, or the performance violations on failure. */
  performed: IAutoMovieMcpPerformedShot;
}

/** The `cut` tool's result. */
export interface IAutoMovieCutOutput {
  /** The cut film on success, or the assemble violations on failure. */
  cut: IAutoMovieCut;
}

/** The `forge` tool's result. */
export interface IAutoMovieForgeOutput {
  /** The forged cast on success, or the forge violations on failure. */
  forged: IAutoMovieForgedCast;
}

/** A source-to-output value range, the JSON-safe form of a `[from, to]` pair. */
export interface IAutoMovieMcpRange {
  /** Range start. */
  from: number;

  /** Range end. */
  to: number;
}

/**
 * A driven driver whose tuple-valued `inRange`/`outRange` cross the MCP
 * boundary as named {@link IAutoMovieMcpRange} objects (the LLM JSON schema
 * cannot express tuples), converted to the engine's pairs in `convert.ts`.
 */
export interface IAutoMovieMcpDrivenDriver extends Omit<
  IAutoMovieDrivenDriver,
  "inRange" | "outRange"
> {
  /** Source value range mapped onto {@link outRange}. */
  inRange: IAutoMovieMcpRange;

  /** Output value range. */
  outRange: IAutoMovieMcpRange;
}

/** A prop profile driver as the MCP boundary accepts it — tuple-free. */
export type IAutoMovieMcpPropDriver =
  | IAutoMovieCopyDriver
  | IAutoMovieAimDriver
  | IAutoMovieIKDriver
  | IAutoMovieParentDriver
  | IAutoMovieMcpDrivenDriver
  | IAutoMovieSpringDriver;

/**
 * A prop's profile as the MCP boundary accepts it: the declared controls,
 * limits, and (tuple-free) drivers. Gaits are omitted — a prop does not
 * locomote (`IAutoMovieProfile.gaits` is for bodies); the humanoid gait path
 * rides the `perform` tool's actor contexts instead.
 */
export interface IAutoMovieMcpPropProfile {
  /** Stable profile id. */
  id: string;

  /** Profile name (e.g. `"hinge"`). */
  name: string;

  /** The named controls this profile exposes. */
  controls: IAutoMovieProfileControl[];

  /** Drivers coupling the prop's joints, tuple-free. */
  drivers: IAutoMovieMcpPropDriver[];

  /** Value constraints over the prop's joints (the hinge's 0..110°). */
  limits: IAutoMovieChannelLimit[];
}

/** A prop's self-declared moving parts as the MCP boundary accepts them. */
export interface IAutoMovieMcpPropArticulation {
  /** The prop's internal joint nodes. */
  nodes: IAutoMovieNode[];

  /** The declared capability over those nodes. */
  profile: IAutoMovieMcpPropProfile;

  /** The application of the profile onto the nodes (`boneMap`). */
  binding: IAutoMovieProfileBinding;
}

/**
 * A prop spec as the `forgeProp` tool accepts it — a crude primitive proxy with
 * rich meaning: body, affordances, self-declared articulation (D011).
 */
export interface IAutoMovieMcpPropSpec {
  /** The scene node this prop will occupy (the staging join key). */
  node: string;

  /** The prop model: generated, skeleton-less, primitive parts. */
  model: IAutoMovieModel;

  /** Self-declared moving parts, or `null` for a rigid prop. */
  articulation: IAutoMovieMcpPropArticulation | null;
}

/**
 * The engine's forged-prop verdict with the accepted spec echoed in its
 * MCP-safe form (the engine's echo carries the raw tuple-bearing profile the
 * LLM schema cannot express).
 */
export type IAutoMovieMcpForgedProp =
  | IAutoMovieMcpForgedProp.ISuccess
  | IAutoMovieMcpForgedProp.IFailure;
export namespace IAutoMovieMcpForgedProp {
  /** The prop passed both contracts. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The accepted spec, echoed for the staging join. */
    prop: IAutoMovieMcpPropSpec;
  }

  /** The spec broke a contract. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/** The `forgeProp` tool's result. */
export interface IAutoMovieForgePropOutput {
  /** The forged prop on success, or the forge violations on failure. */
  forged: IAutoMovieMcpForgedProp;
}

/**
 * What a resident project holds — which slate slices exist as files and which
 * binary assets the manifest tracks (#614: the project folder is the memory).
 */
export interface IAutoMovieMcpProjectSummary {
  /** Absolute project root directory. */
  root: string;

  /** Whether `script.json` exists. */
  script: boolean;

  /** Whether `scene.json` exists. */
  scene: boolean;

  /** Committed shot ids (`shots/<beat>.json`). */
  shots: string[];

  /** Committed beat-end beats (`beatEnds/<beat>.json`). */
  beatEnds: string[];

  /** Open review note count. */
  notes: number;

  /** Whether `film.json` exists. */
  film: boolean;

  /** Tracked binary asset paths, project-relative, in registration order. */
  assets: string[];
}

/** The `openProject` tool's result. */
export interface IAutoMovieOpenProjectOutput {
  /** The activated project's summary. */
  project: IAutoMovieMcpProjectSummary;
}

/** The `nextSteps` tool's result — the film ladder as data (#615). */
export interface IAutoMovieNextStepsOutput {
  /** The resident project's current status. */
  status: IAutoMovieMcpProjectSummary;

  /** Unmet ladder prerequisites, in ladder order; empty when satisfied. */
  missing: string[];

  /** Ordered concrete tool calls that advance the film; empty when complete. */
  nextActions: string[];
}
