import {
  AutoMovieHumanoidBone,
  IAutoMovieCamera,
  IAutoMoviePose,
  IAutoMoviePoseKeypoint,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { resolvePose } from "../kinematics/resolvePose";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { projectToNdc, resolveCameraAt } from "./cameraProjection";

/** Assumed render aspect (width/height): the scene camera carries no aspect. */
const DEFAULT_ASPECT = 16 / 9;

/**
 * The OpenPose-style BODY keypoint set: the load-bearing humanoid bones, minus
 * the 30 finger bones (the dimensional tail that pose-conditioned diffusion
 * does not use). A rig that omits a bone simply produces no keypoint for it.
 */
export const DEFAULT_KEYPOINT_BONES: readonly AutoMovieHumanoidBone[] = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
];

/**
 * Project one posed actor's named joints to 2D screen keypoints (#1168), the
 * exact OpenPose-style conditioning automovie can emit because it already knows
 * every bone's exact 3D world position. Forward kinematics resolves the pose in
 * rig space, the staged scene node's transform lifts each bone into scene-world
 * (the same TRS the renderer composes), and the shot's camera projects it to a
 * normalized `[0, 1]` frame coordinate.
 *
 * A joint behind the camera or outside the frame is still projected (never
 * silently clamped: a clamped point reads as a false edge keypoint) but
 * flagged `inFrame: false`. Deterministic: pure FK + stateless projection.
 *
 * @author Samchon
 */
export const resolvePoseKeypoints = (props: {
  /** The actor's pose at this instant. */
  pose: IAutoMoviePose;

  /** The actor's skeleton. */
  skeleton: IAutoMovieSkeleton;

  /** The actor's staged scene-node placement (world TRS). */
  node: { transform: IAutoMovieTransform };

  /** The live camera. */
  camera: IAutoMovieCamera;

  /** The camera's move, or omit for a static camera. */
  cameraMotion?: IAutoMovieShot["cameraMotion"];

  /** Shot-local instant to sample the camera at. Defaults to 0. */
  time?: number;

  /** Render aspect (width/height). Defaults to 16/9. */
  aspect?: number;

  /** Joints to emit. Defaults to the OpenPose body set. */
  joints?: readonly AutoMovieHumanoidBone[];
}): IAutoMoviePoseKeypoint[] => {
  const rigByBone = new Map(
    resolvePose(props.pose, props.skeleton).map((b) => [
      b.bone,
      b.worldPosition,
    ]),
  );
  const cam = resolveCameraAt(
    props.camera.transform,
    props.cameraMotion ?? null,
    props.camera.id,
    props.time ?? 0,
  );
  const halfY = Math.tan((props.camera.fovY * Math.PI) / 360);
  const aspect = props.aspect ?? DEFAULT_ASPECT;
  const joints = props.joints ?? DEFAULT_KEYPOINT_BONES;

  const keypoints: IAutoMoviePoseKeypoint[] = [];
  for (const bone of joints) {
    const rig = rigByBone.get(bone);
    if (rig === undefined) continue;
    const world = toSceneWorld(props.node.transform, rig);
    const { ndcX, ndcY, depth } = projectToNdc(cam, world, halfY, aspect);
    const inFrame =
      depth >= props.camera.near &&
      depth <= props.camera.far &&
      Math.abs(ndcX) <= 1 &&
      Math.abs(ndcY) <= 1;
    // NDC (−1..1, +y up) → normalized frame (0..1, top-left origin).
    keypoints.push({ bone, x: (ndcX + 1) / 2, y: (1 - ndcY) / 2, inFrame });
  }
  return keypoints;
};

/** Lift a rig-space point into scene-world by the node's TRS (scale-correct). */
const toSceneWorld = (
  transform: IAutoMovieTransform,
  point: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    transform.translation,
    Quaternion.rotateVector(transform.rotation, {
      x: transform.scale.x * point.x,
      y: transform.scale.y * point.y,
      z: transform.scale.z * point.z,
    }),
  );
