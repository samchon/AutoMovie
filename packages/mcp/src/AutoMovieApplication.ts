import { IAutoMovieStagedSet } from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieActionTarget,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieForgeApplication,
  IAutoMovieModel,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieRenderFrameFormat,
  IAutoMovieRenderSpec,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptApplication,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieShotPerformance,
  IAutoMovieSkeleton,
  IAutoMovieStagingApplication,
} from "@automovie/interface";

import { AutoMovieContext } from "./AutoMovieContext";
import {
  AutoMovieGuideName,
  AutoMovieMcpFrameCapture,
  IAutoMovieActorEraseOutput,
  IAutoMovieBlockOutput,
  IAutoMovieCommitOutput,
  IAutoMovieCutOutput,
  IAutoMovieEraseOutput,
  IAutoMovieForgeOutput,
  IAutoMovieForgePropOutput,
  IAutoMovieGetBeatEndOutput,
  IAutoMovieGetNotesOutput,
  IAutoMovieGetReachOutput,
  IAutoMovieGetResolvedPoseOutput,
  IAutoMovieGetSceneOutput,
  IAutoMovieGetScriptOutput,
  IAutoMovieGetShotEndStateOutput,
  IAutoMovieGetShotOutput,
  IAutoMovieGetSlateOutput,
  IAutoMovieGuideDocumentOutput,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpTransform,
  IAutoMovieMcpWritableSlate,
  IAutoMovieMeasureDistanceOutput,
  IAutoMovieNextStepsOutput,
  IAutoMovieOpenProjectOutput,
  IAutoMoviePerformOutput,
  IAutoMoviePlanCaptionsOutput,
  IAutoMoviePlanChunkedRenderOutput,
  IAutoMoviePlanPoseKeypointsOutput,
  IAutoMoviePlanRenderOutput,
  IAutoMoviePropEraseOutput,
  IAutoMovieRegisterAssetOutput,
  IAutoMovieSeeFrameOutput,
  IAutoMovieSetOutput,
  IAutoMovieStageOutput,
  IAutoMovieValidateOutput,
} from "./dto";
import { nextStepsOf } from "./project/AutoMoviePrerequisite";
import { CommitService } from "./services/CommitService";
import { GeometryService } from "./services/GeometryService";
import { GuideService } from "./services/GuideService";
import { PipelineService } from "./services/PipelineService";
import { RenderService } from "./services/RenderService";
import { SlateQueryService } from "./services/SlateQueryService";
import { ValidationService } from "./services/ValidationService";

/**
 * AutoMovie's deterministic motion-control engine, exposed as MCP tools:
 * declarative action verbs and film artifacts go in; ROM-checked motion, camera
 * moves, and render plans come out, the engine, not the model, is the arbiter
 * of physical truth ("engine enforces, model creates"). Read
 * `getGuideDocument({ name: "AUTOMOVIE_OVERALL" })` first, then the stage
 * guides. For real work open a resident project (`openProject`), let
 * `nextSteps` steer, and walk the ladder:
 * `stage`/`block`/`perform`/`cut`/`forge` compute, commit tools persist slices
 * (stale downstream erased), query/validate tools read and check, render tools
 * plan frames, chunks, captions, and previews. Every failure returns
 * field-located violations for the correction round, not a thrown error.
 *
 * `perform` keeps the MCP contract JSON-only by accepting per-actor motion
 * contexts and assembling the engine's default synthesizer inside the server.
 * How many servers/tools the whole pipeline should become remains an ongoing
 * design experiment, not a fixed shape.
 *
 * @author Samchon
 */
export class AutoMovieApplication {
  private readonly context: AutoMovieContext;
  private readonly slateQuery: SlateQueryService;
  private readonly geometry: GeometryService;
  private readonly validation: ValidationService;
  private readonly commit: CommitService;
  private readonly render: RenderService;
  private readonly pipeline: PipelineService;
  private readonly guide: GuideService;

  public constructor(props?: {
    /**
     * Frame-capture adapter owned by the host (a Playwright page, a render
     * worker). The MCP layer stays pure planning/validation: `seeFrame` plans
     * the frame and hands this adapter the request; pixels never flow through
     * the server itself. Without an adapter `seeFrame` reports
     * `no-capture-adapter` honestly instead of pretending.
     */
    capture?: AutoMovieMcpFrameCapture;
    /**
     * Project root to activate at startup (#614). The project directory itself
     * is the resident memory: slate slices as human-readable JSON files plus
     * tracked binary assets. Tools may then omit their slate to read/commit the
     * resident project.
     */
    projectRoot?: string;
  }) {
    this.context = new AutoMovieContext(props?.capture, props?.projectRoot);
    this.slateQuery = new SlateQueryService(this.context);
    this.geometry = new GeometryService(this.context);
    this.validation = new ValidationService();
    this.commit = new CommitService(this.context);
    this.render = new RenderService(this.context);
    this.pipeline = new PipelineService(this.context);
    this.guide = new GuideService();
  }

