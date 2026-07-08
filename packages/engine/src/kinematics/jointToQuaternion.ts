import {
  IAutoMovieJointPose,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoMovieRestFrame, toRigAngle } from "../rom/restFrame";

const JOINT_AXES = ["flexion", "abduction", "twist"] as const;
const VECTOR_AXES = ["x", "y", "z"] as const;
const MIN_AXIS_LENGTH = 1e-9;
const MAX_AXIS_DOT = 1e-6;
type AutoMovieJointAxis = (typeof JOINT_AXES)[number];

/**
 * The bone-local axes the three clinical angles rotate about. Lets a rig whose
 * bone frames are not aligned to the default clinical planes (e.g. a T-pose arm
 * pointing along its local X) declare which local axis flexion / abduction /
 * twist each swing, so "flexion" stays anatomically sagittal instead of rolling
 * the bone along its length.
 */
export interface IAutoMovieJointAxes {
  /** Axis `flexion` rotates about (sagittal). */
  flexion: IAutoMovieVector3;
  /** Axis `abduction` rotates about (frontal). */
  abduction: IAutoMovieVector3;
  /** Axis `twist` rotates about (the bone's long axis). */
  twist: IAutoMovieVector3;
}

/** The default clinical basis: flexion→X, abduction→Z, twist→Y. */
export const DEFAULT_JOINT_AXES: IAutoMovieJointAxes = {
  flexion: { x: 1, y: 0, z: 0 },
  abduction: { x: 0, y: 0, z: 1 },
  twist: { x: 0, y: 1, z: 0 },
};

/** A field-located malformed joint-axis basis issue. */
export interface IAutoMovieJointAxesIssue {
  /** JSON-ish path to the offending axis field. */
  path: string;

  /** Human-readable correction requirement. */
  expected: string;

  /** Offending value. */
  value: unknown;
}

const readAngle = (
  joint: Pick<IAutoMovieJointPose, "flexion" | "abduction" | "twist">,
  axis: (typeof JOINT_AXES)[number],
  frame: IAutoMovieRestFrame[(typeof JOINT_AXES)[number]] | undefined,
): number => {
  const value = joint[axis];
  if (value !== null && !Number.isFinite(value))
    throw new Error(
      `jointToQuaternion ${axis} must be finite or null, but was ${value}`,
    );
  return toRigAngle(value, frame) ?? 0;
};

/**
 * Validate the axis basis used by joint compose/decompose.
 *
 * Axes may be non-unit; callers normalize after this check. They must be
 * finite, non-zero, and mutually orthogonal so clinical angles form a real
 * basis instead of silently skewing FK/IK.
 *
 * @author Samchon
 */
export const validateJointAxesBasis = (
  axes: IAutoMovieJointAxes,
  path: string,
): IAutoMovieJointAxesIssue[] => {
  const issues: IAutoMovieJointAxesIssue[] = [];
  const usable = new Set<AutoMovieJointAxis>();

  for (const jointAxis of JOINT_AXES) {
    let finite = true;
    for (const vectorAxis of VECTOR_AXES) {
      const value = axes[jointAxis][vectorAxis];
      if (!Number.isFinite(value)) {
        finite = false;
        issues.push({
          path: `${path}.${jointAxis}.${vectorAxis}`,
          expected: `must be finite, but was ${value}`,
          value,
        });
      }
    }
    if (!finite) continue;
    const length = Vector3.length(axes[jointAxis]);
    if (length <= MIN_AXIS_LENGTH)
      issues.push({
        path: `${path}.${jointAxis}`,
        expected: "must have non-zero length",
        value: axes[jointAxis],
      });
    else usable.add(jointAxis);
  }

  if (JOINT_AXES.every((axis) => usable.has(axis))) {
    const normalized = normalizeRawJointAxes(axes);
    for (const [a, b] of [
      ["flexion", "abduction"],
      ["flexion", "twist"],
      ["abduction", "twist"],
    ] as const) {
      const dot = Math.abs(Vector3.dot(normalized[a], normalized[b]));
      if (dot > MAX_AXIS_DOT)
        issues.push({
          path: `${path}.${b}`,
          expected: `${a} and ${b} axes must be orthogonal`,
          value: { [a]: axes[a], [b]: axes[b] },
        });
    }
  }

  return issues;
};

/**
 * Validate and normalize a joint-axis basis for quaternion math.
 *
 * @author Samchon
 */
export const normalizeJointAxes = (
  axes: IAutoMovieJointAxes,
  path: string,
): IAutoMovieJointAxes => {
  const issues = validateJointAxesBasis(axes, path);
  if (issues.length !== 0) {
    const issue = issues[0]!;
    throw new Error(`${issue.path} ${issue.expected}`);
  }
  return normalizeRawJointAxes(axes);
};

const normalizeRawJointAxes = (
  axes: IAutoMovieJointAxes,
): IAutoMovieJointAxes => ({
  flexion: normalizeAxis(axes.flexion),
  abduction: normalizeAxis(axes.abduction),
  twist: normalizeAxis(axes.twist),
});

const normalizeAxis = (axis: IAutoMovieVector3): IAutoMovieVector3 =>
  Vector3.scale(axis, 1 / Vector3.length(axis));

/**
 * Convert a joint's semantic clinical angles (flexion / abduction / twist) into
 * a single bone-local rotation quaternion.
 *
 * **Axis convention** (bone-local frame, applied in this fixed order): flexion
 * about {@link IAutoMovieJointAxes.flexion} (default local **X**, sagittal),
 * abduction about `abduction` (default **Z**, frontal), twist about `twist`
 * (default **Y**, the bone's long axis). Composition order is twist ∘ abduction
 * ∘ flexion — flexion first in the bone's own frame, then abduction, then axial
 * twist:
 *
 *     q = qTwist * qAbduction * qFlexion;
 *
 * `axes` overrides the default basis per bone so a rig keeps flexion
 * anatomically correct regardless of how its rest frame is oriented (a T-pose
 * arm wants flexion about Y, not its length axis X). Omit it for the default
 * clinical basis, which is consistent and round-trippable.
 *
 * A `null` angle means "no rotation on that axis" and contributes identity.
 *
 * When a `frame` ({@link IAutoMovieRestFrame}) is given, the joint's angles are
 * read as **clinical** and mapped into the rig's rest-relative space first (`r
 * = (clinical − neutral) / sign`, per {@link toRigAngle}) — so a pose can be
 * authored in one intuitive clinical convention (e.g. +abduction raises either
 * arm) and the per-side rest frame reconciles it. Omit it for angles already in
 * the rig's own space.
 *
 * @author Samchon
 */
export const jointToQuaternion = (
  joint: Pick<IAutoMovieJointPose, "flexion" | "abduction" | "twist">,
  axes: IAutoMovieJointAxes = DEFAULT_JOINT_AXES,
  frame?: IAutoMovieRestFrame,
): IAutoMovieQuaternion => {
  const basis = normalizeJointAxes(axes, "jointToQuaternion axes");
  const qFlexion = Quaternion.fromAxisAngle(
    basis.flexion,
    readAngle(joint, "flexion", frame?.flexion),
  );
  const qAbduction = Quaternion.fromAxisAngle(
    basis.abduction,
    readAngle(joint, "abduction", frame?.abduction),
  );
  const qTwist = Quaternion.fromAxisAngle(
    basis.twist,
    readAngle(joint, "twist", frame?.twist),
  );
  return Quaternion.multiply(qTwist, Quaternion.multiply(qAbduction, qFlexion));
};
