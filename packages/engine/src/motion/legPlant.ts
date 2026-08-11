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
  jointToQuaternion,
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
import { Vector3 } from "../math/Vector3";
import { clampJointToSkeleton } from "../rom/clampPose";
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
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Names the limb segments whose effector is solved against an authoritative contact target.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Defines the articulated support chain consumed by contact resolution.
 * @author Samchon
 */
export interface IAutoMoviePlantChain {
  /**
   * End-effector bone driven onto the pinned target (foot / hand).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Identifies the point whose world contact is authoritative.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Selects the support effector measured after the solve.
   */
  effector: AutoMovieHumanoidBone;
  /**
   * Chain-root segment (thigh / upper arm).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Anchors contact correction at the declared proximal segment.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Establishes the first articulated link that transfers support.
   */
  upper: AutoMovieHumanoidBone;
  /**
   * Mid segment (shin / forearm).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Identifies the hinge segment adjusted to reach the contact target.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Establishes the second link of the support chain.
   */
  lower: AutoMovieHumanoidBone;
}

/**
 * The humanoid leg chains, the default both plant passes pin.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Applies the shared contact policy to the two canonical foot effectors.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Supplies the default bilateral support set for humanoid planting.
 */
export const HUMANOID_LEG_CHAINS: readonly IAutoMoviePlantChain[] = [
  { effector: "leftFoot", upper: "leftUpperLeg", lower: "leftLowerLeg" },
  { effector: "rightFoot", upper: "rightUpperLeg", lower: "rightLowerLeg" },
];

/**
 * Re-key the sampled frames densely, re-solving every pinned leg onto its
 * stance target (the assembly stage of {@link plantStanceFeet}). Optional
 * clinical mappings must be the same ones used to resolve the stance samples
 * and later play the returned motion.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Re-solves every sample inside each declared planted interval while leaving swing samples unpinned.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Bakes the resolved support targets back into the motion keyframes.
 */
