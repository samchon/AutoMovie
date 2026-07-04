import { automovieHumanoidBone } from "@automovie/interface";

import { IautomovieJointAxes } from "./JointToQuaternion";

/**
 * Per-bone clinical axes for the **canonical humanoid rest pose** (VRM T-pose:
 * arms out along 짹X, legs down ?뭑), parallel to `DEFAULT_HUMANOID_ROM`.
 *
 * Only the arm chain needs remapping. A T-pose arm points along its local X, so
 * the default basis would make `flexion` roll the arm along its length instead
 * of swinging it fore/aft. Mapping flexion?뭑 and twist?뭎 (abduction stays Z)
 * makes the clinical angles anatomically correct: `flexion` swings the arm
 * sagittally (a walk's arm-swing), `abduction` raises it to the side (a jumping
 * jack), `twist` rotates it about its length. Legs and spine already align with
 * the default basis, so they are omitted (and fall back to it).
 *
 * Opt in by passing this to {@link resolvePose} / `applyPose`; a bone absent
 * from the table uses {@link DEFAULT_JOINT_AXES}.
 *
 * @author Samchon
 */
export const HUMANOID_JOINT_AXES: Partial<
  Record<automovieHumanoidBone, IautomovieJointAxes>
> = (() => {
  const arm: IautomovieJointAxes = {
    flexion: { x: 0, y: 1, z: 0 },
    abduction: { x: 0, y: 0, z: 1 },
    twist: { x: 1, y: 0, z: 0 },
  };
  const slots: automovieHumanoidBone[] = [
    "leftShoulder",
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightShoulder",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
  ];
  const table: Partial<Record<automovieHumanoidBone, IautomovieJointAxes>> = {};
  for (const s of slots) table[s] = arm;
  return table;
})();
