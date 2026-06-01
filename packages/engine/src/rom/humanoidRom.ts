import {
  IMoticaAngleRange,
  IMoticaJointConstraint,
  MoticaHumanoidBone,
} from "@motica/interface";

const range = (min: number, max: number): IMoticaAngleRange => ({ min, max });

const constraint = (
  flexion: IMoticaAngleRange | null,
  abduction: IMoticaAngleRange | null,
  twist: IMoticaAngleRange | null,
): IMoticaJointConstraint => ({ flexion, abduction, twist });

/**
 * Generic finger phalanx: flexes forward, slight hyperextension, no
 * abduction/twist.
 */
const FINGER = constraint(range(-20, 100), null, null);

/**
 * Default anatomical range-of-motion table for the normalized humanoid, keyed
 * by {@link MoticaHumanoidBone}.
 *
 * These are **approximate clinical norms** (goniometry), in degrees, under the
 * sign convention documented on {@link IMoticaJointConstraint}: flexion (+) /
 * extension (−) about the sagittal axis, abduction (+) / adduction (−) about
 * the frontal axis, external (+) / internal (−) about the limb's long axis.
 * Left and right limbs share magnitudes here; mirroring the abduction _sign_
 * per side is a future refinement.
 *
 * A bone absent from this table (or an axis set to `null`) is treated as
 * unconstrained / immobile on that axis. A skeleton may override any of these
 * per-bone via {@link "@motica/interface".IMoticaBone.constraint} (a
 * contortionist, a stylized non-human rig); this table is only the fallback.
 *
 * These numbers are a deliberate, documented baseline — good enough to reject
 * grossly impossible poses (a backward elbow, a hyper-extended knee). Sourcing
 * exact per-population norms is tracked as future work.
 *
 * @author Samchon
 */
export const DEFAULT_HUMANOID_ROM: Partial<
  Record<MoticaHumanoidBone, IMoticaJointConstraint>
> = {
  // ── spine / head ──
  spine: constraint(range(-30, 80), range(-35, 35), range(-45, 45)),
  chest: constraint(range(-20, 40), range(-25, 25), range(-35, 35)),
  upperChest: constraint(range(-15, 30), range(-20, 20), range(-30, 30)),
  neck: constraint(range(-50, 45), range(-40, 40), range(-70, 70)),
  head: constraint(range(-50, 45), range(-40, 40), range(-70, 70)),
  jaw: constraint(range(0, 35), range(-10, 10), null),
  leftEye: constraint(range(-30, 30), range(-45, 45), null),
  rightEye: constraint(range(-30, 30), range(-45, 45), null),

  // ── arms ──
  leftShoulder: constraint(range(-15, 30), range(-30, 30), null),
  rightShoulder: constraint(range(-15, 30), range(-30, 30), null),
  leftUpperArm: constraint(range(-60, 180), range(-30, 180), range(-90, 90)),
  rightUpperArm: constraint(range(-60, 180), range(-30, 180), range(-90, 90)),
  leftLowerArm: constraint(range(0, 150), null, range(-90, 90)),
  rightLowerArm: constraint(range(0, 150), null, range(-90, 90)),
  leftHand: constraint(range(-80, 70), range(-30, 20), null),
  rightHand: constraint(range(-80, 70), range(-30, 20), null),

  // ── legs ──
  leftUpperLeg: constraint(range(-30, 120), range(-30, 45), range(-45, 45)),
  rightUpperLeg: constraint(range(-30, 120), range(-30, 45), range(-45, 45)),
  leftLowerLeg: constraint(range(0, 150), null, null),
  rightLowerLeg: constraint(range(0, 150), null, null),
  leftFoot: constraint(range(-50, 20), range(-25, 25), null),
  rightFoot: constraint(range(-50, 20), range(-25, 25), null),
  leftToes: constraint(range(-40, 80), null, null),
  rightToes: constraint(range(-40, 80), null, null),

  // ── fingers (generic) ──
  leftThumbMetacarpal: FINGER,
  leftThumbProximal: FINGER,
  leftThumbDistal: FINGER,
  leftIndexProximal: FINGER,
  leftIndexIntermediate: FINGER,
  leftIndexDistal: FINGER,
  leftMiddleProximal: FINGER,
  leftMiddleIntermediate: FINGER,
  leftMiddleDistal: FINGER,
  leftRingProximal: FINGER,
  leftRingIntermediate: FINGER,
  leftRingDistal: FINGER,
  leftLittleProximal: FINGER,
  leftLittleIntermediate: FINGER,
  leftLittleDistal: FINGER,
  rightThumbMetacarpal: FINGER,
  rightThumbProximal: FINGER,
  rightThumbDistal: FINGER,
  rightIndexProximal: FINGER,
  rightIndexIntermediate: FINGER,
  rightIndexDistal: FINGER,
  rightMiddleProximal: FINGER,
  rightMiddleIntermediate: FINGER,
  rightMiddleDistal: FINGER,
  rightRingProximal: FINGER,
  rightRingIntermediate: FINGER,
  rightRingDistal: FINGER,
  rightLittleProximal: FINGER,
  rightLittleIntermediate: FINGER,
  rightLittleDistal: FINGER,
};

/**
 * The effective ROM constraint for a bone: the skeleton's per-bone override if
 * present, otherwise the default-table fallback, otherwise `null`
 * (unconstrained).
 */
export const getConstraint = (
  bone: MoticaHumanoidBone,
  override: IMoticaJointConstraint | null,
): IMoticaJointConstraint | null =>
  override ?? DEFAULT_HUMANOID_ROM[bone] ?? null;
