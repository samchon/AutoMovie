import {
  HUMANOID_JOINT_AXES,
  Quaternion,
  Vector3,
  reachPose,
  resolvePose,
  resolveTargetPoint,
  sampleMotion,
} from "@automovie/engine";
import {
  IAutoMovieActionTarget,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

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

/**
 * Engine geometry queries — resolved poses, reach reports, and distance
 * measurements over the narrow geometry context. The MCP contract lives on the
 * {@link AutoMovieApplication} facade; this service owns the execution.
 */
export class GeometryService {
  public getResolvedPose(props: {
    context: IAutoMovieMcpGeometryContext;
    actor: string;
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

  public getReach(props: {
    context: IAutoMovieMcpGeometryContext;
    actor: string;
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

  public measureDistance(props: {
    scene: IAutoMovieScene;
    from: IAutoMovieActionTarget;
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
}

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
