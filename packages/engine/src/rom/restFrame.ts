import {
  AutoMovieHumanoidBone,
  IAutoMovieAngleRange,
  IAutoMovieJointConstraint,
} from "@automovie/interface";

/**
 * How one clinical axis relates to a rig's rest pose: a pose angle `r`
 * (rest-relative, what the engine articulates) maps to the clinical angle the
 * ROM table is written in as `clinical = sign·r + neutral`. `sign` mirrors an
 * axis whose positive direction is flipped per side (a right arm abducts with
 * negative rotation in the rig); `neutral` is the clinical angle the rig sits
 * at when at rest (a T-pose arm is already ~90° abducted).
 */
export interface IAutoMovieAxisFrame {
  sign: 1 | -1;
  neutral: number;
}

/** A bone's per-axis rest frame; an omitted axis is the identity (sign 1, 0). */
export interface IAutoMovieRestFrame {
  flexion?: IAutoMovieAxisFrame;
  abduction?: IAutoMovieAxisFrame;
  twist?: IAutoMovieAxisFrame;
}

const assertAxisFrame = (
  label: string,
  frame: IAutoMovieAxisFrame | undefined,
): void => {
  if (frame === undefined) return;
  if (frame.sign !== 1 && frame.sign !== -1)
    throw new Error(`${label} sign must be 1 or -1, but was ${frame.sign}`);
  if (!Number.isFinite(frame.neutral))
    throw new Error(
      `${label} neutral must be finite, but was ${frame.neutral}`,
    );
};

/**
 * A **clinical** angle (what the ROM table and pose authors write) → the
 * **rest-relative** angle the rig actually rotates by: `r = (clinical −
 * neutral) / sign`. The inverse of {@link toClinicalAngle}. An undefined frame
 * (or a `null` angle) is the identity, so non-mirrored axes pass through.
 */
export const toRigAngle = (
  clinical: number | null,
  frame: IAutoMovieAxisFrame | undefined,
): number | null => {
  if (clinical === null) return null;
  assertAxisFrame("rest frame", frame);
  return frame === undefined
    ? clinical
    : (clinical - frame.neutral) / frame.sign;
};

/**
 * The **rest-relative** angle the rig rotates by → the **clinical** angle:
 * `clinical = sign · r + neutral`. The inverse of {@link toRigAngle}.
 */
export const toClinicalAngle = (
  rig: number | null,
  frame: IAutoMovieAxisFrame | undefined,
): number | null => {
  if (rig === null) return null;
  assertAxisFrame("rest frame", frame);
  return frame === undefined ? rig : frame.sign * rig + frame.neutral;
};

const shift = (
  axis: keyof IAutoMovieRestFrame,
  range: IAutoMovieAngleRange | null,
  frame: IAutoMovieAxisFrame | undefined,
): IAutoMovieAngleRange | null => {
  assertAxisFrame(`rest frame ${axis}`, frame);
  if (range === null) return null;
  if (frame === undefined) return range;
  // r = (clinical − neutral) / sign; a sign of −1 flips the interval, so sort.
  const a = (range.min - frame.neutral) / frame.sign;
  const b = (range.max - frame.neutral) / frame.sign;
  return { min: Math.min(a, b), max: Math.max(a, b) };
};

/**
 * Re-express a clinical {@link IAutoMovieJointConstraint} in a rig's
 * rest-relative pose space using its {@link IAutoMovieRestFrame}, so ROM
 * validation/clamping and the ROM overlay line up with how the rig actually
 * articulates, the reconciliation a physics joint does implicitly by defining
 * its limits in the joint's own reference frame.
 *
 * The `swingDeg` cone half-angle carries through unchanged: it caps the
 * _combined_ swing away from rest (`2·acos(cos(flexion/2)·cos(abduction/2))`
 * over the pose angles the rig articulates), so it is a deviation magnitude the
 * rest frame's `sign`/`neutral` shift (which relocates each axis's origin, not
 * the scale of a deviation) leaves invariant. Dropping it here silenced the
 * ball-joint cone on exactly the bones that carry a rest frame (the shoulders),
 * since `validateJointRom`/`clampJointRom` gate the cone on `swingDeg !=
 * null`.
 *
 * @author Samchon
 */
export const restRelativeConstraint = (
  clinical: IAutoMovieJointConstraint,
  frame: IAutoMovieRestFrame,
): IAutoMovieJointConstraint => ({
  flexion: shift("flexion", clinical.flexion, frame.flexion),
  abduction: shift("abduction", clinical.abduction, frame.abduction),
  twist: shift("twist", clinical.twist, frame.twist),
  swingDeg: clinical.swingDeg,
});

/**
 * Rest frames for the **canonical T-pose humanoid**, where they differ from the
 * identity. The shoulders sit at ~90° clinical abduction at rest, and the two
 * sides mirror the abduction sign (a first pass: flexion/twist reconciliation
 * is future work). Bones omitted need no shift (legs/spine rest at clinical
 * neutral).
 *
 * @author Samchon
 */
export const HUMANOID_REST_FRAME: Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
> = {
  leftUpperArm: { abduction: { sign: 1, neutral: 90 } },
  rightUpperArm: { abduction: { sign: -1, neutral: 90 } },
};
