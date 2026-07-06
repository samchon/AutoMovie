import {
  HUMANOID_JOINT_AXES,
  IAutoMovieActorContext,
  IAutoMovieBlockedBeat,
  IAutoMovieCut,
  IAutoMovieForgedCast,
  IAutoMoviePerformedShot,
  IAutoMovieStagedSet,
  Quaternion,
  Vector3,
  blockBeat,
  cutSequence,
  forgeCast,
  makeActorSynthesizer,
  performShot,
  reachPose,
  readSlateContext,
  resolvePose,
  resolveTargetPoint,
  sampleMotion,
  stageScene,
  toValidation,
  validateModel as validateEngineModel,
  validateMotion as validateEngineMotion,
  validatePose as validateEnginePose,
  violation,
} from "@automovie/engine";
import {
  AutoMovieEasing,
  AutoMovieHumanoidBone,
  IAutoMovieActionTarget,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieExpression,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMovieGaitRootBob,
  IAutoMovieKeyframe,
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptApplication,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieSlate,
  IAutoMovieStagingApplication,
  IAutoMovieTransform,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * AutoMovie's deterministic motion-control engine, exposed as MCP tools. Query
 * tools read slate context; `stage`, `block`, `perform`, `cut`, and `forge`
 * compute the film pipeline. Each tool takes structured creative intent and
 * returns the engine's result, including violations that make the engine, not
 * the model, the arbiter of physical truth ("engine enforces, model creates").
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
  /**
   * Read the script slice from a slate. It returns `null` until the SCRIPT
   * stage has committed a script, so agents can ask for context without
   * inventing it.
   *
   * @param props The slate to query.
   * @returns The script slice, or null when absent.
   */
  public getScript(props: {
    /** The stored slate slices to read. */ slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetScriptOutput {
    return {
      script: readSlateContext(toStoredSlate(props.slate), {
        type: "getScript",
      }) as IAutoMovieScript | null,
    };
  }

  /**
   * Read the staged scene slice from a slate. It returns `null` until STAGING
   * has committed a scene, letting later tools gate on real state.
   *
   * @param props The slate to query.
   * @returns The staged scene slice, or null when absent.
   */
  public getScene(props: {
    /** The stored slate slices to read. */ slate: IAutoMovieMcpStoredSlate;
  }): IAutoMovieGetSceneOutput {
    return {
      scene: readSlateContext(toStoredSlate(props.slate), {
        type: "getScene",
      }) as IAutoMovieScene | null,
    };
  }

  /**
   * Read the shot built for one beat. Missing shots return `null`; duplicate
   * shot ids throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching shot, or null when absent.
   */
  public getShot(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Beat id whose shot should be read. */
    beat: string;
  }): IAutoMovieGetShotOutput {
    return {
      shot: readSlateContext(toStoredSlate(props.slate), {
        type: "getShot",
        beat: props.beat,
      }) as IAutoMovieShot | null,
    };
  }

  /**
   * Read review notes from a slate. Omitting `beat` returns the full open
   * backlog; providing it scopes the notes to one beat.
   *
   * @param props The slate and optional beat filter to query.
   * @returns The matching review notes.
   */
  public getNotes(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Optional beat id filter. */
    beat?: string;
  }): IAutoMovieGetNotesOutput {
    return {
      notes: readSlateContext(toStoredSlate(props.slate), {
        type: "getNotes",
        beat: props.beat,
      }) as IAutoMovieReviewNote[],
    };
  }

  /**
   * Read the resolved end-state for one beat. Missing entries return `null`;
   * duplicates throw as an ambiguous slate state.
   *
   * @param props The slate and beat id to query.
   * @returns The matching beat end state, or null when absent.
   */
  public getBeatEnd(props: {
    /** The stored slate slices to read. */
    slate: IAutoMovieMcpStoredSlate;
    /** Beat id whose end state should be read. */
    beat: string;
  }): IAutoMovieGetBeatEndOutput {
    return {
      beatEnd: readSlateContext(toStoredSlate(props.slate), {
        type: "getBeatEnd",
        beat: props.beat,
      }) as IAutoMovieBeatEndState | null,
    };
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
    return {
      resolvedPose: resolveActorGeometry(
        props.context,
        props.actor,
        props.t ?? 0,
      ),
    };
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
    const actor = findActorRig(props.context, props.actor);
    if (actor === null) return { reach: null };
    const target = resolveTargetPoint(
      props.target,
      nodePositions(props.context.scene),
    );
    if (target === null) return { reach: null };
    const localTarget = toModelPoint(target, actor.node.transform);
    if (localTarget === null) return { reach: null };
    const left = measureArmReach(actor.skeleton, "left", localTarget);
    const right = measureArmReach(actor.skeleton, "right", localTarget);
    return {
      reach: {
        actor: props.actor,
        target,
        left,
        right,
        reachable: Boolean(left?.reachable || right?.reachable),
      },
    };
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
    const nodes = nodePositions(props.scene);
    const from = resolveTargetPoint(props.from, nodes);
    const to = resolveTargetPoint(props.to, nodes);
    return {
      measurement:
        from === null || to === null
          ? null
          : {
              from,
              to,
              distance: Vector3.length(Vector3.subtract(to, from)),
            },
    };
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
    return {
      validation: validateEnginePose({
        pose: props.pose,
        skeleton: props.skeleton,
      }).toValidation(),
    };
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
    return {
      validation: validateEngineMotion({
        motion: toEngineMotion(props.motion),
        skeleton: props.skeleton,
      }),
    };
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
    return { validation: validateEngineModel({ model: props.model }) };
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
    return { validation: validateSceneArtifact(props.scene, props.models) };
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
    return {
      validation: validateShotArtifact(props.shot, props.scene, props.motions),
    };
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
    return {
      validation: validateSequenceArtifact(props.sequence, props.shots),
    };
  }

  /**
   * Commit a verified script into the slate. Replacing the script clears every
   * downstream slice because staging, shots, notes, and film depend on it.
   *
   * @param props The slate and script artifact to commit.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitScript(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Script artifact to commit. */
    script: IAutoMovieScript;
  }): IAutoMovieCommitOutput {
    const validation = validateScriptArtifact(props.script);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({
      ...props.slate,
      script: props.script,
      scene: null,
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    });
  }

  /**
   * Commit a staged scene after script and model-reference checks. A new scene
   * invalidates shots, beat ends, notes, and film.
   *
   * @param props The slate, scene, and available model ids.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitScene(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Scene artifact to commit. */
    scene: IAutoMovieScene;
    /** Model ids available to scene nodes. */
    models: IAutoMovieMcpGeometryModel[];
  }): IAutoMovieCommitOutput {
    const violations: IAutoMovieConstraintViolation[] = [];
    appendValidation(
      violations,
      validateSceneArtifact(props.scene, props.models),
    );
    if (props.slate.script === null)
      pushViolation(
        violations,
        "type",
        "$slate.script",
        "a script must be committed before a scene",
        props.slate.script,
      );
    else
      validateSceneAgainstScript(props.scene, props.slate.script, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({
      ...props.slate,
      scene: props.scene,
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    });
  }

  /**
   * Commit one performed shot after script, scene, and optional motion checks.
   * The shot id must be `shot:<beat>` so slate queries can find it.
   *
   * @param props The slate, shot, and optional compiled motions.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitShot(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Shot artifact to commit. */
    shot: IAutoMovieShot;
    /** Optional compiled motions keyed by actor or arbitrary ids. */
    motions?: Record<string, IAutoMovieMcpMotion>;
  }): IAutoMovieCommitOutput {
    const violations: IAutoMovieConstraintViolation[] = [];
    validateUniqueIds(
      props.slate.shots,
      "$slate.shots",
      "committed shot id",
      violations,
    );
    const beat = validateShotCommitPreconditions(
      props.shot,
      props.slate,
      violations,
    );
    if (props.slate.scene !== null)
      appendValidation(
        violations,
        validateShotArtifact(props.shot, props.slate.scene, props.motions),
      );
    const validation = toValidation(violations);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({
      ...props.slate,
      shots: upsertById(props.slate.shots, props.shot),
      beatEnds: props.slate.beatEnds.filter((end) => end.beat !== beat),
      film: null,
    });
  }

  /**
   * Commit the resolved end-state for a beat. It must point at a committed shot
   * and only name actors present in the committed scene.
   *
   * @param props The slate and beat-end state to commit.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitBeatEnd(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Beat-end state to commit. */
    beatEnd: IAutoMovieBeatEndState;
  }): IAutoMovieCommitOutput {
    const violations: IAutoMovieConstraintViolation[] = [];
    validateUniqueBy(
      props.slate.beatEnds.map((end, index) => ({
        id: end.beat,
        path: `$slate.beatEnds[${index}].beat`,
      })),
      "committed beat end",
      violations,
    );
    validateBeatEndArtifact(props.beatEnd, props.slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({
      ...props.slate,
      beatEnds: upsertBy(
        props.slate.beatEnds,
        props.beatEnd,
        (end) => end.beat === props.beatEnd.beat,
      ),
      film: null,
    });
  }

  /**
   * Commit the current review backlog. Notes require a committed script and
   * built shots so review cannot point at imaginary beats.
   *
   * @param props The slate and complete note backlog.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitNotes(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Complete open review-note backlog. */
    notes: IAutoMovieReviewNote[];
  }): IAutoMovieCommitOutput {
    const violations: IAutoMovieConstraintViolation[] = [];
    validateNotesArtifact(props.notes, props.slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({ ...props.slate, notes: props.notes, film: null });
  }

  /**
   * Commit the assembled film after sequence and backlog checks. Open review
   * notes or missing beat shots keep the slate unchanged.
   *
   * @param props The slate and sequence artifact to commit.
   * @returns The new slate, or the unchanged slate with violations.
   */
  public commitFilm(props: {
    /** Current writable slate. */
    slate: IAutoMovieMcpWritableSlate;
    /** Sequence artifact to commit. */
    film: IAutoMovieSequence;
  }): IAutoMovieCommitOutput {
    const violations: IAutoMovieConstraintViolation[] = [];
    appendValidation(
      violations,
      validateSequenceArtifact(props.film, props.slate.shots),
    );
    validateFilmPreconditions(props.film, props.slate, violations);
    const validation = toValidation(violations);
    if (validation.success === false)
      return failedCommit(props.slate, validation);
    return successfulCommit({ ...props.slate, film: props.film });
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
    return { staged: stageScene(props.script, props.staging) };
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
    return { blocked: blockBeat(props.script, props.staged, props.blocking) };
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
    const contexts = new Map<string, IAutoMovieActorContext>(
      Object.entries(props.actors).map(([node, context]) => [
        node,
        toActorContext(context),
      ]),
    );
    const nodes = new Map(
      props.staged.scene.nodes.map((node) => [
        node.id,
        node.transform.translation,
      ]),
    );
    const synthesize = makeActorSynthesizer(contexts, nodes);
    const performed = performShot({
      script: props.script,
      staged: props.staged,
      performance: props.performance,
      synthesize,
      skeleton: (node) => contexts.get(node)?.rig ?? null,
      restFrames: (node) => contexts.get(node)?.restFrames,
      blocking: props.blocking,
    });
    return { performed: toMcpPerformedShot(performed) };
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
    return { cut: cutSequence(props.assemble, props.shots) };
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
    return { forged: forgeCast(props.script, props.forge) };
  }
}

