import {
  AutoMovieHumanoidBone,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMovieNode,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTrack,
} from "@automovie/interface";

import {
  IAutoMovieJointAxes,
  jointToQuaternion,
} from "../kinematics/jointToQuaternion";
import { Quaternion } from "../math/Quaternion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { sampleMotion } from "./sampleMotion";

const DEFAULT_SAMPLE_RATE = 24;

/**
 * The synthetic node above the lowered bone hierarchy that carries the motion's
 * root transform. `"root"` is not a humanoid bone name (the closed
 * {@link AutoMovieHumanoidBone} union has no such member), so it can never
 * collide with a lowered bone node id.
 */
export const MOTION_ROOT_NODE_ID = "root";

/**
 * A humanoid motion lowered onto the general node/clip model: the skeleton as a
 * bone-node hierarchy plus the clip whose tracks reproduce the motion on it.
 *
 * @author Samchon
 */
export interface IAutoMovieMotionClipBridge {
  /** The baked clip: rotation tracks per articulated bone (+ root TRS). */
  clip: IAutoMovieClip;

  /**
   * The skeleton lowered to nodes: one `bone` node per {@link IAutoMovieBone}
   * (id = bone name, parent = parent bone or the synthetic root), under a
   * `group` root node ({@link MOTION_ROOT_NODE_ID}) that carries the motion's
   * root transform.
   */
  nodes: IAutoMovieNode[];
}

/**
 * Bake a humanoid {@link IAutoMovieMotion} (clinical-angle keyframes) into the
 * general {@link IAutoMovieClip} node-channel form — the bridge that makes "the
 * humanoid motion model and the general clip model are the same thing" a
 * provable fact rather than a doc claim: for every baked sample time,
 * `composeScene` over the returned nodes and clip reproduces `resolvePose`'s
 * world transforms exactly (see the parity tests).
 *
 * **What a rotation track carries.** `composeScene` overrides _replace_ a
 * node's local TRS, so each bone's rotation track holds the bone's full local
 * rotation — `rest.rotation ∘ jointToQuaternion(articulation)` — exactly the
 * `localRotation` {@link resolvePose} computes. Bone translations stay the rest
 * translation (articulation never translates) and node scales are pinned to
 * `1`: `resolvePose` never scales bones (it ignores rest scale and the root
 * scale), so the lowered nodes must too, or a scaled rest pose would shear the
 * composed world apart from FK. The motion's root transform becomes
 * translation/rotation tracks on the synthetic root node — mirroring how
 * `resolvePose` seats root bones under `pose.root`'s rotation/translation.
 *
 * **Sampling parity.** `sampleMotion` interpolates clinical angles per axis and
 * then converts to quaternions; a baked rotation track slerps quaternions. The
 * two agree exactly at bake sample times and differ O(step²) between them, so
 * the bake is dense on a fixed clock (`sampleRate`, default 24 — the engine's
 * convention) and every easing/bezier curve is captured by the dense samples
 * (inter-sample interpolation is linear/slerp after the bake). Expression
 * channels (morph `weights` tracks) are deferred.
 *
 * @author Samchon
 */
