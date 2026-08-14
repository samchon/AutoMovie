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
  type AutoMovieProductionGuideName,
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

/**
 * The committed slices a READ tool needs: everything but the assembled film.
 *
 * `film` is declared here as optional rather than omitted, because every
 * producer of a slate emits the writable form and the documented loop is
 * commit-then-read: `commitScene`'s echoed slate goes straight back into
 * `getScene`. Tool inputs are validated with `validateEquals` (#1340), so a
 * property the parameter does not declare is refused, and leaving `film`
 * undeclared would have broken that round trip at the boundary. Declaring it
 * optional accepts both forms and states the truth: a read of the script, the
 * scene, a shot, the notes, or a beat end does not consult the film.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes every committed production slice a typed slate value that source code can pass between reads without relying on resident server memory.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Defines the read slate as explicit caller-visible state; MCP reads these committed slices but does not author them.
 */
export interface IAutoMovieMcpStoredSlate {
  /**
   * Committed script, or null before SCRIPT exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes committed script, or null before SCRIPT exists explicit in the stored slate, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries committed script, or null before SCRIPT exists through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  script: IAutoMovieScript | null;

  /**
   * Committed staged scenes, keyed by their own `id`, empty before STAGING.
   *
   * Plural because a film is not one location. The script tree already authors
   * several `scene` nodes with their own INT/EXT and location, and every shot
   * already names the scene it renders through {@link IAutoMovieShot.scene},
   * which `validateShotArtifact` enforces. The slate held one scene, so the
   * production layer collapsed a screenplay to a single set (#1171).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes committed staged scenes, keyed by their own `id`, empty before STAGING in the stored slate, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries committed staged scenes, keyed by their own `id`, empty before STAGING as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  scenes: IAutoMovieScene[];

  /**
   * Shots built so far.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes shots built so far in the stored slate, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries shots built so far as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  shots: IAutoMovieShot[];

  /**
   * Resolved end-state snapshots for built beats.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes resolved end-state snapshots for built beats in the stored slate, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries resolved end-state snapshots for built beats as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  beatEnds: IAutoMovieBeatEndState[];

  /**
   * Open review notes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes open review notes in the stored slate, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries open review notes as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  notes: IAutoMovieReviewNote[];

  /**
   * Assembled film, or null before CUT has committed. Carried so a slate
   * returned by any tool can be passed straight back to a read tool; the reads
   * themselves never consult it.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes assembled film, or null before CUT has committed explicit in the stored slate, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries assembled film, or null before CUT has committed through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  film?: IAutoMovieSequence | null;
}

/**
 * Writable slate accepted and returned by MCP commit tools.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets source callers provide and receive the complete writable slate, including the cut film, as ordinary TypeScript data.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Defines commit state as an explicit input and result; the controller validates or persists it without becoming its author.
 */
export interface IAutoMovieMcpWritableSlate extends IAutoMovieMcpStoredSlate {
  /**
   * Assembled film, or null before CUT has committed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes assembled film, or null before CUT has committed explicit in the writable slate, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries assembled film, or null before CUT has committed through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  film: IAutoMovieSequence | null;
}

/**
 * The `getSlate` query result: the whole writable slate in one read.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `getSlate` query result available to typed source callers, so the query can be consumed and diagnosed without hidden session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns the `getSlate` query result from deterministic package logic; MCP reports the query result without authoring its project inputs.
 */
export interface IAutoMovieGetSlateOutput {
  /**
   * Every committed slice (script/scene/shots/beatEnds/notes) plus the film.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes every committed slice (script/scene/shots/beatEnds/notes) plus the film explicit in the get slate result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries every committed slice (script/scene/shots/beatEnds/notes) plus the film through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  slate: IAutoMovieMcpWritableSlate;
}

/**
 * The `getScript` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `getScript` query result available to typed source callers, so the query can be consumed and diagnosed without hidden session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns the `getScript` query result from deterministic package logic; MCP reports the query result without authoring its project inputs.
 */
export interface IAutoMovieGetScriptOutput {
  /**
   * The committed script slice, or null until it exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the committed script slice, or null until it exists explicit in the get script result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries the committed script slice, or null until it exists through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  script: IAutoMovieScript | null;
}

/**
 * The `getScene` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `getScene` query result available to typed source callers, so the query can be consumed and diagnosed without hidden session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns the `getScene` query result from deterministic package logic; MCP reports the query result without authoring its project inputs.
 */
export interface IAutoMovieGetSceneOutput {
  /**
   * The committed staged scene, or null until it exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the committed staged scene, or null until it exists explicit in the get scene result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries the committed staged scene, or null until it exists through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  scene: IAutoMovieScene | null;
}

/**
 * The `getShot` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `getShot` query result available to typed source callers, so the query can be consumed and diagnosed without hidden session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns the `getShot` query result from deterministic package logic; MCP reports the query result without authoring its project inputs.
 */
export interface IAutoMovieGetShotOutput {
  /**
   * The shot for the requested beat, or null until it exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the shot for the requested beat, or null until it exists explicit in the get shot result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries the shot for the requested beat, or null until it exists through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  shot: IAutoMovieShot | null;
}

/**
 * The `getNotes` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `getNotes` query result available to typed source callers, so review notes can be consumed without hidden session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns review notes from deterministic package state; MCP reports them without authoring their content.
 */
export interface IAutoMovieGetNotesOutput {
  /**
   * Open review notes, optionally filtered by beat.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Returns the open notes selected for a beat to typed callers, so source code can drive the review loop from explicit findings.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Reads committed review notes as project data; the controller reports them without authoring the review record.
   */
  notes: IAutoMovieReviewNote[];
}

/**
 * The `getBeatEnd` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes resumable beat-end lookup a typed package query that source code can consume without resident session knowledge.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Exposes committed beat-end state through a deterministic read; MCP does not author the continuity snapshot.
 */
export interface IAutoMovieGetBeatEndOutput {
  /**
   * The end-state for the requested beat, or null until it exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives source callers the requested beat's committed end state, including its explicit pre-commit absence.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Returns the project-owned continuity snapshot as data; the controller neither derives nor authors it here.
   */
  beatEnd: IAutoMovieBeatEndState | null;
}

/**
 * Geometry query context accepted by MCP tools.
 *
 * It keeps only the pieces the queries need: staged scene nodes, model
 * skeletons, compiled MCP-safe motions, and an optional shot to sample.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary code assemble the staged scene, rigs, motions, rest frames, and shot needed for geometry queries.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Supplies deterministic geometry evaluation with caller-owned context; MCP does not author placements or motion.
 */
export interface IAutoMovieMcpGeometryContext {
  /**
   * Staged scene whose node transforms define world space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the staged world transform hierarchy explicit to source callers performing spatial queries.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Treats scene placement as supplied project data for deterministic evaluation, not as MCP-authored staging.
   */
  scene: IAutoMovieScene;

