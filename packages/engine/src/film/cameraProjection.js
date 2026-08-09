import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { channelKey } from "../resolve/channel";
import { sampleClip } from "../resolve/sampleClip";
/**
 * The camera's world placement at `time`: static (its base transform), or
 * sampled from its `cameraMotion` clip. A move missing a track falls back to
 * the static component.
 */
export const resolveCameraAt = (base, cameraMotion, cameraId, time) => {
    if (cameraMotion === null)
        return { position: base.translation, rotation: base.rotation };
    const sampled = sampleClip(cameraMotion, time);
    const position = sampled.get(channelKey({ kind: "node", node: cameraId, path: "translation" }))?.value;
    const rotation = sampled.get(channelKey({ kind: "node", node: cameraId, path: "rotation" }))?.value;
    return {
        position: position === undefined
            ? base.translation
            : { x: position[0], y: position[1], z: position[2] },
        rotation: rotation === undefined
            ? base.rotation
            : {
                x: rotation[0],
                y: rotation[1],
                z: rotation[2],
                w: rotation[3],
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
export const projectToNdc = (camera, point, halfY, aspect) => {
    const local = Quaternion.rotateVector(Quaternion.inverse(camera.rotation), Vector3.subtract(point, camera.position));
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
export const intersectsPerspectiveFrustumSegment = (props) => {
    const inverse = Quaternion.inverse(props.camera.rotation);
    const local = (point) => Quaternion.rotateVector(inverse, Vector3.subtract(point, props.camera.position));
    const from = local(props.from);
    const to = local(props.to);
    const halfX = props.halfY * props.aspect;
    // Six half-spaces, each written as `f(p) <= 0`. The camera looks down its
    // local −Z, so the viewing depth is `-p.z` and the side planes open with it.
    const planes = [
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
            if (at0 > 0)
                return false;
            continue;
        }
        const crossing = -at0 / slope;
        if (slope > 0)
            upper = Math.min(upper, crossing);
        else
            lower = Math.max(lower, crossing);
        if (lower > upper)
            return false;
    }
    return true;
};
/** The eight world corners of a perspective frustum, near plane first. */
const frustumCorners = (props) => {
    const halfX = props.halfY * props.aspect;
    return [props.near, props.far].flatMap((depth) => [-1, 1].flatMap((sx) => [-1, 1].map((sy) => Vector3.add(props.camera.position, Quaternion.rotateVector(props.camera.rotation, {
        x: sx * depth * halfX,
        y: sy * depth * props.halfY,
        z: -depth,
    })))));
};
/**
 * The twelve edges of any eight-corner box, as index pairs.
 *
 * Both corner lists below are built by nesting three two-valued choices, so a
 * corner's index is those three choices read as bits and an edge is a pair
 * differing in exactly one of them. The same twelve pairs therefore name the
 * box's edges and the frustum's.
 */
const BOX_EDGES = [
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
const segmentMeetsBox = (from, to, min, max) => {
    let lower = 0;
    let upper = 1;
    for (const axis of ["x", "y", "z"]) {
        const start = from[axis];
        const slope = to[axis] - start;
        // Parallel to this pair of slabs: the whole segment shares one coordinate,
        // so the slab decides it outright and there is no crossing to narrow with.
        if (slope === 0) {
            if (start < min[axis] || start > max[axis])
                return false;
            continue;
        }
        const first = (min[axis] - start) / slope;
        const second = (max[axis] - start) / slope;
        lower = Math.max(lower, Math.min(first, second));
        upper = Math.min(upper, Math.max(first, second));
        if (lower > upper)
            return false;
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
 */
export const intersectsPerspectiveFrustumBox = (props) => {
    const corners = [props.min.x, props.max.x].flatMap((x) => [props.min.y, props.max.y].flatMap((y) => [props.min.z, props.max.z].map((z) => ({ x, y, z }))));
    for (const [from, to] of BOX_EDGES)
        if (intersectsPerspectiveFrustumSegment({
            camera: props.camera,
            from: corners[from],
            to: corners[to],
            near: props.near,
            far: props.far,
            halfY: props.halfY,
            aspect: props.aspect,
        }))
            return true;
    const lens = frustumCorners(props);
    for (const [from, to] of BOX_EDGES)
        if (segmentMeetsBox(lens[from], lens[to], props.min, props.max))
            return true;
    return false;
};
/**
 * Whether a world-space sphere intersects an exact perspective-camera frustum.
 * Side-plane distances include plane normalization, so callers must not
 * approximate the radius by padding projected NDC coordinates.
 */
export const intersectsPerspectiveFrustumSphere = (props) => {
    const local = Quaternion.rotateVector(Quaternion.inverse(props.camera.rotation), Vector3.subtract(props.center, props.camera.position));
    const depth = -local.z;
    if (Number.isFinite(props.radius) === false ||
        props.radius < 0 ||
        depth + props.radius < props.near ||
        depth - props.radius > props.far)
        return false;
    const halfX = props.halfY * props.aspect;
    return (Math.abs(local.x) <= depth * halfX + props.radius * Math.hypot(1, halfX) &&
        Math.abs(local.y) <=
            depth * props.halfY + props.radius * Math.hypot(1, props.halfY));
};
//# sourceMappingURL=cameraProjection.js.map