import { IAutoMovieStagedSet } from "@automovie/engine";
import {
  IAutoMovieActionTarget,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieForgeApplication,
  IAutoMovieModel,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieRenderSpec,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptApplication,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieStagingApplication,
} from "@automovie/interface";

import { AutoMovieContext } from "./AutoMovieContext";
import {
  AutoMovieGuideName,
  AutoMovieMcpFrameCapture,
  IAutoMovieBlockOutput,
  IAutoMovieCommitOutput,
  IAutoMovieCutOutput,
  IAutoMovieForgeOutput,
  IAutoMovieForgePropOutput,
  IAutoMovieGetBeatEndOutput,
  IAutoMovieGetNotesOutput,
  IAutoMovieGetReachOutput,
  IAutoMovieGetResolvedPoseOutput,
  IAutoMovieGetSceneOutput,
  IAutoMovieGetScriptOutput,
  IAutoMovieGetShotOutput,
  IAutoMovieGuideDocumentOutput,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpPropSpec,
  IAutoMovieMcpStoredSlate,
  IAutoMovieMcpWritableSlate,
  IAutoMovieMeasureDistanceOutput,
  IAutoMovieNextStepsOutput,
  IAutoMovieOpenProjectOutput,
  IAutoMoviePerformOutput,
  IAutoMoviePlanRenderOutput,
  IAutoMovieSeeFrameOutput,
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
 * AutoMovie's deterministic motion-control engine, exposed as MCP tools. Read
 * `getGuideDocument({ name: "AUTOMOVIE_OVERALL" })` first, then the guide
 * matching each stage. Query tools read slate context; `stage`, `block`,
 * `perform`, `cut`, and `forge` compute the film pipeline. Each tool returns
 * the engine's result, including violations that make the engine, not the
 * model, the arbiter of physical truth ("engine enforces, model creates").
 *
 * `@typia/mcp` derives every tool's JSON schema, and validates requests and
 * responses, straight from this class's method signatures and JSDoc via
 * `typia.llm.controller`; the old per-stage
 * `typia.llm.application<IAutoMovie*Application>()` interfaces are retired as
 * the integration surface. Drive the pipeline stage by stage, feeding each
 * tool's output into the next.
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
    this.geometry = new GeometryService();
    this.validation = new ValidationService();
    this.commit = new CommitService(this.context);
    this.render = new RenderService(this.context);
    this.pipeline = new PipelineService();
    this.guide = new GuideService();
  }

  /**
   * Open (or create) the resident project at `root` and return what it holds.
   * The project directory itself is the memory (#614): slate slices live as
   * human-readable JSON files (`script.json`, `shots/<beat>.json`, ...), and
   * binary assets (models, textures, rendered frames) are tracked by the
   * manifest and referenced by path. After opening, every `get*` and `commit*`
   * tool may omit its `slate` to read from — and write through to — the
   * project, so a long production never re-sends its whole state per call.
   * Reopening the same root keeps the live project; a fresh directory is a
   * valid empty project.
   *
   * @param props The project root directory.
   * @returns The activated project's summary.
   */
  public openProject(props: {
    /** Project root directory (created when missing). */
    root: string;
  }): IAutoMovieOpenProjectOutput {
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
   * Fetch a film-authoring guide document by exact name.
   *
   * Start with `AUTOMOVIE_OVERALL` (the operating loop, result semantics, and
   * the commit ladder), then read the guide matching the next stage: `STAGING`,
   * `BLOCKING`, `PERFORMANCE`, `REVIEW`, `PROPS`, `PROJECT_MEMORY`, or
   * `RENDER_GUIDES`. Guides teach the method; tool returns decide correctness.
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
   * Read the script slice from a slate. It returns `null` until the SCRIPT
   * stage has committed a script, so agents can ask for context without
   * inventing it.
   *
   * @param props The slate to query.
   * @returns The script slice, or null when absent.
   */
  public getScript(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpStoredSlate;
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
    slate?: IAutoMovieMcpStoredSlate;
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
    slate?: IAutoMovieMcpStoredSlate;
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
    slate?: IAutoMovieMcpStoredSlate;
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
    slate?: IAutoMovieMcpStoredSlate;
    /** Beat id whose end state should be read. */
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    return this.slateQuery.getBeatEnd(props);
  }

  /**
   * Resolve an actor's world-space skeleton pose. With a shot it samples the
   * actor's performed motion at `t`; without one it reads the staged node
   * pose.
   *
   * @param props The geometry context, actor id, and optional shot time.
   * @returns The resolved pose, or null when the actor cannot be resolved.
   */
  public getResolvedPose(props: {
    /** Scene, skeletons, optional shot, and compiled motions to query. */
    context: IAutoMovieMcpGeometryContext;
    /** Scene-node id of the actor to resolve. */
    actor: string;
    /** Shot-local time in seconds. Defaults to 0. */
    t?: number;
  }): IAutoMovieGetResolvedPoseOutput {
    return this.geometry.getResolvedPose(props);
  }

  /**
   * Measure whether an actor's arms can reach a positional target. It returns
   * per-arm reach distance, gap, and the IK pose for the closest attempt.
   *
   * @param props The geometry context, actor id, and target.
   * @returns The reach report, or null when actor or target is not positional.
   */
  public getReach(props: {
    /** Scene and skeletons used to resolve the actor and target. */
    context: IAutoMovieMcpGeometryContext;
    /** Scene-node id of the reaching actor. */
    actor: string;
    /** Node, point, or group target to reach. */
    target: IAutoMovieActionTarget;
  }): IAutoMovieGetReachOutput {
    return this.geometry.getReach(props);
  }

  /**
   * Measure the world-space distance between two positional targets. Relative
   * targets return null because they are directions, not points.
   *
   * @param props The scene and the two targets to compare.
   * @returns The resolved endpoints and distance, or null when unresolved.
   */
  public measureDistance(props: {
    /** Scene whose node positions define the target space. */
    scene: IAutoMovieScene;
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
   * transforms, camera clip planes, and light ranges.
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
   * Commit a verified script into the slate. Replacing the script clears every
   * downstream slice because staging, shots, notes, and film depend on it.
   *
   * @param props The slate and script artifact to commit.
   * @returns The new slate, or the unchanged slate with violations.
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
   * @returns The new slate, or the unchanged slate with violations.
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
   *
   * @param props The slate, shot, and optional compiled motions.
   * @returns The new slate, or the unchanged slate with violations.
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
   * and only name actors present in the committed scene.
   *
   * @param props The slate and beat-end state to commit.
   * @returns The new slate, or the unchanged slate with violations.
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
   * built shots so review cannot point at imaginary beats.
   *
   * @param props The slate and complete note backlog.
   * @returns The new slate, or the unchanged slate with violations.
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
   * notes or missing beat shots keep the slate unchanged.
   *
   * @param props The slate and sequence artifact to commit.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitFilm(props: {
    /** The slate to transform; omit to commit into the resident project (#614). */
    slate?: IAutoMovieMcpWritableSlate;
    /** Sequence artifact to commit. */
    film: IAutoMovieSequence;
  }): IAutoMovieCommitOutput {
    return this.commit.commitFilm(props);
  }

  /**
   * Plan a deterministic render for a committed shot or film. It returns frame
   * times, frame paths, per-pass guide outputs, and ffmpeg args without doing
   * host I/O.
   *
   * @param props The slate, render spec, optional guide passes, and paths.
   * @returns A render plan, or validation diagnostics when the target is not
   *   ready.
   */
  public planRender(props: {
    /** Slate whose committed shot or film is the render source. */
    slate: IAutoMovieMcpWritableSlate;
    /** Render parameters for a committed shot or sequence id. */
    spec: IAutoMovieRenderSpec;
    /** Guide passes to capture per frame. Defaults to beauty only. */
    passes?: string[];
    /** Directory where frame files would be written. */
    frameDir?: string;
    /** Encoded video output path. */
    outputPath?: string;
  }): IAutoMoviePlanRenderOutput {
    return this.render.planRender(props);
  }

  /**
   * Capture one preview frame for inspection — the render/see loop. It plans
   * the target frame and requested guide pass, then hands the host-injected
   * capture adapter the request and returns the captured image. Without an
   * adapter it returns the resolved frame with status `no-capture-adapter`
   * instead of pixels, so an agent always knows whether it actually saw the
   * frame.
   *
   * @param props The slate, render spec, optional frame/time, and guide pass.
   * @returns The captured (or planned) preview frame, or diagnostics.
   */
  public async seeFrame(props: {
    /** Slate whose committed shot or film is the preview source. */
    slate: IAutoMovieMcpWritableSlate;
    /** Render parameters for a committed shot or sequence id. */
    spec: IAutoMovieRenderSpec;
    /** Zero-based frame index. Defaults to the first frame. */
    frame?: number;
    /** Target time in seconds. Must agree with `frame` when both are present. */
    time?: number;
    /** Guide pass to draw. Defaults to `beauty`. */
    pass?: string;
  }): Promise<IAutoMovieSeeFrameOutput> {
    return this.render.seeFrame(props);
  }

  /**
   * Stage a scene -- the first deterministic step. Place the script's cast on
   * the set per the staging plan, resolve every actor/camera/light to a
   * concrete world transform (measured against the staged rigs), and validate
   * persistent mounts. On failure nothing is composed and the violations name
   * the offending placement to repair.
   *
   * @param props The script (cast + beats) and the staging plan (placements).
   * @returns The staged scene on success, or the staging violations to fix.
   */
  public stage(props: {
    /** The script: the cast to place and the beats they play. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The staging plan: where each actor, camera, and light goes. */
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
    /** The script: the cast and their beats. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The staged scene this beat blocks over (a successful `stage` result). */
    staged: IAutoMovieStagedSet.ISuccess;
    /** The blocking plan: the beat's movement intents and timing anchors. */
    blocking: IAutoMovieBlockingApplication.IWrite;
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
   * intent-realization gates.
   *
   * @param props The script, staged scene, performance write, actor contexts,
   *   and optional validated blocking.
   * @returns The performed shot on success, or the performance violations.
   */
  public perform(props: {
    /** The script: the cast and beats the shot belongs to. */
    script: IAutoMovieScriptApplication.IWrite;
    /** The successfully staged scene this shot performs over. */
    staged: IAutoMovieStagedSet.ISuccess;
    /** The performance plan: timed action calls and camera frames. */
    performance: IAutoMoviePerformanceApplication.IWrite;
    /** Per staged actor, the data the default synthesizer needs. */
    actors: Record<string, IAutoMovieMcpActorContext>;
    /** Optional validated blocking, from a successful `block` result. */
    blocking?: IAutoMovieBlockingApplication.IWrite;
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
   * deterministically at resolve time.
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