  /**
   * Model id to skeleton lookup; full mesh/material payloads are not needed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets source code join staged model ids to the skeletons required by FK and reach calculations.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Restricts the query input to declared rig geometry; MCP neither chooses models nor authors meshes.
   */
  models: IAutoMovieMcpGeometryModel[];

  /**
   * Compiled motions, usually the `perform` output's `motions` record.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes compiled motion clips available to ordinary callers that sample geometry outside the perform call.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Feeds code-authored or compiled motion data into deterministic sampling; MCP does not invent the clips.
   */
  motions: Record<string, IAutoMovieMcpMotion>;

  /**
   * Per-actor clinical rest-frame tables, keyed by scene-node id. Omitted
   * actors use the canonical humanoid frame; an explicit empty table selects
   * raw rig-space angles for that actor.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project code supply each actor's clinical rest frame so resolved joint angles remain inspectable and reproducible.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Applies caller-declared rest geometry during deterministic kinematics; the controller does not author rig calibration.
   */
  actorRestFrames?: Record<
    string,
    NonNullable<IAutoMovieActorContext["restFrames"]>
  >;

  /**
   * Optional shot whose performances choose which motion each actor samples.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the shot-to-performance selection that tells source-side queries which actor motions to sample.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Uses the supplied shot only to resolve deterministic sampling; MCP does not author the shot or its performances.
   */
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets project source express placement with semantic Euler degrees while retaining a typed lowering boundary to engine quaternions.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps placement angles in code-authored data and confines MCP to transporting the transform for deterministic lowering.
 */
export interface IAutoMovieMcpTransform {
  /**
   * Translation in parent space (meters).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the authored parent-space displacement directly constructible and inspectable in TypeScript.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Supplies translation as declared placement data for deterministic lowering, not as a controller-authored move.
   */
  translation: IAutoMovieVector3;

