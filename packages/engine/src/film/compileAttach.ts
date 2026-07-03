import {
  AutoFilmHumanoidBone,
  IAutoFilmClip,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmSkeleton,
  IAutoFilmTransform,
} from "@autofilm/interface";

import { IAutoFilmJointAxes } from "../kinematics/jointToQuaternion";
import { resolveAttachment } from "../kinematics/resolveAttachment";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";

/** The child rides the bone directly — origin on the bone, no extra offset. */
const IDENTITY_OFFSET: IAutoFilmTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * Bake the `attachTo` verb into the **child object's** flight-follow clip — the
 * per-frame realisation of a rigid coupling to a parent's bone (a sword in a
 * hand, a prop on a saddle). The child is not a rig, so — like a projectile —
 * it moves by a node clip of transform tracks, not a pose motion.
 *
 * Each sample resolves the parent's posed skeleton at that instant
 * ({@link resolveAttachment}, which runs the parent's FK) to find the bone's
 * frame in the parent's **model space**, then composes that onto the parent's
 * **staged world placement** so the child lands in scene space:
 *
 * - `translation = parentPos + parentRot · boneLocal.translation`
 * - `rotation = parentRot ∘ boneLocal.rotation`
 *
 * So as the parent walks, turns, or swings the limb, the child rides with it,
 * position and orientation together — what a physics fixed-joint does. Pass the
 * same `jointAxes` the renderer poses the parent with (`HUMANOID_JOINT_AXES`),
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
  /** The coupled child's scene node — the clip's target. */
  child: string;
  /** The parent bone the child rides. */
  bone: AutoFilmHumanoidBone;
  /** The parent's staged world placement (staging fixes it). */
  parentTransform: IAutoFilmTransform;
  /** The parent's rig, for the per-frame FK. */
  parentSkeleton: IAutoFilmSkeleton;
  /** The parent's compiled pose motion; absent ⇒ it holds its rest pose. */
  parentMotion?: IAutoFilmMotion;
  /** Shot-local second the coupling begins. */
  start: number;
  /** Length of the coupling in seconds. */
  duration: number;
  /** The shot's length — the clip spans it (shot-local time). */
  shotDuration: number;
  /** Samples per second of the baked follow (default 30). */
  fps?: number;
  /** Clinical-axis remap for the parent's FK (pass `HUMANOID_JOINT_AXES`). */
  jointAxes?: Partial<Record<AutoFilmHumanoidBone, IAutoFilmJointAxes>>;
}): IAutoFilmClip => {
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
  const restPose: IAutoFilmPose = {
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
    );
    const worldPos = Vector3.add(
      parentTransform.translation,
      Quaternion.rotateVector(parentTransform.rotation, local.translation),
    );
    const worldRot = Quaternion.multiply(
      parentTransform.rotation,
      local.rotation,
    );
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
