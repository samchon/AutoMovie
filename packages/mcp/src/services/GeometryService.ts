import {
  HUMANOID_JOINT_AXES,
  IAutoMovieStagedSet,
  POSITIONAL_TARGET_SHAPE,
  Quaternion,
  Vector3,
  positionalTargetFault,
  reachPose,
  resolveBeatEnd,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  IAutoMovieActionTarget,
  IAutoMovieConstraintViolation,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEngineMotion } from "../convert";
import {
  IAutoMovieGetReachOutput,
  IAutoMovieGetResolvedPoseOutput,
  IAutoMovieGetShotEndStateOutput,
  IAutoMovieMcpArmReach,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpResolvedPose,
  IAutoMovieMeasureDistanceOutput,
} from "../dto";
import { shotIdOf } from "../project/shotKey";
import {
  appendMotionClockShape,
  pushViolation,
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateTransformArtifact,
} from "../validators/primitives";
import { resolveRuntimeSafeTargetPoint } from "./actionTargets";

/**
 * Engine geometry queries, resolved poses, reach reports, and distance
 * measurements over the narrow geometry context. The MCP contract lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class GeometryService {
  public constructor(private readonly context: AutoMovieContext) {}

  public getResolvedPose(props: {
    context?: IAutoMovieMcpGeometryContext;
    actor: string;
    beat?: string;
    t?: number;
  }): IAutoMovieGetResolvedPoseOutput {
    assertGeometryRequestRoot(props);
    assertGeometryActor(props.actor);
    const beat = resolveOptionalGeometryBeat(props.beat);
    const t = resolveResolvedPoseTime(props.t);
    const source = this.resolveGeometryContext(
      props.context,
      beat,
      "getResolvedPose",
    );
    assertGeometryContextShape(source.context, source.root);
    return resolveActorGeometry(
      source.context,
      props.actor,
      t,
      source.root,
      source.resident ? { caller: "getResolvedPose" } : undefined,
      source.actorRigs,
    );
  }

  public getReach(props: {
    context?: IAutoMovieMcpGeometryContext;
    actor: string;
    target: IAutoMovieActionTarget;
  }): IAutoMovieGetReachOutput {
    assertGeometryRequestRoot(props);
    assertGeometryActor(props.actor);
    const source = this.resolveGeometryContext(
      props.context,
      undefined,
      "getReach",
    );
    assertGeometryContextShape(source.context, source.root);
    const found = findActorRig(
      source.context,
      props.actor,
      source.root,
      source.resident ? { caller: "getReach" } : undefined,
      source.actorRigs,
    );
    if (found.actor === null) return { reach: null, reason: found.reason };
    const actor = found.actor;
    const target = resolveRuntimeSafeTargetPoint(
      props.target,
      nodePositions(source.context.scene, `${source.root}.scene`),
    );
    if (target === null)
      return {
        reach: null,
        reason: unresolvedTargetReason(null, props.target),
      };
    const localTarget = toModelPoint(target, actor.node.transform);
    if (localTarget === null)
      return {
        reach: null,
        reason: `actor "${props.actor}" has a degenerate node scale; its transform cannot drop the target into model space`,
      };
    const left = measureArmReach(actor.skeleton, "left", localTarget);
    const right = measureArmReach(actor.skeleton, "right", localTarget);
    // A rig with no measurable arm chain on EITHER side is unmeasurable, not
    // unreachable (#1097): answering `reachable: false` with `reason: null`
    // reads as a confident geometric verdict when no measurement happened.
    if (left === null && right === null)
      return {
        reach: null,
        reason: `actor "${props.actor}" has no measurable arm chain (upper arm, lower arm, and hand bones with non-degenerate lengths) on either side; reach cannot be measured`,
      };
    return {
      reach: {
        actor: props.actor,
        target,
        left,
        right,
        reachable: Boolean(left?.reachable || right?.reachable),
      },
      reason: null,
    };
  }

  public getShotEndState(props: {
    context?: IAutoMovieMcpGeometryContext;
    beat: string;
    mounts?: IAutoMovieStagedSet.IMount[];
  }): IAutoMovieGetShotEndStateOutput {
    assertGeometryRequestRoot(props);
    assertRequiredGeometryBeat(props.beat);
    const source = this.resolveGeometryContext(
      props.context,
      props.beat,
      "getShotEndState",
    );
    assertGeometryContextShape(source.context, source.root);
    const shot = source.context.shot;
    if (shot === undefined || shot === null)
      return {
        beatEnd: null,
        reason: `no shot for beat "${props.beat}", pass context.shot explicitly or commit the beat's shot first`,
      };
    // The registry this is about to sample, gated the same way `getResolvedPose`
    // gates it (through `findMotion`). This method reaches `resolveBeatEnd` ->
    // `sampleMotion` WITHOUT that lookup, and the context shape gate above
    // covers scene, models, and shot but not motions, so the clip floor #1322
    // added was reachable from one geometry query and not the other (#1328).
    // Structural, so it throws like every other shape fault in this service,
    // and it runs outside the try below: an unsampleable clip is not an
    // authored-data reason, it is a malformed context.
    assertGeometryMotionRegistryShape(
      source.context.motions,
      `${source.root}.motions`,
    );
    // The remaining engine contracts (duplicate motion ids, duplicated
    // performances/mounts) are authored-data faults a read-only derivation
    // reports as a reason, not a raw throw across the boundary (#990).
    try {
      return {
        reason: null,
        beatEnd: resolveBeatEnd({
          beat: props.beat,
          scene: source.context.scene,
          shot,
          motions: Object.values(source.context.motions).map(toEngineMotion),
          mounts: props.mounts,
        }),
      };
    } catch (error) {
      return { beatEnd: null, reason: String((error as Error).message) };
    }
  }

  public measureDistance(props: {
    scene?: IAutoMovieScene;
    from: IAutoMovieActionTarget;
    to: IAutoMovieActionTarget;
  }): IAutoMovieMeasureDistanceOutput {
    assertGeometryRequestRoot(props);
    const source = this.resolveScene(props.scene, "measureDistance");
    assertGeometrySceneShape(source.scene, source.root);
    const nodes = nodePositions(source.scene, source.root);
    const from = resolveRuntimeSafeTargetPoint(props.from, nodes);
    const to = resolveRuntimeSafeTargetPoint(props.to, nodes);
    // One clause per unresolved SIDE, each naming its own fault: merging them
    // into one sentence made a `from` that named an unplaced id and a `to` that
    // was a heading read as the same problem.
    const missing = [
      ...(from === null ? [["from", props.from] as const] : []),
      ...(to === null ? [["to", props.to] as const] : []),
    ];
    return {
      reason:
        missing.length === 0
          ? null
          : missing
              .map(([side, target]) => unresolvedTargetReason(side, target))
              .join("; "),
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

  private resolveScene(
    scene: IAutoMovieScene | undefined,
    caller: string,
  ): GeometrySceneSource {
    if (scene !== undefined) return { scene, root: "$input.scene" };
    const project = this.context.requireProject(caller);
    const stored = project.storedSlate();
    if (stored.scene === null)
      throw new Error(
        `${caller} was called without a scene, but the resident project has no committed scene. Commit a scene first or pass scene explicitly.`,
      );
    // storedSlate validates scene.json before returning the resident scene.
    // `$slate.scene` matches the commit/render services' resident addressing
    // (#995): the resident scene IS the stored slate's scene slice.
    return { scene: stored.scene, root: "$slate.scene" };
  }

  private resolveGeometryContext(
    context: IAutoMovieMcpGeometryContext | undefined,
    beat: string | undefined,
    caller: string,
  ): GeometryContextSource {
    if (context !== undefined)
      return { context, resident: false, root: "$input.context" };
    const project = this.context.requireProject(caller);
    const slate = project.writableSlate();
    if (slate.scene === null)
      throw new Error(
        `${caller} was called without a context, but the resident project has no committed scene. Commit a scene first or pass context explicitly.`,
      );
    // writableSlate reaches the scene through the same validated stored read.
    // Beat-scoped motion memory (#1091): the queried beat's own snapshot, so
    // `perform:<actor>` ids never resolve to another beat's clip.
    const memory = this.context.geometryMemory(beat);
    // Persisted cast rigs (actors/<node>.json, #1176) stay keyed by their OWN
    // node, so a REOPENED project resolves rest/ambient cast poses without a
    // destructive commitScene re-run (#1229) AND each actor resolves its own
    // rig. They are deliberately NOT merged into the model set: a rig is
    // per-actor while a model id is shared, so re-keying them by `node.model`
    // silently gave every cast node on one `modelRef` a single arbitrary rig
    // (#1244). `findActorRig` consults this map per actor instead.
    const actorRigs = new Map(
      project
        .storedActors()
        .flatMap((spec) =>
          spec.rig === undefined ? [] : [[spec.node, spec.rig] as const],
        ),
    );
    const models = mergeResidentModels([
      ...memory.models,
      ...project.storedProps().map((prop) => ({
        id: prop.model.id,
        skeleton: prop.model.skeleton,
      })),
    ]);
    return {
      resident: true,
      actorRigs,
      // `$context` (not `$slate...`): the geometry context is assembled from
      // the stored scene plus session rig/motion memory, so a slate-slice
      // root would misaddress the memory-backed parts (#995).
      root: "$context",
      context: {
        scene: slate.scene,
        models,
        motions: memory.motions,
        shot:
          beat === undefined
            ? null
            : (slate.shots.find((shot) => shot.id === shotIdOf(beat)) ?? null),
      },
    };
  }
}

type GeometryContextSource = {
  context: IAutoMovieMcpGeometryContext;
  resident: boolean;
  root: string;
  /** Persisted per-actor rigs; resident-only (#1244). See {@link findActorRig}. */
  actorRigs?: ReadonlyMap<string, IAutoMovieSkeleton>;
};

