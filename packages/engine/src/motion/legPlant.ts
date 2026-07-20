import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { decomposeJointRotation } from "../kinematics/decomposeJointRotation";
import {
  DEFAULT_JOINT_AXES,
  IAutoMovieJointAxes,
  normalizeJointAxes,
} from "../kinematics/jointToQuaternion";
import {
  IAutoMovieResolvedBone,
  IAutoMovieSkeletonTopology,
  indexSkeletonTopology,
  resolvePose,
} from "../kinematics/resolvePose";
import { twoBoneChainArticulation } from "../kinematics/twoBoneChainArticulation";
import { Quaternion } from "../math/Quaternion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import {
  IAutoMovieFootLeg,
  IAutoMovieFootPlant,
  IAutoMoviePlantedFeet,
} from "./plantFeet";
import { sampleMotion } from "./sampleMotion";

/**
 * A two-segment chain pinned by its end effector: a leg (hip → knee → ankle) or
 * an arm (shoulder → elbow → hand). The plant solver is limb-agnostic: which
 * bones form the chain is the caller's rig policy, the algebra is not.
 *
 * @author Samchon
 */
export interface IAutoMoviePlantChain {
  /** End-effector bone driven onto the pinned target (foot / hand). */
  effector: AutoMovieHumanoidBone;
  /** Chain-root segment (thigh / upper arm). */
  upper: AutoMovieHumanoidBone;
  /** Mid segment (shin / forearm). */
  lower: AutoMovieHumanoidBone;
}

/** The humanoid leg chains, the default both plant passes pin. */
export const HUMANOID_LEG_CHAINS: readonly IAutoMoviePlantChain[] = [
  { effector: "leftFoot", upper: "leftUpperLeg", lower: "leftLowerLeg" },
  { effector: "rightFoot", upper: "rightUpperLeg", lower: "rightLowerLeg" },
];

/**
 * Re-key the sampled frames densely, re-solving every pinned leg onto its
 * stance target (the assembly stage of {@link plantStanceFeet}).
 */
export const rekeyPlantedFeet = (props: {
  skeleton: IAutoMovieSkeleton;
  times: readonly number[];
  poses: ReadonlyArray<ReturnType<typeof sampleMotion>>;
  legs: readonly IAutoMovieFootLeg[];
  targets: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>;
}): IAutoMovieKeyframe[] => {
  const topology = indexSkeletonTopology(props.skeleton);
  return props.times.map((time, index) => ({
    time,
    pose: {
      skeleton: props.poses[index]!.pose.skeleton,
      root: props.poses[index]!.pose.root,
      joints: plantedJoints(
        props.skeleton,
        props.poses[index]!.pose,
        props.legs,
        props.targets[index]!,
        topology,
      ),
    },
    expression: props.poses[index]!.expression,
    easing: "linear" as const,
    bezier: null,
  }));
};

/** Wrap the corrected keyframes + plants as the pass result. */
export const assemblePlantedFeet = (
  motion: IAutoMovieMotion,
  keyframes: IAutoMovieKeyframe[],
  plants: IAutoMovieFootPlant[],
): IAutoMoviePlantedFeet => ({
  motion: {
    id: motion.id,
    skeleton: motion.skeleton,
    duration: motion.duration,
    loop: motion.loop,
    keyframes,
  },
  plants,
});

/**
 * FK-resolve a pose into a bone → resolved-bone lookup. `jointAxes` /
 * `restFrames` are the same optional clinical remaps {@link resolvePose} takes:
 * omit them for the default clinical basis (what the ground-IK pass uses),
 * supply a rig's own tables when the pose's clinical angles must be read
 * through them (what the retarget contact pass uses).
 */
export const resolveBoneMap = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  topology: IAutoMovieSkeletonTopology = indexSkeletonTopology(skeleton),
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
): Map<AutoMovieHumanoidBone, IAutoMovieResolvedBone> =>
  new Map(
    resolvePose(pose, skeleton, jointAxes, restFrames, topology).map((bone) => [
      bone.bone,
      bone,
    ]),
  );

/**
 * The frame's joints with every pinned leg re-solved onto its target: planted
 * legs get their {@link solveLegPlant} articulation, everything else is carried
 * through unchanged.
 */
