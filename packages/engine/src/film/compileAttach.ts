import {
  AutoMovieHumanoidBone,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";

import { IAutoMovieJointAxes } from "../kinematics/jointToQuaternion";
import { resolveAttachment } from "../kinematics/resolveAttachment";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";

/** The child rides the bone directly: origin on the bone, no extra offset. */
const IDENTITY_OFFSET: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * Bake the `attachTo` verb into the **child object's** flight-follow clip, the
 * per-frame realisation of a rigid coupling to a parent's bone (a sword in a
 * hand, a prop on a saddle). The child is not a rig, so (like a projectile)
 * it moves by a node clip of transform tracks, not a pose motion.
 *
 * Each sample resolves the parent's posed skeleton at that instant
 * ({@link resolveAttachment}, which runs the parent's FK) to find the bone's
 * frame in the parent's **model space**, then composes that onto the parent's
 * **staged world placement**, or, when the parent itself rides a coupling this
 * shot, onto its per-sample ridden frame (`parentTransformAt`, #1140), so the
 * child lands in scene space:
 *
 * - `translation = parentPos + parentRot · boneLocal.translation`
 * - `rotation = parentRot ∘ boneLocal.rotation`
 *
 * So as the parent walks, turns, or swings the limb, the child rides with it,
 * position and orientation together, what a physics fixed-joint does. Pass the
 * same `jointAxes` the renderer poses the parent with (`HUMANOID_JOINT_AXES`),
 * plus the same `restFrames` when parent clips are authored in clinical space,
 * or the child follows a bone that sits where the renderer does not draw it.
 * When the parent has no motion, it holds its rest pose and the child is
 * static.
 *
 * The clip is **shot-local** (times over `[start, start + duration]`, spanning
 * `shotDuration`), the same convention as `cameraMotion` and a launch's flight:
 * before the coupling begins it holds the bone's start frame, after it the
 * last.
 *
 * @author Samchon
 */
export const compileAttach = (props: {
  /** The coupled child's scene node: the clip's target. */
  child: string;
  /** The parent bone the child rides. */
  bone: AutoMovieHumanoidBone;
  /** The parent's staged world placement (staging fixes it). */
  parentTransform: IAutoMovieTransform;
  /**
   * The parent's world root over shot-local time, when the parent itself rides
   * a coupling this shot (#1140): each sample composes onto THIS frame instead
   * of the static `parentTransform`, so the child follows the parent's ridden
   * path: a lance in a mounted knight's hand rides the horse. Omit for a
   * parent standing on its staged placement.
   */
  parentTransformAt?: (t: number) => IAutoMovieTransform;
  /** The parent's rig, for the per-frame FK. */
  parentSkeleton: IAutoMovieSkeleton;
  /** The parent's compiled pose motion; absent ⇒ it holds its rest pose. */
  parentMotion?: IAutoMovieMotion;
  /** Shot-local second the coupling begins. */
  start: number;
  /** Length of the coupling in seconds. */
  duration: number;
  /** The shot's length: the clip spans it (shot-local time). */
  shotDuration: number;
  /** Samples per second of the baked follow (default 30). */
  fps?: number;
  /** Clinical-axis remap for the parent's FK (pass `HUMANOID_JOINT_AXES`). */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Per-rig clinical rest-frame remap for the parent's FK. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieClip => {
  const {
    child,
    bone,
    parentTransform,
    parentSkeleton,
    parentMotion,
    start,
    duration,
    shotDuration,
  } = props;
  const fps = props.fps ?? 30;
  // A non-positive span would bake duplicate keyframe times (the loop below
  // emits `start` for both endpoints), an unsamplable clip. `performShot`
  // rejects a zero-span coupling before it reaches here; this precondition (the
  // same one `projectileTrajectory` enforces) seals the baker itself so no
  // other caller can produce a degenerate follow clip.
  if (!(duration > 0))
    throw new RangeError(
      `attach follow duration must be > 0 seconds, but was ${duration}`,
    );
  const restPose: IAutoMoviePose = {
    skeleton: parentSkeleton.id,
    root: null,
    joints: [],
  };
  const attachment = { parentBone: bone, offset: IDENTITY_OFFSET };

  const count = Math.max(1, Math.round(duration * fps));
  const times: number[] = [];
  const pos: number[] = [];
  const rot: number[] = [];
  for (let i = 0; i <= count; ++i) {
    const t = start + (i / count) * duration;
    const pose =
      parentMotion === undefined
        ? restPose
        : sampleMotion(parentMotion, t).pose;
    const local = resolveAttachment(
      pose,
      parentSkeleton,
      attachment,
      props.jointAxes,
      props.restFrames,
    );
    const parentWorld = props.parentTransformAt?.(t) ?? parentTransform;
    const worldPos = Vector3.add(
      parentWorld.translation,
      Quaternion.rotateVector(parentWorld.rotation, local.translation),
    );
    const worldRot = Quaternion.multiply(parentWorld.rotation, local.rotation);
    times.push(t);
    pos.push(worldPos.x, worldPos.y, worldPos.z);
    rot.push(worldRot.x, worldRot.y, worldRot.z, worldRot.w);
  }
  return {
    id: `attach:${child}`,
    name: null,
    duration: shotDuration,
    loop: false,
    tracks: [
      {
        channel: { kind: "node", node: child, path: "translation" },
        times,
        values: pos,
        interpolation: "linear",
      },
      {
        channel: { kind: "node", node: child, path: "rotation" },
        times,
        values: rot,
        interpolation: "linear",
      },
    ],
  };
};