const toActorContext = (
  context: IAutoMovieMcpActorContext,
): IAutoMovieActorContext => ({
  ...context,
  gaits: context.gaits.map((gait): IAutoMovieGait => ({ ...gait })),
});

const toMcpPerformedShot = (
  performed: IAutoMoviePerformedShot,
): IAutoMovieMcpPerformedShot =>
  performed.success === false
    ? performed
    : {
        ...performed,
        motions: Object.fromEntries(
          Object.entries(performed.motions).map(([node, motion]) => [
            node,
            toMcpMotion(motion),
          ]),
        ),
      };

const toMcpMotion = (motion: IAutoMovieMotion): IAutoMovieMcpMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier: toMcpBezier(keyframe.bezier),
  })),
});

const toMcpBezier = (
  bezier: IAutoMovieKeyframe["bezier"],
): IAutoMovieMcpBezier | null =>
  bezier === null
    ? null
    : {
        x1: bezier[0],
        y1: bezier[1],
        x2: bezier[2],
        y2: bezier[3],
      };

const toStoredSlate = (slate: IAutoMovieMcpStoredSlate): IAutoMovieSlate => ({
  brief: "",
  script: slate.script,
  scene: slate.scene,
  shots: slate.shots,
  beatEnds: slate.beatEnds,
  notes: slate.notes,
  film: null,
});