type GeometrySceneSource = {
  scene: IAutoMovieScene;
  root: string;
};

type GeometryActor = {
  node: IAutoMovieScene["nodes"][number];
  model: IAutoMovieMcpGeometryModel;
  skeleton: IAutoMovieSkeleton;
};

const assertRequiredGeometryBeat = (beat: unknown): void => {
  if (typeof beat === "string" && beat.trim().length > 0) return;
  throw new Error(
    "geometry query beat at $input.beat must be a non-empty string",
  );
};

const assertGeometryRequestRoot = (props: unknown): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateObjectArtifact(props, "$input", "geometry query request", violations);
  assertNoGeometryViolations(violations);
};

function assertGeometryActor(actor: unknown): asserts actor is string {
  if (typeof actor === "string" && actor.trim().length > 0) return;
  throw new Error(
    "geometry query actor at $input.actor must be a non-empty string",
  );
}

const resolveOptionalGeometryBeat = (beat: unknown): string | undefined => {
  if (beat === undefined) return undefined;
  if (typeof beat === "string" && beat.trim().length > 0) return beat;
  throw new Error(
    "geometry query beat at $input.beat must be a non-empty string",
  );
};

const resolveResolvedPoseTime = (t: unknown): number => {
  if (t === undefined) return 0;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  throw new Error(
    `range at $input.t: resolved pose sample time must be a finite number, but was ${String(
      t,
    )}`,
  );
};

