import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { segmentIndex } from "../math/bisect";
import { cubicBezierEasing, ease } from "./easing";
const IDENTITY_TRANSFORM = {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
};
/**
 * Sample an {@link IAutoMovieMotion} clip at time `seconds`, interpolating
 * between the surrounding keyframes with that segment's easing.
 *
 * This is the bridge from the LLM's sparse keyframes to the dense, per-frame
 * state a renderer consumes: the engine owns interpolation so the same clip
 * plays identically everywhere. Joint angles are interpolated per axis, the
 * root transform by lerp (translation/scale) + slerp (rotation).
 *
 * Time handling: clamped to `[0, duration]`, or wrapped modulo `duration` when
 * the clip `loop`s. Before the first / after the last keyframe the nearest
 * keyframe is returned verbatim.
 *
 * @author Samchon
 */
export const sampleMotion = (motion, seconds) => {
    const frames = motion.keyframes;
    if (frames.length === 0)
        throw new Error(`motion "${motion.id}" must have keyframes to sample`);
    const time = normalizeTime(seconds, motion.duration, motion.loop);
    if (time <= frames[0].time)
        return toSample(motion, frames[0]);
    const last = frames[frames.length - 1];
    if (time >= last.time)
        return toSample(motion, last);
    // Precondition: the clip has strictly increasing keyframe times (the contract
    // validateMotion enforces), so the binary search lands on a segment with a
    // positive span, and its tie rule matches the old linear scan exactly.
    const loIdx = segmentIndex(frames.length, (i) => frames[i].time, time);
    const lo = frames[loIdx];
    const hi = frames[loIdx + 1];
    const span = hi.time - lo.time;
    const linearT = (time - lo.time) / span;
    const t = lo.easing === "cubicBezier" && lo.bezier !== null
        ? cubicBezierEasing(lo.bezier, linearT)
        : ease(lo.easing, linearT);
    return {
        pose: interpolatePose(motion.skeleton, lo.pose, hi.pose, t),
        expression: interpolateExpression(lo.expression, hi.expression, t),
    };
};
const normalizeTime = (seconds, duration, loop) => {
    if (duration <= 0)
        return 0;
    if (loop) {
        const m = seconds % duration;
        return m < 0 ? m + duration : m;
    }
    return Math.min(duration, Math.max(0, seconds));
};
const toSample = (motion, frame) => ({
    pose: { ...frame.pose, skeleton: motion.skeleton },
    expression: frame.expression,
});
const interpolatePose = (skeleton, a, b, t) => {
    const aJoints = new Map(a.joints.map((j) => [j.bone, j]));
    const bJoints = new Map(b.joints.map((j) => [j.bone, j]));
    const bones = new Set([
        ...aJoints.keys(),
        ...bJoints.keys(),
    ]);
    const joints = [];
    for (const bone of bones) {
        const ja = aJoints.get(bone);
        const jb = bJoints.get(bone);
        joints.push({
            bone,
            flexion: lerpAxis(ja?.flexion ?? null, jb?.flexion ?? null, t),
            abduction: lerpAxis(ja?.abduction ?? null, jb?.abduction ?? null, t),
            twist: lerpAxis(ja?.twist ?? null, jb?.twist ?? null, t),
        });
    }
    return {
        skeleton,
        root: lerpTransform(a.root, b.root, t),
        joints,
    };
};
/**
 * Interpolate one axis; `null` is treated as 0 but preserved when both sides
 * are null.
 */
const lerpAxis = (a, b, t) => {
    if (a === null && b === null)
        return null;
    return (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t;
};
const lerpTransform = (a, b, t) => {
    if (a === null && b === null)
        return null;
    const ta = a ?? IDENTITY_TRANSFORM;
    const tb = b ?? IDENTITY_TRANSFORM;
    return {
        translation: Vector3.lerp(ta.translation, tb.translation, t),
        rotation: Quaternion.slerp(ta.rotation, tb.rotation, t),
        scale: Vector3.lerp(ta.scale, tb.scale, t),
    };
};
const interpolateExpression = (a, b, t) => {
    // `null` is the NEUTRAL side (intensity 0 of the authored preset), blended
    // toward like a resting joint axis (`lerpAxis` null → 0) or a resting
    // transform (`lerpTransform` null → identity), the same "unauthored side"
    // convention this file uses everywhere else. An expression authored only at
    // the far keyframe therefore RAMPS in from neutral instead of popping to full
    // at the segment start, and one authored only at the near keyframe fades out
    // to neutral (#1245-round-2 R2-8). Only when neither side is authored is there
    // no expression to sample.
    if (a === null && b === null)
        return null;
    const ea = a ?? neutral(b.preset);
    const eb = b ?? neutral(a.preset);
    // Same preset → blend smoothly; differing presets → switch at the midpoint.
    if (ea.preset !== eb.preset)
        return t < 0.5 ? ea : eb;
    return {
        preset: ea.preset,
        intensity: ea.intensity + (eb.intensity - ea.intensity) * t,
        blendshapes: blendChannels(ea, eb, t),
    };
};
/** The rest expression of a preset: present but with zero intensity/channels. */
const neutral = (preset) => ({
    preset,
    intensity: 0,
    blendshapes: null,
});
const blendChannels = (a, b, t) => {
    if (a.blendshapes === null && b.blendshapes === null)
        return null;
    const weights = new Map();
    for (const c of a.blendshapes ?? [])
        weights.set(c.channel, c.weight * (1 - t));
    for (const c of b.blendshapes ?? [])
        weights.set(c.channel, (weights.get(c.channel) ?? 0) + c.weight * t);
    return [...weights].map(([channel, weight]) => ({ channel, weight }));
};
//# sourceMappingURL=sampleMotion.js.map