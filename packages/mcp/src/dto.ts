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
  IAutoMovieEuler,
  IAutoMovieExpression,
  IAutoMovieGaitCycle,
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
import {
  IAutoMovieCaptionSidecar,
  IAutoMovieGuidePassOutput,
  IAutoMoviePoseKeypointSidecar,
  IAutoMovieRenderPassManifest,
  IAutoMovieRenderReassembly,
} from "@automovie/render";

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

/** The `getSlate` query result: the whole writable slate in one read. */
export interface IAutoMovieGetSlateOutput {
  /** Every committed slice (script/scene/shots/beatEnds/notes) plus the film. */
  slate: IAutoMovieMcpWritableSlate;
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

/**
 * An LLM-facing placement transform, the MCP boundary form of the engine's
 * {@link IAutoMovieTransform}, where `rotation` is authored as semantic Euler
 * degrees ({@link IAutoMovieEuler}) rather than a raw quaternion (#723, D016).
 *
 * The engine's quaternion is "not LLM-facing" by its own contract, opaque to a
 * language model and easy to emit off-unit-norm, yet a raw transform forced
 * exactly that on any tool where the model authors a placement from scratch.
 * Here the model states an angle it understands (yaw/pitch/roll about the local
 * axes, with the composition `order`) and `toEngineTransform` lowers it to the
 * quaternion, mirroring how joints are authored as clinical degrees. A move
 * that only translates omits `rotation` entirely (identity).
 */
export interface IAutoMovieMcpTransform {
  /** Translation in parent space (meters). */
  translation: IAutoMovieVector3;

  /**
   * Rotation as semantic Euler degrees. Omit or `null` for no rotation
   * (identity), a placement that only slides a node needs no angles.
   */
  rotation?: IAutoMovieEuler | null;

  /** Per-axis scale factor (`1` = identity). Non-positive is rejected. */
  scale: IAutoMovieVector3;
}

/** Minimal model geometry lookup accepted by MCP query tools. */
export interface IAutoMovieMcpGeometryModel {
  /** Model id referenced by scene nodes. */
  id: string;

  /** Skeleton used for FK and reach queries; null for props. */
  skeleton: IAutoMovieSkeleton | null;
}

/** The `getShotEndState` query result. */
export interface IAutoMovieGetShotEndStateOutput {
  /** The engine-derived resumable end-state, ready for `commitBeatEnd`. */
  beatEnd: IAutoMovieBeatEndState | null;

  /** Why derivation failed when `beatEnd` is null; null on success. */
  reason: string | null;
}

/** The `getResolvedPose` query result. */
export interface IAutoMovieGetResolvedPoseOutput {
  /** Actor pose resolved into world-space bone transforms, or null. */
  resolvedPose: IAutoMovieMcpResolvedPose | null;

  /** Which lookup failed when `resolvedPose` is null; null on success. */
  reason: string | null;
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

  /** Which lookup failed when `reach` is null; null on success. */
  reason: string | null;
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

  /**
   * True when either arm can reach the target AND the pose that reaches it
   * satisfies that arm's range of motion, i.e. the answer `perform` will give
   * (#1338). Consult {@link IAutoMovieMcpArmReach.withinShell} for the purely
   * geometric "is it within arm's length" question.
   */
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

  /** Positive miss distance; zero means the target is within arm's length. */
  gap: number;

  /**
   * True when the target lies within the arm's reach shell, a pure distance
   * test (`gap == 0`). Geometry only: the arm may still be unable to assume the
   * pose that lands there.
   */
  withinShell: boolean;

  /**
   * True when this arm both reaches the target and does so within the rig's
   * range of motion: `withinShell` AND `romViolations` empty (#1338).
   *
   * This is the verdict the CONSUMING stage gives. `perform` compiles the same
   * IK pose and runs the same ROM gate, so an oracle that answered on distance
   * alone sent authors to stage against a reach `perform` then refused, after
   * the staging and blocking the measurement existed to protect.
   */
  reachable: boolean;

  /**
   * The violations the rig's ROM gate raises against {@link pose}, empty when
   * the pose is clean. These are the exact violations `perform` would report,
   * field-located per joint axis, so an author can see WHICH axis blocks the
   * reach rather than only that it does. Also empty when no pose was solved.
   */
  romViolations: IAutoMovieConstraintViolation[];