export const rekeyPlantedFeet = (props: {
  skeleton: IAutoMovieSkeleton;
  times: readonly number[];
  poses: ReadonlyArray<ReturnType<typeof sampleMotion>>;
  legs: readonly IAutoMovieFootLeg[];
  targets: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>;
  /** Optional clinical axes used to lower and replay solved joints. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Optional clinical rest frames used to lower and replay solved joints. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieKeyframe[] => {
  const topology = indexSkeletonTopology(props.skeleton);
  const keyframes: IAutoMovieKeyframe[] = [];
  let prior: IAutoMoviePose | undefined;
  props.times.forEach((time, index) => {
    const sampled = props.poses[index]!;
    const pose: IAutoMoviePose = {
      skeleton: sampled.pose.skeleton,
      root: sampled.pose.root,
      joints: plantedJoints(
        props.skeleton,
        sampled.pose,
        props.legs,
        props.targets[index]!,
        topology,
        prior,
        props.jointAxes,
        props.restFrames,
      ),
    };
    keyframes.push({
      time,
      pose,
      expression: sampled.expression,
      easing: "linear",
      bezier: null,
    });
    prior = pose;
  });
  return keyframes;
};

/**
 * Wrap the corrected keyframes + plants as the pass result.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Returns both the corrected motion and the planted intervals that explain it.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Couples the support observations to their baked motion result.
 */
export const assemblePlantedFeet = (
  motion: IAutoMovieMotion,
  keyframes: IAutoMovieKeyframe[],
  plants: IAutoMovieFootPlant[],
): IAutoMoviePlantedFeet => ({
  motion: {
    ...motion,
    keyframes,
  },
  plants,
});

/**
 * FK-resolve a pose into a bone → resolved-bone lookup. `jointAxes` /
 * `restFrames` are the same optional clinical remaps {@link resolvePose} takes:
 * omit them for the canonical clinical basis, or supply a rig's own tables when
 * the pose's clinical angles must be read through them (what the ground plant
 * and retarget contact passes do for imported/non-canonical rigs).
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Resolves each effector in the same rig basis used to judge its contact target.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Produces the world-space joint state measured by the contact pass.
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
 * Fit one two-bone chain onto a world-space target without leaving the rig's
 * effective ROM. The authored pose and a deterministic bend-plane search are
 * compared by the effector position they actually produce after clamping. A
 * candidate is accepted only when it improves the current residual bucket, or
 * when it preserves that bucket while moving closer to an explicit prior pose.
 *
 * This is the shared contact policy for ground planting and retargeting. A
 * world-down pole alone can lower a hinge joint into abduction/twist that its
 * ROM immediately removes. A fixed rest-hinge plane is insufficient too: a hip
 * ball joint rotates the knee's world hinge plane while reaching a lateral pin.
 * Searching around the reach axis finds that rotated plane, while keeping the
 * original pose in the candidate set makes an unreachable or constrained target
 * non-destructive.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Keeps every candidate inside the skeleton's declared joint ranges while seeking the target.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Chooses the closest legal articulated solve under the rig's ROM controls.
 * @author Samchon
 */
export const fitChainToTarget = (props: {
  /** Rig whose ROM and rest transforms constrain the solve. */
  skeleton: IAutoMovieSkeleton;
  /** Current authored pose; returned unchanged when no candidate improves it. */
  pose: IAutoMoviePose;
  /** Ordered root, mid, and end-effector bones of one descendant chain. */
  chain: IAutoMoviePlantChain;
  /** World-space position the end effector should reach. */
  target: IAutoMovieVector3;
  /** Pre-indexed topology belonging to `skeleton`. */
  topology: IAutoMovieSkeletonTopology;
  /** Optional clinical axes used consistently by IK, ROM, and FK. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Optional clinical rest frames used consistently by IK, ROM, and FK. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  /**
   * Prior corrected pose used only to stabilize equal-residual bend branches;
   * its root and non-chain joints do not replace the current pose.
   */
  referencePose?: IAutoMoviePose;
}): IAutoMoviePose => {
  const prepared = prepareChainPlant(props);
  if (prepared === null) return props.pose;
  const solve = (
    bendNormal?: IAutoMovieVector3,
  ): ReturnType<typeof solvePreparedChainPlant> =>
    solvePreparedChainPlant({
      prepared,
      target: props.target,
      bendNormal,
      jointAxes: props.jointAxes,
      restFrames: props.restFrames,
    });

  const pole = solve();
  if (pole === null) return props.pose;
  const authored = resolveBoneMap(
    props.skeleton,
    props.pose,
    props.topology,
    props.jointAxes,
    props.restFrames,
  ).get(props.chain.effector)!.worldPosition;
  const distance = (position: IAutoMovieVector3): number =>
    Vector3.length(Vector3.subtract(position, props.target));
  const reference = props.referencePose ?? props.pose;
  const referenceAngles = new Map(
    reference.joints.map((joint) => [joint.bone, joint] as const),
  );
  const authoredAngles = new Map(
    props.pose.joints.map((joint) => [joint.bone, joint] as const),
  );
  const rotationDistance = (
    bone: AutoMovieHumanoidBone,
    candidate: IAutoMovieJointPose | undefined,
  ): number =>
    jointRotationDistance(
      candidate ?? {
        bone,
        flexion: null,
        abduction: null,
        twist: null,
      },
      referenceAngles.get(bone),
      props.jointAxes?.[bone],
      props.restFrames?.[bone],
    );
  let best: {
    pose: IAutoMoviePose;
    residual: number;
    continuity: number;
  } = {
    pose: props.pose,
    residual: distance(authored),
    continuity:
      props.referencePose === undefined
        ? 0
        : rotationDistance(
            props.chain.upper,
            authoredAngles.get(props.chain.upper),
          ) +
          rotationDistance(
            props.chain.lower,
            authoredAngles.get(props.chain.lower),
          ),
  };
  const consider = (
    solved: NonNullable<ReturnType<typeof solve>>,
  ): IPlantCandidateScore => {
    const upper = clampJointToSkeleton(solved.upper, props.skeleton);
    const lower = clampJointToSkeleton(solved.lower, props.skeleton);
    const candidate: IAutoMoviePose = {
      ...props.pose,
      joints: [
        ...props.pose.joints.filter(
          (joint) =>
            joint.bone !== props.chain.upper &&
            joint.bone !== props.chain.lower,
        ),
        upper,
        lower,
      ],
    };
    const candidateResidual = distance(
      resolvedPreparedEffector({
        prepared,
        upper,
        lower,
        jointAxes: props.jointAxes,
        restFrames: props.restFrames,
      }),
    );
    const continuity =
      jointRotationDistance(
        upper,
        referenceAngles.get(upper.bone),
        props.jointAxes?.[upper.bone],
        props.restFrames?.[upper.bone],
      ) +
      jointRotationDistance(
        lower,
        referenceAngles.get(lower.bone),
        props.jointAxes?.[lower.bone],
        props.restFrames?.[lower.bone],
      );
    const score = { residual: candidateResidual, continuity };
    if (comparePlantCandidate(score, best) < 0)
      best = {
        pose: candidate,
        residual: candidateResidual,
        continuity,
      };
    return score;
  };
  const canFinish = (): boolean =>
    plantResidualBucket(best.residual) === 0 &&
    (props.referencePose === undefined ||
      best.continuity <= PLANT_CONTINUITY_EPSILON);

  consider(pole);
  if (canFinish()) return best.pose;

  const upper = prepared.upper;
  const reachAxis = Vector3.normalize(
    Vector3.subtract(props.target, upper.worldPosition),
  );
  let primary = Vector3.subtract(
    pole.hinge,
    Vector3.scale(reachAxis, Vector3.dot(pole.hinge, reachAxis)),
  );
  if (Vector3.length(primary) < 1e-6)
    primary = Vector3.cross(reachAxis, { x: 0, y: -1, z: 0 });
  if (Vector3.length(primary) < 1e-6)
    primary = Vector3.cross(reachAxis, { x: 0, y: 0, z: 1 });
  primary = Vector3.normalize(primary);
  const secondary = Vector3.normalize(Vector3.cross(reachAxis, primary));
  const normalAt = (angle: number): IAutoMovieVector3 =>
    Vector3.add(
      Vector3.scale(primary, Math.cos(angle)),
      Vector3.scale(secondary, Math.sin(angle)),
    );

  if (props.referencePose !== undefined) {
    const referenceJoints = [props.chain.upper, props.chain.lower].map(
      (bone): IAutoMovieJointPose =>
        referenceAngles.get(bone) ?? {
          bone,
          flexion: null,
          abduction: null,
          twist: null,
        },
    );
    const referenceLower = resolveBoneMap(
      props.skeleton,
      {
        ...props.pose,
        joints: [
          ...props.pose.joints.filter(
            (joint) =>
              joint.bone !== props.chain.upper &&
              joint.bone !== props.chain.lower,
          ),
          ...referenceJoints,
        ],
      },
      props.topology,
      props.jointAxes,
      props.restFrames,
    ).get(props.chain.lower)!;
    const referenceNormal = Vector3.cross(
      reachAxis,
      Vector3.subtract(referenceLower.worldPosition, upper.worldPosition),
    );
    if (Vector3.length(referenceNormal) >= 1e-6) {
      consider(solve(Vector3.normalize(referenceNormal))!);
      if (canFinish()) return best.pose;
    }
  }

  const segments = 32;
  const sweep: Array<{ angle: number } & IPlantCandidateScore> = [];
  for (let index = 0; index < segments; ++index) {
    const angle = (2 * Math.PI * index) / segments;
    sweep.push({ angle, ...consider(solve(normalAt(angle))!) });
    if (canFinish()) return best.pose;
  }
  const minima = sweep.filter((entry, index) => {
    const previous = sweep[(index + segments - 1) % segments]!;
    const next = sweep[(index + 1) % segments]!;
    const previousOrder = comparePlantCandidate(entry, previous);
    const nextOrder = comparePlantCandidate(entry, next);
    return (
      previousOrder <= 0 &&
      nextOrder <= 0 &&
      (previousOrder < 0 || nextOrder < 0)
    );
  });
  for (const minimum of minima) {
    let center = minimum;
    let step = (2 * Math.PI) / segments;
    for (let iteration = 0; iteration < 10; ++iteration) {
      step /= 2;
      for (const angle of [center.angle - step, center.angle + step]) {
        const candidate = {
          angle,
          ...consider(solve(normalAt(angle))!),
        };
        if (comparePlantCandidate(candidate, center) < 0) center = candidate;
        if (canFinish()) return best.pose;
      }
    }
  }
  return best.pose;
};

const PLANT_RESIDUAL_EPSILON = 1e-7;
const PLANT_CONTINUITY_EPSILON = 1e-12;

interface IPlantCandidateScore {
  residual: number;
  continuity: number;
}

const plantResidualBucket = (residual: number): number =>
  Math.floor(residual / PLANT_RESIDUAL_EPSILON);

/** Residual buckets are ordered first; continuity breaks equivalent pins. */
const comparePlantCandidate = (
  left: IPlantCandidateScore,
  right: IPlantCandidateScore,
): number => {
  const residualOrder =
    plantResidualBucket(left.residual) - plantResidualBucket(right.residual);
  if (residualOrder !== 0) return residualOrder;
  const continuityOrder = left.continuity - right.continuity;
  return continuityOrder === 0
    ? left.residual - right.residual
    : continuityOrder;
};

/** Sign-insensitive geodesic distance between two joint rotations. */
const jointRotationDistance = (
  joint: IAutoMovieJointPose,
  reference: IAutoMovieJointPose | undefined,
  axes: IAutoMovieJointAxes | undefined,
  restFrame: IAutoMovieRestFrame | undefined,
): number => {
  const candidate = Quaternion.normalize(
    jointToQuaternion(joint, axes, restFrame),
  );
  const prior = Quaternion.normalize(
    jointToQuaternion(
      reference ?? {
        bone: joint.bone,
        flexion: null,
        abduction: null,
        twist: null,
      },
      axes,
      restFrame,
    ),
  );
  const dot = Math.min(
    1,
    Math.abs(
      candidate.x * prior.x +
        candidate.y * prior.y +
        candidate.z * prior.z +
        candidate.w * prior.w,
    ),
  );
  const angle = 2 * Math.acos(dot);
  return angle * angle;
};

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
  referencePose?: IAutoMoviePose,
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
): IAutoMovieJointPose[] => {
  let joints = pose.joints;
  for (const leg of legs) {
    const target = targets.get(leg.foot);
    if (target === undefined) continue;
    const fitted = fitChainToTarget({
      skeleton,
      pose: { ...pose, joints },
      chain: { effector: leg.foot, upper: leg.upper, lower: leg.lower },
      target,
      topology,
      referencePose,
      jointAxes,
      restFrames,
    });
    joints = fitted.joints;
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
 * lowered into. Canonical callers may omit them; ground-IK and retarget callers
 * supply the rig's own tables when its basis or rest frame is non-canonical,
 * which makes the resulting angles round-trip through the same FK convention.
 *
 * The returned `hinge` is the mid joint's world flexion axis under that same
 * zeroed chain. {@link fitChainToTarget} projects it onto the reach-normal plane
 * and searches the full circle: a ball-joint parent can rotate the hinge's
 * world plane while the mid joint remains legal flexion-only articulation.
 *
 * Returns `null` for a missing or degenerate chain.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Converts a reachable world target into clinical joint angles for the characterized chain.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Derives the chain articulation in the same axes and rest-frame basis used by rig validation.
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
  const prepared = prepareChainPlant(props);
  return prepared === null
    ? null
    : solvePreparedChainPlant({
        prepared,
        target: props.target,
        bendNormal: props.bendNormal,
        jointAxes: props.jointAxes,
        restFrames: props.restFrames,
      });
};

interface IPreparedChainPlant {
  chain: IAutoMoviePlantChain;
  upper: IAutoMovieResolvedBone;
  lower: IAutoMovieResolvedBone;
  end: IAutoMovieVector3;
  hinge: IAutoMovieVector3;
  lowerOffset: IAutoMovieVector3;
  lowerRotation: ReturnType<typeof Quaternion.identity>;
  effectorOffset: IAutoMovieVector3;
}

/** Resolve the pose-invariant chain data once for a bend-plane search. */
const prepareChainPlant = (props: {
  skeleton: IAutoMovieSkeleton;
  pose: IAutoMoviePose;
  chain: IAutoMoviePlantChain;
  topology: IAutoMovieSkeletonTopology;
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IPreparedChainPlant | null => {
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
  if (
    isDescendant(props.topology, chain.upper, chain.lower) === false ||
    isDescendant(props.topology, chain.lower, chain.effector) === false
  )
    return null;

  const upperInverse = Quaternion.inverse(upper.worldRotation);
  const lowerInverse = Quaternion.inverse(lower.worldRotation);
  return {
    chain,
    upper,
    lower,
    end: effector.worldPosition,
    hinge: Quaternion.rotateVector(
      lower.worldRotation,
      normalizeJointAxes(
        props.jointAxes?.[chain.lower] ?? DEFAULT_JOINT_AXES,
        "solveChainPlant axes",
      ).flexion,
    ),
    lowerOffset: Quaternion.rotateVector(
      upperInverse,
      Vector3.subtract(lower.worldPosition, upper.worldPosition),
    ),
    lowerRotation: Quaternion.multiply(upperInverse, lower.worldRotation),
    effectorOffset: Quaternion.rotateVector(
      lowerInverse,
      Vector3.subtract(effector.worldPosition, lower.worldPosition),
    ),
  };
};

/** Whether a reachable bone sits strictly below another in the rig tree. */
const isDescendant = (
  topology: IAutoMovieSkeletonTopology,
  ancestor: AutoMovieHumanoidBone,
  descendant: AutoMovieHumanoidBone,
): boolean =>
  (topology.childrenByParent.get(ancestor) ?? []).some(
    (child) =>
      child.bone === descendant ||
      isDescendant(topology, child.bone, descendant),
  );

/** Solve one bend normal against chain data prepared once per target. */
const solvePreparedChainPlant = (props: {
  prepared: IPreparedChainPlant;
  target: IAutoMovieVector3;
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  bendNormal?: IAutoMovieVector3;
}): {
  upper: IAutoMovieJointPose;
  lower: IAutoMovieJointPose;
  hinge: IAutoMovieVector3;
} | null => {
  const { chain, upper, lower } = props.prepared;

  const articulation = twoBoneChainArticulation({
    upper,
    lower,
    end: props.prepared.end,
    target: props.target,
    bendNormal: props.bendNormal,
  });
  if (articulation === null) return null;

  return {
    hinge: props.prepared.hinge,
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

/** FK only the prepared chain after its two candidate joints are clamped. */
const resolvedPreparedEffector = (props: {
  prepared: IPreparedChainPlant;
  upper: IAutoMovieJointPose;
  lower: IAutoMovieJointPose;
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieVector3 => {
  const upperRotation = Quaternion.multiply(
    props.prepared.upper.worldRotation,
    jointToQuaternion(
      props.upper,
      props.jointAxes?.[props.prepared.chain.upper],
      props.restFrames?.[props.prepared.chain.upper],
    ),
  );
  const lowerPosition = Vector3.add(
    props.prepared.upper.worldPosition,
    Quaternion.rotateVector(upperRotation, props.prepared.lowerOffset),
  );
  const lowerRotation = Quaternion.multiply(
    Quaternion.multiply(upperRotation, props.prepared.lowerRotation),
    jointToQuaternion(
      props.lower,
      props.jointAxes?.[props.prepared.chain.lower],
      props.restFrames?.[props.prepared.chain.lower],
    ),
  );
  return Vector3.add(
    lowerPosition,
    Quaternion.rotateVector(lowerRotation, props.prepared.effectorOffset),
  );
};
