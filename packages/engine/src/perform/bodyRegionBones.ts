import {
  AutoMovieBodyRegion,
  AutoMovieHumanoidBone,
} from "@automovie/interface";

/** Hips + both legs (the locomotion / stance region). */
const LOWER: AutoMovieHumanoidBone[] = [
  "hips",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
];

/** Spine/chest + both arms + every finger (the gesture / reach region). */
const UPPER: AutoMovieHumanoidBone[] = [
  "spine",
  "chest",
  "upperChest",
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal",
];

/** Neck/head + eyes + jaw (the look-at region). */
const HEAD: AutoMovieHumanoidBone[] = [
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
];

/**
 * The humanoid bones a {@link AutoMovieBodyRegion} owns. The regions partition
 * the skeleton **disjointly and completely** (`lowerBody ∪ upperBody ∪ head` =
 * all 55 VRM bones; `face` owns no bones, being expression/morph channels;
 * `fullBody` owns every bone). This is what lets the performance compiler mask
 * clips predictably. Layering then compares the content that survives these
 * masks: clips may run concurrently whenever no root, bone, or expression
 * channel is claimed twice, even when one uses the broad `fullBody` mask.
 *
 * @author Samchon
 */
export const bodyRegionBones = (
  region: AutoMovieBodyRegion,
): AutoMovieHumanoidBone[] => {
  if (region === "lowerBody") return LOWER;
  if (region === "upperBody") return UPPER;
  if (region === "head") return HEAD;
  if (region === "face") return [];
  return [...LOWER, ...UPPER, ...HEAD]; // fullBody
};
