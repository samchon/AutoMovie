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
 * Whether a world-space segment intersects an exact perspective-camera frustum.
 *
 * The frustum is the intersection of six half-spaces, so it is convex and the
 * segment can be clipped against them one plane at a time in its own parameter.
 * Each plane is linear in camera-local coordinates, which makes every crossing
 * exact rather than sampled. That exactness is the reason this exists: a close
 * shot frames the band between roughly 0.71 and 0.99 of a subject's height, so
 * **neither end** of the subject is on screen while its middle fills the frame.
 * Testing chosen points — the base, the top, the midpoint — reports such a
 * subject absent; clipping finds it.
 */
export const intersectsPerspectiveFrustumSegment = (props: {
  camera: IAutoMovieResolvedCamera;
  from: IAutoMovieVector3;
  to: IAutoMovieVector3;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
}): boolean => {
  const inverse = Quaternion.inverse(props.camera.rotation);
  const local = (point: IAutoMovieVector3): IAutoMovieVector3 =>
    Quaternion.rotateVector(
      inverse,
      Vector3.subtract(point, props.camera.position),
    );
  const from = local(props.from);
  const to = local(props.to);
  const halfX = props.halfY * props.aspect;
  // Six half-spaces, each written as `f(p) <= 0`. The camera looks down its
  // local −Z, so the viewing depth is `-p.z` and the side planes open with it.
  const planes: ((point: IAutoMovieVector3) => number)[] = [
    (point) => props.near + point.z,
    (point) => -point.z - props.far,
    (point) => point.x + point.z * halfX,
    (point) => -point.x + point.z * halfX,
    (point) => point.y + point.z * props.halfY,
    (point) => -point.y + point.z * props.halfY,
  ];
  let lower = 0;
  let upper = 1;
  for (const plane of planes) {
    const at0 = plane(from);
    const at1 = plane(to);
    const slope = at1 - at0;
    // Parallel to the plane: the whole segment is on one side of it, so the
    // sign at either end decides, and there is no crossing to narrow with.
    if (slope === 0) {
      if (at0 > 0) return false;
      continue;
    }
    const crossing = -at0 / slope;
    if (slope > 0) upper = Math.min(upper, crossing);
    else lower = Math.max(lower, crossing);
    if (lower > upper) return false;
  }
  return true;
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