  /**
   * Open (or create) the resident project at `root` and return what it holds.
   * The project directory itself is the memory (#614): slate slices live as
   * human-readable JSON files (`script.json`, `shots/<beat>.json`, ...), and
   * binary assets (models, textures, rendered frames) are tracked by the
   * manifest and referenced by path. After opening, every `get*` and `commit*`
   * tool may omit its `slate` to read from, and write through to, the project,
   * so a long production never re-sends its whole state per call. Reopening the
   * same root keeps the live project; a fresh directory is a valid empty
   * project.
   *
   * @param props The project root directory.
   * @returns The activated project's summary.
   */
  public openProject(props: {
    /** Project root directory (created when missing). */
    root: string;
  }): IAutoMovieOpenProjectOutput {
    assertOpenProjectRequestRoot(props);
    return { project: this.context.activateProject(props.root).summary() };
  }

  /**
   * Ask the resident project what to do next. It returns the film ladder's
   * current status, the unmet prerequisites, and the ordered concrete tool
   * calls that advance the film -- the same computation the resident commit
   * gate throws as an actionable prompt, exposed as data so an agent can ask
   * before trying. Requires an active project (call openProject first).
   *
   * @returns The ladder status, missing prerequisites, and next actions.
   */
  public nextSteps(): IAutoMovieNextStepsOutput {
    return nextStepsOf(this.context.requireProject("nextSteps"));
  }

  /**
   * Track ONE binary asset (a GLB, a texture, a rendered frame) in the resident
   * project's manifest. The tool registers the project-relative path only,
   * byte-writing stays the host adapter's job, so the path may name a file the
   * adapter already wrote or is about to write. Paths must stay inside the
   * project (no absolute paths, no `..`), and registration never silently
   * overwrites: a duplicate path is refused as a violation and the index is
   * unchanged. Requires an active project (call openProject first).
   *
   * @param props The project-relative asset path to track.
   * @returns The normalized path and full asset index, or violations when
   *   refused.
   */
  public registerAsset(props: {
    /** Project-relative asset path (forward slashes; no `..` escapes). */
    path: string;
  }): IAutoMovieRegisterAssetOutput {
    return this.commit.registerAsset(props);
  }

  /**
   * Fetch a film-authoring guide document by exact name.
   *
   * Start with `AUTOMOVIE_OVERALL` (the operating loop, result semantics, and
   * the commit ladder), then read the guide matching the next stage: `FORGE`,
   * `STAGING`, `BLOCKING`, `PERFORMANCE`, `REVIEW`, `PROPS`, `PROJECT_MEMORY`,
   * or `RENDER_GUIDES`. Guides teach the method; tool returns decide
   * correctness.
   *
   * @param props Exact guide document name.
   * @returns Markdown guide content.
   */
  public getGuideDocument(props: {
    /** Exact guide document name. Start with `AUTOMOVIE_OVERALL`. */
    name: AutoMovieGuideName;
  }): IAutoMovieGuideDocumentOutput {
    return this.guide.getGuideDocument(props);
  }

