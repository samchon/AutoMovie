import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  resolvePose,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieJointConstraint,
  IAutoMovieJointPose,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const bone = (
  name: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  rest: IAutoMovieTransform,
): IAutoMovieBone => ({ bone: name, parent, rest, constraint: null });

/** Bones whose rest offsets the `leg` proportion scales. */
export const LEG_BONES: readonly AutoMovieHumanoidBone[] = [
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
];

/** Bones whose rest offsets the `arm` proportion scales. */
export const ARM_BONES: readonly AutoMovieHumanoidBone[] = [
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
];

/** Per-limb-group rest-offset multipliers; each defaults to `1`. */
export interface IProportions {
  leg?: number;
  torso?: number;
  arm?: number;
}

/**
 * A humanoid rig whose limb groups scale independently, so a target can differ
 * from the source in **proportion** rather than only in overall size.
 *
 * At proportion `1` the rest pose is exact and hand-checkable: hips at y=1.0,
 * hip joint 0.95, knee 0.50, ankle (±0.1, 0.10, 0.10), head 1.75 — a floor of
 * 0.10 and a rest height of 1.65.
 */
export const proportionedRig = (
  id: string,
  proportions: IProportions = {},
): IAutoMovieSkeleton => {
  const leg = proportions.leg ?? 1;
  const torso = proportions.torso ?? 1;
  const arm = proportions.arm ?? 1;
  const at = (
    slot: AutoMovieHumanoidBone,
    x: number,
    y: number,
    z: number,
  ): IAutoMovieTransform => {
    const factor = LEG_BONES.includes(slot)
      ? leg
      : ARM_BONES.includes(slot)
        ? arm
        : torso;
    return restAt(x * factor, y * factor, z * factor);
  };
  return {
    id,
    bones: [
      bone("hips", null, at("hips", 0, 1.0, 0)),
      bone("spine", "hips", at("spine", 0, 0.2, 0)),
      bone("chest", "spine", at("chest", 0, 0.25, 0)),
      bone("neck", "chest", at("neck", 0, 0.15, 0)),
      bone("head", "neck", at("head", 0, 0.15, 0)),
      bone("leftUpperArm", "chest", at("leftUpperArm", 0.18, 0.15, 0)),
      bone("leftLowerArm", "leftUpperArm", at("leftLowerArm", 0.28, 0, 0)),
      bone("leftHand", "leftLowerArm", at("leftHand", 0.25, 0, 0)),
      bone("rightUpperArm", "chest", at("rightUpperArm", -0.18, 0.15, 0)),
      bone("rightLowerArm", "rightUpperArm", at("rightLowerArm", -0.28, 0, 0)),
      bone("rightHand", "rightLowerArm", at("rightHand", -0.25, 0, 0)),
      bone("leftUpperLeg", "hips", at("leftUpperLeg", 0.1, -0.05, 0)),
      bone("leftLowerLeg", "leftUpperLeg", at("leftLowerLeg", 0, -0.45, 0)),
      bone("leftFoot", "leftLowerLeg", at("leftFoot", 0, -0.4, 0.1)),
      bone("rightUpperLeg", "hips", at("rightUpperLeg", -0.1, -0.05, 0)),
      bone("rightLowerLeg", "rightUpperLeg", at("rightLowerLeg", 0, -0.45, 0)),
      bone("rightFoot", "rightLowerLeg", at("rightFoot", 0, -0.4, 0.1)),
    ],
  };
};

/** The same rig with an explicit per-bone ROM override on `bones`. */
export const withJointConstraint = (
  skeleton: IAutoMovieSkeleton,
  bones: readonly AutoMovieHumanoidBone[],
  constraint: IAutoMovieJointConstraint | null,
): IAutoMovieSkeleton => ({
  ...skeleton,
  bones: skeleton.bones.map((b) =>
    bones.includes(b.bone) ? { ...b, constraint } : b,
  ),
});

/** The same rig with `bones` (and anything they parent) removed. */
export const withoutBones = (
  skeleton: IAutoMovieSkeleton,
  bones: readonly AutoMovieHumanoidBone[],
): IAutoMovieSkeleton => ({
  ...skeleton,
  bones: skeleton.bones.filter((b) => !bones.includes(b.bone)),
});

/** The same rig with `bones` collapsed to a zero-length rest offset. */
export const withZeroLengthBones = (
  skeleton: IAutoMovieSkeleton,
  bones: readonly AutoMovieHumanoidBone[],
): IAutoMovieSkeleton => ({
  ...skeleton,
  bones: skeleton.bones.map((b) =>
    bones.includes(b.bone) ? { ...b, rest: restAt(0, 0, 0) } : b,
  ),
});

/**
 * A two-keyframe clip that only moves the root, leaving every joint at rest.
 * Both feet therefore sit exactly on the rig's rest floor for the whole clip —
 * an unambiguous, hand-checkable contact the retarget must preserve.
 */
export const rootShiftClip = (
  skeleton: string,
  shift: IAutoMovieVector3,
  times: readonly number[] = [0, 1],
): IAutoMovieMotion => ({
  id: "root-shift",
  skeleton,
  duration: 1,
  loop: false,
  keyframes: times.map((time, index) => ({
    time,
    pose: {
      skeleton,
      root:
        index === 0
          ? null
          : {
              translation: shift,
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
      joints: [],
    },
    expression: null,
    easing: "linear" as const,
    bezier: null,
  })),
});

/**
 * The same root-shift clip with `joints` authored on every keyframe, so the
 * contact pass has authored articulation to replace and unrelated authored
 * joints to carry through.
 */
export const posedRootShiftClip = (
  skeleton: string,
  shift: IAutoMovieVector3,
  joints: readonly IAutoMovieJointPose[],
): IAutoMovieMotion => {
  const base = rootShiftClip(skeleton, shift);
  return {
    ...base,
    keyframes: base.keyframes.map((kf) => ({
      ...kf,
      pose: { ...kf.pose, joints: joints.map((j) => ({ ...j })) },
    })),
  };
};

/** World position of one bone at one keyframe, read through the humanoid tables. */
export const keyframeWorld = (
  skeleton: IAutoMovieSkeleton,
  motion: IAutoMovieMotion,
  index: number,
  slot: AutoMovieHumanoidBone,
): IAutoMovieVector3 =>
  resolvePose(
    motion.keyframes[index]!.pose,
    skeleton,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  ).find((b) => b.bone === slot)!.worldPosition;

/** A vector scaled by the retarget's root multiplier. */
export const mapped = (
  v: IAutoMovieVector3,
  scale: number,
): IAutoMovieVector3 => ({
  x: v.x * scale,
  y: v.y * scale,
  z: v.z * scale,
});
