import {
  automovieHumanoidBone,
  IautomovieAngleRange,
  IautomovieJointConstraint,
} from "@automovie/interface";

/**
 * How one clinical axis relates to a rig's rest pose: a pose angle `r`
 * (rest-relative, what the engine articulates) maps to the clinical angle the
 * ROM table is written in as `clinical = sign쨌r + neutral`. `sign` mirrors an
 * axis whose positive direction is flipped per side (a right arm abducts with
 * negative rotation in the rig); `neutral` is the clinical angle the rig sits
 * at when at rest (a T-pose arm is already ~90째 abducted).
 */
export interface IautomovieAxisFrame {
  sign: 1 | -1;
  neutral: number;
}

/** A bone's per-axis rest frame; an omitted axis is the identity (sign 1, 0). */
export interface IautomovieRestFrame {
  flexion?: IautomovieAxisFrame;
  abduction?: IautomovieAxisFrame;
  twist?: IautomovieAxisFrame;
}

/**
 * A **clinical** angle (what the ROM table and pose authors write) ??the
 * **rest-relative** angle the rig actually rotates by: `r = (clinical ?? * neutral) / sign`. The inverse of {@link toClinicalAngle}. An undefined frame
 * (or a `null` angle) is the identity, so non-mirrored axes pass through.
 */
export const toRigAngle = (
  clinical: number | null,
  frame: IautomovieAxisFrame | undefined,
): number | null =>
  clinical === null || frame === undefined
    ? clinical
    : (clinical - frame.neutral) / frame.sign;

/**
 * The **rest-relative** angle the rig rotates by ??the **clinical** angle:
 * `clinical = sign 쨌 r + neutral`. The inverse of {@link toRigAngle}.
 */
export const toClinicalAngle = (
  rig: number | null,
  frame: IautomovieAxisFrame | undefined,
): number | null =>
  rig === null || frame === undefined ? rig : frame.sign * rig + frame.neutral;

const shift = (
  range: IautomovieAngleRange | null,
  frame: IautomovieAxisFrame | undefined,
): IautomovieAngleRange | null => {
  if (range === null) return null;
  if (frame === undefined) return range;
  // r = (clinical ??neutral) / sign; a sign of ?? flips the interval, so sort.
  const a = (range.min - frame.neutral) / frame.sign;
  const b = (range.max - frame.neutral) / frame.sign;
  return { min: Math.min(a, b), max: Math.max(a, b) };
};

/**
 * Re-express a clinical {@link IautomovieJointConstraint} in a rig's
 * rest-relative pose space using its {@link IautomovieRestFrame}, so ROM
 * validation/clamping and the ROM overlay line up with how the rig actually
 * articulates ??the reconciliation a physics joint does implicitly by defining
 * its limits in the joint's own reference frame.
 *
 * @author Samchon
 */
export const restRelativeConstraint = (
  clinical: IautomovieJointConstraint,
  frame: IautomovieRestFrame,
): IautomovieJointConstraint => ({
  flexion: shift(clinical.flexion, frame.flexion),
  abduction: shift(clinical.abduction, frame.abduction),
  twist: shift(clinical.twist, frame.twist),
});

/**
 * Rest frames for the **canonical T-pose humanoid**, where they differ from the
 * identity. The shoulders sit at ~90째 clinical abduction at rest, and the two
 * sides mirror the abduction sign (a first pass ??flexion/twist reconciliation
 * is future work). Bones omitted need no shift (legs/spine rest at clinical
 * neutral).
 *
 * @author Samchon
 */
export const HUMANOID_REST_FRAME: Partial<
  Record<automovieHumanoidBone, IautomovieRestFrame>
> = {
  leftUpperArm: { abduction: { sign: 1, neutral: 90 } },
  rightUpperArm: { abduction: { sign: -1, neutral: 90 } },
};
