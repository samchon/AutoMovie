import {
  IAutoMovieDeliveryCrop,
  IAutoMovieQuaternion,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { channelKey } from "../resolve/channel";
import { sampleClip } from "../resolve/sampleClip";

/**
 * A camera's resolved world placement (position + rotation).
 *
 * @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding Carries the world position and rotation resolved for one addressed camera at one sample time as a single projection input.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding IAutoMovieResolvedCamera realizes explicit camera spatial binding: A camera's resolved world placement (position + rotation).
 */
export interface IAutoMovieResolvedCamera {
  /**
   * Camera origin in world space.
   *
   * @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding Stores the addressed camera's sampled world origin used by view-space projection and frustum tests.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding IAutoMovieResolvedCamera.position realizes explicit camera spatial binding: Camera origin in world space.
   */
  position: IAutoMovieVector3;
  /**
   * Camera orientation in world space.
   *
   * @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding Stores the same addressed camera's sampled world orientation that defines its local viewing basis.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding IAutoMovieResolvedCamera.rotation realizes explicit camera spatial binding: Camera orientation in world space.
   */
  rotation: IAutoMovieQuaternion;
}

const WHOLE_DELIVERY_CROP: IAutoMovieDeliveryCrop = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

/**
 * Validate and resolve one portable delivery-gate crop.
 *
 * Coordinates name pixel edges in the uncropped raster with a top-left
 * origin. Omission resolves to the whole gate. The returned object never
 * aliases caller-owned input, so render and review consumers share values
 * without sharing mutation.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Resolves the authored delivery window in a resolution-independent coordinate system before projection and rendering consume it.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Validates the closed normalized crop region that narrows the delivery frustum without changing its near or far planes.
 */
export const resolveAutoMovieDeliveryCrop = (
  crop: IAutoMovieDeliveryCrop | undefined,
): IAutoMovieDeliveryCrop => {
  const resolved = crop ?? WHOLE_DELIVERY_CROP;
  if (
    [resolved.left, resolved.top, resolved.right, resolved.bottom].every(
      (edge) => Number.isFinite(edge) && edge >= 0 && edge <= 1,
    ) === false ||
    resolved.left >= resolved.right ||
    resolved.top >= resolved.bottom
  )
    throw new RangeError(
      "Delivery crop edges must be finite, normalized to [0, 1], and ordered left < right and top < bottom.",
    );
  return { ...resolved };
};

interface IAutoMovieDeliveryCropNdc {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  whole: boolean;
}

const deliveryCropNdc = (
  crop: IAutoMovieDeliveryCrop | undefined,
): IAutoMovieDeliveryCropNdc => {
  const resolved = resolveAutoMovieDeliveryCrop(crop);
  return {
    left: 2 * resolved.left - 1,
    right: 2 * resolved.right - 1,
    top: 1 - 2 * resolved.top,
    bottom: 1 - 2 * resolved.bottom,
    width: resolved.right - resolved.left,
    height: resolved.bottom - resolved.top,
    whole:
      resolved.left === 0 &&
      resolved.top === 0 &&
      resolved.right === 1 &&
      resolved.bottom === 1,
  };
};

/**
 * The camera's world placement at `time`: static (its base transform), or
 * sampled from its `cameraMotion` clip. A move missing a track falls back to
 * the static component.
 *
 * @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding Resolves position and rotation tracks for the named camera at the requested time and falls back component-wise to that camera's staged transform when a track is absent.
 * @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth Resolves the addressed camera's actual world transform at the sample time from its motion tracks and staged fallback, independent of framing intent metadata.
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-sampling Samples the addressed camera-motion clip at the caller's film time, providing camera translation and rotation for the same instant used by moving-target consumers.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding resolveCameraAt realizes explicit camera spatial binding: The camera's world placement at `time`: static (its base transform), or sampled from its `cameraMotion` clip. A move missing a track falls back to the static component.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Provides the camera half of the same-time state pair by sampling translation and rotation at the addressed film instant.
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
 *
 * @evidence requirements/camera/validation.md#camera-hand-computable-geometry Converts a world point to normalized device coordinates and positive camera depth from explicit FOV and aspect inputs.
 * @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth Computes image position and depth from the resolved world camera transform and world point rather than from shot labels or intended framing.
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions Applies an inverse-quaternion view transform, local negative-Z depth, vertical half-FOV, and width-to-height aspect before returning unclamped NDC coordinates.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results projectToNdc realizes independently computable image geometry: Project a world point into the camera's normalized device coordinates. The camera looks down its local −Z (glTF), so `depth = −localZ` is positive in front of the lens; NDC is `local / (depth · tan(fovY/2))`, horizontally widened by `aspect`. Behind the camera (`depth ≤ 0`) the NDC is unbounded: the caller reads `depth` (and the near/far/rectangle bounds) to decide, this never clamps.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Fixes perspective projection to the engine's inverse-quaternion, negative-Z-forward, vertical-FOV, and width-to-height aspect convention.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding Uses the resolved camera origin and orientation as the sole spatial authority for this point projection.
 */
export const projectToNdc = (
  camera: IAutoMovieResolvedCamera,
  point: IAutoMovieVector3,
  halfY: number,
  aspect: number,
  crop?: IAutoMovieDeliveryCrop,
): { ndcX: number; ndcY: number; depth: number } => {
  const local = Quaternion.rotateVector(
    Quaternion.inverse(camera.rotation),
    Vector3.subtract(point, camera.position),
  );
  const depth = -local.z;
  const ndcX = local.x / (depth * halfY * aspect);
  const ndcY = local.y / (depth * halfY);
  const gate = deliveryCropNdc(crop);
  if (gate.whole) return { ndcX, ndcY, depth };
  return {
    ndcX: (ndcX - (gate.left + gate.right) / 2) / gate.width,
    ndcY: (ndcY - (gate.bottom + gate.top) / 2) / gate.height,
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
 *
 * @evidence requirements/camera/validation.md#camera-hand-computable-geometry intersectsPerspectiveFrustumSegment reduces segment visibility to explicit perspective-plane clipping that can be checked independently.
 * @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth Clips the world segment against half-spaces derived from the resolved camera transform and current lens geometry, not an authored composition claim.
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-frustum-boundaries Treats equality with every near, far, and side half-space as visible, so a segment touching a closed frustum boundary intersects.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Uses the declared near and far planes in the exact segment clip instead of sampling selected points or ignoring depth.
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions Builds six closed camera-local half-spaces from inverse-quaternion rotation, negative-Z depth, vertical half-FOV, and width-to-height aspect.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results intersectsPerspectiveFrustumSegment realizes independently computable image geometry: Whether a world-space segment intersects an exact perspective-camera frustum. The frustum is the intersection of six half-spaces, so it is convex and the segment can be clipped against them one plane at a time in its own parameter. Each plane is linear in camera-local coordinates, which makes every crossing exact rather than sampled. That exactness is the reason this exists: a close shot frames the band between roughly 0.71 and 0.99 of a subject's height, so **neither end** of the subject is on screen while its middle fills the frame. Testing chosen points — the base, the top, the midpoint — reports such a subject absent; clipping finds it.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Clips the complete segment against all six closed frustum half-spaces, preserving boundary contact as visible geometry.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Evaluates only this segment against the current near, far, and side planes; the optional clipping-plane set is empty for an authored camera, and it does not claim camera-body clearance or swept-motion safety.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Uses the declared perspective basis for every segment-plane crossing and preserves equality with a near, far, or image-edge plane.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding Derives every segment-frustum plane test from the supplied resolved camera state and current geometric bounds.
 */
export const intersectsPerspectiveFrustumSegment = (props: {
  camera: IAutoMovieResolvedCamera;
  from: IAutoMovieVector3;
  to: IAutoMovieVector3;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
  crop?: IAutoMovieDeliveryCrop;
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
  const crop = deliveryCropNdc(props.crop);
  // Six half-spaces, each written as `f(p) <= 0`. The camera looks down its
  // local −Z, so the viewing depth is `-p.z` and the side planes open with it.
  const planes: ((point: IAutoMovieVector3) => number)[] = [
    (point) => props.near + point.z,
    (point) => -point.z - props.far,
    (point) => point.x + crop.right * point.z * halfX,
    (point) => -point.x - crop.left * point.z * halfX,
    (point) => point.y + crop.top * point.z * props.halfY,
    (point) => -point.y - crop.bottom * point.z * props.halfY,
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

/** The eight world corners of a perspective frustum, near plane first. */
const frustumCorners = (props: {
  camera: IAutoMovieResolvedCamera;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
  crop?: IAutoMovieDeliveryCrop;
}): IAutoMovieVector3[] => {
  const halfX = props.halfY * props.aspect;
  const crop = deliveryCropNdc(props.crop);
  return [props.near, props.far].flatMap((depth) =>
    [crop.left, crop.right].flatMap((sx) =>
      [crop.bottom, crop.top].map((sy) =>
        Vector3.add(
          props.camera.position,
          Quaternion.rotateVector(props.camera.rotation, {
            x: sx * depth * halfX,
            y: sy * depth * props.halfY,
            z: -depth,
          }),
        ),
      ),
    ),
  );
};

/**
 * The twelve edges of any eight-corner box, as index pairs.
 *
 * Both corner lists below are built by nesting three two-valued choices, so a
 * corner's index is those three choices read as bits and an edge is a pair
 * differing in exactly one of them. The same twelve pairs therefore name the
 * box's edges and the frustum's.
 */
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
];

/** Whether a world-space segment meets an axis-aligned box (slab clipping). */
const segmentMeetsBox = (
  from: IAutoMovieVector3,
  to: IAutoMovieVector3,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): boolean => {
  let lower = 0;
  let upper = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const start = from[axis];
    const slope = to[axis] - start;
    // Parallel to this pair of slabs: the whole segment shares one coordinate,
    // so the slab decides it outright and there is no crossing to narrow with.
    if (slope === 0) {
      if (start < min[axis] || start > max[axis]) return false;
      continue;
    }
    const first = (min[axis] - start) / slope;
    const second = (max[axis] - start) / slope;
    lower = Math.max(lower, Math.min(first, second));
    upper = Math.min(upper, Math.max(first, second));
    if (lower > upper) return false;
  }
  return true;
};

/**
 * Whether a world-space axis-aligned box intersects an exact perspective-camera
 * frustum.
 *
 * Both bodies are convex, and two convex polyhedra meet exactly when an edge of
 * one meets the other: every vertex of the intersection is a vertex of one body
 * lying inside the other, or a crossing of one body's edge with the other's
 * face, and each of those puts some edge of one body inside the other. So the
 * twelve box edges are clipped against the frustum's six half-spaces, and the
 * twelve frustum edges against the box's three slabs. Neither half alone is the
 * answer: a box small enough to sit inside the frame is found only by the
 * first, and a frustum that pierces a mass far wider than itself — a camera
 * standing inside a crowd, or above one — only by the second.
 *
 * This is what a required subject with a real extent is judged against. A
 * segment through one point cannot answer for a mass: it reports a crowd absent
 * whenever the frame holds its flank instead of its middle, and present
 * whenever that one point is on screen no matter where the rest of the unit
 * stands.
 *
 * @evidence requirements/camera/validation.md#camera-hand-computable-geometry intersectsPerspectiveFrustumBox tests all transformed box corners against explicit frustum planes, yielding a reproducible geometry result.
 * @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth Tests the current world box and frustum as two resolved geometric bodies, without substituting subject labels or framing intent.
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-frustum-boundaries Preserves a box or frustum edge that merely touches the other's closed planes or slabs as an intersection.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Applies the current near and far distances while clipping both box edges and frustum edges, covering containment in either direction.
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions Constructs negative-Z near and far corners from vertical half-FOV and aspect, rotates them by the camera quaternion, and clips both closed bodies in one convention.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results intersectsPerspectiveFrustumBox realizes independently computable image geometry: Whether a world-space axis-aligned box intersects an exact perspective-camera frustum. Both bodies are convex, and two convex polyhedra meet exactly when an edge of one meets the other: every vertex of the intersection is a vertex of one body lying inside the other, or a crossing of one body's edge with the other's face, and each of those puts some edge of one body inside the other. So the twelve box edges are clipped against the frustum's six half-spaces, and the twelve frustum edges against the box's three slabs. Neither half alone is the answer: a box small enough to sit inside the frame is found only by the first, and a frustum that pierces a mass far wider than itself — a camera standing inside a crowd, or above one — only by the second. This is what a required subject with a real extent is judged against. A segment through one point cannot answer for a mass: it reports a crowd absent whenever the frame holds its flank instead of its middle, and present whenever that one point is on screen no matter where the rest of the unit stands.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Tests both convex bodies' closed edges, preventing containment and tangent contact from being culled as invisible.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Evaluates only the current world box against the current frustum and clipping range; an authored camera declares no section plane, so the optional plane set is empty here, and it does not evaluate clearance or a swept interval.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Carries the same optical axis, quaternion order, FOV, aspect, and closed boundary convention through frustum-box intersection.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding Builds the frustum body from the supplied resolved camera state before testing both box and frustum edges.
 */
export const intersectsPerspectiveFrustumBox = (props: {
  camera: IAutoMovieResolvedCamera;
  min: IAutoMovieVector3;
  max: IAutoMovieVector3;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
  crop?: IAutoMovieDeliveryCrop;
}): boolean => {
  const corners = [props.min.x, props.max.x].flatMap((x) =>
    [props.min.y, props.max.y].flatMap((y) =>
      [props.min.z, props.max.z].map((z) => ({ x, y, z })),
    ),
  );
  for (const [from, to] of BOX_EDGES)
    if (
      intersectsPerspectiveFrustumSegment({
        camera: props.camera,
        from: corners[from]!,
        to: corners[to]!,
        near: props.near,
        far: props.far,
        halfY: props.halfY,
        aspect: props.aspect,
        crop: props.crop,
      })
    )
      return true;
  const lens = frustumCorners(props);
  for (const [from, to] of BOX_EDGES)
    if (segmentMeetsBox(lens[from]!, lens[to]!, props.min, props.max))
      return true;
  return false;
};

/**
 * Whether a world-space sphere intersects an exact perspective-camera frustum.
 * Side-plane distances include plane normalization, so callers must not
 * approximate the radius by padding projected NDC coordinates.
 *
 * @evidence requirements/camera/validation.md#camera-hand-computable-geometry intersectsPerspectiveFrustumSphere keeps camera geometry hand-computable: Whether a world-space sphere intersects an exact perspective-camera frustum. Side-plane distances include plane normalization, so callers must not approximate the radius by padding projected NDC coordinates.
 * @evidence requirements/camera/scope-and-identity.md#camera-geometric-truth Measures the current world-space sphere against planes derived from the resolved camera origin and orientation, independent of authored intent.
 * @evidence requirements/rendering/geometry-visibility-and-culling.md#rendering-frustum-boundaries Keeps a sphere tangent to a near, far, or normalized side plane visible by rejecting only strict separation from the closed frustum.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Tests the sphere's radius-adjusted depth against the declared near and far distances before its side-plane bounds.
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-optical-conventions Transforms the sphere center by the inverse camera quaternion, reads positive depth along negative Z, and tests normalized FOV-and-aspect side planes as closed boundaries.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-computable-geometry-results intersectsPerspectiveFrustumSphere realizes independently computable image geometry: Whether a world-space sphere intersects an exact perspective-camera frustum. Side-plane distances include plane normalization, so callers must not approximate the radius by padding projected NDC coordinates.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-visibility-culling Uses normalized plane distances and strict outside tests so exact sphere-boundary contact remains render-visible.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Evaluates only the current sphere bound against the current frustum and clipping range with an empty optional plane set; it does not claim clearance or swept-motion coverage.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Applies the same optical axis, transform order, vertical FOV, aspect, depth, and closed-boundary convention to spherical bounds.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding Transforms the sphere through the supplied resolved camera state before applying current depth and side-plane bounds.
 */
export const intersectsPerspectiveFrustumSphere = (props: {
  camera: IAutoMovieResolvedCamera;
  center: IAutoMovieVector3;
  radius: number;
  near: number;
  far: number;
  halfY: number;
  aspect: number;
  crop?: IAutoMovieDeliveryCrop;
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
  const crop = deliveryCropNdc(props.crop);
  const rightDistance = local.x - depth * halfX * crop.right;
  const leftDistance = -local.x + depth * halfX * crop.left;
  const topDistance = local.y - depth * props.halfY * crop.top;
  const bottomDistance = -local.y + depth * props.halfY * crop.bottom;
  return (
    rightDistance <= props.radius * Math.hypot(1, halfX * crop.right) &&
    leftDistance <= props.radius * Math.hypot(1, halfX * crop.left) &&
    topDistance <= props.radius * Math.hypot(1, props.halfY * crop.top) &&
    bottomDistance <= props.radius * Math.hypot(1, props.halfY * crop.bottom)
  );
};

/**
 * One inspection-owned cutting plane: the half-space a section view removes.
 *
 * A building is authored from cutaway drawings and then cannot be looked at the
 * way it was drawn. Standing outside hides the interior, standing inside shows
 * one room, and deleting a wall to look past it edits the production instead of
 * reviewing it. A section plane is the missing third option: the scene is left
 * exactly as compiled and the observer removes a half-space of it.
 *
 * **This is not a field of an authored camera**, and it lives beside the
 * frustum half-spaces rather than inside the scene AST for that reason. A shot
 * is judged on the image it delivers, so an observation made after a wall was
 * removed is a diagram about the production rather than evidence about that
 * image; viewpoint authority for it belongs to inspection, exactly as it
 * already does for a subject review's own angle and distance.
 * `IAutoMovieCamera` states the exclusion and the condition that reopens it.
 *
 * The plane is a point and a normal rather than a signed offset because an
 * authoring agent reaches a cut through geometry it already has — a floor
 * level, a room's content bounds, a wall's face — and a point on that feature
 * plus the direction to throw away is what it can name. An offset would make it
 * solve for a scalar it never measured.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Declares the inspection-owned cut as a coplanar point and a normal naming the removed side, outside any authored camera field.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the optional clipping plane that clipping evaluation accepts as an input beside the near, far, and side planes.
 */
export interface IAutoMovieSectionPlane {
  /**
   * A point the plane passes through, world space, metres.
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Carries the coplanar point the declared cut is measured from.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Supplies `p0` of the specified signed distance `n·(p − p0)`.
   */
  point: IAutoMovieVector3;

  /**
   * Direction of the half-space that is REMOVED. Need not be unit length: it is
   * normalized on use, and a zero or non-finite vector names no half-space at
   * all, so it is refused rather than read as "keep everything".
   *
   * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Carries which side of the declared plane the section removes.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Supplies `n` of the specified signed distance `n·(p − p0)`.
   */
  normal: IAutoMovieVector3;
}

/**
 * How a bounded body stands to a set of section planes.
 *
 * `cut` is a fact: some single plane removed the whole body. `crossed` is only
 * the absence of that fact — no one plane removed it whole — and does NOT
 * promise a surviving point, because two planes can between them remove a body
 * that neither removes alone. Reading `crossed` as "partly visible" is the
 * mistake this union is named to prevent.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Names the three outcomes a declared cut has for a body without overstating a partial result.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the specified `kept`, `cut`, and `crossed` outcome of evaluating a bound against the optional clipping planes.
 */
export type AutoMovieSectionPlaneState = "kept" | "cut" | "crossed";

/**
 * Signed distance from a section plane to a world point, `n̂·(p − p0)`, metres.
 *
 * Positive is the removed side, negative is the kept side, and exactly zero is
 * the plane itself, which is KEPT. The boundary has to be decided somewhere and
 * it is decided here, because a cut taken at a floor's own level puts every
 * vertex of that floor at exactly zero: dropping them would delete the surface
 * the reviewer asked to stand on. `three.js` resolves its own clipping the same
 * way — a fragment is discarded only at negative signed distance to its plane —
 * so this number and the pixel the renderer draws agree at the boundary instead
 * of disagreeing by one plane.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Measures a world point against the declared cut and keeps geometry lying exactly on the plane.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Implements the specified signed distance `n·(p − p0)` with zero declared on the kept side.
 */
export const autoMovieSectionPlaneDistance = (
  plane: IAutoMovieSectionPlane,
  point: IAutoMovieVector3,
): number => {
  const length = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z);
  if (Number.isFinite(length) === false || length === 0)
    throw new RangeError(
      "Section plane normal must be a finite, non-zero vector.",
    );
  return (
    (plane.normal.x * (point.x - plane.point.x) +
      plane.normal.y * (point.y - plane.point.y) +
      plane.normal.z * (point.z - plane.point.z)) /
    length
  );
};

/**
 * Whether every declared plane keeps this world point.
 *
 * The planes intersect rather than union: a point survives a section only when
 * no plane removes it. That is what `three.js` applies with `clipIntersection`
 * left false, so a point this reports as kept is a point the renderer draws.
 * Unioning them instead would let a second plane restore what the first cut
 * away, and "two cuts" would mean less removed than one.
 *
 * An empty plane list keeps everything, which is what makes "no section" the
 * absence of a declaration rather than a separate mode.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Answers whether the declared cut leaves a world point in the observed half-space.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Applies the optional clipping planes as an intersection of kept half-spaces with the boundary included.
 */
export const autoMovieSectionPlanesKeepPoint = (
  planes: readonly IAutoMovieSectionPlane[],
  point: IAutoMovieVector3,
): boolean =>
  planes.every((plane) => autoMovieSectionPlaneDistance(plane, point) <= 0);

/**
 * Classify a world-space axis-aligned box against a set of section planes.
 *
 * Each plane is decided exactly, without walking eight corners: over a box
 * `n̂·(p − p0)` is linear, so its extremes sit at the two corners chosen per
 * axis by the sign of the normal's component. The corner farthest toward the
 * removed side decides whether the box is wholly kept, and the corner farthest
 * toward the kept side whether it is wholly removed.
 *
 * A box merely touching a plane is not removed: the touching face sits at
 * exactly zero, which {@link autoMovieSectionPlaneDistance} keeps, so a wall
 * standing on the cutting level still reads as present.
 *
 * This is what tells a reviewer which subjects a section actually left in view.
 * It is deliberately NOT folded into {@link intersectsPerspectiveFrustumBox}: an
 * authored camera declares no plane, so folding it into delivery acceptance
 * would add a term that is always empty there while making the acceptance of a
 * sliced subject a silent decision.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clipping-range Reports whether a declared cut leaves a subject's bound whole, removes it, or crosses it, with plane-level contact kept.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Produces the specified `kept`, `cut`, and `crossed` outcome for a current geometry bound under the optional clipping planes.
 */
export const classifyAutoMovieSectionPlaneBox = (props: {
  planes: readonly IAutoMovieSectionPlane[];
  min: IAutoMovieVector3;
  max: IAutoMovieVector3;
}): AutoMovieSectionPlaneState => {
  let crossed = false;
  for (const plane of props.planes) {
    const corner = (removedSide: boolean): IAutoMovieVector3 => {
      const picked: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };
      for (const axis of ["x", "y", "z"] as const)
        picked[axis] =
          plane.normal[axis] > 0 === removedSide
            ? props.max[axis]
            : props.min[axis];
      return picked;
    };
    // If even the extreme toward the removed side survives, the whole box does.
    if (autoMovieSectionPlaneDistance(plane, corner(true)) <= 0) continue;
    // If even the extreme toward the kept side is removed, the whole box is.
    if (autoMovieSectionPlaneDistance(plane, corner(false)) > 0) return "cut";
    crossed = true;
  }
  return crossed ? "crossed" : "kept";
};