  /**
   * Rotation as semantic Euler degrees. Omit or `null` for no rotation
   * (identity), a placement that only slides a node needs no angles.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  rotation?: IAutoMovieEuler | null;

  /**
   * Per-axis scale factor (`1` = identity). Non-positive is rejected.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  scale: IAutoMovieVector3;
}

/**
 * Minimal model geometry lookup accepted by MCP query tools.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpGeometryModel {
  /**
   * Model id referenced by scene nodes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  id: string;

  /**
   * Skeleton used for FK and reach queries; null for props.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  skeleton: IAutoMovieSkeleton | null;
}

/**
 * The `getShotEndState` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieGetShotEndStateOutput {
  /**
   * The engine-derived resumable end-state, ready for `commitBeatEnd`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  beatEnd: IAutoMovieBeatEndState | null;

  /**
   * Why derivation failed when `beatEnd` is null; null on success.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reason: string | null;
}

/**
 * The `getResolvedPose` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieGetResolvedPoseOutput {
  /**
   * Actor pose resolved into world-space bone transforms, or null.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  resolvedPose: IAutoMovieMcpResolvedPose | null;

  /**
   * Which lookup failed when `resolvedPose` is null; null on success.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reason: string | null;
}

/**
 * Actor pose after sampling motion and running forward kinematics.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpResolvedPose {
  /**
   * Scene-node id of the resolved actor.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  node: string;

  /**
   * Model id placed by the scene node.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  model: string;

  /**
   * Motion id sampled for this query, or null for a held pose.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  motion: string | null;

  /**
   * Shot-local time used for sampling, seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  t: number;

  /**
   * Sparse pose sampled or held before FK.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  pose: IAutoMoviePose;

  /**
   * Bone transforms in scene world space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  bones: IAutoMovieMcpResolvedBone[];
}

/**
 * A single resolved bone transform in scene world space.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpResolvedBone {
  /**
   * Bone name.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Local bone rotation after rest and articulation compose.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  localRotation: IAutoMovieQuaternion;

  /**
   * World-space bone origin.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  worldPosition: IAutoMovieVector3;

  /**
   * World-space bone orientation.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  worldRotation: IAutoMovieQuaternion;
}

/**
 * The `getReach` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieGetReachOutput {
  /**
   * Reach report, or null when actor/target cannot resolve to rigged points.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reach: IAutoMovieMcpReachReport | null;

  /**
   * Which lookup failed when `reach` is null; null on success.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reason: string | null;
}

/**
 * Reachability report for one actor against one target.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpReachReport {
  /**
   * Scene-node id of the actor.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  actor: string;

  /**
   * Target resolved into world space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  target: IAutoMovieVector3;

  /**
   * Left arm report, or null when the rig lacks that arm chain.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  left: IAutoMovieMcpArmReach | null;

  /**
   * Right arm report, or null when the rig lacks that arm chain.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  right: IAutoMovieMcpArmReach | null;

  /**
   * True when either arm's shell contains the target: a DISTANCE verdict, and
   * only that. It does not promise `perform` will accept the reach; consult
   * each arm's {@link IAutoMovieMcpArmReach.poseWithinRom} and
   * {@link IAutoMovieMcpArmReach.romViolations} for that (#1338).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reachable: boolean;
}

/**
 * Reachability and IK pose for one arm.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpArmReach {
  /**
   * Arm side.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  side: "left" | "right";

  /**
   * Distance from shoulder to target in model space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  targetDistance: number;

  /**
   * Shoulder-to-hand reach length in model space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  maximumDistance: number;

  /**
   * Positive miss distance; zero means the target is within arm's length.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  gap: number;

  /**
   * True when the target lies within the arm's reach shell (`gap == 0`). A
   * DISTANCE verdict: whether the arm is long enough, reaching from where the
   * actor stands.
   *
   * It is deliberately NOT the answer `perform` gives. Whether the arm can hold
   * the pose that lands there is {@link poseWithinRom}, and the two are separate
   * because the engine can establish the first and can only answer the second
   * about ONE candidate pose (see {@link romViolations}).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reachable: boolean;

  /**
   * True when {@link pose} satisfies the rig's range of motion, so `perform`
   * would accept this reach. False when it would refuse, and `false` when no
   * pose was solved at all.
   *
   * Scoped to the pose, not to the arm, and the scope is the honest limit. A
   * `false` here says "the pose this solver produced breaks the rig", NOT "the
   * arm cannot reach": the engine has one analytic two-bone solve, so a failed
   * candidate is not proof that no valid pose exists. Claiming the stronger
   * verdict would repeat the original defect's error (#1338) in the opposite
   * direction, asserting an impossibility from a single unsuccessful attempt.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  poseWithinRom: boolean;

  /**
   * The violations the rig's ROM gate raises against {@link pose}, empty when
   * the pose is clean or no pose was solved. These are the exact violations
   * `perform` reports for this pose, field-located per joint axis, so the
   * author sees WHICH axis blocks the reach at measure time instead of after
   * staging and blocking against it.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  romViolations: IAutoMovieConstraintViolation[];

  /**
   * IK pose that reaches the target, or extends toward it if out of range, in
   * CLINICAL angles (the space the ROM table, `perform`, and a pose author all
   * use). `null` when no pose could be solved, and {@link poseReason} says why.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  pose: IAutoMoviePose | null;

  /**
   * Why {@link pose} is null, `null` when a pose was solved.
   *
   * The two causes need different corrections, so the report names which one
   * happened instead of leaving an unexplained null. A target coincident with
   * the shoulder has no two-bone solve for THAT placement: restage and measure
   * again. An arm whose elbow flexion axis lies along the forearm's own rest
   * direction has no solvable pose for ANY placement, because elbow flexion
   * rolls the forearm instead of moving the hand, so the chain has one fixed
   * radius rather than a reach shell: that rig cannot be asked to reach until
   * its arm chain is authored to bend (#1346).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  poseReason: string | null;
}

/**
 * The `measureDistance` query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMeasureDistanceOutput {
  /**
   * Distance report, or null when either endpoint failed to resolve.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  measurement: IAutoMovieMcpDistanceMeasurement | null;

  /**
   * Which endpoint failed to resolve when `measurement` is null; else null.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reason: string | null;
}

/**
 * Resolved endpoints and their Euclidean distance.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpDistanceMeasurement {
  /**
   * First endpoint in world space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  from: IAutoMovieVector3;

  /**
   * Second endpoint in world space.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  to: IAutoMovieVector3;

  /**
   * Euclidean distance between endpoints, meters.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  distance: number;
}

/**
 * Validation tool result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieValidateOutput {
  /**
   * Success or field-located violations.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;
}

/**
 * A compact identity digest of a slate, which slices exist, by id (#1132). Tool
 * returns carry this instead of echoing whole artifacts: state belongs to the
 * read side (`getSlate`/`getShot`/`nextSteps`), and a full-slate echo on every
 * write cost thousands of tokens per call while tempting callers to trust a
 * possibly-stale snapshot over current truth.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpSlateDigest {
  /**
   * Whether a script is committed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  script: boolean;

  /**
   * Whether a staged scene is committed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  scene: boolean;

  /**
   * Committed shot ids.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  shots: string[];

  /**
   * Committed beat-end beats.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  beatEnds: string[];

  /**
   * Open review note count.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  notes: number;

  /**
   * Whether the assembled film is committed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  film: boolean;

  /**
   * What this call's invalidation cascade cleared, as slice labels (`"film"`,
   * `"notes"`, `"shot:<beat>"`, `"beatEnd:<beat>"`, ...). Empty when nothing
   * downstream was invalidated (including every refusal).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  cleared: string[];
}

/**
 * Result of attempting to commit one caller-authored production artifact.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility Reports the exact downstream invalidation consequence of a committed source change.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report Keeps persisted source and cleared derived state in one result.
 */
export interface IAutoMovieCommitOutput {
  /**
   * True only when the input artifact was persisted. Always equal to
   * `validation.success`, the one-word answer, not a second status channel.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  committed: boolean;

  /**
   * The slate's identity digest after this call (unchanged on refusal).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  state: IAutoMovieMcpSlateDigest;

  /**
   * The transformed slate, present ONLY for explicit-slate calls, where the
   * tool is a pure transform and the return IS the product (#1132). Resident
   * calls omit it: the project files are the truth, read via `getSlate` /
   * `getShot` / `nextSteps` instead of trusting a per-write echo.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  slate?: IAutoMovieMcpWritableSlate;

  /**
   * Success or field-located violations explaining why commit was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;
}

/**
 * Render planning result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePlanRenderOutput {
  /**
   * Success or field-located violations explaining why render cannot start.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;

  /**
   * Deterministic render plan, or null when validation failed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  plan: IAutoMovieMcpRenderPlan | null;
}

/**
 * Preview-frame planning result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieSeeFrameOutput {
  /**
   * Success or field-located violations explaining why preview cannot resolve.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;

  /**
   * Preview frame contract, or null when validation failed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  preview: IAutoMovieMcpFramePreview | null;
}

/**
 * Shot or sequence selected for rendering.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpRenderTarget {
  /**
   * Render target kind.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  kind: "shot" | "sequence";

  /**
   * Committed shot or sequence id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  id: string;
}

/**
 * Deterministic render plan exposed through MCP.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpRenderPlan {
  /**
   * Selected committed target.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  target: IAutoMovieMcpRenderTarget;

  /**
   * Target duration in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  duration: number;

  /**
   * Number of frames to capture.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameCount: number;

  /**
   * Clip-local sample instants, seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  times: number[];

  /**
   * Directory where frame files would be written.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameDir: string;

  /**
   * First frame path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  firstFrame: string;

  /**
   * Last frame path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for the frame sequence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  inputPattern: string;

  /**
   * Encoded output path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  outputPath: string;

  /**
   * Ffmpeg argument vector for encoding the frames.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  ffmpegArgs: string[];

  /**
   * Per-pass guide output locations (beauty only unless more requested).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  passes: IAutoMovieGuidePassOutput[];
}

/**
 * One independently-renderable chunk of a long film, as exposed through MCP:
 * the engine chunk minus its per-frame `frames` array. The whole-plan render
 * tool returns frame `times`, not per-frame shot/blend samples, the host's
 * capture adapter re-derives frame content from the sequence, so a chunk needs
 * only its boundaries, paths, and encoder args, keeping the chunk plan bounded
 * (one entry per chunk, not per frame) even for an hours-long timeline.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpRenderChunk {
  /**
   * Chunk ordinal (0-based, capture order).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  index: number;

  /**
   * First global output frame index in this chunk (inclusive).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameStart: number;

  /**
   * One past the last global output frame index (exclusive).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameEnd: number;

  /**
   * Number of frames in this chunk.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameCount: number;

  /**
   * Global output second of this chunk's first frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  startSeconds: number;

  /**
   * Global output second of this chunk's last frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  endSeconds: number;

  /**
   * Directory where this chunk's frame files should be written.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameDir: string;

  /**
   * First chunk frame path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  firstFrame: string;

  /**
   * Last chunk frame path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for this chunk's frame sequence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  inputPattern: string;

  /**
   * This chunk's encoded video output path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  outputPath: string;

  /**
   * Exact ffmpeg argument vector for this chunk's encoded output.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  ffmpegArgs: string[];

  /**
   * Per-pass output locations inside this chunk (present only with passes).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  passOutputs?: IAutoMovieGuidePassOutput[];
}

/**
 * A long film split into independently-renderable, bounded-window chunks plus
 * the plan to reassemble them (#609/#644). Exposed so an orchestrator can drive
 * a two-hour render chunk by chunk without ever holding the whole timeline.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpRenderChunkPlan {
  /**
   * Render target identity.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  target: IAutoMovieMcpRenderTarget;

  /**
   * Output fps.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  renderFps: number;

  /**
   * Total output frames across all chunks.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frameCount: number;

  /**
   * Frames per chunk (the last chunk may be shorter).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  chunkFrames: number;

  /**
   * Number of chunks.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  chunkCount: number;

  /**
   * The chunks, in capture order.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  chunks: IAutoMovieMcpRenderChunk[];

  /**
   * How to stitch the chunk outputs into the final video.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reassembly: IAutoMovieRenderReassembly;

  /**
   * Per-pass whole-timeline walk orders (present only with passes).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  passManifests?: IAutoMovieRenderPassManifest[];
}

/**
 * Chunked render planning result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePlanChunkedRenderOutput {
  /**
   * Success or field-located violations explaining why chunking cannot start.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;

  /**
   * Chunked render plan, or null when validation failed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  plan: IAutoMovieMcpRenderChunkPlan | null;
}

/**
 * Caption sidecar planning result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePlanCaptionsOutput {
  /**
   * Success or field-located violations explaining why captions cannot plan.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;

  /**
   * The whole-film caption sidecar, or null when validation failed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  sidecar: IAutoMovieCaptionSidecar | null;

  /**
   * Per-chunk caption sidecars (chunk-local frame indices) when `chunkFrames`
   * was given, aligning each render chunk with its own caption track; null when
   * no chunking was requested (or on validation failure).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  chunks: IAutoMovieCaptionSidecar[] | null;
}

/**
 * Pose-keypoint sidecar planning result (#1168).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePlanPoseKeypointsOutput {
  /**
   * Success or field-located violations explaining why keypoints cannot plan.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;

  /**
   * The per-frame pose-keypoint sidecar, or null when validation failed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  sidecar: IAutoMoviePoseKeypointSidecar | null;
}

/**
 * One frame-capture request the server hands the host-injected adapter: which
 * committed target, which frame/time, which guide pass, and where the frame
 * file belongs. The adapter owns the browser/renderer; the server only plans.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpCaptureRequest {
  /**
   * Selected committed target.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  target: IAutoMovieMcpRenderTarget;

  /**
   * Zero-based frame index.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frame: number;

  /**
   * Clip-local sample time in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  time: number;

  /**
   * Guide pass to draw.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  pass: AutoMovieGuidePass;

  /**
   * Deterministic pass-tagged frame path the capture should produce.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  framePath: string;

  /**
   * Render width in pixels.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  width: number;

  /**
   * Render height in pixels.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  height: number;

  /**
   * Tone mapping requested by the render spec.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  toneMapping: IAutoMovieRenderSpec["toneMapping"];
}

/**
 * The captured image the adapter returns for one request.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpCapturedImage {
  /**
   * Frame path the adapter actually wrote (normally the requested one).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  framePath: string;

  /**
   * Image MIME type, or null when the adapter wrote a file only.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  mimeType: string | null;

  /**
   * Inline image payload for immediate inspection, or null when file-only.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  dataUrl: string | null;
}

/**
 * Host-injected frame capture: drives a real renderer (a Playwright page over
 * the viewer, a render worker) for one planned frame and returns the image.
 * Failures should throw, a capture error is a host runtime fault, not a
 * validation issue, and propagates as a tool error.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export type AutoMovieMcpFrameCapture = (
  request: IAutoMovieMcpCaptureRequest,
) => Promise<IAutoMovieMcpCapturedImage>;

/**
 * Preview frame returned by `seeFrame`.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpFramePreview {
  /**
   * Selected committed target.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  target: IAutoMovieMcpRenderTarget;

  /**
   * Zero-based frame index.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frame: number;

  /**
   * Clip-local sample time in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  time: number;

  /**
   * Guide pass drawn (or planned, when no adapter is attached).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  pass: AutoMovieGuidePass;

  /**
   * Deterministic pass-tagged frame path.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  framePath: string;

  /**
   * Render width in pixels.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  width: number;

  /**
   * Render height in pixels.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  height: number;

  /**
   * Tone mapping requested by the render spec.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  toneMapping: IAutoMovieRenderSpec["toneMapping"];

  /**
   * `captured` when the host's adapter produced the image; `no-capture-adapter`
   * when the server has no adapter and only planned the frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  status: "captured" | "no-capture-adapter";

  /**
   * The captured image, or null when no adapter is attached.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  image: IAutoMovieMcpCapturedImage | null;
}

/**
 * The `stage` tool's result (a single object wrapping the engine's union).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieStageOutput {
  /**
   * The staged scene on success, or the staging violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  staged: IAutoMovieStagedSet;
}

/**
 * The `block` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieBlockOutput {
  /**
   * The blocked beat on success, or the blocking violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  blocked: IAutoMovieBlockedBeat;
}

/**
 * Actor context accepted by the MCP `perform` tool.
 *
 * This is the JSON-safe subset of the engine's actor context. Gait cubic-bezier
 * tuple fields are intentionally omitted; use named easing curves for
 * MCP-supplied gait limbs.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpActorContext {
  /**
   * Skeleton id every synthesized clip targets.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  skeleton: string;

  /**
   * Gaits this actor can perform, without tuple-valued bezier controls.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  gaits: IAutoMovieMcpGait[];

  /**
   * Where the actor stands at the start of the shot (world meters). A RESIDENT
   * `perform` may omit it (#1176): the previous beat's committed end-state
   * seeds it, so a walking character resumes exactly where it stopped. An
   * explicit call (or a beat with no committed predecessor) must pass it.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  position?: IAutoMovieVector3;

  /**
   * Locomotion speed (m/s): how fast a `locomote` carries the actor.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  speed: number;

  /**
   * Heading the actor faces, degrees about +Y (0 = +Z). Omittable in a RESIDENT
   * `perform` exactly like `position` (#1176), seeded from the previous beat's
   * committed end-state facing.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  facingDeg?: number;

  /**
   * Seconds into the looping gait cycle at the shot's start, a beat that opens
   * mid-stride resumes the walk at this phase instead of restarting it.
   * Omittable in a RESIDENT `perform` exactly like `position` (#1176): seeded
   * from the previous beat's committed end-state `gaitPhase` when it recorded
   * one. `null` (or omission with nothing recorded) starts the cycle at zero.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  gaitPhase?: number | null;

  /**
   * Eye height above the actor's position (meters): where a `lookAt` aims from.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  eyeHeight: number;

  /**
   * The pose the actor settles into for a `hold`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  restPose: IAutoMoviePose;

  /**
   * The actor's resolved skeleton geometry: the rig bones and their ROM
   * constraints. Required by the physics/IK verbs that measure or clamp against
   * the body (`react` folds a flinch bounded by each joint's ROM) and by
   * `enact`; one of those without a `rig` synthesises nothing. `lookAt` reads
   * it too, spreading a steep aim across the `neck` and `head` ranges you
   * declare instead of putting the whole angle on the head.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  rig?: IAutoMovieSkeleton;

  /**
   * Per-bone rest frames that let the IK/arm verbs (`reach`/`point`/`strike`)
   * emit their arm angles in **clinical** space, lifted by `sign·r + neutral`
   * so a downstream renderer reads them up through the same frames (abduction
   * `180` raises either arm overhead regardless of side). Omission uses the
   * canonical humanoid clinical frame; supply `{}` only for raw rig-space
   * angles. A custom table must be paired with the same frames on the player.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpActorSpec extends Omit<
  IAutoMovieMcpActorContext,
  "position" | "facingDeg" | "gaitPhase"
> {
  /**
   * The scene node / cast id this context belongs to (the storage key).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  node: string;
}

/**
 * JSON-safe gait definition accepted by the MCP `perform` tool, mirroring
 * {@link IAutoMovieGait} minus the tuple-valued bezier controls its limbs cannot
 * express here.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpGait {
  /**
   * Stable name (`"walk"`, `"trot"`, `"gallop"`, `"stalk"`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  name: string;

  /**
   * Stride period (one full cycle) in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  period: number;

  /**
   * Optional vertical root bob for the body mass during the cycle. When
   * present, the synthesiser emits a root transform whose `translation.y`
   * follows `center + amplitude * sin(2 * PI * (t / period + phase))`. Omit it
   * to leave root placement entirely to travel/staging.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  rootBob?: IAutoMovieGaitRootBob;

  /**
   * Each limb's contribution to the cycle. The limbs differ only in **when**
   * they swing (`phase`) and **how**: a horse walk is its four legs at phase
   * offsets `0, 0.5, 0.25, 0.75` (lateral sequence), a trot at `0, 0.5, 0.5, 0`
   * (diagonal pairs).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  limbs: IAutoMovieMcpGaitLimb[];
}

/**
 * JSON-safe gait limb channel accepted by the MCP `perform` tool.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpGaitLimb {
  /**
   * The bone this limb's swing drives (a leg's upper bone).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Joint axis this gait channel writes. Omitted means `"flexion"` (the
   * sagittal swing); set `"abduction"` for side-to-side sway/spread or
   * `"twist"` for axial gait details.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  axis?: "flexion" | "abduction" | "twist";

  /**
   * Where in the stride this limb's cycle starts, in `[0, 1)`: the phase offset
   * that distinguishes one gait's footfall sequence from another's.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  phase: number;

  /**
   * Fraction of the stride the limb spends in **stance** (planted, pushing the
   * body back) versus **swing** (lifted, recovering forward), in `(0, 1)`. A
   * walk has a high duty (long ground contact); a gallop a low one.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  duty: number;

  /**
   * Peak swing on `axis` (degrees) about the limb's neutral.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  amplitude: number;

  /**
   * Easing used while the limb is in stance (planted, pushing back). Omitted
   * means `"linear"`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  stanceEasing?: AutoMovieEasing;

  /**
   * Easing used while the limb is in swing (recovering forward). Omitted means
   * `"linear"`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
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
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  neutral?: number;
}

/**
 * Performed-shot union returned by the MCP `perform` tool.
 *
 * It mirrors the engine result but rewrites motion keyframe bezier tuples into
 * named object fields so MCP schema generation stays JSON-schema compatible.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export type IAutoMovieMcpPerformedShot =
  | IAutoMovieMcpPerformedShot.ISuccess
  | IAutoMovieMcpPerformedShot.IFailure;
export namespace IAutoMovieMcpPerformedShot {
  /**
   * The performance compiled and every clip passed validation.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    success: true;

    /**
     * The shot, ready for the cut.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    shot: IAutoMovieShot;

    /**
     * Compact identity and duration for each synthesized clip.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    motionSummary: IAutoMovieMcpPerformedMotionSummary[];

    /**
     * The synthesized per-actor clips, keyed by scene-node id. A compact
     * resident response returns an empty registry; its following `commitShot`
     * reads the same-session registry instead.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    motions: Record<string, IAutoMovieMcpMotion>;
  }

  /**
   * The action list contradicted the stage, or a compiled clip broke ROM.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    success: false;

    /**
     * Every violation found, for the correction round.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * One compact entry for a synthesized motion clip.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpPerformedMotionSummary {
  /**
   * Scene node the clip animates.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  node: string;

  /**
   * Stable clip id the shot references.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  id: string;

  /**
   * Total clip duration in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  duration: number;
}

/**
 * One profile-bound channel component clamped while resolving a prop frame.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpPropClamp {
  /**
   * Concrete node channel that exceeded its declared profile limit.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  channel: string;

  /**
   * Profile whose declared limit applied.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  profile: string;

  /**
   * Index within the channel value vector.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  component: number;

  /**
   * Whether the lower or upper limit applied.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  bound: "min" | "max";

  /**
   * Authored value before the clamp.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  actual: number;

  /**
   * Value enforced by the declared limit.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  limit: number;
}

/**
 * Resolved articulated-prop state at one committed shot instant.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpResolvedPropFrame {
  /**
   * Concrete lowered node id to column-major world matrix.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  world: Record<string, number[]>;

  /**
   * Every declared limit that clamped this frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  clamps: IAutoMovieMcpPropClamp[];

  /**
   * Driver kinds deferred because this one-frame query cannot step them.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  deferredDriverTypes: string[];
}

/**
 * Resident articulated-prop frame query result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieGetResolvedPropFrameOutput {
  /**
   * Resolved frame, or null when the resident scene/shot cannot resolve.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  frame: IAutoMovieMcpResolvedPropFrame | null;

  /**
   * Actionable absence or validation reason, null on success.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  reason: string | null;
}

/**
 * JSON-safe motion clip crossing the MCP `perform` boundary, returned as the
 * compiled per-actor clips, and supplied by the caller as the authored clips an
 * `enact` action plays (#1148).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpMotion {
  /**
   * Stable id so scenes and exports can cite this clip.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  id: string;

  /**
   * Which skeleton this clip animates. Every keyframe pose targets this rig.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  skeleton: string;

  /**
   * Total clip length, seconds. Every keyframe `time` must be `<= duration`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  duration: number;

  /**
   * Whether the clip loops seamlessly. When `true`, the engine expects the last
   * keyframe to be continuous with the first.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  loop: boolean;

  /**
   * Keyframes in strictly increasing `time` order. At least two are required: a
   * clip needs a start and an end to interpolate between.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  keyframes: IAutoMovieMcpKeyframe[];

  /**
   * The gait cycle the motion carries ({@link IAutoMovieGaitCycle}), how a
   * non-looping compiled performance still reports a stride phase at the beat
   * end. Absent/null = no cycle to resume.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  gaitCycle?: IAutoMovieGaitCycle | null;
}

/**
 * JSON-safe keyframe returned by the MCP `perform` tool.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time`; both enforced by the
   * engine's temporal verifier.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  time: number;

  /**
   * The body pose held at this instant.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  pose: IAutoMoviePose;

  /**
   * Facial expression at this instant, or `null` for the neutral (rest) face.
   * `null` is the unauthored/neutral side, blended toward like a resting joint
   * axis: an expression authored only at the far keyframe ramps in from neutral
   * across the segment, and one authored only at the near keyframe fades out.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  expression: IAutoMovieExpression | null;

  /**
   * How to interpolate from this keyframe toward the next.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  easing: AutoMovieEasing;

  /**
   * Control points for `easing: "cubicBezier"`, `null` for all other easings.
   * The engine's own keyframe carries these as the tuple `[x1, y1, x2, y2]`;
   * the LLM schema cannot express a tuple, so the MCP boundary names the four
   * numbers instead. Same values, same order.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  bezier: IAutoMovieMcpBezier | null;
}

/**
 * Cubic-bezier control points as named fields, not a tuple: the MCP form of the
 * engine's `[x1, y1, x2, y2]`, in the unit square (CSS `cubic-bezier`
 * convention).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpBezier {
  /**
   * First control point x, in `[0, 1]`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  x1: number;

  /**
   * First control point y.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  y1: number;

  /**
   * Second control point x, in `[0, 1]`.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  x2: number;

  /**
   * Second control point y.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  y2: number;
}

/**
 * The `perform` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePerformOutput {
  /**
   * The performed shot on success, or the performance violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  performed: IAutoMovieMcpPerformedShot;
}

/**
 * The `cut` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieCutOutput {
  /**
   * The cut film on success, or the assemble violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  cut: IAutoMovieCut;
}

/**
 * The `forge` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieForgeOutput {
  /**
   * The forged cast on success, or the forge violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  forged: IAutoMovieForgedCast;
}

/**
 * A source-to-output value range, the JSON-safe form of a `[from, to]` pair.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpRange {
  /**
   * Range start.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  from: number;

  /**
   * Range end.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  to: number;
}

/**
 * A driven driver whose tuple-valued `inRange`/`outRange` cross the MCP
 * boundary as named {@link IAutoMovieMcpRange} objects (the LLM JSON schema
 * cannot express tuples), converted to the engine's pairs in `convert.ts`.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpDrivenDriver extends Omit<
  IAutoMovieDrivenDriver,
  "inRange" | "outRange"
> {
  /**
   * Source value range mapped onto {@link outRange}. Omit when `curve` is set.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  inRange?: IAutoMovieMcpRange;

  /**
   * Output value range. Omit when `curve` is set.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  outRange?: IAutoMovieMcpRange;
}

/**
 * A prop profile driver as the MCP boundary accepts it, tuple-free.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpPropProfile {
  /**
   * Stable profile id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  id: string;

  /**
   * Profile name (e.g. `"hinge"`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  name: string;

  /**
   * The named controls this profile exposes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  controls: IAutoMovieProfileControl[];

  /**
   * Drivers coupling the prop's joints, tuple-free.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  drivers: IAutoMovieMcpPropDriver[];

  /**
   * Value constraints over the prop's joints (the hinge's 0..110°).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  limits: IAutoMovieChannelLimit[];
}

/**
 * A prop's self-declared moving parts as the MCP boundary accepts them.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpPropArticulation {
  /**
   * The prop's internal joint nodes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  nodes: IAutoMovieNode[];

  /**
   * The declared capability over those nodes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  profile: IAutoMovieMcpPropProfile;

  /**
   * The application of the profile onto the nodes (`boneMap`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  binding: IAutoMovieProfileBinding;
}

/**
 * A prop spec as the `forgeProp` tool accepts it, a crude primitive proxy with
 * rich meaning: body, affordances, self-declared articulation.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpPropSpec {
  /**
   * The scene node this prop will occupy (the staging join key).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  node: string;

  /**
   * The prop model: generated, skeleton-less, primitive parts.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  model: IAutoMovieModel;

  /**
   * Self-declared moving parts, or `null` for a rigid prop.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  articulation: IAutoMovieMcpPropArticulation | null;
}

/**
 * The engine's forged-prop verdict with the accepted spec echoed in its
 * MCP-safe form (the engine's echo carries the raw tuple-bearing profile the
 * LLM schema cannot express).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export type IAutoMovieMcpForgedProp =
  | IAutoMovieMcpForgedProp.ISuccess
  | IAutoMovieMcpForgedProp.IFailure;
export namespace IAutoMovieMcpForgedProp {
  /**
   * The prop passed both contracts.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    success: true;

    /**
     * The accepted spec, echoed for the staging join.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    prop: IAutoMovieMcpPropSpec;
  }

  /**
   * The spec broke a contract.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    success: false;

    /**
     * Every violation found, for the correction round.
     *
     * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
     * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The `forgeProp` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieForgePropOutput {
  /**
   * The forged prop on success, or the forge violations on failure.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  forged: IAutoMovieMcpForgedProp;

  /**
   * Present only when a resident project is active (#671): `true` when the
   * accepted spec was written through as `props/<node>.json`, `false` when the
   * write-through was refused (#712, the committed scene still places this
   * prop, so re-forging its spec would leave committed shots resolving against
   * stale articulation). Absent on pure (no-project) calls, keeping them
   * byte-compatible, and on failed forges, which write nothing.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  stored?: boolean;

  /**
   * The refusal violations (#712), present only when a resident re-forge was
   * refused (`stored: false`): the committed scene still places this prop node,
   * so its spec is not replaced. Re-commit the scene without the placement (or
   * accept re-perform) first. Absent on a stored write-through, on pure calls,
   * and on failed forges, the `forged.success` already carries the forge
   * contract's own verdict.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation?: IAutoMovieValidation;
}

/**
 * What a resident project holds, which slate slices exist as files and which
 * binary assets the manifest tracks (#614: the project folder is the memory).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieMcpProjectSummary {
  /**
   * Absolute project root directory.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  root: string;

  /**
   * Whether `script.json` exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  script: boolean;

  /**
   * Whether `scene.json` exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  scene: boolean;

  /**
   * Committed shot ids (`shots/<beat>.json`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  shots: string[];

  /**
   * Committed beat-end beats (`beatEnds/<beat>.json`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  beatEnds: string[];

  /**
   * Open review note count.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  notes: number;

  /**
   * Whether `film.json` exists.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  film: boolean;

  /**
   * Stored forged prop nodes (`props/<node>.json`).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  props: string[];

  /**
   * Stored actor context nodes (`actors/<node>.json`, #1176).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
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
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  staleRenders: string[];

  /**
   * Tracked binary asset paths, project-relative, in registration order.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  assets: string[];
}

/**
 * The `openProject` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieOpenProjectOutput {
  /**
   * The activated project's summary.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  project: IAutoMovieMcpProjectSummary;
}

/**
 * An erase tool's result (#617). Erase is a targeted, resident-only removal of
 * one named artifact, never a reset; `erased` is true only when the named
 * mistake existed and its files were removed (with the downstream cascade).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieEraseOutput {
  /**
   * True only when the named artifact existed and was removed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  erased: boolean;

  /**
   * The resident slate's identity digest after the erase (#1132).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  state: IAutoMovieMcpSlateDigest;

  /**
   * Success, or the violations explaining why the erase was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;
}

/**
 * A `set*` tool's result (#654). Set is a targeted, resident-only replacement
 * of one artifact inside a committed slice, the granularity below the beat;
 * `updated` is true only when the named target existed and was replaced (with
 * the documented downstream cascade).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieSetOutput {
  /**
   * True only when the named target existed and was replaced.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  updated: boolean;

  /**
   * The resident slate's identity digest after the set (#1132).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  state: IAutoMovieMcpSlateDigest;

  /**
   * Success, or the violations explaining why the set was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;
}

/**
 * The `eraseProp` tool's result (#671). Erase is a targeted, resident-only
 * removal of ONE stored prop spec file, `erased` is true only when the named
 * spec existed and its file was removed. A prop the committed scene still
 * places is refused: unstaging is `commitScene`'s job, not a spec erase's.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMoviePropEraseOutput {
  /**
   * True only when the named prop spec existed and its file was removed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  erased: boolean;

  /**
   * Stored prop nodes after the call (unchanged when refused).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  props: string[];

  /**
   * Success, or the violations explaining why the erase was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
   */
  validation: IAutoMovieValidation;
}

/**
 * The `eraseActor` tool's result (#1176). Erase is a targeted, resident-only
 * removal of ONE stored actor context file, `erased` is true only when the
 * named context existed and its file was removed. An actor the committed scene
 * still stages is refused: later resident performs would lose the context their
 * beats depend on, and unstaging is `commitScene`'s job.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Keeps this public package contract available to ordinary typed source instead of hidden MCP session state.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps this code-native declaration outside the MCP authoring surface.
 */
export interface IAutoMovieActorEraseOutput {
  /**
   * True only when the named actor context existed and its file was removed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the erased verdict in the actor erase result (true only when the named actor context existed and its file was removed), allowing ordinary source to branch without consulting session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Treats the erased verdict as a computed or validated motion fact; the deterministic performer consumes or produces it while MCP does not author motion.
   */
  erased: boolean;

