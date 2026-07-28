import { IAutoMovieStagedSet } from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieDistanceTarget,
  IAutoMovieForgeApplication,
  IAutoMovieModel,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieReachTarget,
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
  IAutoMovieGetResolvedPropFrameOutput,
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
  IAutoMovieMcpStoredSlate,
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
import { ArticulationService } from "./services/ArticulationService";
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
 * plan frames, chunks, captions, and previews. Engine validation verdicts
 * return field-located violations for the correction round; activation,
 * prerequisite and programmer-input guards may instead throw an actionable MCP
 * error.
 *
 * `perform` keeps the MCP contract JSON-only by accepting per-actor motion
 * contexts and assembling the engine's default synthesizer inside the server.
 * How many servers/tools the whole pipeline should become remains an ongoing
 * design experiment, not a fixed shape.
 *
 * @author Samchon
 */
export class AutoMovieLegacyApplication {
  private readonly context: AutoMovieContext;
  private readonly slateQuery: SlateQueryService;
  private readonly geometry: GeometryService;
  private readonly validation: ValidationService;
  private readonly commit: CommitService;
  private readonly articulation: ArticulationService;
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
    this.articulation = new ArticulationService(this.context);
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
   * before trying. Requires an active project (call openProject first). This is
   * a read-only projection, not an autonomous planner: it neither executes the
   * suggested calls nor waives validation. If a suggested write is refused,
   * correct its named prerequisite and query again instead of skipping ahead.
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
   * correctness. This read-only call neither opens a project nor satisfies any
   * production gate by itself. Unknown names are refused rather than mapped to
   * a guessed document. Read the returned versioned text, then use the tool and
   * correction path it names instead of treating prompt memory as current
   * engine truth.
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
   * inventing it. Omit `slate` only after `openProject`; otherwise pass the
   * explicit stored slate being inspected. This call is read-only and does not
   * validate, synthesize, or commit a replacement. A null result means
   * `commitScript` is the missing prerequisite, not that the caller should
   * fabricate downstream scene or shot state.
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
   * has committed a scene, letting later tools gate on real state. Omit `slate`
   * only for an active resident project. When several scene ids exist, supply
   * `scene`; ambiguity is refused instead of selecting an arbitrary set. This
   * read neither restages nor validates the scene. Use the returned
   * compiler-accepted state as input to geometry, blocking, performance, and
   * validation rather than reconstructing transforms from prose.
   *
   * @param props The slate to query.
   * @returns The staged scene slice, or null when absent.
   */
  public getScene(props: {
    /** The slate to read; omit to read the resident project (#614). */
    slate?: IAutoMovieMcpStoredSlate;
    /**
     * Which staged scene to read, by its id. Omit while a film stages one;
     * required once it stages several, since "the scene" stops naming one.
     */
    scene?: string;
  }): IAutoMovieGetSceneOutput {
    return this.slateQuery.getScene(props);
  }