  /**
   * IK pose that reaches the target, or extends toward it if out of range.
   * `null` when the chain is degenerate for this target (a target coincident
   * with the shoulder has no solve), which is also reported as not reachable.
   */
  pose: IAutoMoviePose | null;
}

/** The `measureDistance` query result. */
export interface IAutoMovieMeasureDistanceOutput {
  /** Distance report, or null when either endpoint failed to resolve. */
  measurement: IAutoMovieMcpDistanceMeasurement | null;

  /** Which endpoint failed to resolve when `measurement` is null; else null. */
  reason: string | null;
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

/**
 * A compact identity digest of a slate, which slices exist, by id (#1132). Tool
 * returns carry this instead of echoing whole artifacts: state belongs to the
 * read side (`getSlate`/`getShot`/`nextSteps`), and a full-slate echo on every
 * write cost thousands of tokens per call while tempting callers to trust a
 * possibly-stale snapshot over current truth.
 */
export interface IAutoMovieMcpSlateDigest {
  /** Whether a script is committed. */
  script: boolean;

  /** Whether a staged scene is committed. */
  scene: boolean;

  /** Committed shot ids. */
  shots: string[];

  /** Committed beat-end beats. */
  beatEnds: string[];

  /** Open review note count. */
  notes: number;

  /** Whether the assembled film is committed. */
  film: boolean;

  /**
   * What this call's invalidation cascade cleared, as slice labels (`"film"`,
   * `"notes"`, `"shot:<beat>"`, `"beatEnd:<beat>"`, ...). Empty when nothing
   * downstream was invalidated (including every refusal).
   */
  cleared: string[];
}

export interface IAutoMovieCommitOutput {
  /**
   * True only when the input artifact was persisted. Always equal to
   * `validation.success`, the one-word answer, not a second status channel.
   */
  committed: boolean;

  /** The slate's identity digest after this call (unchanged on refusal). */
  state: IAutoMovieMcpSlateDigest;

  /**
   * The transformed slate, present ONLY for explicit-slate calls, where the
   * tool is a pure transform and the return IS the product (#1132). Resident
   * calls omit it: the project files are the truth, read via `getSlate` /
   * `getShot` / `nextSteps` instead of trusting a per-write echo.
   */
  slate?: IAutoMovieMcpWritableSlate;

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
 * One independently-renderable chunk of a long film, as exposed through MCP:
 * the engine chunk minus its per-frame `frames` array. The whole-plan render
 * tool returns frame `times`, not per-frame shot/blend samples, the host's
 * capture adapter re-derives frame content from the sequence, so a chunk needs
 * only its boundaries, paths, and encoder args, keeping the chunk plan bounded
 * (one entry per chunk, not per frame) even for an hours-long timeline.
 */
export interface IAutoMovieMcpRenderChunk {
  /** Chunk ordinal (0-based, capture order). */
  index: number;

  /** First global output frame index in this chunk (inclusive). */
  frameStart: number;

  /** One past the last global output frame index (exclusive). */
  frameEnd: number;

  /** Number of frames in this chunk. */
  frameCount: number;

  /** Global output second of this chunk's first frame. */
  startSeconds: number;

  /** Global output second of this chunk's last frame. */
  endSeconds: number;

  /** Directory where this chunk's frame files should be written. */
  frameDir: string;

  /** First chunk frame path. */
  firstFrame: string;

  /** Last chunk frame path. */
  lastFrame: string;

  /** Ffmpeg input pattern for this chunk's frame sequence. */
  inputPattern: string;

  /** This chunk's encoded video output path. */
  outputPath: string;

  /** Exact ffmpeg argument vector for this chunk's encoded output. */
  ffmpegArgs: string[];

  /** Per-pass output locations inside this chunk (present only with passes). */
  passOutputs?: IAutoMovieGuidePassOutput[];
}

/**
 * A long film split into independently-renderable, bounded-window chunks plus
 * the plan to reassemble them (#609/#644). Exposed so an orchestrator can drive
 * a two-hour render chunk by chunk without ever holding the whole timeline.
 */
export interface IAutoMovieMcpRenderChunkPlan {
  /** Render target identity. */
  target: IAutoMovieMcpRenderTarget;

  /** Output fps. */
  renderFps: number;

  /** Total output frames across all chunks. */
  frameCount: number;

  /** Frames per chunk (the last chunk may be shorter). */
  chunkFrames: number;

