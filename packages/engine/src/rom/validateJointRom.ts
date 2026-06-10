import {
  IAutoFilmAngleRange,
  IAutoFilmJointConstraint,
  IAutoFilmJointPose,
} from "@autofilm/interface";

import { ViolationCollector } from "../validation/violation";
import { swingConeAngle } from "./swingCone";

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
  joint: IAutoFilmJointPose;
  constraint: IAutoFilmJointConstraint;
  path: string;
  collector: ViolationCollector;
}): void => {
  const { joint, constraint, path, collector } = props;
  for (const axis of AXES) {
    const angle: number | null = joint[axis];
    const allowed: IAutoFilmAngleRange | null = constraint[axis];
    if (angle === null || angle === 0) continue;
    if (allowed === null) {
      // immobile axis: the gap is the whole distance from the required 0
      const overshoot = Math.abs(angle);
      collector.push(
        "rom",
        `${path}.${axis}`,
        `${joint.bone} does not move in ${axis}; this axis must be null or 0, but was ${angle} (${overshoot}° off)`,
        angle,
        overshoot,
      );
      continue;
    }
    if (angle < allowed.min || angle > allowed.max) {
      const overshoot =
        angle < allowed.min ? allowed.min - angle : angle - allowed.max;
      collector.push(
        "rom",
        `${path}.${axis}`,
        `${joint.bone} ${axis} must be within [${allowed.min}, ${allowed.max}]° (anatomical ROM), but was ${angle} (${overshoot}° past limit)`,
        angle,
        overshoot,
      );
    }
  }

  // combined swing cone (ball joints): caps the corner the per-axis boxes miss
  if (
    constraint.swingDeg != null &&
    joint.flexion !== null &&
    joint.abduction !== null
  ) {
    const swing = swingConeAngle(joint.flexion, joint.abduction);
    if (swing > constraint.swingDeg) {
      const overshoot = swing - constraint.swingDeg;
      collector.push(
        "rom",
        `${path}.swing`,
        `${joint.bone} combined flexion+abduction swing must be within ${constraint.swingDeg}° of neutral (the joint's reachable cone), but was ${swing.toFixed(1)}° (${overshoot.toFixed(1)}° past the cone)`,
        swing,
        overshoot,
      );
    }
  }
};
