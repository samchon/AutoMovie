import {
  AutoFilmHumanoidBone,
  IAutoFilmAngleRange,
  IAutoFilmJointConstraint,
} from "@autofilm/interface";

/**
 * How one clinical axis relates to a rig's rest pose: a pose angle `r`
 * (rest-relative, what the engine articulates) maps to the clinical angle the
 * ROM table is written in as `clinical = sign·r + neutral`. `sign` mirrors an
 * axis whose positive direction is flipped per side (a right arm abducts with
 * negative rotation in the rig); `neutral` is the clinical angle the rig sits
 * at when at rest (a T-pose arm is already ~90° abducted).
 */
export interface IAutoFilmAxisFrame {
  sign: 1 | -1;
  neutral: number;
}

/** A bone's per-axis rest frame; an omitted axis is the identity (sign 1, 0). */
export interface IAutoFilmRestFrame {
  flexion?: IAutoFilmAxisFrame;
  abduction?: IAutoFilmAxisFrame;
  twist?: IAutoFilmAxisFrame;
}

const shift = (
  range: IAutoFilmAngleRange | null,
  frame: IAutoFilmAxisFrame | undefined,
): IAutoFilmAngleRange | null => {
  if (range === null) return null;
  if (frame === undefined) return range;
  // r = (clinical − neutral) / sign; a sign of −1 flips the interval, so sort.
  const a = (range.min - frame.neutral) / frame.sign;
  const b = (range.max - frame.neutral) / frame.sign;
  return { min: Math.min(a, b), max: Math.max(a, b) };
};

/**
 * Re-express a clinical {@link IAutoFilmJointConstraint} in a rig's
 * rest-relative pose space using its {@link IAutoFilmRestFrame}, so ROM
 * validation/clamping and the ROM overlay line up with how the rig actually
 * articulates — the reconciliation a physics joint does implicitly by defining
 * its limits in the joint's own reference frame.
 *
 * @author Samchon
 */
export const restRelativeConstraint = (
  clinical: IAutoFilmJointConstraint,
  frame: IAutoFilmRestFrame,
): IAutoFilmJointConstraint => ({
  flexion: shift(clinical.flexion, frame.flexion),
  abduction: shift(clinical.abduction, frame.abduction),
  twist: shift(clinical.twist, frame.twist),
});

/**
 * Rest frames for the **canonical T-pose humanoid**, where they differ from the
 * identity. The shoulders sit at ~90° clinical abduction at rest, and the two
 * sides mirror the abduction sign (a first pass — flexion/twist reconciliation
 * is future work). Bones omitted need no shift (legs/spine rest at clinical
 * neutral).
 *
 * @author Samchon
 */
export const HUMANOID_REST_FRAME: Partial<
  Record<AutoFilmHumanoidBone, IAutoFilmRestFrame>
> = {
  leftUpperArm: { abduction: { sign: 1, neutral: 90 } },
  rightUpperArm: { abduction: { sign: -1, neutral: 90 } },
};