  /** Number of chunks. */
  chunkCount: number;

  /** The chunks, in capture order. */
  chunks: IAutoMovieMcpRenderChunk[];

  /** How to stitch the chunk outputs into the final video. */
  reassembly: IAutoMovieRenderReassembly;

  /** Per-pass whole-timeline walk orders (present only with passes). */
  passManifests?: IAutoMovieRenderPassManifest[];
}

/** Chunked render planning result. */
export interface IAutoMoviePlanChunkedRenderOutput {
  /** Success or field-located violations explaining why chunking cannot start. */
  validation: IAutoMovieValidation;

  /** Chunked render plan, or null when validation failed. */
  plan: IAutoMovieMcpRenderChunkPlan | null;
}

/** Caption sidecar planning result. */
export interface IAutoMoviePlanCaptionsOutput {
  /** Success or field-located violations explaining why captions cannot plan. */
  validation: IAutoMovieValidation;

  /** The whole-film caption sidecar, or null when validation failed. */
  sidecar: IAutoMovieCaptionSidecar | null;

  /**
   * Per-chunk caption sidecars (chunk-local frame indices) when `chunkFrames`
   * was given, aligning each render chunk with its own caption track; null when
   * no chunking was requested (or on validation failure).
   */
  chunks: IAutoMovieCaptionSidecar[] | null;
}

/** Pose-keypoint sidecar planning result (#1168). */
export interface IAutoMoviePlanPoseKeypointsOutput {
  /** Success or field-located violations explaining why keypoints cannot plan. */
  validation: IAutoMovieValidation;

  /** The per-frame pose-keypoint sidecar, or null when validation failed. */
  sidecar: IAutoMoviePoseKeypointSidecar | null;
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
 * Failures should throw, a capture error is a host runtime fault, not a
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

  /**
   * Where the actor stands at the start of the shot (world meters). A RESIDENT
   * `perform` may omit it (#1176): the previous beat's committed end-state
   * seeds it, so a walking character resumes exactly where it stopped. An
   * explicit call (or a beat with no committed predecessor) must pass it.
   */
  position?: IAutoMovieVector3;

  /** Locomotion speed (m/s): how fast a `locomote` carries the actor. */
  speed: number;

  /**
   * Heading the actor faces, degrees about +Y (0 = +Z). Omittable in a RESIDENT
   * `perform` exactly like `position` (#1176), seeded from the previous beat's
   * committed end-state facing.
   */
  facingDeg?: number;

  /**
   * Seconds into the looping gait cycle at the shot's start, a beat that opens
   * mid-stride resumes the walk at this phase instead of restarting it.
   * Omittable in a RESIDENT `perform` exactly like `position` (#1176): seeded
   * from the previous beat's committed end-state `gaitPhase` when it recorded
   * one. `null` (or omission with nothing recorded) starts the cycle at zero.
   */
  gaitPhase?: number | null;

  /** Eye height above the actor's position (meters): where a `lookAt` aims from. */
  eyeHeight: number;

  /** The pose the actor settles into for a `hold`. */
  restPose: IAutoMoviePose;

  /**
   * The actor's resolved skeleton geometry: the rig bones and their ROM
   * constraints. Required only by the physics/IK verbs that measure or clamp
   * against the body (`react` folds a flinch bounded by each joint's ROM) and
   * by `enact`; the gait/hold/lookAt/emote verbs need only the `skeleton` id,
   * so a context built for those alone may omit it, and a physics verb with no
   * `rig` synthesises nothing.
   */
  rig?: IAutoMovieSkeleton;

  /**
   * Per-bone rest frames that let the IK/arm verbs (`reach`/`point`/`strike`)
   * emit their arm angles in **clinical** space, lifted by `sign·r + neutral`
   * so a downstream renderer reads them up through the same frames (abduction
   * `180` raises either arm overhead regardless of side). Omit to have those
   * verbs output raw rig-space angles; when supplied it must be paired with the
   * same frames on the player.
   */
  restFrames?: IAutoMovieActorContext["restFrames"];
}

/**
 * A stored actor context as `actors/<node>.json` holds it (#1176): the
 * beat-invariant half of {@link IAutoMovieMcpActorContext}, everything but
 * `position`/`facingDeg`/`gaitPhase`, which are per-beat openings the
 * continuity seed (or the caller) supplies. A resident `perform` with explicit
 * `actors` writes these through; later resident performs omit `actors` and read
 * them back.
 */
export interface IAutoMovieMcpActorSpec extends Omit<
  IAutoMovieMcpActorContext,
  "position" | "facingDeg" | "gaitPhase"
> {
  /** The scene node / cast id this context belongs to (the storage key). */
  node: string;
}

/**
 * JSON-safe gait definition accepted by the MCP `perform` tool, mirroring
 * {@link IAutoMovieGait} minus the tuple-valued bezier controls its limbs cannot
 * express here.
 */
export interface IAutoMovieMcpGait {
  /** Stable name (`"walk"`, `"trot"`, `"gallop"`, `"stalk"`). */
  name: string;