type GeometryActor = {
  node: IAutoMovieScene["nodes"][number];
  model: IAutoMovieMcpGeometryModel;
  skeleton: IAutoMovieSkeleton;
};

type ActorPoseState = {
  pose: IAutoMoviePose;
  motion: string | null;
};

const resolveActorGeometry = (
  context: IAutoMovieMcpGeometryContext,
  actor: string,
  t: number,
): IAutoMovieMcpResolvedPose | null => {
  assertFiniteTime(t);
  const actorRig = findActorRig(context, actor);
  if (actorRig === null) return null;
  const state = resolveActorPose(context, actorRig.node, actorRig.skeleton, t);
  if (state === null) return null;
  return {
    node: actor,
    model: actorRig.model.id,
    motion: state.motion,
    t,
    pose: state.pose,
    bones: resolvePose(state.pose, actorRig.skeleton, HUMANOID_JOINT_AXES).map(
      (bone) => ({
        bone: bone.bone,
        localRotation: bone.localRotation,
        worldPosition: applyTransformPoint(
          actorRig.node.transform,
          bone.worldPosition,
        ),
        worldRotation: Quaternion.multiply(
          actorRig.node.transform.rotation,
          bone.worldRotation,
        ),
      }),
    ),
  };
};

const resolveActorPose = (
  context: IAutoMovieMcpGeometryContext,
  node: IAutoMovieScene["nodes"][number],
  skeleton: IAutoMovieSkeleton,
  t: number,
): ActorPoseState | null => {
  const performance =
    context.shot === undefined || context.shot === null
      ? null
      : findShotPerformance(context.shot, node.id);
  const motionId = performance === null ? node.motion : performance.motion;
  if (motionId !== null) {
    const motion = findMotion(context, motionId);
    if (motion === null) return null;
    return {
      motion: motionId,
      pose: sampleMotion(
        toEngineMotion(motion),
        t - (performance?.startOffset ?? 0),
      ).pose,
    };
  }
  return {
    motion: null,
    pose: node.pose ?? { skeleton: skeleton.id, root: null, joints: [] },
  };
};

const findActorRig = (
  context: IAutoMovieMcpGeometryContext,
  actor: string,
): GeometryActor | null => {
  const node = findSceneNode(context.scene, actor);
  if (node === null) return null;
  const model = findGeometryModel(context.models, node.model);
  if (model === null || model.skeleton === null) return null;
  return { node, model, skeleton: model.skeleton };
};

const findSceneNode = (
  scene: IAutoMovieScene,
  id: string,
): IAutoMovieScene["nodes"][number] | null => {
  const matches = scene.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.id === id);
  if (matches.length > 1)
    throw new Error(
      `scene node "${id}" is duplicated at context.scene.nodes[${matches[1]!.index}].id`,
    );
  return matches[0]?.node ?? null;
};

const findGeometryModel = (
  models: IAutoMovieMcpGeometryModel[],
  id: string,
): IAutoMovieMcpGeometryModel | null => {
  const matches = models
    .map((model, index) => ({ model, index }))
    .filter(({ model }) => model.id === id);
  if (matches.length > 1)
    throw new Error(
      `geometry model "${id}" is duplicated at context.models[${matches[1]!.index}].id`,
    );
  return matches[0]?.model ?? null;
};

const findShotPerformance = (
  shot: IAutoMovieShot,
  node: string,
): IAutoMovieShot["performances"][number] | null => {
  const matches = shot.performances
    .map((performance, index) => ({ performance, index }))
    .filter(({ performance }) => performance.node === node);
  if (matches.length > 1)
    throw new Error(
      `shot performance for "${node}" is duplicated at context.shot.performances[${matches[1]!.index}].node`,
    );
  return matches[0]?.performance ?? null;
};