  /**
   * Stored actor context nodes after the call (unchanged when refused).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes stored actor context nodes after the call (unchanged when refused) in the actor erase result, so source callers can enumerate the complete motion set and author or inspect the performance data directly.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries stored actor context nodes after the call (unchanged when refused) as explicit motion data; the deterministic performer consumes or produces it while MCP does not author motion.
   */
  actors: string[];

  /**
   * Success, or the violations explaining why the erase was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Returns success, or the violations explaining why the erase was refused through the actor erase result, so source callers can correct the named failure from explicit evidence instead of retrying blindly.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes success, or the violations explaining why the erase was refused a deterministic diagnostic from the actor erase result; the deterministic performer consumes or produces it while MCP does not author motion.
   */
  validation: IAutoMovieValidation;
}

/**
 * The `registerAsset` tool's result (#670). Registration is a resident-only,
 * additive manifest mutation: `registered` is true only when the path was newly
 * tracked, duplicates and path escapes are refused as violations, and the index
 * is never silently rewritten.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `registerAsset` tool's result (#670) an explicit typed outcome, so source code can inspect the resident operation without probing server memory.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Reports the `registerAsset` tool's result (#670) from project-owned state; MCP performs the bounded operation without authoring production content.
 */
export interface IAutoMovieRegisterAssetOutput {
  /**
   * True only when the path was newly registered into the manifest.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the registered verdict in the register asset result (true only when the path was newly registered into the manifest), allowing ordinary source to branch without consulting session state.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Treats the registered verdict as a computed or validated project fact; MCP reads or reports the state but does not author the project facts.
   */
  registered: boolean;