  /** Stride period (one full cycle) in seconds. */
  period: number;

  /**
   * Optional vertical root bob for the body mass during the cycle. When
   * present, the synthesiser emits a root transform whose `translation.y`
   * follows `center + amplitude * sin(2 * PI * (t / period + phase))`. Omit it
   * to leave root placement entirely to travel/staging.
   */
  rootBob?: IAutoMovieGaitRootBob;

  /**
   * Each limb's contribution to the cycle. The limbs differ only in **when**
   * they swing (`phase`) and **how**: a horse walk is its four legs at phase
   * offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0, 0.5, 0.5, 0`
   * (diagonal pairs).
   */
  limbs: IAutoMovieMcpGaitLimb[];
}

/** JSON-safe gait limb channel accepted by the MCP `perform` tool. */
export interface IAutoMovieMcpGaitLimb {
  /** The bone this limb's swing drives (a leg's upper bone). */
  bone: AutoMovieHumanoidBone;

  /**
   * Joint axis this gait channel writes. Omitted means `"flexion"` (the
   * sagittal swing); set `"abduction"` for side-to-side sway/spread or
   * `"twist"` for axial gait details.
   */
  axis?: "flexion" | "abduction" | "twist";

  /**
   * Where in the stride this limb's cycle starts, in `[0, 1)`: the phase offset
   * that distinguishes one gait's footfall sequence from another's.
   */
  phase: number;

  /**
   * Fraction of the stride the limb spends in **stance** (planted, pushing the
   * body back) versus **swing** (lifted, recovering forward), in `(0, 1)`. A
   * walk has a high duty (long ground contact); a gallop a low one.
   */
  duty: number;

  /** Peak swing on `axis` (degrees) about the limb's neutral. */
  amplitude: number;

  /**
   * Easing used while the limb is in stance (planted, pushing back). Omitted
   * means `"linear"`.
   */
  stanceEasing?: AutoMovieEasing;

  /**
   * Easing used while the limb is in swing (recovering forward). Omitted means
   * `"linear"`.
   */
  swingEasing?: AutoMovieEasing;

  /**
   * Center the swing oscillates around (degrees), default `0`. A symmetric limb
   * (a hip, a shoulder) leaves this unset and swings `±amplitude` about zero; a
   * limb that only bends one way needs a nonzero center to keep the whole swing
   * on the anatomical side. A knee, whose flexion ROM is `[0, 150]°` and cannot
   * hyperextend, walks with e.g. `{ neutral: 25, amplitude: 18 }` so its swing
   * stays in `[7, 43]°` instead of crossing zero: the offset the ROM validator
   * forces once you try to bend a knee at all.
   */
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

/**
 * JSON-safe motion clip crossing the MCP `perform` boundary, returned as the
 * compiled per-actor clips, and supplied by the caller as the authored clips an
 * `enact` action plays (#1148).
 */
export interface IAutoMovieMcpMotion {
  /** Stable id so scenes and exports can cite this clip. */
  id: string;

  /** Which skeleton this clip animates. Every keyframe pose targets this rig. */
  skeleton: string;

  /** Total clip length, seconds. Every keyframe `time` must be `<= duration`. */
  duration: number;

  /**
   * Whether the clip loops seamlessly. When `true`, the engine expects the last
   * keyframe to be continuous with the first.
   */
  loop: boolean;

  /**
   * Keyframes in strictly increasing `time` order. At least two are required: a
   * clip needs a start and an end to interpolate between.
   */
  keyframes: IAutoMovieMcpKeyframe[];

