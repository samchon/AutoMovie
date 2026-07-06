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
} from "@automovie/engine";
import {
  AutoMovieEasing,
  AutoMovieHumanoidBone,
  IAutoMovieActionTarget,
  IAutoMovieAssembleApplication,
  IAutoMovieBeatEndState,
  IAutoMovieBlockingApplication,
  IAutoMovieConstraintViolation,
  IAutoMovieExpression,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMovieGaitRootBob,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieSlate,
  IAutoMovieStagingApplication,
  IAutoMovieTransform,
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