  /**
   * The normalized project-relative path, or null when refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the normalized project-relative path, or null when refused explicit in the register asset result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries the normalized project-relative path, or null when refused through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  path: string | null;

  /**
   * Every tracked asset path after the call (unchanged when refused).
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes every tracked asset path after the call (unchanged when refused) in the register asset result, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries every tracked asset path after the call (unchanged when refused) as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  assets: string[];

  /**
   * Success, or the violations explaining why registration was refused.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Returns success, or the violations explaining why registration was refused through the register asset result, so source callers can correct the named failure from explicit evidence instead of retrying blindly.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Makes success, or the violations explaining why registration was refused a deterministic diagnostic from the register asset result; MCP reads or reports the state but does not author the project facts.
   */
  validation: IAutoMovieValidation;
}

/**
 * The `nextSteps` tool's result, the film ladder as data (#615).
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the `nextSteps` tool's result, the film ladder as data (#615) an explicit typed outcome, so source code can inspect the resident operation without probing server memory.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Reports the `nextSteps` tool's result, the film ladder as data (#615) from project-owned state; MCP performs the bounded operation without authoring production content.
 */
export interface IAutoMovieNextStepsOutput {
  /**
   * The resident project's current status.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes the resident project's current status explicit in the next steps result, allowing ordinary source to choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries the resident project's current status through deterministic project processing as declared data; MCP reads or reports the state but does not author the project facts.
   */
  status: IAutoMovieMcpProjectSummary;