/**
 * Why a geometry query could not turn a target into a world point, in the
 * engine's own words ({@link positionalTargetFault}).
 *
 * One vocabulary, two rungs: the perform gate learned in #1294 that blaming the
 * discriminator of a kind the same sentence lists as legal leaves the
 * correction round nothing to act on. The geometry queries kept answering "not
 * positional" for EVERY failure, so a `node` target naming an unplaced id, or a
 * camera the table did not carry, was reported as the one thing it demonstrably
 * was not.
 *
 * `side` names which endpoint failed on the two-sided distance measurement, and
 * is `null` for a single-target query.
 */
const unresolvedTargetReason = (
  side: "from" | "to" | null,
  target: unknown,
): string =>
  `the ${side === null ? "" : `${side} `}target must resolve to a point (${POSITIONAL_TARGET_SHAPE}), but ${positionalTargetFault(target)}`;

const describeViolations = (
  violations: IAutoMovieConstraintViolation[],
): string =>
  violations
    .slice(0, 5)
    .map(
      (violation) =>
        `${violation.kind} at ${violation.path}: ${violation.expected}`,
    )
    .join("; ") +
  (violations.length > 5 ? `; +${violations.length - 5} more` : "");

const resolveActorGeometry = (
  context: IAutoMovieMcpGeometryContext,
  actor: string,
  t: number,
  root: string,
  contract?: ResidentGeometryContract,
  actorRigs?: ReadonlyMap<string, IAutoMovieSkeleton>,
): {
  resolvedPose: IAutoMovieMcpResolvedPose | null;
  reason: string | null;
} => {
  // getResolvedPose is the only caller and resolves t through the finite gate.
  const found = findActorRig(context, actor, root, contract, actorRigs);
  if (found.actor === null) return { resolvedPose: null, reason: found.reason };
  const actorRig = found.actor;
  const state = resolveActorPose(
    context,
    actorRig.node,
    actorRig.skeleton,
    t,
    root,
    contract,
  );
  if (state.pose === null) return { resolvedPose: null, reason: state.reason };
  return {
    reason: null,
    resolvedPose: {
      node: actor,
      model: actorRig.model.id,
      motion: state.motion,
      t,
      pose: state.pose,
      bones: resolvePose(
        state.pose,
        actorRig.skeleton,
        HUMANOID_JOINT_AXES,
      ).map((bone) => ({
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
      })),
    },
  };
};