const findMotion = (
  context: IAutoMovieMcpGeometryContext,
  id: string,
): IAutoMovieMcpMotion | null => {
  const entries = Object.entries(context.motions)
    .map(([key, motion]) => ({ key, motion }))
    .filter(({ motion }) => motion.id === id);
  if (entries.length > 1)
    throw new Error(
      `motion "${id}" is duplicated at context.motions.${entries[1]!.key}.id`,
    );
  return entries[0]?.motion ?? null;
};

const nodePositions = (
  scene: IAutoMovieScene,
): Map<string, IAutoMovieVector3> =>
  new Map(
    scene.nodes.map((node, index) => {
      if (scene.nodes.findIndex((other) => other.id === node.id) !== index)
        throw new Error(
          `scene node "${node.id}" is duplicated at scene.nodes[${index}].id`,
        );
      return [node.id, node.transform.translation];
    }),
  );

const measureArmReach = (
  skeleton: IAutoMovieSkeleton,
  side: "left" | "right",
  target: IAutoMovieVector3,
): IAutoMovieMcpArmReach | null => {
  const upperName = side === "left" ? "leftUpperArm" : "rightUpperArm";
  const lowerName = side === "left" ? "leftLowerArm" : "rightLowerArm";
  const handName = side === "left" ? "leftHand" : "rightHand";
  const rest = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
    HUMANOID_JOINT_AXES,
  );
  const upper = rest.find((bone) => bone.bone === upperName);
  const lower = rest.find((bone) => bone.bone === lowerName);
  const hand = rest.find((bone) => bone.bone === handName);
  if (upper === undefined || lower === undefined || hand === undefined)
    return null;
  const upperLength = Vector3.length(
    Vector3.subtract(lower.worldPosition, upper.worldPosition),
  );
  const lowerLength = Vector3.length(
    Vector3.subtract(hand.worldPosition, lower.worldPosition),
  );
  if (upperLength < 1e-6 || lowerLength < 1e-6) return null;
  const targetDistance = Vector3.length(
    Vector3.subtract(target, upper.worldPosition),
  );
  const maximumDistance = upperLength + lowerLength;
  const gap = Math.max(0, targetDistance - maximumDistance);
  return {
    side,
    targetDistance,
    maximumDistance,
    gap,
    reachable: gap <= 1e-6,
    pose: reachPose(skeleton, side, target),
  };
};

const toEngineMotion = (motion: IAutoMovieMcpMotion): IAutoMovieMotion => ({
  ...motion,
  keyframes: motion.keyframes.map((keyframe) => ({
    ...keyframe,
    bezier:
      keyframe.bezier === null
        ? null
        : ([
            keyframe.bezier.x1,
            keyframe.bezier.y1,
            keyframe.bezier.x2,
            keyframe.bezier.y2,
          ] as [number, number, number, number]),
  })),
});

const applyTransformPoint = (
  transform: IAutoMovieTransform,
  point: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    transform.translation,
    Quaternion.rotateVector(transform.rotation, {
      x: point.x * transform.scale.x,
      y: point.y * transform.scale.y,
      z: point.z * transform.scale.z,
    }),
  );

const toModelPoint = (
  point: IAutoMovieVector3,
  transform: IAutoMovieTransform,
): IAutoMovieVector3 | null => {
  if (
    Math.abs(transform.scale.x) < 1e-6 ||
    Math.abs(transform.scale.y) < 1e-6 ||
    Math.abs(transform.scale.z) < 1e-6
  )
    return null;
  const unrotated = Quaternion.rotateVector(
    inverse(transform.rotation),
    Vector3.subtract(point, transform.translation),
  );
  return {
    x: unrotated.x / transform.scale.x,
    y: unrotated.y / transform.scale.y,
    z: unrotated.z / transform.scale.z,
  };
};