  /**
   * Read the WHOLE slate in one call -- every committed slice (script, scene,
   * shots, beat ends, notes) plus the film. Omit `slate` to read the resident
   * project (#614); pass one to echo it back. This is the read a refused commit
   * points you at: when a cross-session write is rejected as stale (#1133),
   * call `getSlate` to resynchronize with the current on-disk truth, then
   * re-issue from it. Prefer the per-slice `getScript`/`getScene`/`getShot`
   * when you need only one part.
   *
   * @param props The slate to echo, or omit to read the resident project.
   * @returns The whole writable slate.
   */
  public getSlate(props: {
    /** The slate to echo; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetSlateOutput {
    return this.slateQuery.getSlate(props);
  }

  /**
   * Read the script slice from a slate. It returns `null` until the SCRIPT
   * stage has committed a script, so agents can ask for context without
   * inventing it.
   *
   * @param props The slate to query.
   * @returns The script slice, or null when absent.
   */
  public getScript(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetScriptOutput {
    return this.slateQuery.getScript(props);
  }

  /**
   * Read the staged scene slice from a slate. It returns `null` until STAGING
   * has committed a scene, letting later tools gate on real state.
   *
   * @param props The slate to query.
   * @returns The staged scene slice, or null when absent.
   */
  public getScene(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
  }): IAutoMovieGetSceneOutput {
    return this.slateQuery.getScene(props);
  }

  /**
   * Read the shot built for one beat. Missing shots return `null`; duplicate
   * shot ids throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching shot, or null when absent.
   */
  public getShot(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Beat id whose shot should be read. */
    beat: string;
  }): IAutoMovieGetShotOutput {
    return this.slateQuery.getShot(props);
  }

  /**
   * Read review notes from a slate. Omitting `beat` returns the full open
   * backlog; providing it scopes the notes to one beat.
   *
   * @param props The slate and optional beat filter to query.
   * @returns The matching review notes.
   */
  public getNotes(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Optional beat id filter. */
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    return this.slateQuery.getNotes(props);
  }

  /**
   * Read the resolved end-state for one beat. Missing entries return `null`;
   * duplicates throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching beat end state, or null when absent.
   */
  public getBeatEnd(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Beat id whose end state should be read. */
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    return this.slateQuery.getBeatEnd(props);
  }

  /**
   * Resolve an actor's world-space skeleton pose. Pass `context` for the
   * explicit stateless path, or omit it to read the resident project. Resident
   * mode uses the committed scene, optional committed beat shot, each cast
   * actor's persisted rig (`actors/<node>.json`, so a reopened project resolves
   * rest/ambient poses without a re-commit), and the session-only compiled
   * motions remembered from resident commitShot. Motions are not persisted as
   * slices, so a query that samples a specific beat's motion needs that beat's
   * commitShot in this session (or an explicit context).
   *
   * @param props The actor id, optional explicit context or resident beat, and
   *   optional shot time.
   * @returns The resolved pose, or null when the actor cannot be resolved.
   */
  public getResolvedPose(props: {
    /** Scene, skeletons, optional shot, and compiled motions to query. */
    context?: IAutoMovieMcpGeometryContext;
    /** Scene-node id of the actor to resolve. */
    actor: string;
    /** Resident beat whose committed shot should choose the sampled motion. */
    beat?: string;
    /** Shot-local time in seconds. Defaults to 0. */
    t?: number;
  }): IAutoMovieGetResolvedPoseOutput {
    return this.geometry.getResolvedPose(props);
  }

  /**
   * Measure whether an actor's arms can reach a positional target, answering
   * the question `perform` will answer. `reachable` is true only when the
   * target is within the arm's shell AND the IK pose that lands there satisfies
   * the rig's range of motion; when it is not, `romViolations` names the exact
   * joint axes that block it, and `withinShell` still reports the purely
   * geometric distance verdict. Pass `context` explicitly, or omit it to use
   * the resident project's committed scene plus the session-only model
   * skeletons remembered from commitScene. A node target may name any staged
   * placement, an actor, a set piece, or a camera.
   *
   * @param props The actor id, target, and optional explicit context.
   * @returns The reach report, or null with a reason naming the id or the
   *   relative kind that failed to resolve.
   */
  public getReach(props: {
    /** Scene and skeletons used to resolve the actor and target. */
    context?: IAutoMovieMcpGeometryContext;
    /** Scene-node id of the reaching actor. */
    actor: string;
    /** Node, point, or group target to reach. */
    target: IAutoMovieActionTarget;
  }): IAutoMovieGetReachOutput {
    return this.geometry.getReach(props);
  }

  /**
   * Derive a beat's resumable end-state from its performed shot, the engine
   * computation `commitBeatEnd` persists, so continuity is engine-derived
   * instead of hand-authored. Every scene actor gets an end snapshot: held
   * actors keep their staged placement, performed actors sample their motion at
   * the shot end with root motion folded into the world transform, plus gait
   * phase, root velocity, and mount couplings, so the next beat starts actors
   * where they ended. Omit `context` to derive from the resident committed
   * scene, the beat's committed shot, and this session's motion memory; pass
   * staging `mounts` to carry rider couplings. A missing shot or an engine
   * contract fault returns a `reason` instead of an end-state.
   *
   * @param props The geometry context (omit for resident), beat, and mounts.
   * @returns The derived end-state ready for `commitBeatEnd`, or a reason.
   */
  public getShotEndState(props: {
    /** Scene, skeletons, motions, and shot; omit for the resident project. */
    context?: IAutoMovieMcpGeometryContext;
    /** Beat whose shot the end-state derives from. */
    beat: string;
    /** Persistent mount couplings from staging, carried to rider states. */
    mounts?: IAutoMovieStagedSet.IMount[];
  }): IAutoMovieGetShotEndStateOutput {
    return this.geometry.getShotEndState(props);
  }

  /**
   * Measure the world-space distance between two positional targets. Pass
   * `scene` explicitly, or omit it to use the resident committed scene. A node
   * target may name any staged placement, an actor, a set piece, or a camera.
   * Relative targets return null because they are directions, not points.
   *
   * @param props The two targets and optional explicit scene.
   * @returns The resolved endpoints and distance, or null with a per-side
   *   reason naming the id or the relative kind that failed to resolve.
   */
  public measureDistance(props: {
    /** Scene whose node positions define the target space. */
    scene?: IAutoMovieScene;
    /** First endpoint. */
    from: IAutoMovieActionTarget;
    /** Second endpoint. */
    to: IAutoMovieActionTarget;
  }): IAutoMovieMeasureDistanceOutput {
    return this.geometry.measureDistance(props);
  }

  /**
   * Validate a pose against a skeleton. Returns ROM, duplicate-joint, skeleton
   * mismatch, and root-transform diagnostics with field paths.
   *
   * @param props The pose and target skeleton.
   * @returns The validation envelope.
   */
  public validatePose(props: {
    /** Pose to validate. */
    pose: IAutoMoviePose;
    /** Target skeleton whose ROM and bones constrain the pose. */
    skeleton: IAutoMovieSkeleton;
  }): IAutoMovieValidateOutput {
    return this.validation.validatePose(props);
  }

  /**
   * Validate an MCP-safe motion against a skeleton. Bezier controls are
   * converted back to the engine tuple shape before temporal and ROM checks
   * run.
   *
   * @param props The motion and target skeleton.
   * @returns The validation envelope.
   */
  public validateMotion(props: {
    /** Motion to validate, using MCP-safe bezier objects. */
    motion: IAutoMovieMcpMotion;
    /** Target skeleton whose ROM and bones constrain the motion. */
    skeleton: IAutoMovieSkeleton;
  }): IAutoMovieValidateOutput {
    return this.validation.validateMotion(props);
  }

  /**
   * Validate a model. This runs the engine's model validator over geometry,
   * materials, skeleton graph, skinning, and transform ranges.
   *
   * @param props The model to validate.
   * @returns The validation envelope.
   */
  public validateModel(props: {
    /** Model to validate. */
    model: IAutoMovieModel;
  }): IAutoMovieValidateOutput {
    return this.validation.validateModel(props);
  }

  /**
   * Validate a staged scene's local integrity: ids, model references, finite
   * transforms, camera clip planes, light ranges, and -- when the scene
   * declares one -- its `space`'s surfaces (convex footprints, ramp axes,
   * walkable ids). A space surface needs no model: it is the ground's meaning,
   * drawn from its own footprint, never a registry entry.
   *
   * @param props The scene and available model ids.
   * @returns The validation envelope.
   */
  public validateScene(props: {
    /** Scene to validate. */
    scene: IAutoMovieScene;
    /** Model ids available to scene nodes. */
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieValidateOutput {
    return this.validation.validateScene(props);
  }

  /**
   * Validate a shot against its scene and optional motion table. The result
   * names missing scene/camera/node/motion refs and invalid clip timing.
   *
   * @param props The shot, scene, and optional motions to validate against.
   * @returns The validation envelope.
   */
  public validateShot(props: {
    /** Shot to validate. */
    shot: IAutoMovieShot;
    /** Scene the shot should render. */
    scene: IAutoMovieScene;
    /** Optional compiled motions keyed by actor or arbitrary ids. */
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieValidateOutput {
    return this.validation.validateShot(props);
  }

  /**
   * Validate an editorial sequence against the shots it references. It checks
   * fps, shot refs, trim spans, transition placement, and duplicate ids.
   *
   * @param props The sequence and available shots.
   * @returns The validation envelope.
   */
  public validateSequence(props: {
    /** Sequence to validate. */
    sequence: IAutoMovieSequence;
    /** Shots available to sequence entries. */
    shots: IAutoMovieShot[];
  }): IAutoMovieValidateOutput {
    return this.validation.validateSequence(props);
  }

  /**
   * Lint whole-film continuity across cuts (#1172): compare each beat's OPENING
   * against the previous beat's END state, in playback order. Continuity is the
   * structural bet the forward-written beat-end state exists to keep, but
   * nothing verified it. Emits ADVISORY warnings, a hard cut may intend a jump,
   * for position drift, facing drift, a dropped or changed mount (the "props
   * disappear" failure), or an actor missing from the incoming opening. Each
   * beat carries its shot and the motions its performances reference; every
   * shot is validated against the scene first, so a malformed shot returns
   * violations rather than a bogus lint. Drift beyond `positionTolerance`
   * metres (default 0.05) or `facingToleranceDeg` degrees (default 5) warns; a
   * nonsensical tolerance is a range error.
   *
   * @param props The scene, the film's beats in playback order, and tolerances.
   * @returns The validation envelope: continuity warnings, or violations.
   */
  public lintContinuity(props: {
    /** The staged scene every beat plays over. */
    scene: IAutoMovieScene;
    /** The film's beats, in playback order. */
    beats: {
      /** Beat id the shot realizes. */
      beat: string;
      /** The beat's compiled shot. */
      shot: IAutoMovieShot;
      /** Motions the shot's performances reference (id-keyed). */
      motions?: Record<string, IAutoMovieMcpMotion>;
    }[];
    /** World-space position drift tolerated (metres); defaults to 0.05. */
    positionTolerance?: number;
    /** Facing drift tolerated (degrees); defaults to 5. */
    facingToleranceDeg?: number;
  }): IAutoMovieValidateOutput {
    return this.validation.lintContinuity(props);
  }

  /**
   * Commit a verified script into the slate. Replacing the script clears every
   * downstream slice because staging, shots, notes, and film depend on it.
   *
   * @param props The slate and script artifact to commit.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitScript(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Script artifact to commit. */
    script: IAutoMovieScript;
  }): IAutoMovieCommitOutput {
    return this.commit.commitScript(props);
  }

  /**
   * Commit a staged scene after script and model-reference checks. A new scene
   * invalidates shots, beat ends, notes, and film.
   *
   * @param props The slate, scene, and available model ids.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitScene(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Scene artifact to commit. */
    scene: IAutoMovieScene;
    /** Model ids available to scene nodes. */
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieCommitOutput {
    return this.commit.commitScene(props);
  }

  /**
   * Commit one performed shot after script, scene, and optional motion checks.
   * The shot id must be `shot:<beat>` so slate queries can find it.
   * Re-committing the same beat replaces exactly that beat's shot (the upsert
   * rule) and leaves sibling beats untouched. The cascade also removes that
   * beat's now-stale end-state and review notes (they reviewed the replaced
   * shot) and nulls the committed film, re-derive the beat end and re-commit
   * the film after replacing a shot.
   *
   * @param props The slate, shot, and optional compiled motions.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitShot(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Shot artifact to commit. */
    shot: IAutoMovieShot;
    /** Optional compiled motions keyed by actor or arbitrary ids. */
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieCommitOutput {
    return this.commit.commitShot(props);
  }

  /**
   * Commit the resolved end-state for a beat. It must point at a committed shot
   * and only name actors present in the committed scene. Re-committing the same
   * beat replaces exactly that beat's end-state (the upsert rule) and nulls the
   * committed film, continuity data changed under the cut.
   *
   * @param props The slate and beat-end state to commit.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitBeatEnd(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Beat-end state to commit. */
    beatEnd: IAutoMovieBeatEndState;
  }): IAutoMovieCommitOutput {
    return this.commit.commitBeatEnd(props);
  }

  /**
   * Commit the current review backlog. Notes require a committed script and
   * built shots so review cannot point at imaginary beats. Committing notes
   * nulls the committed film: an open backlog means the cut is under review.
   *
   * @param props The slate and complete note backlog.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitNotes(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Complete open review-note backlog. */
    notes: IAutoMovieReviewNote[];
  }): IAutoMovieCommitOutput {
    return this.commit.commitNotes(props);
  }

  /**
   * Commit the assembled film after sequence and backlog checks. Open review
   * notes or missing beat shots keep the slate unchanged. `review` comes first:
   * state your pacing/continuity self-check before the cut-list it judges.
   *
   * @param props The pre-commit review, the slate, and the sequence artifact.
   * @returns The slate digest (and, for explicit calls, the transformed slate),
   *   or violations on refusal.
   */
  public commitFilm(props: {
    /**
     * Self-check of the cut BEFORE committing it: does the shot order serve the
     * pacing you intended, do the trims/transitions carry continuity across
     * each cut, and does the runtime feel right? Non-empty text.
     */
    review: string;
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Sequence artifact to commit. */
    film: IAutoMovieSequence;
  }): IAutoMovieCommitOutput {
    return this.commit.commitFilm(props);
  }

  /**
   * Erase ONE beat's shot from the resident project, a targeted removal of a
   * named mistake, never a reset. The beat's beat-end and its review notes go
   * with it (they are stale without their shot) and the assembled film is
   * cleared. Requires an active project, a non-empty reason (evidence), and an
   * existing shot, erasing nothing is reported as a violation. Upstream slices
   * (script, scene) have no erase tool: re-committing upstream already clears
   * downstream (the commit cascade).
   *
   * @param props The beat whose shot to erase and the reason (evidence).
   * @returns The slate digest after the erase, or violations when refused.
   */
  public eraseShot(props: {
    /** Beat id whose shot (and dependents) should be erased. */
    beat: string;
    /** Why this shot is a mistake, required evidence. */
    reason: string;
  }): IAutoMovieEraseOutput {
    return this.commit.eraseShot(props);
  }

  /**
   * Erase ONE beat's review notes from the resident project. Notes carry no
   * ids; the beat is their identity anchor, so per-beat is the erase
   * granularity. Requires an active project, a non-empty reason, and existing
   * notes for the beat, erasing nothing is reported as a violation. The
   * assembled film is cleared (any notes change invalidates it).
   *
   * @param props The beat whose notes to erase and the reason (evidence).
   * @returns The slate digest after the erase, or violations when refused.
   */
  public eraseNotes(props: {
    /** Beat id whose review notes should be erased. */
    beat: string;
    /** Why these notes should go, required evidence. */
    reason: string;
  }): IAutoMovieEraseOutput {
    return this.commit.eraseNotes(props);
  }

  /**
   * Erase ONE stored prop spec (`props/<node>.json`) from the resident project,
   * the targeted mirror of `forgeProp`'s resident write-through. Requires an
   * active project, a non-empty reason (evidence), and an existing stored spec,
   * erasing nothing is a violation. A prop the committed scene still places is
   * refused rather than cascaded: the scene is upstream of every shot, so
   * clearing it from a spec erase would be a reset in disguise, re-commit the
   * scene without the placement first.
   *
   * @param props The prop node whose spec to erase and the reason (evidence).
   * @returns The stored prop nodes after the erase, or violations when refused.
   */
  public eraseProp(props: {
    /** Prop node whose stored spec should be erased. */
    node: string;
    /** Why this spec should go, required evidence. */
    reason: string;
  }): IAutoMoviePropEraseOutput {
    return this.commit.eraseProp(props);
  }

  /**
   * Erase ONE stored actor context (`actors/<node>.json`) from the resident
   * project, the targeted mirror of `perform`'s resident actor write-through
   * (#1176). Requires an active project, a non-empty reason (evidence), and an
   * existing stored context, erasing nothing is a violation. An actor the
   * committed scene still stages is refused rather than cascaded: later
   * resident performs would lose the context their beats depend on, so
   * re-commit the scene without the node first.
   *
   * @param props The actor node whose context to erase and the reason.
   * @returns The stored actor nodes after the erase, or violations when
   *   refused.
   */
  public eraseActor(props: {
    /** Actor node whose stored context should be erased. */
    node: string;
    /** Why this context should go, required evidence. */
    reason: string;
  }): IAutoMovieActorEraseOutput {
    return this.commit.eraseActor(props);
  }

  /**
   * Replace ONE actor's performance in a beat's committed shot, in the resident
   * project. Sibling performances and other beats stay byte-unchanged; the
   * beat's beat-end and review notes are removed (stale without the performance
   * they sampled) and the film is cleared. Replacement-only: the node must
   * already perform in that shot, a new performer belongs to perform +
   * commitShot. Requires an active project and a non-empty reason (evidence).
   * Full motion validation stays perform's job; pass the motions registry to
   * check the reference.
   *
   * @param props The beat, the replacement performance, and the reason.
   * @returns The slate digest after the replacement, or violations when
   *   refused.
   */
  public setActorPerformance(props: {
    /** Beat id whose shot holds the performance to replace. */
    beat: string;
    /** The replacement performance for its `node`. */
    performance: IAutoMovieShotPerformance;
    /** Compiled motions keyed by actor node, to check the motion reference. */
    motions?: Record<string, IAutoMovieMcpMotion>;
    /** Why this performance is being replaced, required evidence. */
    reason: string;
  }): IAutoMovieSetOutput {
    return this.commit.setActorPerformance(props);
  }

  /**
   * Move ONE placement in the resident scene, replace that scene node's
   * transform, leaving sibling placements byte-unchanged. The cascade mirrors
   * commitScene deliberately: a moved placement changes the world coordinates
   * every shot was performed against, so shots, beat-ends, and notes clear and
   * the film nulls, the gain is staging precision, not a shortcut around
   * re-performing. Requires an active project, a non-empty reason, and an
   * existing placement.
   *
   * The new transform is authored the LLM-facing way: `rotation` is semantic
   * Euler degrees (or omitted for no turn), never a raw quaternion, the engine
   * lowers it (#723, D016).
   *
   * @param props The placement node, its new transform, and the reason.
   * @returns The slate digest after the move, or violations when refused.
   */
  public setPlacement(props: {
    /** Scene node id of the placement to move. */
    node: string;
    /** The placement's new world transform (rotation as semantic Euler degrees). */
    transform: IAutoMovieMcpTransform;
    /** Why this placement is moving, required evidence. */
    reason: string;
  }): IAutoMovieSetOutput {
    return this.commit.setPlacement(props);
  }

  /**
   * Plan a deterministic render for a committed shot or film. It returns frame
   * times, frame paths, per-pass guide outputs, and ffmpeg args without doing
   * host I/O. Omit `slate` to plan the resident project (#614): the frame and
   * output paths then default into the project's reserved `renders/` directory,
   * so a long film never re-sends its whole state to plan a render. An explicit
   * slate stays a pure transform with the legacy `frames/<stem>` default
   * paths.
   *
   * @param props The slate (omit for the resident project), render spec,
   *   optional guide passes, and paths.
   * @returns A render plan, or validation diagnostics when the target is not
   *   ready.
   */
  public planRender(props: {
    /** Slate whose committed shot or film is the source; omit for resident. */
    slate?: IAutoMovieMcpWritableSlate;
    /** Render parameters for a committed shot or sequence id. */
    spec: IAutoMovieRenderSpec;
    /** Guide passes to capture per frame. Defaults to beauty only. */
    passes?: AutoMovieGuidePass[];
    /** Directory where frame files would be written. */
    frameDir?: string;
    /** Encoded video output path. */
    outputPath?: string;
  }): IAutoMoviePlanRenderOutput {
    return this.render.planRender(props);
  }

  /**
   * Capture one preview frame for inspection, the render/see loop. It plans the
   * target frame and requested guide pass, then hands the host-injected capture
   * adapter the request and returns the captured image. Without an adapter it
   * returns the resolved frame with status `no-capture-adapter` instead of
   * pixels, so an agent always knows whether it actually saw the frame. Omit
   * `slate` to preview the resident project (#614).
   *
   * @param props The slate (omit for the resident project), render spec,
   *   optional frame/time, and guide pass.
   * @returns The captured (or planned) preview frame, or diagnostics.
   */
  public async seeFrame(props: {
    /** Slate whose committed shot or film is the source; omit for resident. */
    slate?: IAutoMovieMcpWritableSlate;
    /** Render parameters for a committed shot or sequence id. */
    spec: IAutoMovieRenderSpec;
    /** Zero-based frame index. Defaults to the first frame. */
    frame?: number;
    /** Target time in seconds. Must agree with `frame` when both are present. */
    time?: number;
    /** Guide pass to draw. Defaults to `beauty`. */
    pass?: AutoMovieGuidePass;
  }): Promise<IAutoMovieSeeFrameOutput> {
    return this.render.seeFrame(props);
  }

  /**
   * Plan a long film as independently-renderable chunks of `chunkFrames` output
   * frames each, so an hours-long render is produced in bounded windows and
   * regenerated one window at a time (#609/#644). The target must be the
   * committed film; frame-atomic boundaries mean concatenating the chunks
   * reproduces the whole render. Omit `slate` to plan the resident project.
   *
   * @param props The slate (omit for resident), render spec, frames per chunk,
   *   optional guide passes, and paths.
   * @returns A chunked render plan, or diagnostics when the target is not
   *   ready.
   */
  public planChunkedRender(props: {
    /** Slate whose committed film is the source; omit for resident. */
    slate?: IAutoMovieMcpWritableSlate;
    /** Render parameters; `target` must be the committed film id. */
    spec: IAutoMovieRenderSpec;
    /** Output frames per chunk. A positive integer. */
    chunkFrames: number;
    /** Guide passes to plan per chunk. Defaults to beauty only. */
    passes?: AutoMovieGuidePass[];
    /** Directory where frame files would be written. */
    frameDir?: string;
    /** Encoded video output path. */
    outputPath?: string;
  }): IAutoMoviePlanChunkedRenderOutput {
    return this.render.planChunkedRender(props);
  }

  /**
   * Plan the caption sidecar, the per-shot diffusion-prompt track a render host
   * reads beside the guide frames (#607), from the committed script and film.
   * Pass `chunkFrames` to also get one chunk-local sidecar per render chunk,
   * aligned with `planChunkedRender`. Omit `slate` to plan the resident
   * project.
   *
   * @param props The slate (omit for resident), shared render frame format, and
   *   optional frames per chunk.
   * @returns The caption sidecar (and per-chunk sidecars when chunked), or
   *   diagnostics when script/film are not ready.
   */
  public planCaptions(props: {
    /**
     * Slate whose committed script and film supply the captions; omit for
     * resident.
     */
    slate?: IAutoMovieMcpWritableSlate;
    /** The exact clock and pixel geometry shared with the companion render. */
    frameFormat: IAutoMovieRenderFrameFormat;
    /**
     * Frames per chunk to also slice the sidecar into. Omit for whole-film
     * only.
     */
    chunkFrames?: number;
  }): IAutoMoviePlanCaptionsOutput {
    return this.render.planCaptions(props);
  }

  /**
   * Plan the per-frame pose-keypoint sidecar (#1168): for every output frame of
   * the committed film, each performing actor's named humanoid joints projected
   * through the live camera to normalized [0,1] frame coordinates, the exact
   * OpenPose-style data a pose-conditioned diffusion pass (ControlNet) reads
   * beside the rendered guide frames. Off-frame joints are never clamped (a
   * clamped point reads as a false edge keypoint); they carry `inFrame: false`.
   * The slate is resident-or-explicit and must carry a committed scene, shots,
   * and film. Motions are derived, never stored, so pass the `motions` registry
   * the shots' performances reference (and the skeletons they target) exactly
   * as resident `commitShot` does. Deterministic: same inputs, byte-identical
   * sidecar.
   *
   * @param props The slate, shared render frame format, motion registry, and
   *   skeletons.
   * @returns The per-frame keypoint sidecar, or violations when it cannot plan.
   */
  public planPoseKeypoints(props: {
    /** Slate whose scene, shots, and film supply the cut; omit for resident. */
    slate?: IAutoMovieMcpWritableSlate;
    /** The exact clock and pixel geometry shared with the companion render. */
    frameFormat: IAutoMovieRenderFrameFormat;
    /** Motions the shots' performances reference (id-keyed). */
    motions: Record<string, IAutoMovieMcpMotion>;
    /** Skeletons the motions target. */
    skeletons: IAutoMovieSkeleton[];
  }): IAutoMoviePlanPoseKeypointsOutput {
    return this.render.planPoseKeypoints(props);
  }

  /**
   * Stage a scene -- the first deterministic step. Place the script's cast on
   * the set per the staging plan, resolve every actor/camera/light to a
   * concrete world transform (measured against the staged rigs), and validate
   * persistent mounts. The environment comes in two halves (#1173): `set`
   * pieces are geometry -- skeleton-less models (a forged prop's primitives),
   * each optionally resized by `scale`, so one box serves as wall, step, and
   * table top -- while `space` is the ground's meaning, the walkable surfaces
   * copied onto the scene and drawn as real meshes. Together they keep the
   * guide passes describing a world rather than actors floating in a void. A
   * light states its physics: `type` picks directional (aimed, no falloff),
   * point (`position`, optional `range`), or spot (both, plus `coneAngle`), and
   * `color` makes a candle warm; a parameter its kind cannot use is refused,
   * not ignored. On failure nothing is composed and the violations name the
   * offending placement to repair.
   *
   * @param props The script (cast + beats) and the staging plan (placements).
   * @returns The staged scene on success, or the staging violations to fix.
   */
  public stage(props: {
    /** The script: the cast to place and the beats they play. */
    script: IAutoMovieScriptApplication.IWrite;
    /**
     * The staging plan: actors, cameras, lights, optional set pieces, and an
     * optional space.
     */
    staging: IAutoMovieStagingApplication.IWrite;
  }): IAutoMovieStageOutput {
    return this.pipeline.stage(props);
  }

  /**
   * Block a beat -- plan the coarse movement (who goes where, in what order,
   * with what timing anchors) over an already-{@link stage staged} scene, before
   * the fine performance. Returns the blocked beat, or the violations if a
   * block contradicts the staging or the beat.
   *
   * @param props The script, the successfully staged scene, and the blocking.
   * @returns The blocked beat on success, or the violations to fix.
   */
  public block(props: {
    /**
     * The script: the cast and their beats. Omit TOGETHER with `staged` to
     * block against the resident project's committed script and scene (#1176),
     * a long production stops re-sending them every beat. Mixed calls are
     * refused.
     */
    script?: IAutoMovieScriptApplication.IWrite;
    /** The staged scene this beat blocks over (a successful `stage` result). */
    staged?: IAutoMovieStagedSet.ISuccess;
    /** The blocking plan: the beat's movement intents and timing anchors. */
    blocking: IAutoMovieBlockingApplication.IWrite;
    /**
     * The previous beat's resolved end-state (#1176), pass `getBeatEnd`'s (or
     * `getShotEndState`'s) result so this beat blocks as a continuation:
     * carried actors are gated as staged nodes and the validated state is
     * surfaced on the success as `previous` for the performance stage to seed
     * from. A RESIDENT block seeds this automatically from the committed
     * previous beat's end-state (script order) when omitted; omit everywhere
     * only for the first beat or an intentional hard reset.
     */
    previous?: IAutoMovieBeatEndState;
  }): IAutoMovieBlockOutput {
    return this.pipeline.block(props);
  }

  /**
   * Perform a shot -- compile one beat's action calls into camera/object tracks
   * and per-actor clips over a successfully staged scene. The server builds the
   * default deterministic synthesizer from the provided actor contexts, so MCP
   * clients pass only JSON: gait/profile data, optional rigs, and optional rest
   * frames. The MCP gait shape omits cubic-bezier tuple fields because the LLM
   * schema cannot express tuples. Supplying validated blocking arms the
   * intent-realization gates. An `enact` action plays a clip you authored
   * yourself: COMPUTE the keyframes (with code, never hand-written floats) and
   * supply the motion in `clips` under the action's clip id -- the engine still
   * masks it to its region, layers it, and ROM-gates the composite. Clips are
   * derived output, never persisted; re-supply them on each perform.
   *
   * @param props The script, staged scene, performance write, actor contexts,
   *   optional enacted clips, and optional validated blocking.
   * @returns The performed shot on success, or the performance violations.
   */
  public perform(props: {
    /**
     * The script: the cast and beats the shot belongs to. Omit TOGETHER with
     * `staged` to perform against the resident project's committed script and
     * scene (#1176), a long production stops re-sending the staged scene every
     * beat. Mixed calls are refused.
     */
    script?: IAutoMovieScriptApplication.IWrite;
    /** The successfully staged scene this shot performs over. */
    staged?: IAutoMovieStagedSet.ISuccess;
    /** The performance plan: timed action calls and camera frames. */
    performance: IAutoMoviePerformanceApplication.IWrite;
    /**
     * Per staged actor, the data the default synthesizer needs. In a RESIDENT
     * call a context may omit `position`/`facingDeg` (#1176, #1295): they are
     * seeded from the previous beat's committed end-state (`commitBeatEnd`), so
     * a walking character resumes exactly where the last beat left it, and on a
     * beat with no predecessor from the committed staged placement itself, so a
     * film's first beat never restates what `commitScene` just stored. A
     * successful resident perform also writes each context's beat-invariant
     * half through as `actors/<node>.json`, so a LATER resident perform may
     * omit `actors` entirely and read the stored contexts back (their openings
     * seeded the same way). An explicit call always passes the registry.
     */
    actors?: Record<string, IAutoMovieMcpActorContext>;
    /**
     * Caller-authored motions for `enact` actions, keyed by the clip id each
     * action names. Compute these with code against the actor's skeleton; the
     * pipeline's region masking and ROM gate apply unchanged.
     */
    clips?: Record<string, IAutoMovieMcpMotion>;
    /** Optional validated blocking, from a successful `block` result. */
    blocking?: IAutoMovieBlockingApplication.IWrite;
    /**
     * Staging mounts for the RESIDENT form only (#1176), mounts are not a
     * committed slice, so a resident shot with a mounted rider re-declares them
     * here (the `getShotEndState` precedent). An explicit `staged` set already
     * carries its own mounts; combining the two is refused.
     */
    mounts?: IAutoMovieStagedSet.IMount[];
  }): IAutoMoviePerformOutput {
    return this.pipeline.perform(props);
  }

  /**
   * Cut shots into a film -- assemble a sequence of performed shots on the
   * output clock, applying trims and transitions (a cross-dissolve overlaps the
   * tail). Returns the cut with its runtime, or the violations if a trim or
   * transition does not fit its shot.
   *
   * @param props The assemble plan (the ordered entries) and the shots to cut.
   * @returns The cut film on success, or the violations to fix.
   */
  public cut(props: {
    /** The assemble plan: the ordered shot entries, trims, and transitions. */
    assemble: IAutoMovieAssembleApplication.IWrite;
    /** The performed shots referenced by the assemble entries. */
    shots: IAutoMovieShot[];
  }): IAutoMovieCutOutput {
    return this.pipeline.cut(props);
  }

  /**
   * Forge a cast's models -- build the parametric head/body meshes the script's
   * cast needs from the forge specification, ready to rig and render. Returns
   * the forged cast, or the violations if a specification is out of range.
   *
   * @param props The script (whose cast is forged) and the forge specification.
   * @returns The forged cast on success, or the violations to fix.
   */
  public forge(props: {
    /** The script: the cast whose models to forge. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The forge specification: the model parameters per cast member. */
    forge: IAutoMovieForgeApplication.IWrite;
  }): IAutoMovieForgeOutput {
    return this.pipeline.forge(props);
  }

  /**
   * Forge a prop -- author an object as data: a crude primitive model that
   * carries rich meaning (physical body, contact affordances, self-declared
   * articulation such as a door's limited hinge with a driver coupling its
   * parts). The engine gates the model contract (generated, skeleton-less, id
   * equal to the scene node) and the articulation contract (joint nodes resolve
   * acyclically, the profile binding maps every referenced key), and returns
   * the accepted prop or every violation for the correction round. An accepted
   * articulated prop's profile then constrains and drives its joints
   * deterministically at resolve time. With a resident project active an
   * accepted spec writes through as `props/<node>.json` (`stored: true`) unless
   * the committed scene still places the prop; the PROPS guide covers the
   * write-through, refusal, and `eraseProp` rules.
   *
   * @param props The prop spec: node, model, and optional articulation.
   * @returns The forged prop on success, or the violations to fix.
   */
  public forgeProp(props: {
    /** The prop spec: scene node, model, and optional articulation. */
    spec: IAutoMovieMcpPropSpec;
  }): IAutoMovieForgePropOutput {
    return this.pipeline.forgeProp(props);
  }
}

function assertOpenProjectRequestRoot(
  props: unknown,
): asserts props is { root: string } {
  if (typeof props !== "object" || props === null || Array.isArray(props))
    throw new Error("openProject request at $input must be a JSON object");
  const root = (props as { root?: unknown }).root;
  if (typeof root === "string" && root.trim().length > 0) return;
  throw new Error(
    "openProject request root at $input.root must be a non-empty string",
  );
}
