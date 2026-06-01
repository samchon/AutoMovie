import {
  IMoticaBlendshapeChannel,
  IMoticaExpression,
  IMoticaJointPose,
  IMoticaKeyframe,
  IMoticaMotion,
  IMoticaPose,
  IMoticaTransform,
  MoticaArkitChannel,
  MoticaHumanoidBone,
} from "@motica/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { cubicBezierEasing, ease } from "./easing";

/** A pose plus optional expression sampled at one instant of a clip. */
export interface IMoticaMotionSample {
  pose: IMoticaPose;
  expression: IMoticaExpression | null;
}

const IDENTITY_TRANSFORM: IMoticaTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * Sample an {@link IMoticaMotion} clip at time `seconds`, interpolating between
 * the surrounding keyframes with that segment's easing.
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
export const sampleMotion = (
  motion: IMoticaMotion,
  seconds: number,
): IMoticaMotionSample => {
  const frames = motion.keyframes;
  const time = normalizeTime(seconds, motion.duration, motion.loop);

  if (time <= frames[0]!.time) return toSample(motion, frames[0]!);
  const last = frames[frames.length - 1]!;
  if (time >= last.time) return toSample(motion, last);

  let lo = frames[0]!;
  let hi = last;
  for (let i = 0; i < frames.length - 1; ++i)
    if (time >= frames[i]!.time && time <= frames[i + 1]!.time) {
      lo = frames[i]!;
      hi = frames[i + 1]!;
      break;
    }

  // Precondition: the clip has strictly increasing keyframe times (the contract
  // validateMotion enforces), so the selected segment always has a positive span.
  const span = hi.time - lo.time;
  const linearT = (time - lo.time) / span;
  const t =
    lo.easing === "cubicBezier" && lo.bezier !== null
      ? cubicBezierEasing(lo.bezier, linearT)
      : ease(lo.easing, linearT);

  return {
    pose: interpolatePose(motion.skeleton, lo.pose, hi.pose, t),
    expression: interpolateExpression(lo.expression, hi.expression, t),
  };
};

const normalizeTime = (
  seconds: number,
  duration: number,
  loop: boolean,
): number => {
  if (duration <= 0) return 0;
  if (loop) {
    const m = seconds % duration;
    return m < 0 ? m + duration : m;
  }
  return Math.min(duration, Math.max(0, seconds));
};

const toSample = (
  motion: IMoticaMotion,
  frame: IMoticaKeyframe,
): IMoticaMotionSample => ({
  pose: { ...frame.pose, skeleton: motion.skeleton },
  expression: frame.expression,
});

const interpolatePose = (
  skeleton: string,
  a: IMoticaPose,
  b: IMoticaPose,
  t: number,
): IMoticaPose => {
  const aJoints = new Map(a.joints.map((j) => [j.bone, j]));
  const bJoints = new Map(b.joints.map((j) => [j.bone, j]));
  const bones = new Set<MoticaHumanoidBone>([
    ...aJoints.keys(),
    ...bJoints.keys(),
  ]);

  const joints: IMoticaJointPose[] = [];
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
const lerpAxis = (
  a: number | null,
  b: number | null,
  t: number,
): number | null => {
  if (a === null && b === null) return null;
  return (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t;
};

const lerpTransform = (
  a: IMoticaTransform | null,
  b: IMoticaTransform | null,
  t: number,
): IMoticaTransform | null => {
  if (a === null && b === null) return null;
  const ta = a ?? IDENTITY_TRANSFORM;
  const tb = b ?? IDENTITY_TRANSFORM;
  return {
    translation: Vector3.lerp(ta.translation, tb.translation, t),
    rotation: Quaternion.slerp(ta.rotation, tb.rotation, t),
    scale: Vector3.lerp(ta.scale, tb.scale, t),
  };
};

const interpolateExpression = (
  a: IMoticaExpression | null,
  b: IMoticaExpression | null,
  t: number,
): IMoticaExpression | null => {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  // Same preset → blend smoothly; differing presets → switch at the midpoint.
  if (a.preset !== b.preset) return t < 0.5 ? a : b;
  return {
    preset: a.preset,
    intensity: a.intensity + (b.intensity - a.intensity) * t,
    blendshapes: blendChannels(a, b, t),
  };
};

const blendChannels = (
  a: IMoticaExpression,
  b: IMoticaExpression,
  t: number,
): IMoticaBlendshapeChannel[] | null => {
  if (a.blendshapes === null && b.blendshapes === null) return null;
  const weights = new Map<MoticaArkitChannel, number>();
  for (const c of a.blendshapes ?? [])
    weights.set(c.channel, c.weight * (1 - t));
  for (const c of b.blendshapes ?? [])
    weights.set(c.channel, (weights.get(c.channel) ?? 0) + c.weight * t);
  return [...weights].map(([channel, weight]) => ({ channel, weight }));
};