const inverse = (q: IAutoMovieQuaternion): IAutoMovieQuaternion =>
  Quaternion.normalize({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

const assertFiniteTime = (t: number): void => {
  if (!Number.isFinite(t)) throw new Error("t must be finite");
};

const failedCommit = (
  slate: IAutoMovieMcpWritableSlate,
  validation: IAutoMovieValidation.IFailure,
): IAutoMovieCommitOutput => ({ committed: false, slate, validation });

const successfulCommit = (
  slate: IAutoMovieMcpWritableSlate,
): IAutoMovieCommitOutput => ({
  committed: true,
  slate,
  validation: { success: true },
});

const appendValidation = (
  violations: IAutoMovieConstraintViolation[],
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === false) violations.push(...validation.violations);
};

const upsertById = <T extends { id: string }>(items: T[], item: T): T[] =>
  upsertBy(items, item, (entry) => entry.id === item.id);

const upsertBy = <T>(
  items: T[],
  item: T,
  matches: (entry: T) => boolean,
): T[] => {
  let replaced = false;
  const next = items.map((entry) => {
    if (!matches(entry)) return entry;
    replaced = true;
    return item;
  });
  if (!replaced) next.push(item);
  return next;
};

const validateScriptArtifact = (
  script: IAutoMovieScript,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyText(script.logline, "$input.logline", "logline", violations);
  validateNonEmptyText(script.theme, "$input.theme", "theme", violations);
  validateUniqueBy(
    script.cast.map((member, index) => ({
      id: member.node,
      path: `$input.cast[${index}].node`,
    })),
    "cast node",
    violations,
  );
  validateUniqueIds(script.beats, "$input.beats", "beat id", violations);
  script.cast.forEach((member, i) => {
    const path = `$input.cast[${i}]`;
    validateNonEmptyId(member.node, `${path}.node`, "cast node", violations);
    validateNonEmptyText(
      member.character,
      `${path}.character`,
      "cast character",
      violations,
    );
    if (member.modelRef !== null)
      validateNonEmptyText(
        member.modelRef,
        `${path}.modelRef`,
        "cast modelRef",
        violations,
      );
  });
  if (script.beats.length === 0)
    pushViolation(
      violations,
      "type",
      "$input.beats",
      "script must contain at least one beat",
      script.beats,
    );
  script.beats.forEach((beat, i) => {
    const path = `$input.beats[${i}]`;
    validateNonEmptyId(beat.id, `${path}.id`, "beat id", violations);
    validateNonEmptyText(beat.name, `${path}.name`, "beat name", violations);
    validateNonEmptyText(
      beat.summary,
      `${path}.summary`,
      "beat summary",
      violations,
    );
    validateRange(
      beat.durationHint,
      `${path}.durationHint`,
      0,
      Infinity,
      "beat durationHint",
      violations,
      false,
    );
  });
  return toValidation(violations);
};

const validateSceneAgainstScript = (
  scene: IAutoMovieScene,
  script: IAutoMovieScript,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const nodeIds = new Set(scene.nodes.map((node) => node.id));
  script.cast.forEach((member, i) => {
    if (!nodeIds.has(member.node))
      pushViolation(
        violations,
        "type",
        "$input.nodes",
        `scene must contain cast node "${member.node}" from script cast[${i}]`,
        member.node,
      );
  });
};

const validateShotCommitPreconditions = (
  shot: IAutoMovieShot,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): string | null => {
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a shot",
      slate.script,
    );
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a shot",
      slate.scene,
    );

  const beat = shotBeatId(shot.id);
  if (beat === null)
    pushViolation(
      violations,
      "type",
      "$input.id",
      'shot id must use the "shot:<beat>" form',
      shot.id,
    );
  else if (
    slate.script !== null &&
    !slate.script.beats.some((entry) => entry.id === beat)
  )
    pushViolation(
      violations,
      "type",
      "$input.id",
      `shot beat "${beat}" must exist in the committed script`,
      shot.id,
    );
  return beat;
};