const resolveActorPose = (
  context: IAutoMovieMcpGeometryContext,
  node: IAutoMovieScene["nodes"][number],
  skeleton: IAutoMovieSkeleton,
  t: number,
  root: string,
  contract?: ResidentGeometryContract,
): {
  motion: string | null;
  pose: IAutoMoviePose | null;
  reason: string | null;
} => {
  const performance =
    context.shot === undefined || context.shot === null
      ? null
      : findShotPerformance(context.shot, node.id, `${root}.shot.performances`);
  const motionId = performance === null ? node.motion : performance.motion;
  if (motionId !== null) {
    const motion = findMotion(context, motionId, `${root}.motions`);
    if (motion === null && contract !== undefined)
      throw new Error(
        `${contract.caller} cannot sample resident motion "${motionId}" for actor "${node.id}". Project files persist shot motion ids, not compiled motion clips; call commitShot with motions in this application session or pass context explicitly.`,
      );
    if (motion === null)
      return {
        motion: motionId,
        pose: null,
        reason: `motion "${motionId}" for actor "${node.id}" is not in the motions registry, add it to context.motions or fix the reference`,
      };
    return {
      reason: null,
      motion: motionId,
      pose: sampleMotion(
        toEngineMotion(motion),
        t - (performance?.startOffset ?? 0),
      ).pose,
    };
  }
  return {
    reason: null,
    motion: null,
    pose: node.pose ?? { skeleton: skeleton.id, root: null, joints: [] },
  };
};

const findActorRig = (
  context: IAutoMovieMcpGeometryContext,
  actor: string,
  root: string,
  contract?: ResidentGeometryContract,
  /**
   * Persisted `actors/<node>.json` rigs, keyed by their OWN node (#1244). A rig
   * is per-actor, so it must never be re-keyed into the model namespace: cast
   * nodes may share one `modelRef` (a crowd from one VRM), and a model-keyed
   * merge would silently resolve every one of them against a single arbitrary
   * rig. Resident-only; the explicit-context path has no persisted store.
   */
  actorRigs?: ReadonlyMap<string, IAutoMovieSkeleton>,
): { actor: GeometryActor | null; reason: string | null } => {
  const node = findSceneNode(context.scene, actor, `${root}.scene.nodes`);
  if (node === null)
    return {
      actor: null,
      reason: `actor "${actor}" is not a scene node, check the scene's node ids`,
    };
  const model = findGeometryModel(context.models, node.model, `${root}.models`);
  // Session memory stays authoritative only when it CARRIES a rig: a
  // `commitScene` model with `skeleton: null` is the ABSENCE of a rig, not a
  // rig, so it must not mask the actor's own persisted one (#1244), otherwise
  // the session that just wrote the rig resolves worse than a reopened project.
  const sessionSkeleton = model?.skeleton ?? null;
  const persisted = actorRigs?.get(actor);
  const skeleton = sessionSkeleton ?? persisted ?? null;
  if (skeleton === null && contract !== undefined)
    throw new Error(
      `${contract.caller} cannot resolve a rig for actor "${actor}" (model "${node.model}"). Project files persist the scene and each performed actor's rig; run a resident perform with this actor's rig (or commitScene with skeletal models) in this session, or pass context explicitly.`,
    );
  if (model === null && skeleton === null)
    return {
      actor: null,
      reason: `actor "${actor}" places model "${node.model}", which is not in the models list`,
    };
  if (skeleton === null)
    return {
      actor: null,
      reason: `model "${node.model}" carries no skeleton, rig queries need a skeletal model`,
    };
  return {
    actor: { node, model: model ?? { id: node.model, skeleton }, skeleton },
    reason: null,
  };
};

type ResidentGeometryContract = {
  caller: string;
};

