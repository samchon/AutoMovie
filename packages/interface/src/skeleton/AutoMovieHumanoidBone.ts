/**
 * The closed set of humanoid bones, mirroring the **VRM 1.0** humanoid bone
 * specification (55 bones).
 *
 * This enum is the backbone of automovie's "named scalar" strategy. Because
 * every bone an LLM can address is a fixed identifier from this union, a
 * hallucinated or mistyped bone name is structurally impossible ??the model
 * picks from a menu, it does not invent. The names map 1:1 onto `VRMHumanoid`
 * so a validated pose retargets cleanly onto _any_ VRM avatar (the whole point
 * of a normalized humanoid rig).
 *
 * Required vs optional bones: VRM marks ~16 as required (hips, spine, chest,
 * head, the four limb chains). Fingers, eyes, jaw, `upperChest`, `neck`,
 * `toes`, and `shoulder` are optional ??an imported rig may omit them, in which
 * case a pose simply never references them.
 *
 * The finger bones (30 of the 55) are the dimensional tail: a full-hand pose is
 * where direct LLM emission gets brittle. automovie handles hands as a separate,
 * optional articulation stage rather than asking for all 55 bones at once.
 *
 * Reference: VRM 1.0 humanoid specification
 * (https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/humanoid.md).
 *
 * @author Samchon
 */
export type automovieHumanoidBone =
  // ?? torso (4) ??
  /** Pelvis. The root of the humanoid hierarchy. */
  | "hips"
  /** Lower spine. */
  | "spine"
  /** Mid spine / ribcage. */
  | "chest"
  /** Upper ribcage (optional). */
  | "upperChest"
  // ?? head (5) ??
  /** Neck (optional). */
  | "neck"
  /** Head. */
  | "head"
  /** Left eyeball (optional). */
  | "leftEye"
  /** Right eyeball (optional). */
  | "rightEye"
  /** Jaw (optional). */
  | "jaw"
  // ?? left arm (4) ??
  /** Left clavicle / shoulder (optional). */
  | "leftShoulder"
  /** Left upper arm (humerus). */
  | "leftUpperArm"
  /** Left forearm. */
  | "leftLowerArm"
  /** Left hand. */
  | "leftHand"
  // ?? right arm (4) ??
  /** Right clavicle / shoulder (optional). */
  | "rightShoulder"
  /** Right upper arm (humerus). */
  | "rightUpperArm"
  /** Right forearm. */
  | "rightLowerArm"
  /** Right hand. */
  | "rightHand"
  // ?? left leg (4) ??
  /** Left thigh (femur). */
  | "leftUpperLeg"
  /** Left shin. */
  | "leftLowerLeg"
  /** Left foot. */
  | "leftFoot"
  /** Left toes (optional). */
  | "leftToes"
  // ?? right leg (4) ??
  /** Right thigh (femur). */
  | "rightUpperLeg"
  /** Right shin. */
  | "rightLowerLeg"
  /** Right foot. */
  | "rightFoot"
  /** Right toes (optional). */
  | "rightToes"
  // ?? left fingers (15, all optional) ??
  | "leftThumbMetacarpal"
  | "leftThumbProximal"
  | "leftThumbDistal"
  | "leftIndexProximal"
  | "leftIndexIntermediate"
  | "leftIndexDistal"
  | "leftMiddleProximal"
  | "leftMiddleIntermediate"
  | "leftMiddleDistal"
  | "leftRingProximal"
  | "leftRingIntermediate"
  | "leftRingDistal"
  | "leftLittleProximal"
  | "leftLittleIntermediate"
  | "leftLittleDistal"
  // ?? right fingers (15, all optional) ??
  | "rightThumbMetacarpal"
  | "rightThumbProximal"
  | "rightThumbDistal"
  | "rightIndexProximal"
  | "rightIndexIntermediate"
  | "rightIndexDistal"
  | "rightMiddleProximal"
  | "rightMiddleIntermediate"
  | "rightMiddleDistal"
  | "rightRingProximal"
  | "rightRingIntermediate"
  | "rightRingDistal"
  | "rightLittleProximal"
  | "rightLittleIntermediate"
  | "rightLittleDistal";
