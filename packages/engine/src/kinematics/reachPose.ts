import {
  AutoFilmHumanoidBone,
  IAutoFilmPose,
  IAutoFilmQuaternion,
  IAutoFilmSkeleton,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoFilmRestFrame } from "../rom/restFrame";
import { aimRotation } from "./aimRotation";
import { decomposeJointRotation } from "./decomposeJointRotation";
import { HUMANOID_JOINT_AXES } from "./humanoidJointAxes";
import { resolvePose } from "./resolvePose";
import { solveTwoBoneIK } from "./solveTwoBoneIK";

/** World-down, the pole a natural elbow bends away from. */
const POLE: IAutoFilmVector3 = { x: 0, y: -1, z: 0 };

const inverse = (q: IAutoFilmQuaternion): IAutoFilmQuaternion =>
  Quaternion.normalize({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

/**
 * Analytic two-bone IK for an arm: the {@link IAutoFilmPose} (upper-arm +
 * forearm articulation) that brings the `side` hand onto `target`, in the
 * skeleton's own model space. This is the harness `reach` verb made concrete —
 * the model says "put your right hand on the lever" and the engine solves the
 * shoulder and elbow that land it there, deterministically, no solver
 * iteration.
 *
 * It reads the arm's segment lengths and rest directions from the skeleton's
 * rest FK, solves the shoulder lift and elbow bend by {@link solveTwoBoneIK},
 * places the elbow off the shoulder→target line (bending away from world-down,
 * the natural solution), then lowers the two world-space bone rotations back
 * into the clinical angles a pose carries via {@link decomposeJointRotation}. An
 * unreachable target extends the arm fully toward it (the hand stops on the
 * reachable shell) rather than failing.
 *
 * Returns `null` if the arm bones are missing or degenerate — a rig that cannot
 * reach.
 *
 * @author Samchon
 */
export const reachPose = (
  skeleton: IAutoFilmSkeleton,
  side: "left" | "right",
  target: IAutoFilmVector3,
  restFrames?: Partial<Record<AutoFilmHumanoidBone, IAutoFilmRestFrame>>,
): IAutoFilmPose | null => {
  const upperName = side === "left" ? "leftUpperArm" : "rightUpperArm";
  const lowerName = side === "left" ? "leftLowerArm" : "rightLowerArm";
  const handName = side === "left" ? "leftHand" : "rightHand";

  const rest = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
    HUMANOID_JOINT_AXES,
  );
  const upper = rest.find((b) => b.bone === upperName);
  const lower = rest.find((b) => b.bone === lowerName);
  const hand = rest.find((b) => b.bone === handName);
  if (upper === undefined || lower === undefined || hand === undefined)
    return null;

  const shoulder = upper.worldPosition;
  const l1 = Vector3.length(Vector3.subtract(lower.worldPosition, shoulder));
  const l2 = Vector3.length(
    Vector3.subtract(hand.worldPosition, lower.worldPosition),
  );
  if (l1 < 1e-6 || l2 < 1e-6) return null;
  const restUpperDir = Vector3.normalize(
    Vector3.subtract(lower.worldPosition, shoulder),
  );
  const restForeDir = Vector3.normalize(
    Vector3.subtract(hand.worldPosition, lower.worldPosition),
  );

  const reach = Vector3.subtract(target, shoulder);
  const dist = Vector3.length(reach);
  if (dist < 1e-6) return null;
  const axis = Vector3.normalize(reach);

  const { bend, lift } = solveTwoBoneIK(l1, l2, dist);
  void bend; // the bend angle is realised implicitly by placing the elbow

  // Bend plane: normal ⟂ (reach axis, world-down pole). The upper arm lifts by
  // `lift` off the axis in this plane, dropping the elbow away from the pole.
  let normal = Vector3.cross(axis, POLE);
  if (Vector3.length(normal) < 1e-6)
    normal = Vector3.cross(axis, { x: 0, y: 0, z: 1 });
  normal = Vector3.normalize(normal);

  const upperDir = Quaternion.rotateVector(
    Quaternion.fromAxisAngle(normal, lift),
    axis,
  );
  const elbow = Vector3.add(shoulder, Vector3.scale(upperDir, l1));
  const foreDir = Vector3.normalize(Vector3.subtract(target, elbow));

  // Shoulder: world delta taking the rest upper-arm dir onto upperDir, lowered
  // into the bone-local articulation (restWorld⁻¹ · Δ · restWorld).
  const rsu = upper.worldRotation;
  const du = aimRotation(restUpperDir, upperDir);
  const articU = Quaternion.multiply(
    inverse(rsu),
    Quaternion.multiply(du, rsu),
  );

  // Elbow: worldRot(L) = du · Rsl · articL, so the forearm's local axis
  // (Rsl⁻¹ · restForeDir) must rotate onto (Rsl⁻¹ · du⁻¹ · foreDir).
  const rsl = lower.worldRotation;
  const rslInv = inverse(rsl);
  const localFore = Quaternion.rotateVector(rslInv, restForeDir);
  const localGoal = Quaternion.rotateVector(
    rslInv,
    Quaternion.rotateVector(inverse(du), foreDir),
  );
  const articL = aimRotation(localFore, localGoal);

  return {
    skeleton: skeleton.id,
    root: null,
    joints: [
      {
        bone: upperName,
        ...decomposeJointRotation(
          articU,
          HUMANOID_JOINT_AXES[upperName],
          restFrames?.[upperName],
        ),
      },
      {
        bone: lowerName,
        ...decomposeJointRotation(
          articL,
          HUMANOID_JOINT_AXES[lowerName],
          restFrames?.[lowerName],
        ),
      },
    ],
  };
};