const mergeResidentModels = (
  models: IAutoMovieMcpGeometryModel[],
): IAutoMovieMcpGeometryModel[] => [
  ...new Map(models.map((model) => [model.id, model])).values(),
];

const findSceneNode = (
  scene: IAutoMovieScene,
  id: string,
  path: string,
): IAutoMovieScene["nodes"][number] | null => {
  const matches = scene.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.id === id);
  if (matches.length > 1)
    throw new Error(
      `scene node "${id}" is duplicated at ${path}[${matches[1]!.index}].id`,
    );
  return matches[0]?.node ?? null;
};

const findGeometryModel = (
  models: IAutoMovieMcpGeometryModel[],
  id: string,
  path: string,
): IAutoMovieMcpGeometryModel | null => {
  const matches = models
    .map((model, index) => ({ model, index }))
    .filter(({ model }) => model.id === id);
  if (matches.length > 1)
    throw new Error(
      `geometry model "${id}" is duplicated at ${path}[${matches[1]!.index}].id`,
    );
  return matches[0]?.model ?? null;
};

const findShotPerformance = (
  shot: IAutoMovieShot,
  node: string,
  path: string,
): IAutoMovieShot["performances"][number] | null => {
  const matches = shot.performances
    .map((performance, index) => ({ performance, index }))
    .filter(({ performance }) => performance.node === node);
  if (matches.length > 1)
    throw new Error(
      `shot performance for "${node}" is duplicated at ${path}[${matches[1]!.index}].node`,
    );
  return matches[0]?.performance ?? null;
};

const findMotion = (
  context: IAutoMovieMcpGeometryContext,
  id: string,
  path: string,
): IAutoMovieMcpMotion | null => {
  assertGeometryMotionRegistryShape(context.motions, path);
  const entries = Object.entries(
    context.motions as Record<string, IAutoMovieMcpMotion>,
  )
    .map(([key, motion]) => ({ key, motion }))
    .filter(({ motion }) => motion.id === id);
  if (entries.length > 1)
    throw new Error(
      `motion "${id}" is duplicated at ${path}.${entries[1]!.key}.id`,
    );
  return entries[0]?.motion ?? null;
};

const assertGeometryContextShape = (context: unknown, path: string): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(context, path, "context", violations))
    return assertNoGeometryViolations(violations);
  appendGeometrySceneShape(context.scene, `${path}.scene`, violations);
  appendGeometryModelsShape(context.models, `${path}.models`, violations);
  const shot = context.shot;
  if (shot === null || shot === undefined)
    return assertNoGeometryViolations(violations);
  if (!validateObjectArtifact(shot, `${path}.shot`, "context shot", violations))
    return assertNoGeometryViolations(violations);
  appendGeometryShotShape(shot, `${path}.shot`, violations);
  assertNoGeometryViolations(violations);
};

const assertGeometrySceneShape = (scene: unknown, path: string): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  appendGeometrySceneShape(scene, path, violations);
  assertNoGeometryViolations(violations);
};

const appendGeometrySceneShape = (
  scene: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(scene, path, "scene", violations)) return;
  // The placement table now reads `scene.cameras` too (#1294 symmetry), so the
  // camera list needs the same structural floor the node list has: without it a
  // hand-built context throws a TypeError out of `nodePositions` instead of
  // refusing with a located violation (#1005/#1007).
  if (
    validateArrayArtifact(
      scene.cameras,
      `${path}.cameras`,
      "scene cameras",
      violations,
    )
  )
    scene.cameras.forEach((camera, index) => {
      const cameraPath = `${path}.cameras[${index}]`;
      if (
        !validateObjectArtifact(camera, cameraPath, "scene camera", violations)
      )
        return;
      validateNonEmptyId(
        camera.id,
        `${cameraPath}.id`,
        "scene camera id",
        violations,
      );
      validateTransformArtifact(
        camera.transform,
        `${cameraPath}.transform`,
        "scene camera transform",
        violations,
      );
    });
  if (
    !validateArrayArtifact(
      scene.nodes,
      `${path}.nodes`,
      "scene nodes",
      violations,
    )
  )
    return;
  scene.nodes.forEach((node, index) =>
    appendGeometrySceneNodeShape(node, `${path}.nodes[${index}]`, violations),
  );
};