export const motionToClip = (props: {
  /** The humanoid motion to lower. */
  motion: IAutoMovieMotion;
  /** The rig the motion articulates; lowered to the returned nodes. */
  skeleton: IAutoMovieSkeleton;
  /** Optional per-bone clinical-axis remap, as {@link resolvePose} takes. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Optional per-bone rest-frame remap, as {@link resolvePose} takes. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  /** Bake samples per second. Defaults to `24`. */
  sampleRate?: number;
}): IAutoMovieMotionClipBridge => {
  const { motion, skeleton } = props;
  const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error(
      `motionToClip sampleRate must be a finite number > 0, but was ${sampleRate}`,
    );
  if (!Number.isFinite(motion.duration) || motion.duration <= 0)
    throw new Error(
      `motionToClip motion "${motion.id}" duration must be a finite number > 0, but was ${motion.duration}`,
    );
  if (motion.keyframes.length === 0)
    throw new Error(
      `motionToClip motion "${motion.id}" must have keyframes to bake`,
    );

  const boneNames = new Set(skeleton.bones.map((bone) => bone.bone));
  const articulated = new Set<AutoMovieHumanoidBone>();
  let hasRoot = false;
  for (const frame of motion.keyframes) {
    for (const joint of frame.pose.joints) {
      if (!boneNames.has(joint.bone))
        throw new Error(
          `motionToClip motion "${motion.id}" articulates bone "${joint.bone}" that skeleton "${skeleton.id}" does not have`,
        );
      articulated.add(joint.bone);
    }
    if (frame.pose.root !== null) hasRoot = true;
  }

  const nodes = lowerSkeleton(skeleton);
  const times = sampleTimes(motion.duration, sampleRate);
  const samples = times.map((time) => sampleMotion(motion, time).pose);

  const tracks: IAutoMovieTrack[] = [];
  if (hasRoot) {
    tracks.push(
      rootTrack(times, samples, "translation"),
      rootTrack(times, samples, "rotation"),
    );
  }
  // Deterministic track order: skeleton declaration order, articulated only —
  // an unarticulated bone keeps its node rest transform, which already equals
  // resolvePose's identity-articulation local rotation.
  for (const bone of skeleton.bones) {
    if (!articulated.has(bone.bone)) continue;
    const values: number[] = [];
    for (const pose of samples) {
      const joint = pose.joints.find((j) => j.bone === bone.bone);
      const articulation =
        joint === undefined
          ? Quaternion.identity()
          : jointToQuaternion(
              joint,
              props.jointAxes?.[bone.bone],
              props.restFrames?.[bone.bone],
            );
      const local = Quaternion.multiply(bone.rest.rotation, articulation);
      values.push(local.x, local.y, local.z, local.w);
    }
    tracks.push({
      channel: { kind: "node", node: bone.bone, path: "rotation" },
      times: [...times],
      values,
      interpolation: "linear",
    });
  }

  return {
    clip: {
      id: motion.id,
      name: null,
      duration: motion.duration,
      loop: motion.loop,
      tracks,
    },
    nodes,
  };
};

/**
 * Lower a skeleton to the node hierarchy `composeScene` walks: a `group` root
 * carrying the motion's root transform, then one `bone` node per bone with the
 * rest translation/rotation and scale pinned to `1` (mirroring
 * {@link resolvePose}, which never scales bones).
 */
const lowerSkeleton = (skeleton: IAutoMovieSkeleton): IAutoMovieNode[] => {
  const nodes: IAutoMovieNode[] = [
    {
      id: MOTION_ROOT_NODE_ID,
      name: null,
      parent: null,
      kind: "group",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: null,
      camera: null,
      light: null,
      skin: null,
    },
  ];
  for (const bone of skeleton.bones)
    nodes.push({
      id: bone.bone,
      name: null,
      parent: bone.parent ?? MOTION_ROOT_NODE_ID,
      kind: "bone",
      transform: {
        translation: bone.rest.translation,
        rotation: bone.rest.rotation,
        scale: { x: 1, y: 1, z: 1 },
      },
      mesh: null,
      camera: null,
      light: null,
      skin: null,
    });
  return nodes;
};

/** The root node's translation or rotation track from the sampled root. */
const rootTrack = (
  times: number[],
  samples: IAutoMoviePose[],
  path: "translation" | "rotation",
): IAutoMovieTrack => {
  const values: number[] = [];
  for (const pose of samples) {
    if (path === "translation") {
      const t = pose.root?.translation ?? { x: 0, y: 0, z: 0 };
      values.push(t.x, t.y, t.z);
    } else {
      const r = pose.root?.rotation ?? Quaternion.identity();
      values.push(r.x, r.y, r.z, r.w);
    }
  }
  return {
    channel: { kind: "node", node: MOTION_ROOT_NODE_ID, path },
    times: [...times],
    values,
    interpolation: "linear",
  };
};

/** The dense bake clock: `i / sampleRate` clamped to end exactly at duration. */
const sampleTimes = (duration: number, sampleRate: number): number[] => {
  const frames = Math.max(1, Math.ceil(duration * sampleRate));
  return Array.from({ length: frames + 1 }, (_, index) =>
    Math.min(duration, index / sampleRate),
  );
};
