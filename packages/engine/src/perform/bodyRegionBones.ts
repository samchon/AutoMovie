import {
  AutoMovieBodyRegion,
  AutoMovieHumanoidBone,
} from "@automovie/interface";

/** Hips + both legs (the locomotion / stance region). */
const LOWER = [
  "hips",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "leftToes",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "rightToes",
] as const satisfies readonly AutoMovieHumanoidBone[];

/** Spine/chest + both arms + every finger (the gesture / reach region). */
const UPPER = [
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
] as const satisfies readonly AutoMovieHumanoidBone[];

/** Neck/head + eyes + jaw (the look-at region). */
const HEAD = [
  "neck",
  "head",
  "leftEye",
  "rightEye",
  "jaw",
] as const satisfies readonly AutoMovieHumanoidBone[];

/** A bone some region above owns. */
type RegionedBone =
  | (typeof LOWER)[number]
  | (typeof UPPER)[number]
  | (typeof HEAD)[number];

/**
 * A bone no region owns, which must be none of them.
 *
 * The completeness claim below used to be a sentence and a literal 55, checked
 * by a scenario that compared the three arrays only with each other. A bone
 * added to {@link AutoMovieHumanoidBone} and to no region satisfied every one of
 * those assertions while every mask, `fullBody` included, silently stripped it
 * (#1400). The product contract makes that an expected change, since every
 * future rig axis is additive, so the claim is kept by the compiler instead:
 * this alias resolves to `never` only while the partition is complete, and the
 * declaration under it fails the build naming the bone that escaped.
 */
type UnregionedBone = Exclude<AutoMovieHumanoidBone, RegionedBone>;

/** Build-time proof that {@link bodyRegionBones} partitions the whole rig. */
export const AUTOMOVIE_RIG_IS_PARTITIONED: UnregionedBone extends never
  ? true
  : UnregionedBone = true;

/**
 * The humanoid bones a {@link AutoMovieBodyRegion} owns. The regions partition
 * the skeleton **disjointly and completely** (`lowerBody ∪ upperBody ∪ head` =
 * every bone the union declares, checked by the compiler through
 * {@link AUTOMOVIE_RIG_IS_PARTITIONED}; `face` owns no bones, being
 * expression/morph channels; `fullBody` owns every bone). This is what lets the
 * performance compiler mask clips predictably. Layering then compares the
 * content that survives these masks: clips may run concurrently whenever no
 * root, bone, or expression channel is claimed twice, even when one uses the
 * broad `fullBody` mask.
 *
 * The result is `readonly` because three of the five branches hand back the
 * module's own array rather than a copy. Typed mutable, a caller could have
 * pushed into the engine's partition and changed masking for every later shot.
 *
 * @author Samchon
 */
export const bodyRegionBones = (
  region: AutoMovieBodyRegion,
): readonly AutoMovieHumanoidBone[] => {
  if (region === "lowerBody") return LOWER;
  if (region === "upperBody") return UPPER;
  if (region === "head") return HEAD;
  if (region === "face") return [];
  return [...LOWER, ...UPPER, ...HEAD]; // fullBody
};
