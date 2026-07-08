import {
  HUMANOID_JOINT_AXES,
  Quaternion,
  Vector3,
  reachPose,
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
import path from "node:path";

import { AutoMovieContext } from "../AutoMovieContext";
import { toEngineMotion } from "../convert";
import {
  IAutoMovieGetReachOutput,
  IAutoMovieGetResolvedPoseOutput,
  IAutoMovieMcpArmReach,
  IAutoMovieMcpGeometryContext,
  IAutoMovieMcpGeometryModel,
  IAutoMovieMcpMotion,
  IAutoMovieMcpResolvedPose,
  IAutoMovieMeasureDistanceOutput,
} from "../dto";
import { shotIdOf } from "../project/shotKey";
import { validateSceneArtifact } from "../validators/artifacts";
import {
  validateArrayArtifact,
  validateNonEmptyId,
  validateObjectArtifact,
  validateTransformArtifact,
} from "../validators/primitives";
import { resolveRuntimeSafeTargetPoint } from "./actionTargets";

/**
 * Engine geometry queries — resolved poses, reach reports, and distance
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
    const source = this.resolveGeometryContext(
      props.context,
      props.beat,
      "getResolvedPose",
    );
    assertGeometryContextShape(source.context);
    return {
      resolvedPose: resolveActorGeometry(
        source.context,
        props.actor,
        props.t ?? 0,
        source.resident ? { caller: "getResolvedPose" } : undefined,
      ),
    };
  }

  public getReach(props: {
    context?: IAutoMovieMcpGeometryContext;
    actor: string;
    target: IAutoMovieActionTarget;
  }): IAutoMovieGetReachOutput {
    const source = this.resolveGeometryContext(
      props.context,
      undefined,
      "getReach",
    );
    assertGeometryContextShape(source.context);
    const actor = findActorRig(
      source.context,
      props.actor,
      source.resident ? { caller: "getReach" } : undefined,
    );
    if (actor === null) return { reach: null };
    const target = resolveRuntimeSafeTargetPoint(
      props.target,
      nodePositions(source.context.scene),
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

  public measureDistance(props: {
    scene?: IAutoMovieScene;
    from: IAutoMovieActionTarget;
    to: IAutoMovieActionTarget;
  }): IAutoMovieMeasureDistanceOutput {
    const scene = this.resolveScene(props.scene, "measureDistance");
    assertGeometrySceneShape(scene, "scene");
    const nodes = nodePositions(scene);
    const from = resolveRuntimeSafeTargetPoint(props.from, nodes);
    const to = resolveRuntimeSafeTargetPoint(props.to, nodes);
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

  private resolveScene(
    scene: IAutoMovieScene | undefined,
    caller: string,
  ): IAutoMovieScene {
    if (scene !== undefined) return scene;
    const project = this.context.requireProject(caller);
    const stored = project.storedSlate();
    if (stored.scene === null)
      throw new Error(
        `${caller} was called without a scene, but the resident project has no committed scene. Commit a scene first or pass scene explicitly.`,
      );
    assertResidentSceneFile(project.root, stored.scene, caller);
    return stored.scene;
  }

  private resolveGeometryContext(
    context: IAutoMovieMcpGeometryContext | undefined,
    beat: string | undefined,
    caller: string,
  ): GeometryContextSource {
    if (context !== undefined) return { context, resident: false };
    const project = this.context.requireProject(caller);
    const slate = project.writableSlate();
    if (slate.scene === null)
      throw new Error(
        `${caller} was called without a context, but the resident project has no committed scene. Commit a scene first or pass context explicitly.`,
      );
    assertResidentSceneFile(project.root, slate.scene, caller);
    const memory = this.context.geometryMemory();
    const models = mergeResidentModels([
      ...memory.models,
      ...project.storedProps().map((prop) => ({
        id: prop.model.id,
        skeleton: prop.model.skeleton,
      })),
    ]);
    return {
      resident: true,
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
};

type GeometryActor = {
  node: IAutoMovieScene["nodes"][number];
  model: IAutoMovieMcpGeometryModel;
  skeleton: IAutoMovieSkeleton;
};

type ActorPoseState = {
  pose: IAutoMoviePose;
  motion: string | null;
};

class AutoMovieProjectSemanticError extends Error {
  public constructor(file: string, caller: string, detail: string) {
    super(
      `AutoMovie project file "${file}" is semantically invalid for ${caller}. ` +
        `Fix or remove this file, then call openProject again. ` +
        `Validation detail: ${detail}`,
    );
    this.name = "AutoMovieProjectSemanticError";
  }
}

const assertResidentSceneFile = (
  root: string,
  scene: IAutoMovieScene,
  caller: string,
): void => {
  const file = path.join(root, "scene.json");
  try {
    const validation = validateSceneArtifact(scene, residentSceneModels(scene));
    if (validation.success === true) return;
    throw new AutoMovieProjectSemanticError(
      file,
      caller,
      describeViolations(validation.violations),
    );
  } catch (error) {
    if (error instanceof AutoMovieProjectSemanticError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new AutoMovieProjectSemanticError(file, caller, detail);
  }
};

const residentSceneModels = (
  scene: IAutoMovieScene,
): IAutoMovieMcpGeometryModel[] =>
  [...new Set(scene.nodes.map((node) => node.model))].map((id) => ({
    id,
    skeleton: null,
  }));

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
  contract?: ResidentGeometryContract,
): IAutoMovieMcpResolvedPose | null => {
  assertFiniteTime(t);
  const actorRig = findActorRig(context, actor, contract);
  if (actorRig === null) return null;
  const state = resolveActorPose(
    context,
    actorRig.node,
    actorRig.skeleton,
    t,
    contract,
  );
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
  contract?: ResidentGeometryContract,
): ActorPoseState | null => {
  const performance =
    context.shot === undefined || context.shot === null
      ? null
      : findShotPerformance(context.shot, node.id);
  const motionId = performance === null ? node.motion : performance.motion;
  if (motionId !== null) {
    const motion = findMotion(context, motionId);
    if (motion === null && contract !== undefined)
      throw new Error(
        `${contract.caller} cannot sample resident motion "${motionId}" for actor "${node.id}". Project files persist shot motion ids, not compiled motion clips; call commitShot with motions in this application session or pass context explicitly.`,
      );
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
  contract?: ResidentGeometryContract,
): GeometryActor | null => {
  const node = findSceneNode(context.scene, actor);
  if (node === null) return null;
  const model = findGeometryModel(context.models, node.model);
  if (model === null && contract !== undefined)
    throw new Error(
      `${contract.caller} cannot resolve resident model "${node.model}" for actor "${actor}". Project files persist the scene, but not cast model skeleton payloads; call commitScene with models in this application session or pass context explicitly.`,
    );
  if (model === null || model.skeleton === null) return null;
  return { node, model, skeleton: model.skeleton };
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
  assertGeometryMotionRegistryShape(context.motions, "context.motions");
  const entries = Object.entries(
    context.motions as Record<string, IAutoMovieMcpMotion>,
  )
    .map(([key, motion]) => ({ key, motion }))
    .filter(({ motion }) => motion.id === id);
  if (entries.length > 1)
    throw new Error(
      `motion "${id}" is duplicated at context.motions.${entries[1]!.key}.id`,
    );
  return entries[0]?.motion ?? null;
};

const assertGeometryContextShape = (
  context: IAutoMovieMcpGeometryContext | unknown,
): void => {
  const violations: IAutoMovieConstraintViolation[] = [];
  if (!validateObjectArtifact(context, "context", "context", violations))
    return assertNoGeometryViolations(violations);
  appendGeometrySceneShape(context.scene, "context.scene", violations);
  appendGeometryModelsShape(context.models, "context.models", violations);
  const shot = context.shot;
  if (shot === null || shot === undefined)
    return assertNoGeometryViolations(violations);
  if (!validateObjectArtifact(shot, "context.shot", "context shot", violations))
    return assertNoGeometryViolations(violations);
  appendGeometryShotShape(shot, "context.shot", violations);
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
  motion.keyframes.forEach((keyframe, index) =>
    appendGeometryMotionKeyframeShape(
      keyframe,
      `${path}.keyframes[${index}]`,
      violations,
    ),
  );
};

const appendGeometryMotionKeyframeShape = (
  keyframe: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(keyframe, path, "motion keyframe", violations))
    return;
  appendGeometryPoseShape(keyframe.pose, `${path}.pose`, violations);
  const bezier = keyframe.bezier;
  if (bezier !== null)
    validateObjectArtifact(
      bezier,
      `${path}.bezier`,
      "motion keyframe bezier",
      violations,
    );
};

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
  validateArrayArtifact(
    pose.joints,
    `${path}.joints`,
    "pose joints",
    violations,
  );
};

const assertNoGeometryViolations = (
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (violations.length > 0) throw new Error(describeViolations(violations));
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
  if (!Number.isFinite(t))
    throw new Error(
      `range at $input.t: resolved pose sample time must be finite, but was ${t}`,
    );
};
