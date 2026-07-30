import {
  IAutoMovieQuaternion,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { channelKey } from "../resolve/channel";
import { sampleClip } from "../resolve/sampleClip";

/** A camera's resolved world placement (position + rotation). */
export interface IAutoMovieResolvedCamera {
  position: IAutoMovieVector3;
  rotation: IAutoMovieQuaternion;
}

/**
 * The camera's world placement at `time`: static (its base transform), or
 * sampled from its `cameraMotion` clip. A move missing a track falls back to
 * the static component.
 */
export const resolveCameraAt = (
  base: { translation: IAutoMovieVector3; rotation: IAutoMovieQuaternion },
  cameraMotion: IAutoMovieShot["cameraMotion"],
  cameraId: string,
  time: number,
): IAutoMovieResolvedCamera => {
  if (cameraMotion === null)
    return { position: base.translation, rotation: base.rotation };
  const sampled = sampleClip(cameraMotion, time);
  const position = sampled.get(
    channelKey({ kind: "node", node: cameraId, path: "translation" }),
  )?.value;
  const rotation = sampled.get(
    channelKey({ kind: "node", node: cameraId, path: "rotation" }),
  )?.value;
  return {
    position:
      position === undefined
        ? base.translation
        : { x: position[0]!, y: position[1]!, z: position[2]! },
    rotation:
      rotation === undefined
        ? base.rotation
        : {
            x: rotation[0]!,
            y: rotation[1]!,
            z: rotation[2]!,
            w: rotation[3]!,
          },
  };
};

/**
 * Project a world point into the camera's normalized device coordinates. The
 * camera looks down its local −Z (glTF), so `depth = −localZ` is positive in
 * front of the lens; NDC is `local / (depth · tan(fovY/2))`, horizontally
 * widened by `aspect`. Behind the camera (`depth ≤ 0`) the NDC is unbounded:
 * the caller reads `depth` (and the near/far/rectangle bounds) to decide, this
 * never clamps.
 */
export const projectToNdc = (
  camera: IAutoMovieResolvedCamera,
  point: IAutoMovieVector3,
  halfY: number,
  aspect: number,
): { ndcX: number; ndcY: number; depth: number } => {
  const local = Quaternion.rotateVector(
    Quaternion.inverse(camera.rotation),
    Vector3.subtract(point, camera.position),
  );
  const depth = -local.z;
  return {
    ndcX: local.x / (depth * halfY * aspect),
    ndcY: local.y / (depth * halfY),
    depth,
  };
};

/**
 * Whether a world-space sphere intersects an exact perspective-camera frustum.
 * Side-plane distances include plane normalization, so callers must not
 * approximate the radius by padding projected NDC coordinates.
 */
export const intersectsPerspectiveFrustumSphere = (props: {
  camera: IAutoMovieResolvedCamera;
  center: IAutoMovieVector3;
  radius: number;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
}): boolean => {
  const local = Quaternion.rotateVector(
    Quaternion.inverse(props.camera.rotation),
    Vector3.subtract(props.center, props.camera.position),
  );
  const depth = -local.z;
  if (
    Number.isFinite(props.radius) === false ||
    props.radius < 0 ||
    depth + props.radius < props.near ||
    depth - props.radius > props.far
  )
    return false;
  const halfX = props.halfY * props.aspect;
  return (
    Math.abs(local.x) <= depth * halfX + props.radius * Math.hypot(1, halfX) &&
    Math.abs(local.y) <=
      depth * props.halfY + props.radius * Math.hypot(1, props.halfY)
  );
};