  /**
   * The gait cycle the motion carries ({@link IAutoMovieGaitCycle}), how a
   * non-looping compiled performance still reports a stride phase at the beat
   * end. Absent/null = no cycle to resume.
   */
  gaitCycle?: IAutoMovieGaitCycle | null;
}

/** JSON-safe keyframe returned by the MCP `perform` tool. */
export interface IAutoMovieMcpKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time`; both enforced by the
   * engine's temporal verifier.
   */
  time: number;

  /** The body pose held at this instant. */
  pose: IAutoMoviePose;

  /**
   * Facial expression at this instant, or `null` for the neutral (rest) face.
   * `null` is the unauthored/neutral side, blended toward like a resting joint
   * axis: an expression authored only at the far keyframe ramps in from neutral
   * across the segment, and one authored only at the near keyframe fades out.
   */
  expression: IAutoMovieExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: AutoMovieEasing;

  /**
   * Control points for `easing: "cubicBezier"`, `null` for all other easings.
   * The engine's own keyframe carries these as the tuple `[x1, y1, x2, y2]`;
   * the LLM schema cannot express a tuple, so the MCP boundary names the four
   * numbers instead. Same values, same order.
   */
  bezier: IAutoMovieMcpBezier | null;
}

/**
 * Cubic-bezier control points as named fields, not a tuple: the MCP form of the
 * engine's `[x1, y1, x2, y2]`, in the unit square (CSS `cubic-bezier`
 * convention).
 */
export interface IAutoMovieMcpBezier {
  /** First control point x, in `[0, 1]`. */
  x1: number;

  /** First control point y. */
  y1: number;

  /** Second control point x, in `[0, 1]`. */
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
  /** Source value range mapped onto {@link outRange}. Omit when `curve` is set. */
  inRange?: IAutoMovieMcpRange;

  /** Output value range. Omit when `curve` is set. */
  outRange?: IAutoMovieMcpRange;
}

/** A prop profile driver as the MCP boundary accepts it, tuple-free. */
export type IAutoMovieMcpPropDriver =
  | IAutoMovieCopyDriver
  | IAutoMovieAimDriver
  | IAutoMovieIKDriver
  | IAutoMovieParentDriver
  | IAutoMovieMcpDrivenDriver
  | IAutoMovieSpringDriver;

/**
 * A prop's profile as the MCP boundary accepts it: the declared controls,
 * limits, and (tuple-free) drivers. Gaits are omitted, a prop does not locomote
 * (`IAutoMovieProfile.gaits` is for bodies); the humanoid gait path rides the
 * `perform` tool's actor contexts instead.
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
 * A prop spec as the `forgeProp` tool accepts it, a crude primitive proxy with
 * rich meaning: body, affordances, self-declared articulation.
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

  /**
   * Present only when a resident project is active (#671): `true` when the
   * accepted spec was written through as `props/<node>.json`, `false` when the
   * write-through was refused (#712, the committed scene still places this
   * prop, so re-forging its spec would leave committed shots resolving against
   * stale articulation). Absent on pure (no-project) calls, keeping them
   * byte-compatible, and on failed forges, which write nothing.
   */
  stored?: boolean;

  /**
   * The refusal violations (#712), present only when a resident re-forge was
   * refused (`stored: false`): the committed scene still places this prop node,
   * so its spec is not replaced. Re-commit the scene without the placement (or
   * accept re-perform) first. Absent on a stored write-through, on pure calls,
   * and on failed forges, the `forged.success` already carries the forge
   * contract's own verdict.
   */
  validation?: IAutoMovieValidation;
}

/**
 * What a resident project holds, which slate slices exist as files and which
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

  /** Stored forged prop nodes (`props/<node>.json`). */
  props: string[];

  /** Stored actor context nodes (`actors/<node>.json`, #1176). */
  actors: string[];

  /**
   * Render outputs the committed truth no longer owns (#1130): top-level
   * `renders/` entries whose name matches neither the committed film's stem
   * family, nor any committed shot's, nor a registered asset. Re-committing
   * upstream clears the film while its rendered frames and videos linger; the
   * server NEVER deletes user-visible files, so detection is the server's and
   * the corrective action (delete the strays, or register them deliberately) is
   * the agent's. Empty when the directory matches the committed truth, and
   * always empty while no film is committed (a film mid-rework owns nothing
   * yet).
   */
  staleRenders: string[];

  /** Tracked binary asset paths, project-relative, in registration order. */
  assets: string[];
}

/** The `openProject` tool's result. */
export interface IAutoMovieOpenProjectOutput {
  /** The activated project's summary. */
  project: IAutoMovieMcpProjectSummary;
}

/**
 * An erase tool's result (#617). Erase is a targeted, resident-only removal of
 * one named artifact, never a reset; `erased` is true only when the named
 * mistake existed and its files were removed (with the downstream cascade).
 */
export interface IAutoMovieEraseOutput {
  /** True only when the named artifact existed and was removed. */
  erased: boolean;

  /** The resident slate's identity digest after the erase (#1132). */
  state: IAutoMovieMcpSlateDigest;

  /** Success, or the violations explaining why the erase was refused. */
  validation: IAutoMovieValidation;
}

/**
 * A `set*` tool's result (#654). Set is a targeted, resident-only replacement
 * of one artifact inside a committed slice, the granularity below the beat;
 * `updated` is true only when the named target existed and was replaced (with
 * the documented downstream cascade).
 */
export interface IAutoMovieSetOutput {
  /** True only when the named target existed and was replaced. */
  updated: boolean;

  /** The resident slate's identity digest after the set (#1132). */
  state: IAutoMovieMcpSlateDigest;

  /** Success, or the violations explaining why the set was refused. */
  validation: IAutoMovieValidation;
}

/**
 * The `eraseProp` tool's result (#671). Erase is a targeted, resident-only
 * removal of ONE stored prop spec file, `erased` is true only when the named
 * spec existed and its file was removed. A prop the committed scene still
 * places is refused: unstaging is `commitScene`'s job, not a spec erase's.
 */
export interface IAutoMoviePropEraseOutput {
  /** True only when the named prop spec existed and its file was removed. */
  erased: boolean;

  /** Stored prop nodes after the call (unchanged when refused). */
  props: string[];

  /** Success, or the violations explaining why the erase was refused. */
  validation: IAutoMovieValidation;
}

/**
 * The `eraseActor` tool's result (#1176). Erase is a targeted, resident-only
 * removal of ONE stored actor context file, `erased` is true only when the
 * named context existed and its file was removed. An actor the committed scene
 * still stages is refused: later resident performs would lose the context their
 * beats depend on, and unstaging is `commitScene`'s job.
 */
export interface IAutoMovieActorEraseOutput {
  /** True only when the named actor context existed and its file was removed. */
  erased: boolean;

  /** Stored actor context nodes after the call (unchanged when refused). */
  actors: string[];

  /** Success, or the violations explaining why the erase was refused. */
  validation: IAutoMovieValidation;
}

/**
 * The `registerAsset` tool's result (#670). Registration is a resident-only,
 * additive manifest mutation: `registered` is true only when the path was newly
 * tracked, duplicates and path escapes are refused as violations, and the index
 * is never silently rewritten.
 */
export interface IAutoMovieRegisterAssetOutput {
  /** True only when the path was newly registered into the manifest. */
  registered: boolean;

  /** The normalized project-relative path, or null when refused. */
  path: string | null;

  /** Every tracked asset path after the call (unchanged when refused). */
  assets: string[];

  /** Success, or the violations explaining why registration was refused. */
  validation: IAutoMovieValidation;
}

/** The `nextSteps` tool's result, the film ladder as data (#615). */
export interface IAutoMovieNextStepsOutput {
  /** The resident project's current status. */
  status: IAutoMovieMcpProjectSummary;

  /** Unmet ladder prerequisites, in ladder order; empty when satisfied. */
  missing: string[];

  /** Ordered concrete tool calls that advance the film; empty when complete. */
  nextActions: string[];
}

/**
 * Every guide document the server ships. Keys match `packages/mcp/prompts/*.md`
 * filename stems exactly; the runtime content is generated from those markdown
 * files at build time. Start new work with `"AUTOMOVIE_OVERALL"`, then read the
 * guide matching the next stage.
 */
export type AutoMovieGuideName =
  | "AUTOMOVIE_OVERALL"
  | "STAGING"
  | "BLOCKING"
  | "PERFORMANCE"
  | "FORGE"
  | "REVIEW"
  | "PROPS"
  | "PROJECT_MEMORY"
  | "RENDER_GUIDES";

/** The `getGuideDocument` tool's result. */
export interface IAutoMovieGuideDocumentOutput {
  /** Markdown guide content for the requested topic. */
  content: string;
}