  /**
   * Unmet ladder prerequisites, in ladder order; empty when satisfied.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes unmet ladder prerequisites, in ladder order in the next steps result, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries unmet ladder prerequisites, in ladder order as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  missing: string[];

  /**
   * Ordered concrete tool calls that advance the film; empty when complete.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes ordered concrete tool calls that advance the film in the next steps result, so source callers can enumerate the complete project set and choose the next source-owned production action without consulting server memory.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries ordered concrete tool calls that advance the film as explicit project data; MCP reads or reports the state but does not author the project facts.
   */
  nextActions: string[];
}

/**
 * Canonical guide name exported by the production interface.
 *
 * This compatibility alias intentionally has no second handwritten union: the
 * reflected DTO and the served prompt corpus therefore cannot retain retired
 * names after the production contract removes them.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets package callers use the same canonical guide-name union as the served production guide corpus.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives guide identity from the production interface; exposing the alias adds no authoring tool.
 */
export type AutoMovieGuideName = AutoMovieProductionGuideName;

/**
 * The `getGuideDocument` tool's result.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary source retrieve and consume the requested production guide as typed Markdown content.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Serves committed guidance as documentation data; the controller gains no project-authoring capability.
 */
export interface IAutoMovieGuideDocumentOutput {
  /**
   * Markdown guide content for the requested topic.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes markdown guide content for the requested topic explicit in the guide document result, allowing ordinary source to consume the same guidance outside an MCP call.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries markdown guide content for the requested topic through deterministic guide processing as declared data; MCP serves the documentation without gaining an authoring operation.
   */
  content: string;
}
