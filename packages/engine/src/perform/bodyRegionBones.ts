import { automovieBodyRegion, automovieHumanoidBone } from "@automovie/interface";

/** Hips + both legs (the locomotion / stance region). */
const LOWER: automovieHumanoidBone[] = [
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
const UPPER: automovieHumanoidBone[] = [
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
const HEAD: automovieHumanoidBone[] = [
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
];

/**
 * The humanoid bones a {@link automovieBodyRegion} owns. The regions partition
 * the skeleton **disjointly and completely** (`lowerBody ??upperBody ??head` =
 * all 55 VRM bones; `face` owns no bones, being expression/morph channels;
 * `fullBody` owns every bone). This is what lets the performance compiler
 * **layer** clips on disjoint regions concurrently ??a walk drives `lowerBody`
 * while a wave drives `upperBody` and a look-at drives `head`, with no bone
 * claimed twice ??instead of forcing them to sequence.
 *
 * @author Samchon
 */
export const bodyRegionBones = (
  region: automovieBodyRegion,
): automovieHumanoidBone[] => {
  if (region === "lowerBody") return LOWER;
  if (region === "upperBody") return UPPER;
  if (region === "head") return HEAD;
  if (region === "face") return [];
  return [...LOWER, ...UPPER, ...HEAD]; // fullBody
};
