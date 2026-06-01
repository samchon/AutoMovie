import {
  IMoticaAngleRange,
  IMoticaJointConstraint,
  IMoticaJointPose,
} from "@motica/interface";

import { ViolationCollector } from "../validation/violation";

const AXES = ["flexion", "abduction", "twist"] as const;

/**
 * Validate one joint's articulation against its anatomical range of motion,
 * pushing a `rom` violation per offending axis.
 *
 * Two failure modes per axis:
 *
 * - The joint specifies a non-zero angle on an axis the constraint marks `null`
 *   (the joint physically does not move that way — e.g. an elbow abducting);
 * - The angle is outside the allowed `[min, max]`.
 *
 * `path` is the JSON path of the joint (e.g. `$input.joints[3]`); the offending
 * axis is appended so the `// ❌` feedback points at the exact field.
 *
 * @author Samchon
 */
export const validateJointRom = (props: {
  joint: IMoticaJointPose;
  constraint: IMoticaJointConstraint;
  path: string;
  collector: ViolationCollector;
}): void => {
  const { joint, constraint, path, collector } = props;
  for (const axis of AXES) {
    const angle: number | null = joint[axis];
    const allowed: IMoticaAngleRange | null = constraint[axis];
    if (angle === null || angle === 0) continue;
    if (allowed === null) {
      collector.push(
        "rom",
        `${path}.${axis}`,
        `${joint.bone} does not move in ${axis}; this axis must be null or 0, but was ${angle}`,
        angle,
      );
      continue;
    }
    if (angle < allowed.min || angle > allowed.max)
      collector.push(
        "rom",
        `${path}.${axis}`,
        `${joint.bone} ${axis} must be within [${allowed.min}, ${allowed.max}]° (anatomical ROM), but was ${angle}`,
        angle,
      );
  }
};