const plantedJoints = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  legs: readonly IAutoMovieFootLeg[],
  targets: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>,
  topology: IAutoMovieSkeletonTopology,
): IAutoMovieJointPose[] => {
  let joints = pose.joints;
  for (const leg of legs) {
    const target = targets.get(leg.foot);
    if (target === undefined) continue;
    const solved = solveChainPlant({
      skeleton,
      pose,
      chain: { effector: leg.foot, upper: leg.upper, lower: leg.lower },
      target,
      topology,
    });
    if (solved === null) continue;
    joints = [
      ...joints.filter((j) => j.bone !== leg.upper && j.bone !== leg.lower),
      solved.upper,
      solved.lower,
    ];
  }
  return joints;
};

/**
 * Two-bone IK for one limb: the upper + mid articulation that lands the chain's
 * effector on the pinned world `target`, rooted at the chain's **current posed
 * root joint**. The lowering is the shared {@link twoBoneChainArticulation} (the
 * same algebra {@link reachPose} applies to an arm), fed a chain read from the
 * current pose with the limb zeroed, so the correction composes on top of the
 * clip's root/torso motion rather than replacing it.
 *
 * `jointAxes` / `restFrames` decide the clinical convention the two deltas are
 * lowered into. The ground-IK pass omits them (legs sit on the default clinical
 * basis); the retarget contact pass supplies the target rig's own tables, which
 * is what lets an arm chain, whose humanoid axes are remapped, come back as
 * angles the same tables will re-read.
 *
 * The returned `hinge` is the mid joint's world flexion axis under that same
 * zeroed chain. A caller whose result must survive the joint's ROM re-solves
 * with `bendNormal: ±hinge`: a knee that declares `abduction`/`twist` immobile
 * can only articulate in its hinge plane, so a solve in any other plane leaves
 * exactly the components the ROM clamp zeroes out.
 *
 * Returns `null` for a missing or degenerate chain.
 *
 * @author Samchon
 */
export const solveChainPlant = (props: {
  /** Rig the pose is resolved against. */
  skeleton: IAutoMovieSkeleton;
  /** Current frame pose the correction composes on top of. */
  pose: IAutoMoviePose;
  /** Chain being pinned. */
  chain: IAutoMoviePlantChain;
  /** World position the effector must land on. */
  target: IAutoMovieVector3;
  /** Pre-indexed hierarchy for the repeated FK. */
  topology: IAutoMovieSkeletonTopology;
  /** Clinical axis remap the recovered angles are expressed in. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Clinical rest-frame remap the recovered angles are expressed in. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;

  /** Explicit bend-plane normal; omitted uses the world-down pole. */
  bendNormal?: IAutoMovieVector3;
}): {
  upper: IAutoMovieJointPose;
  lower: IAutoMovieJointPose;
  hinge: IAutoMovieVector3;
} | null => {
  const { chain } = props;
  // The limb at rest under the current parent pose: zero its own articulation
  // so the recovered world rotations carry the torso pose but not the limb's.
  const zeroed: IAutoMoviePose = {
    skeleton: props.pose.skeleton,
    root: props.pose.root,
    joints: props.pose.joints.filter(
      (j) => j.bone !== chain.upper && j.bone !== chain.lower,
    ),
  };
  const map = resolveBoneMap(
    props.skeleton,
    zeroed,
    props.topology,
    props.jointAxes,
    props.restFrames,
  );
  const upper = map.get(chain.upper);
  const lower = map.get(chain.lower);
  const effector = map.get(chain.effector);
  if (upper === undefined || lower === undefined || effector === undefined)
    return null;

  const articulation = twoBoneChainArticulation({
    upper,
    lower,
    end: effector.worldPosition,
    target: props.target,
    bendNormal: props.bendNormal,
  });
  if (articulation === null) return null;

  return {
    hinge: Quaternion.rotateVector(
      lower.worldRotation,
      normalizeJointAxes(
        props.jointAxes?.[chain.lower] ?? DEFAULT_JOINT_AXES,
        "solveChainPlant axes",
      ).flexion,
    ),
    upper: {
      bone: chain.upper,
      ...decomposeJointRotation(
        articulation.upper,
        props.jointAxes?.[chain.upper],
        props.restFrames?.[chain.upper],
      ),
    },
    lower: {
      bone: chain.lower,
      ...decomposeJointRotation(
        articulation.lower,
        props.jointAxes?.[chain.lower],
        props.restFrames?.[chain.lower],
      ),
    },
  };
};