const appendGeometrySceneNodeShape = (
  node: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(node, path, "scene node", violations)) return;
  validateNonEmptyId(node.id, `${path}.id`, "scene node id", violations);
  validateNonEmptyId(
    node.model,
    `${path}.model`,
    "scene node model",
    violations,
  );
  validateTransformArtifact(
    node.transform,
    `${path}.transform`,
    "scene node transform",
    violations,
  );
  // A present non-null pose is dereferenced by resolvePose (#1007); absent or
  // null falls back to the rest pose and never crashes.
  if (node.pose !== null && node.pose !== undefined)
    appendGeometryPoseShape(node.pose, `${path}.pose`, violations);
};

const appendGeometryModelsShape = (
  models: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateArrayArtifact(models, path, "geometry models", violations))
    return;
  models.forEach((model, index) => {
    const modelPath = `${path}[${index}]`;
    if (!validateObjectArtifact(model, modelPath, "geometry model", violations))
      return;
    validateNonEmptyId(
      model.id,
      `${modelPath}.id`,
      "geometry model id",
      violations,
    );
    if (model.skeleton !== null)
      appendGeometrySkeletonShape(
        model.skeleton,
        `${modelPath}.skeleton`,
        violations,
      );
  });
};

const appendGeometrySkeletonShape = (
  skeleton: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (
    !validateObjectArtifact(
      skeleton,
      path,
      "geometry model skeleton",
      violations,
    )
  )
    return;
  validateNonEmptyId(skeleton.id, `${path}.id`, "skeleton id", violations);
  if (
    !validateArrayArtifact(
      skeleton.bones,
      `${path}.bones`,
      "skeleton bones",
      violations,
    )
  )
    return;
  skeleton.bones.forEach((bone, index) => {
    const bonePath = `${path}.bones[${index}]`;
    if (!validateObjectArtifact(bone, bonePath, "skeleton bone", violations))
      return;
    validateNonEmptyId(
      bone.bone,
      `${bonePath}.bone`,
      "skeleton bone",
      violations,
    );
    if (bone.parent !== null)
      validateNonEmptyId(
        bone.parent,
        `${bonePath}.parent`,
        "skeleton bone parent",
        violations,
      );
    validateTransformArtifact(
      bone.rest,
      `${bonePath}.rest`,
      "skeleton bone rest transform",
      violations,
    );
  });
};

const appendGeometryShotShape = (
  shot: Record<string, unknown>,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (
    !validateArrayArtifact(
      shot.performances,
      `${path}.performances`,
      "shot performances",
      violations,
    )
  )
    return;
  shot.performances.forEach((performance, index) => {
    const performancePath = `${path}.performances[${index}]`;
    if (
      !validateObjectArtifact(
        performance,
        performancePath,
        "shot performance",
        violations,
      )
    )
      return;
    validateNonEmptyId(
      performance.node,
      `${performancePath}.node`,
      "shot performance node",
      violations,
    );
    if (performance.motion !== null)
      validateNonEmptyId(
        performance.motion,
        `${performancePath}.motion`,
        "shot performance motion",
        violations,
      );
  });
};

const assertGeometryMotionRegistryShape = (
  motions: unknown,
  path: string,
): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  appendGeometryMotionRegistryShape(motions, path, violations);
  assertNoGeometryViolations(violations);
};

const appendGeometryMotionRegistryShape = (
  motions: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(motions, path, "motion registry", violations))
    return;
  Object.entries(motions).forEach(([key, motion]) =>
    appendGeometryMotionShape(motion, `${path}.${key}`, violations),
  );
};

const appendGeometryMotionShape = (
  motion: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (
    !validateObjectArtifact(motion, path, "motion registry entry", violations)
  )
    return;
  validateNonEmptyId(motion.id, `${path}.id`, "motion id", violations);
  if (
    !validateArrayArtifact(
      motion.keyframes,
      `${path}.keyframes`,
      "motion keyframes",
      violations,
    )
  )
    return;
  // sampleMotion throws a pathless error on an empty clip (#1007); rough
  // types forbid MinItems, so the gate is the only structured diagnosis.
  if (motion.keyframes.length === 0)
    pushViolation(
      violations,
      "type",
      `${path}.keyframes`,
      "motion must carry at least one keyframe to sample",
      motion.keyframes,
    );
  motion.keyframes.forEach((keyframe, index) =>
    appendGeometryMotionKeyframeShape(
      keyframe,
      `${path}.keyframes[${index}]`,
      violations,
    ),
  );
  // And the ORDER, which no single keyframe can show: the sampler's binary
  // search assumes a positive span between neighbours, so equal or descending
  // times interpolate across a zero or negative one. One definition, shared
  // with every other entry point that hands host motions to `sampleMotion`
  // (#1328).
  appendMotionClockShape(motion.keyframes, `${path}.keyframes`, violations);
};