  /**
   * Read the shot built for one beat. Missing shots return `null`; duplicate
   * shot ids throw as an ambiguous slate state. The beat id is the stable
   * screenplay address, not the rendered shot id. Omit `slate` only after
   * `openProject`; the call is read-only and never performs or commits a shot.
   * Null means the beat still needs `perform` followed by `commitShot`, while
   * an ambiguity means the stored slate must be repaired before continuing.
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
   * backlog; providing it scopes the notes to one beat. Omit `slate` only for
   * the active resident project. The returned array is the committed backlog,
   * not an automatic critique and not proof that a shot passed review. This
   * call never clears notes or changes film eligibility; revise the complete
   * list and use `commitNotes` when the review state truly changes.
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
   * duplicates throw as an ambiguous slate state. This is the continuity
   * handoff produced after a performed shot: actor positions, facing, pose and
   * mounts seed the next resident block/performance. Omit `slate` only after
   * `openProject`. Null means the beat needs `getShotEndState` and
   * `commitBeatEnd`; it is not permission to silently reset the next beat.
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
   * Resolve an actor's world-space skeleton pose. Pass `context` for the
   * explicit stateless path, or omit it to read the resident project. Resident
   * mode uses the committed scene, optional committed beat shot, each cast
   * actor's persisted rig and clinical rest frames (`actors/<node>.json`, so a
   * reopened project resolves rest/ambient poses without a re-commit), and the
   * session-only compiled motions remembered from resident commitShot. Motions
   * are not persisted as slices, so a query that samples a specific beat's
   * motion needs that beat's commitShot in this session (or an explicit
   * context).
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
   * Test an actor's arm against a node, bone, point, or group target before
   * authoring a reach action. Read both verdicts: `reachable` checks distance
   * against the arm shell, while each arm's `poseWithinRom` and `romViolations`
   * say whether `perform` can hold the returned IK pose. A target can pass
   * distance and fail joint limits. Pass an explicit geometry context, or omit
   * it after `openProject` to use the committed scene and remembered rigs. A
   * bone target samples its resolved actor at shot time; resident calls use
   * `beat` to select the committed motion. Null output names the unresolved id
   * or unsolvable arm rather than inventing a pose.
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
    /** Node, bone, point, or group target to reach. */
    target: IAutoMovieReachTarget;
    /** Resident beat whose motion a live bone should sample. */
    beat?: string;
    /** Shot-local seconds at which a live bone is sampled. Defaults to 0. */
    t?: number;
  }): IAutoMovieGetReachOutput {
    return this.geometry.getReach(props);
  }

  /**
   * Resolve one committed shot instant through every stored articulated prop's
   * declared limits and drivers. Joint ids are `<placement>/<articulation
   * node>`; the result reports the lowered world matrices and every clamp. This
   * is resident-only because the forged prop specifications live in the project
   * store beside the committed scene and shot. The query is read-only: it does
   * not move the prop, rewrite a driver, persist a sampled frame, or certify
   * contact. Missing scene, shot, spec, or joint identity returns an actionable
   * reason rather than a guessed matrix. Correct the owning committed artifact
   * and query the exact beat/time again.
   *
   * @param props The committed beat and optional shot-local time.
   * @returns The resolved prop frame, or an actionable reason it is
   *   unavailable.
   */
  public getResolvedPropFrame(props: {
    /** Beat whose committed shot supplies `objectMotions`. */
    beat: string;
    /** Shot-local seconds (default 0). */
    t?: number;
  }): IAutoMovieGetResolvedPropFrameOutput {
    return this.articulation.getResolvedPropFrame(props);
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
   * Bone and relative targets are deliberately absent: this scene-only query
   * has neither a rig clock nor a unique point for a direction. The result is a
   * deterministic geometric measurement, not path length, reachability,
   * collision clearance, or artistic staging judgment. The call is read-only
   * and never moves either endpoint. If one side cannot resolve, correct its
   * scene id or use the pose/reach oracle that owns the missing semantics.
   *
   * @param props The two targets and optional explicit scene.
   * @returns The resolved endpoints and distance, or null with a per-side
   *   reason naming the id or the relative kind that failed to resolve.
   */
  public measureDistance(props: {
    /** Scene whose node positions define the target space. */
    scene?: IAutoMovieScene;
    /** First endpoint. */
    from: IAutoMovieDistanceTarget;
    /** Second endpoint. */
    to: IAutoMovieDistanceTarget;
  }): IAutoMovieMeasureDistanceOutput {
    return this.geometry.measureDistance(props);
  }

  /**
   * Validate a pose against a skeleton. Returns ROM, duplicate-joint, skeleton
   * mismatch, and root-transform diagnostics with field paths. This is a pure
   * preflight: it neither repairs the pose nor commits project state. Treat an
   * empty violation list as structural and range validity only, not an
   * aesthetic review. On failure, change the exact joint/root path named by the
   * diagnostic and resubmit before using the pose in a motion or shot.
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
   * run. The validator checks ids, target skeleton, track/keyframe shape,
   * clocks, interpolation and sampled joint limits; it does not synthesize
   * missing motion or persist anything. Use the returned field paths to repair
   * the authored clip, then revalidate before `perform`/`commitShot`. Passing
   * here establishes mechanical validity, not camera readability or dramatic
   * quality.
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
   * Check whether explicitly planted feet skate in a performed MCP-safe motion.
   * Pass the dense motion from `perform({ response: "full" })` when the compact
   * resident response did not return its registry. The pure validator samples
   * only the declared plant windows and reports advisory physics warnings with
   * a foot, sample, and contact-window path; it does not infer missing
   * contacts, rewrite keys, or persist the motion. A clean result means planted
   * feet stayed within the configured tolerance, not that the gait or shot
   * looks natural.
   *
   * @param props The motion, rig, and intended planted-foot windows.
   * @returns The validation envelope.
   */
  public validateFootSkate(
    props: Parameters<ValidationService["validateFootSkate"]>[0],
  ): IAutoMovieValidateOutput {
    return this.validation.validateFootSkate(props);
  }

  /**
   * Check a performed MCP-safe motion's feet against a scalar ground plane.
   * Pass the dense motion from `perform({ response: "full" })` when needed;
   * penetration is advisory and each warning identifies its sampled foot and
   * time. This pure oracle neither resolves arbitrary scene terrain nor edits
   * root motion. Supply the actual rig and intended ground height, correct the
   * reported motion/root keys, and separately review foot planting and terrain
   * contact in a current frame.
   *
   * @param props The motion, rig, optional feet, and ground settings.
   * @returns The validation envelope.
   */
  public validateGroundContact(
    props: Parameters<ValidationService["validateGroundContact"]>[0],
  ): IAutoMovieValidateOutput {
    return this.validation.validateGroundContact(props);
  }

  /**
   * Validate a model. This runs the engine's model validator over geometry,
   * materials, skeleton graph, skinning, and transform ranges. It is a pure
   * boundary check: no mesh is generated, imported, repaired, registered, or
   * committed. Each violation names the malformed model path; correct all of
   * them before staging. A clean result proves engine consumability, not visual
   * likeness, art direction, or attachment behavior in a composed scene.
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
   * drawn from its own footprint, never a registry entry. This pure check does
   * not stage, repair, commit, or render. A clean result proves structural
   * engine validity only; framing, lighting readability, contact, and dramatic
   * composition still require current-frame review. Fix the exact field path
   * returned before blocking or performance.
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
   * names missing scene/camera/node/motion refs and invalid clip timing. Supply
   * every referenced derived motion when checking an explicit shot; resident
   * session memory is not consulted by this pure validator. It neither performs
   * actions nor commits the shot. Repair the exact reference or time path it
   * reports, then separately review frame readability, continuity, contact and
   * acceptance evidence.
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
   * fps, shot refs, trim spans, transition placement, and duplicate ids. Pass
   * the exact shot artifacts the sequence cuts; this pure call does not read or
   * mutate resident state. A clean result proves the cut is mechanically
   * renderable, not that pacing, narrative causality, continuity or runtime
   * intent is good. Perform that review before `commitFilm`, then correct any
   * field-located sequence violation rather than retrying unchanged.
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
   * Resident calls require `openProject`; explicit calls return a transformed
   * slate without writing the project. The commit gate validates the script and
   * current revision atomically. On refusal the slate is unchanged: correct the
   * named script field or resynchronize through `getSlate`, then retry rather
   * than attempting staging against stale memory.
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
   * invalidates shots, beat ends, notes, and film because all downstream
   * transforms and continuity derive from it. Resident calls write atomically
   * after `openProject`; explicit calls transform the supplied slate. The
   * `models` registry must cover every scene-node model. Refusal leaves state
   * unchanged, so repair the reported scene/model reference or revision race
   * before rebuilding shots.
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
    /**
     * Optional compiled motions; a compact resident perform supplies them
     * in-session.
     */
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieCommitOutput {
    return this.commit.commitShot(props);
  }

  /**
   * Commit the resolved end-state for a beat. It must point at a committed shot
   * and only name actors present in the committed scene. Re-committing the same
   * beat replaces exactly that beat's end-state (the upsert rule) and nulls the
   * committed film, continuity data changed under the cut. Use the
   * engine-derived `getShotEndState` result rather than hand-authoring a
   * convenient reset. Resident mode checks the current revision and writes
   * atomically; explicit mode transforms only the supplied slate. A refusal
   * changes nothing, so repair the missing shot, actor, or stale revision
   * before blocking the next beat.
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
   * Send the complete current backlog, not a patch; an empty list is the
   * explicit claim that all noted corrections were applied. Resident mode
   * validates the current revision atomically, while explicit mode transforms
   * only the supplied slate. Refusal leaves prior notes and film state
   * unchanged.
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
   * state your pacing/continuity self-check before the cut-list it judges. The
   * gate validates references, timing and an empty note backlog, but cannot
   * prove that the prose review is honest or the edit is artistically
   * effective. Resident mode commits atomically at the current revision;
   * explicit mode returns a transformed slate. Correct every refusal before
   * claiming a final cut.
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
   * assembled film is cleared because any notes change invalidates its review
   * basis. This is an audited targeted correction, not “mark all fixed” and not
   * a cascade into shots or design. The commit is atomic; refusal preserves the
   * backlog. Apply the noted corrections first, record the concrete reason,
   * then re-review and recommit the film.
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
   * This pure call writes no frames, checkpoint, media, or completion claim;
   * the host executes and records each chunk. It refuses a missing film,
   * invalid frame clock, or non-positive chunk size rather than inventing
   * boundaries. Correct the owning film/spec, then resume only the failed
   * planned windows.
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
   * project. This pure planner computes frame-aligned caption records but
   * writes no WebVTT, prompts, frames, or media. It refuses missing script/film
   * or an incompatible clock instead of guessing. Inspect the returned
   * diagnostics, correct the owning slate or frame format, and let the host
   * persist the resulting sidecar.
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
   * Turn a script and staging plan into the deterministic scene that later
   * blocking and performance consume. It resolves cast, cameras, lights, set
   * pieces, mounts, and walkable space to concrete world transforms. Set pieces
   * are skeleton-less geometry and may be scaled; space defines the ground and
   * surfaces rendered in guide passes. Directional, point, and spot lights each
   * accept only their physical parameters, so a mismatched range, target, or
   * cone is refused rather than ignored. Failure returns field-located
   * placement violations and no partial scene; correct those inputs before
   * calling `block`.
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
   * the fine performance. Explicit mode supplies script and staged set
   * together; resident mode reads both and may seed the preceding committed
   * end-state. Mixed ownership is refused. The result is intent and timing, not
   * animation: it neither synthesizes clips nor commits a shot. Repair
   * contradictory actor, route, timing, or continuity fields before calling
   * `perform`.
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
   * Compile one beat's action plan into deterministic actor clips plus camera,
   * object, and light tracks over a staged scene. Actor contexts provide the
   * rigs, rest frames, gait, and profiles used by the server synthesizer;
   * validated blocking enables intent-realization checks. An `enact` action
   * references a caller-computed clip from `clips`; the engine still applies
   * region masks, layering, and ROM gates. Explicit calls re-supply derived
   * clips. Resident calls may reuse stored actors, retain clips for
   * `commitShot`, and return a compact summary; request `response: "full"` for
   * dense-motion or physics inspection. Fix violations before committing.
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
    /** Resident output: `compact` (default) or dense-clip `full`. */
    response?: "compact" | "full";
  }): IAutoMoviePerformOutput {
    return this.pipeline.perform(props);
  }

  /**
   * Cut shots into a film -- assemble a sequence of performed shots on the
   * output clock, applying trims and transitions (a cross-dissolve overlaps the
   * tail). This pure transform checks shot references, clocks, trims and
   * transition capacity, then returns the computed sequence and runtime. It
   * neither reads resident state nor commits the film; `commitFilm` owns that
   * gate. A clean cut is mechanically valid, not proof of pacing or continuity,
   * so review those qualities and correct any field-located violation first.
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
   * cast needs from the forge specification, ready to rig and render. The
   * deterministic generator validates parameter ranges and returns either the
   * complete forged registry or all violations; it does not import arbitrary
   * meshes, register binary assets, stage actors, or commit project state. A
   * successful model remains subject to scene-scale, silhouette, likeness and
   * current-frame review. Correct the rejected cast/spec path and retry.
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
