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
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Defines the affine conversion from rig-relative rotation to one clinical control.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Makes the rest-frame conversion explicit for an authored joint axis.
 */
export interface IAutoMovieAxisFrame {
  /**
   * Axis direction relative to the clinical convention.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Defines the polarity of the clinical-to-rig angle conversion.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the axis-orientation conversion from the declared rest basis.
   */
  sign: 1 | -1;
  /**
   * Clinical angle represented by the rig's rest orientation.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Declares the semantic control value encoded by the rig's zero articulation.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the rest-pose offset of the clinical-to-rig conversion.
   */
  neutral: number;
}

/**
 * A bone's per-axis rest frame; an omitted axis is the identity (sign 1, 0).
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Groups the semantic control conversions owned by one bone rest frame.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Represents the optional rest-basis mapping supplied with rig input.
 */
export interface IAutoMovieRestFrame {
  /**
   * Rest-frame mapping for the flexion axis.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Reconciles the named flexion control with its rest-relative rig value.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the optional flexion rest-basis conversion.
   */
  flexion?: IAutoMovieAxisFrame;
  /**
   * Rest-frame mapping for the abduction axis.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Reconciles the named abduction control with its rest-relative rig value.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the optional abduction rest-basis conversion.
   */
  abduction?: IAutoMovieAxisFrame;
  /**
   * Rest-frame mapping for the twist axis.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Reconciles the named twist control with its rest-relative rig value.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Carries the optional twist rest-basis conversion.
   */
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
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Lowers a clinical control value into the declared rig rest basis.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Applies the declared affine rest-frame conversion.
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
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Lifts a rig-relative rotation back into its named clinical control value.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Reconstructs the semantic angle from the declared rest-frame conversion.
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
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Re-expresses clinical range limits in the joint's actual rest-relative frame.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Expresses effective ROM in the same rig basis used by articulation.
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
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Declares the non-identity rest conversion for canonical humanoid shoulder bones.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Preserves the T-pose basis needed to interpret shoulder articulation consistently.
 * @author Samchon
 */
export const HUMANOID_REST_FRAME: Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
> = {
  leftUpperArm: { abduction: { sign: 1, neutral: 90 } },
  rightUpperArm: { abduction: { sign: -1, neutral: 90 } },
};