const appendGeometryMotionKeyframeShape = (
  keyframe: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(keyframe, path, "motion keyframe", violations))
    return;
  // The clock `sampleMotion` orders the clip by. Its own comment names the
  // precondition ("strictly increasing keyframe times, the contract
  // validateMotion enforces"), and nothing establishes that here: a geometry
  // context's motions are host-supplied and never see validateMotion. A
  // non-finite time makes every comparison in the sampler's search false, so
  // the span is NaN and the interpolated pose is NaN, which `getResolvedPose`
  // then reports with `reason: null` (#1322). The sibling floor for `enact`
  // clips already requires this; the two disagreed about this one field.
  if (typeof keyframe.time !== "number" || !Number.isFinite(keyframe.time))
    pushViolation(
      violations,
      "range",
      `${path}.time`,
      `motion keyframe time must be a finite number of seconds, but was ${String(keyframe.time)}`,
      keyframe.time,
    );
  appendGeometryPoseShape(keyframe.pose, `${path}.pose`, violations);
  const bezier = keyframe.bezier;
  if (bezier !== null) {
    if (
      !validateObjectArtifact(
        bezier,
        `${path}.bezier`,
        "motion keyframe bezier",
        violations,
      )
    )
      return;
    // cubicBezierEasing throws on non-finite control points (#1007).
    for (const control of ["x1", "y1", "x2", "y2"] as const)
      if (!Number.isFinite(bezier[control]))
        pushViolation(
          violations,
          "range",
          `${path}.bezier.${control}`,
          `motion keyframe bezier ${control} must be finite, but was ${String(bezier[control])}`,
          bezier[control],
        );
  }
};

const GEOMETRY_JOINT_AXES = ["flexion", "abduction", "twist"] as const;

const appendGeometryPoseShape = (
  pose: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(pose, path, "motion keyframe pose", violations))
    return;
  if (pose.root !== null)
    validateTransformArtifact(
      pose.root,
      `${path}.root`,
      "motion keyframe pose root",
      violations,
    );
  if (
    !validateArrayArtifact(
      pose.joints,
      `${path}.joints`,
      "pose joints",
      violations,
    )
  )
    return;
  // jointToQuaternion throws on non-finite non-null angles (#1007).
  pose.joints.forEach((joint, index) => {
    const jointPath = `${path}.joints[${index}]`;
    if (!validateObjectArtifact(joint, jointPath, "pose joint", violations))
      return;
    validateNonEmptyId(
      joint.bone,
      `${jointPath}.bone`,
      "pose joint bone",
      violations,
    );
    for (const axis of GEOMETRY_JOINT_AXES) {
      const angle = joint[axis];
      if (angle !== null && !Number.isFinite(angle))
        pushViolation(
          violations,
          "range",
          `${jointPath}.${axis}`,
          `pose joint ${axis} must be finite or null, but was ${String(angle)}`,
          angle,
        );
    }
  });
};

const assertNoGeometryViolations = (
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (violations.length > 0) throw new Error(describeViolations(violations));
};

/**
 * Every staged thing a geometry query may address by id: the scene's nodes AND
 * its cameras, the same table `scenePlacements` gives the perform gate (#1294).
 * Measuring the distance to a lens, or asking whether an arm reaches it, is the
 * read the guide's "face the camera" idiom already relies on; answering it only
 * for nodes made one rung refuse what the next accepts.
 *
 * Cameras are laid down FIRST, `scenePlacements`' precedence, so an (illegal)
 * id repeated between a camera and a node still resolves to the node.
 */
const nodePositions = (
  scene: IAutoMovieScene,
  path: string,
): Map<string, IAutoMovieVector3> =>
  new Map<string, IAutoMovieVector3>([
    ...scene.cameras.map(
      (camera) => [camera.id, camera.transform.translation] as const,
    ),
    ...scene.nodes.map((node, index) => {
      if (scene.nodes.findIndex((other) => other.id === node.id) !== index)
        throw new Error(
          `scene node "${node.id}" is duplicated at ${path}.nodes[${index}].id`,
        );
      return [node.id, node.transform.translation] as const;
    }),
  ]);

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