const validateBeatEndArtifact = (
  beatEnd: IAutoMovieBeatEndState,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateNonEmptyId(beatEnd.beat, "$input.beat", "beat id", violations);
  validateNonEmptyId(beatEnd.shot, "$input.shot", "shot id", violations);
  if (beatEnd.shot !== `shot:${beatEnd.beat}`)
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot must equal "shot:${beatEnd.beat}"`,
      beatEnd.shot,
    );
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a beat end",
      slate.script,
    );
  else if (!slate.script.beats.some((beat) => beat.id === beatEnd.beat))
    pushViolation(
      violations,
      "type",
      "$input.beat",
      `beat "${beatEnd.beat}" must exist in the committed script`,
      beatEnd.beat,
    );
  const shot = slate.shots.find((entry) => entry.id === beatEnd.shot);
  if (shot === undefined)
    pushViolation(
      violations,
      "type",
      "$input.shot",
      `beat-end shot "${beatEnd.shot}" must be committed first`,
      beatEnd.shot,
    );
  const nodeIds =
    slate.scene === null
      ? null
      : new Set(slate.scene.nodes.map((node) => node.id));
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a beat end",
      slate.scene,
    );
  validateUniqueBy(
    beatEnd.actors.map((actor, index) => ({
      id: actor.node,
      path: `$input.actors[${index}].node`,
    })),
    "beat-end actor",
    violations,
  );
  beatEnd.actors.forEach((actor, i) => {
    const path = `$input.actors[${i}]`;
    validateNonEmptyId(actor.node, `${path}.node`, "actor node", violations);
    if (nodeIds !== null && !nodeIds.has(actor.node))
      pushViolation(
        violations,
        "type",
        `${path}.node`,
        `beat-end actor "${actor.node}" must reference a scene node`,
        actor.node,
      );
    validateTransformArtifact(
      actor.transform,
      `${path}.transform`,
      "beat-end actor transform",
      violations,
    );
    validateVectorArtifact(
      actor.facing,
      `${path}.facing`,
      "beat-end actor facing",
      violations,
    );
    validateRange(
      actor.localTime,
      `${path}.localTime`,
      0,
      shot?.duration ?? Infinity,
      "beat-end actor localTime",
      violations,
    );
    if (
      actor.motion !== null &&
      shot !== undefined &&
      !shot.performances.some(
        (performance) => performance.motion === actor.motion,
      )
    )
      pushViolation(
        violations,
        "type",
        `${path}.motion`,
        `beat-end actor motion "${actor.motion}" must reference the committed shot`,
        actor.motion,
      );
  });
};

const validateNotesArtifact = (
  notes: IAutoMovieReviewNote[],
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before review notes",
      slate.script,
    );
  const beatIds =
    slate.script === null
      ? null
      : new Set(slate.script.beats.map((beat) => beat.id));
  const shotIds = new Set(slate.shots.map((shot) => shot.id));
  notes.forEach((note, i) => {
    const path = `$input.notes[${i}]`;
    validateNonEmptyId(note.beat, `${path}.beat`, "note beat", violations);
    validateNonEmptyText(note.issue, `${path}.issue`, "note issue", violations);
    validateNonEmptyText(
      note.suggestion,
      `${path}.suggestion`,
      "note suggestion",
      violations,
    );
    if (beatIds !== null && !beatIds.has(note.beat))
      pushViolation(
        violations,
        "type",
        `${path}.beat`,
        `review note beat "${note.beat}" must exist in the committed script`,
        note.beat,
      );
    if (!shotIds.has(`shot:${note.beat}`))
      pushViolation(
        violations,
        "type",
        "$slate.shots",
        `review note beat "${note.beat}" must have a committed shot`,
        note.beat,
      );
  });
};

const validateFilmPreconditions = (
  film: IAutoMovieSequence,
  slate: IAutoMovieMcpWritableSlate,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateUniqueIds(
    slate.shots,
    "$slate.shots",
    "committed shot id",
    violations,
  );
  if (slate.script === null)
    pushViolation(
      violations,
      "type",
      "$slate.script",
      "a script must be committed before a film",
      slate.script,
    );
  if (slate.scene === null)
    pushViolation(
      violations,
      "type",
      "$slate.scene",
      "a scene must be committed before a film",
      slate.scene,
    );
  if (slate.notes.length > 0)
    pushViolation(
      violations,
      "type",
      "$slate.notes",
      "open review notes must be cleared before committing a film",
      slate.notes,
    );
  const sequenceShotIds = new Set(film.shots.map((entry) => entry.shot));
  if (slate.script !== null)
    slate.script.beats.forEach((beat, i) => {
      const shot = `shot:${beat.id}`;
      if (!slate.shots.some((entry) => entry.id === shot))
        pushViolation(
          violations,
          "type",
          "$slate.shots",
          `script beat "${beat.id}" must have a committed shot`,
          beat.id,
        );
      if (!sequenceShotIds.has(shot))
        pushViolation(
          violations,
          "type",
          "$input.shots",
          `sequence must include shot "${shot}" for script beat[${i}]`,
          shot,
        );
    });
  if (slate.scene !== null)
    slate.shots.forEach((shot, i) => {
      if (shot.scene !== slate.scene?.id)
        pushViolation(
          violations,
          "type",
          `$slate.shots[${i}].scene`,
          `committed shot scene must match scene "${slate.scene?.id}"`,
          shot.scene,
        );
    });
};

const shotBeatId = (shot: string): string | null => {
  if (!shot.startsWith("shot:")) return null;
  const beat = shot.slice("shot:".length);
  return beat.length === 0 ? null : beat;
};

const validateSceneArtifact = (
  scene: IAutoMovieScene,
  models: IAutoMovieMcpGeometryModel[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyId(scene.id, "$input.id", "scene id", violations);
  validateUniqueIds(scene.nodes, "$input.nodes", "scene node id", violations);
  validateUniqueIds(scene.cameras, "$input.cameras", "camera id", violations);
  validateUniqueIds(scene.lights, "$input.lights", "light id", violations);
  validateUniqueIds(models, "$models", "model id", violations);

  const modelIds = new Set(models.map((model) => model.id));
  scene.nodes.forEach((node, i) => {
    const path = `$input.nodes[${i}]`;
    validateNonEmptyId(node.id, `${path}.id`, "scene node id", violations);
    validateNonEmptyId(
      node.model,
      `${path}.model`,
      "scene node model",
      violations,
    );
    if (!modelIds.has(node.model))
      pushViolation(
        violations,
        "type",
        `${path}.model`,
        `scene node model "${node.model}" must reference an available model id`,
        node.model,
      );
    validateTransformArtifact(
      node.transform,
      `${path}.transform`,
      "scene node transform",
      violations,
    );
  });

  scene.cameras.forEach((camera, i) => {
    const path = `$input.cameras[${i}]`;
    validateNonEmptyId(camera.id, `${path}.id`, "camera id", violations);
    validateTransformArtifact(
      camera.transform,
      `${path}.transform`,
      "camera transform",
      violations,
    );
    validateRange(
      camera.fovY,
      `${path}.fovY`,
      0,
      180,
      "camera fovY",
      violations,
      false,
    );
    validateRange(
      camera.near,
      `${path}.near`,
      0,
      Infinity,
      "camera near",
      violations,
      false,
    );
    if (!Number.isFinite(camera.far) || camera.far <= camera.near)
      pushViolation(
        violations,
        "range",
        `${path}.far`,
        `camera far must be finite and greater than near (${camera.near}), but was ${camera.far}`,
        camera.far,
      );
  });

  scene.lights.forEach((light, i) => {
    const path = `$input.lights[${i}]`;
    validateNonEmptyId(light.id, `${path}.id`, "light id", violations);
    validateTransformArtifact(
      light.transform,
      `${path}.transform`,
      "light transform",
      violations,
    );
    validateColorArtifact(light.color, `${path}.color`, violations);
    validateRange(
      light.intensity,
      `${path}.intensity`,
      0,
      Infinity,
      "light intensity",
      violations,
    );
    if (light.type === "point" || light.type === "spot")
      validateRange(
        light.range,
        `${path}.range`,
        0,
        Infinity,
        "light range",
        violations,
      );
    if (light.type === "spot")
      validateRange(
        light.coneAngle,
        `${path}.coneAngle`,
        0,
        90,
        "spot coneAngle",
        violations,
        false,
      );
  });

  return toValidation(violations);
};

const validateShotArtifact = (
  shot: IAutoMovieShot,
  scene: IAutoMovieScene,
  motions: Record<string, IAutoMovieMcpMotion> | undefined,
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyId(shot.id, "$input.id", "shot id", violations);
  if (shot.scene !== scene.id)
    pushViolation(
      violations,
      "type",
      "$input.scene",
      `shot scene "${shot.scene}" must match scene "${scene.id}"`,
      shot.scene,
    );
  if (!scene.cameras.some((camera) => camera.id === shot.camera))
    pushViolation(
      violations,
      "type",
      "$input.camera",
      `shot camera "${shot.camera}" must reference a scene camera`,
      shot.camera,
    );
  validateRange(
    shot.duration,
    "$input.duration",
    0,
    Infinity,
    "shot duration",
    violations,
    false,
  );

  const nodeIds = new Set(scene.nodes.map((node) => node.id));
  const motionIds =
    motions === undefined
      ? null
      : new Set(Object.values(motions).map((motion) => motion.id));
  validateUniqueBy(
    shot.performances.map((performance, index) => ({
      id: performance.node,
      path: `$input.performances[${index}].node`,
    })),
    "shot performance node",
    violations,
  );
  shot.performances.forEach((performance, i) => {
    const path = `$input.performances[${i}]`;
    validateNonEmptyId(
      performance.node,
      `${path}.node`,
      "performance node",
      violations,
    );
    if (!nodeIds.has(performance.node))
      pushViolation(
        violations,
        "type",
        `${path}.node`,
        `performance node "${performance.node}" must reference a scene node`,
        performance.node,
      );
    validateRange(
      performance.startOffset,
      `${path}.startOffset`,
      0,
      shot.duration,
      "performance startOffset",
      violations,
    );
    if (performance.motion !== null) {
      validateNonEmptyId(
        performance.motion,
        `${path}.motion`,
        "performance motion",
        violations,
      );
      if (motionIds !== null && !motionIds.has(performance.motion))
        pushViolation(
          violations,
          "type",
          `${path}.motion`,
          `performance motion "${performance.motion}" must reference a compiled motion`,
          performance.motion,
        );
    }
  });

  if (shot.cameraMotion !== null)
    validateClipArtifact(shot.cameraMotion, "$input.cameraMotion", violations);
  validateUniqueIds(
    shot.objectMotions,
    "$input.objectMotions",
    "object motion clip id",
    violations,
  );
  shot.objectMotions.forEach((clip, i) =>
    validateClipArtifact(clip, `$input.objectMotions[${i}]`, violations),
  );

  return toValidation(violations);
};

const validateSequenceArtifact = (
  sequence: IAutoMovieSequence,
  shots: IAutoMovieShot[],
): IAutoMovieValidation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateNonEmptyId(sequence.id, "$input.id", "sequence id", violations);
  validateRange(
    sequence.fps,
    "$input.fps",
    0,
    Infinity,
    "sequence fps",
    violations,
    false,
  );
  validateUniqueIds(shots, "$shots", "shot id", violations);
  const shotsById = new Map(shots.map((shot) => [shot.id, shot]));

  sequence.shots.forEach((entry, i) => {
    const path = `$input.shots[${i}]`;
    validateNonEmptyId(entry.shot, `${path}.shot`, "sequence shot", violations);
    const shot = shotsById.get(entry.shot);
    if (shot === undefined)
      pushViolation(
        violations,
        "type",
        `${path}.shot`,
        `sequence shot "${entry.shot}" must reference an available shot`,
        entry.shot,
      );
    if (entry.trim !== null)
      validateTrim(
        entry.trim,
        shot?.duration ?? Infinity,
        `${path}.trim`,
        violations,
      );
    if (entry.transition !== null) {
      if (i === 0)
        pushViolation(
          violations,
          "temporal",
          `${path}.transition`,
          "the first sequence entry cannot have an incoming transition",
          entry.transition,
        );
      validateTransition(entry.transition, `${path}.transition`, violations);
      const current = entryDuration(entry, shot);
      const previousEntry = sequence.shots[i - 1];
      const previous =
        previousEntry === undefined
          ? null
          : entryDuration(previousEntry, shotsById.get(previousEntry.shot));
      if (
        previous !== null &&
        current !== null &&
        entry.transition.duration > Math.min(previous, current)
      )
        pushViolation(
          violations,
          "temporal",
          `${path}.transition.duration`,
          `transition duration must fit adjacent entries, but was ${entry.transition.duration}`,
          entry.transition.duration,
        );
    }
  });

  return toValidation(violations);
};

const validateClipArtifact = (
  clip: IAutoMovieClip,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateNonEmptyId(clip.id, `${path}.id`, "clip id", violations);
  validateRange(
    clip.duration,
    `${path}.duration`,
    0,
    Infinity,
    "clip duration",
    violations,
    false,
  );
  validateUniqueBy(
    clip.tracks.map((track, index) => ({
      id: `${track.channel.kind}:${JSON.stringify(track.channel)}`,
      path: `${path}.tracks[${index}].channel`,
    })),
    "clip track channel",
    violations,
  );
  clip.tracks.forEach((track, i) => {
    const trackPath = `${path}.tracks[${i}]`;
    validateIncreasingTimes(
      track.times,
      clip.duration,
      `${trackPath}.times`,
      violations,
    );
    track.values.forEach((value, j) => {
      if (!Number.isFinite(value))
        pushViolation(
          violations,
          "range",
          `${trackPath}.values[${j}]`,
          `track value must be finite, but was ${value}`,
          value,
        );
    });
  });
};

const validateTrim = (
  trim: NonNullable<IAutoMovieSequence["shots"][number]["trim"]>,
  shotDuration: number,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateRange(
    trim.start,
    `${path}.start`,
    0,
    Infinity,
    "trim start",
    violations,
  );
  validateRange(
    trim.duration,
    `${path}.duration`,
    0,
    Infinity,
    "trim duration",
    violations,
    false,
  );
  if (
    Number.isFinite(shotDuration) &&
    Number.isFinite(trim.start) &&
    Number.isFinite(trim.duration) &&
    trim.start + trim.duration > shotDuration
  )
    pushViolation(
      violations,
      "temporal",
      path,
      `trim start + duration must fit within shot duration ${shotDuration}`,
      trim,
    );
};

const validateTransition = (
  transition: NonNullable<IAutoMovieSequence["shots"][number]["transition"]>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void =>
  validateRange(
    transition.duration,
    `${path}.duration`,
    0,
    Infinity,
    "transition duration",
    violations,
    false,
  );

const entryDuration = (
  entry: IAutoMovieSequence["shots"][number],
  shot: IAutoMovieShot | undefined,
): number | null => {
  if (shot === undefined) return null;
  return entry.trim?.duration ?? shot.duration;
};

const validateIncreasingTimes = (
  times: number[],
  duration: number,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  let previous = -Infinity;
  times.forEach((time, i) => {
    if (!Number.isFinite(time) || time < 0 || time > duration)
      pushViolation(
        violations,
        "temporal",
        `${path}[${i}]`,
        `track time must be finite and within [0, ${duration}], but was ${time}`,
        time,
      );
    if (Number.isFinite(time) && time <= previous)
      pushViolation(
        violations,
        "temporal",
        `${path}[${i}]`,
        `track times must strictly increase; ${time} is not greater than ${previous}`,
        time,
      );
    if (Number.isFinite(time)) previous = time;
  });
};

const validateUniqueIds = <T extends { id: string }>(
  items: T[],
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void =>
  validateUniqueBy(
    items.map((item, index) => ({ id: item.id, path: `${path}[${index}].id` })),
    label,
    violations,
  );

const validateUniqueBy = (
  entries: { id: string; path: string }[],
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id))
      pushViolation(
        violations,
        "type",
        entry.path,
        `${label} "${entry.id}" must be unique`,
        entry.id,
      );
    seen.add(entry.id);
  }
};

const validateNonEmptyId = (
  id: string,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (id.trim().length === 0)
    pushViolation(
      violations,
      "type",
      path,
      `${label} must be a non-empty id`,
      id,
    );
};

const validateNonEmptyText = (
  text: string,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (text.trim().length === 0)
    pushViolation(
      violations,
      "type",
      path,
      `${label} must be non-empty text`,
      text,
    );
};

const validateTransformArtifact = (
  transform: IAutoMovieTransform,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  validateVectorArtifact(
    transform.translation,
    `${path}.translation`,
    `${label} translation`,
    violations,
  );
  validateQuaternionArtifact(
    transform.rotation,
    `${path}.rotation`,
    `${label} rotation`,
    violations,
  );
  validateVectorArtifact(
    transform.scale,
    `${path}.scale`,
    `${label} scale`,
    violations,
  );
  for (const axis of ["x", "y", "z"] as const)
    if (transform.scale[axis] <= 0)
      pushViolation(
        violations,
        "range",
        `${path}.scale.${axis}`,
        `${label} scale component must be > 0, but was ${transform.scale[axis]}`,
        transform.scale[axis],
      );
};

const validateVectorArtifact = (
  vector: IAutoMovieVector3,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(vector[axis]))
      pushViolation(
        violations,
        "range",
        `${path}.${axis}`,
        `${label} component must be finite, but was ${vector[axis]}`,
        vector[axis],
      );
};

const validateQuaternionArtifact = (
  quaternion: IAutoMovieQuaternion,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  for (const axis of ["x", "y", "z", "w"] as const)
    if (!Number.isFinite(quaternion[axis]))
      pushViolation(
        violations,
        "range",
        `${path}.${axis}`,
        `${label} component must be finite, but was ${quaternion[axis]}`,
        quaternion[axis],
      );
};

const validateColorArtifact = (
  color: IAutoMovieScene["lights"][number]["color"],
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  for (const channel of ["r", "g", "b"] as const)
    validateRange(
      color[channel],
      `${path}.${channel}`,
      0,
      1,
      channel,
      violations,
    );
  if (color.a !== null)
    validateRange(color.a, `${path}.a`, 0, 1, "alpha", violations);
};

const validateRange = (
  value: number,
  path: string,
  min: number,
  max: number,
  label: string,
  violations: IAutoMovieConstraintViolation[],
  inclusiveMin = true,
): void => {
  const aboveMin = inclusiveMin ? value >= min : value > min;
  const belowMax = max === Infinity ? true : value <= max;
  if (!Number.isFinite(value) || !aboveMin || !belowMax)
    pushViolation(
      violations,
      "range",
      path,
      max === Infinity
        ? `${label} must be finite and ${inclusiveMin ? ">=" : ">"} ${min}, but was ${value}`
        : `${label} must be finite and within ${inclusiveMin ? "[" : "("}${min}, ${max}], but was ${value}`,
      value,
    );
};

const pushViolation = (
  violations: IAutoMovieConstraintViolation[],
  kind: IAutoMovieConstraintViolation["kind"],
  path: string,
  expected: string,
  value: unknown,
): void => {
  violations.push(violation(kind, path, expected, value));
};

/**
 * Stored slate slices accepted by MCP query tools.
 *
 * This is narrower than the full production slate so query schemas stay small:
 * film assembly is not needed to read script, scene, shots, notes, or beat-end
 * state.
 */
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
