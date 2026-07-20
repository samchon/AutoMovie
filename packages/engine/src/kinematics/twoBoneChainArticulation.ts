import { IAutoMovieQuaternion, IAutoMovieVector3 } from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { aimRotation } from "./aimRotation";
import { solveTwoBoneIK } from "./solveTwoBoneIK";

/** World-down, the pole a natural elbow or knee bends away from. */
const POLE: IAutoMovieVector3 = { x: 0, y: -1, z: 0 };

/** The world position and orientation of one resolved chain bone. */
export interface IAutoMovieChainBone {
  /** World-space bone origin. */
  worldPosition: IAutoMovieVector3;

  /** World-space bone orientation. */
  worldRotation: IAutoMovieQuaternion;
}

/**
 * The two bone-local articulation deltas a two-bone solve produces: apply
 * `upper` on the chain-root joint and `lower` on the mid joint (each lowered
 * into clinical angles by the caller's own axes/rest-frame conventions).
 */
export interface IAutoMovieTwoBoneArticulation {
  /** Bone-local articulation delta for the chain-root joint. */
  upper: IAutoMovieQuaternion;

  /** Bone-local articulation delta for the mid joint. */
  lower: IAutoMovieQuaternion;
}

/**
 * The shared two-bone lowering, the algebra {@link reachPose} (arm) and the
 * ground-IK leg plant both apply, extracted so the two cannot drift (#630):
 * given a resolved two-segment chain (root and mid bones with their world
 * frames, plus the end effector's world position), compute the bone-local
 * articulation deltas that land the end effector on `target`.
 *
 * The solve is `solveTwoBoneIK`'s closed form: measure the segment lengths and
 * reference directions from the resolved chain, lift the upper segment off the
 * root→target axis in the bend plane (the caller's `bendNormal` when given,
 * else normal ⟂ axis and the world-down pole: elbows and knees both bend away
 * from world-down; the axis-parallel degenerate falls back to a +Z plane),
 * place the mid joint, then lower the two world deltas into bone-local
 * rotations: the root joint via `restWorld⁻¹ · Δ · restWorld`, the mid joint by
 * aiming the fore segment's bone-local direction onto the bone-local goal. An
 * unreachable target extends the chain fully toward it (`solveTwoBoneIK`
 * clamps), so the end effector stops on the reachable shell rather than
 * failing.
 *
 * Returns `null` for a degenerate chain: a zero-length segment, or a target
 * coincident with the root. Which bones form the chain, how they were resolved
 * (rest FK for an arm reach, zeroed-leg posed FK for a foot plant), and which
 * clinical axes/rest frames decompose the deltas stay the CALLER's. This is
 * the geometry, not the rig policy.
 *
 * @author Samchon
 */
export const twoBoneChainArticulation = (props: {
  /** Resolved chain-root bone (shoulder / hip). */
  upper: IAutoMovieChainBone;

  /** Resolved mid bone (elbow / knee). */
  lower: IAutoMovieChainBone;

  /** World position of the end effector (hand / foot) on the resolved chain. */
  end: IAutoMovieVector3;

  /** World target the end effector should land on. */
  target: IAutoMovieVector3;

  /**
   * World normal of the bend plane, overriding the world-down pole derivation.
   * A rig that declares the mid joint as a hinge (a knee with `flexion` ranged
   * and `abduction`/`twist` immobile) can only articulate in that hinge's own
   * plane, so a caller that must keep the result inside the joint's ROM passes
   * the hinge axis here. Solving in any other plane produces abduction/twist
   * the ROM clamp then destroys. Rotation follows the right-hand rule about it,
   * so the two signs are the chain's two bend branches.
   */
  bendNormal?: IAutoMovieVector3;
}): IAutoMovieTwoBoneArticulation | null => {
  const root = props.upper.worldPosition;
  const mid = props.lower.worldPosition;

  const l1 = Vector3.length(Vector3.subtract(mid, root));
  const l2 = Vector3.length(Vector3.subtract(props.end, mid));
  if (l1 < 1e-6 || l2 < 1e-6) return null;
  const restUpperDir = Vector3.normalize(Vector3.subtract(mid, root));
  const restForeDir = Vector3.normalize(Vector3.subtract(props.end, mid));

  const reach = Vector3.subtract(props.target, root);
  const dist = Vector3.length(reach);
  if (dist < 1e-6) return null;
  const axis = Vector3.normalize(reach);

  const { lift } = solveTwoBoneIK(l1, l2, dist);

  // Bend plane: the caller's explicit normal when it has one, else normal ⟂
  // (reach axis, world-down pole). The upper segment lifts by `lift` off the
  // axis in this plane, dropping the mid joint away from the pole.
  let normal = props.bendNormal ?? Vector3.cross(axis, POLE);
  if (Vector3.length(normal) < 1e-6)
    normal = Vector3.cross(axis, { x: 0, y: 0, z: 1 });
  normal = Vector3.normalize(normal);

  const upperDir = Quaternion.rotateVector(
    Quaternion.fromAxisAngle(normal, lift),
    axis,
  );
  const midJoint = Vector3.add(root, Vector3.scale(upperDir, l1));
  const foreDir = Vector3.normalize(Vector3.subtract(props.target, midJoint));

  // Root joint: world delta taking the rest upper dir onto upperDir, lowered
  // into the bone-local articulation (restWorld⁻¹ · Δ · restWorld).
  const rsu = props.upper.worldRotation;
  const du = aimRotation(restUpperDir, upperDir);
  const upper = Quaternion.multiply(
    Quaternion.inverse(rsu),
    Quaternion.multiply(du, rsu),
  );

  // Mid joint: worldRot(L) = du · Rsl · articL, so the fore segment's local
  // axis (Rsl⁻¹ · restForeDir) must rotate onto (Rsl⁻¹ · du⁻¹ · foreDir).
  const rsl = props.lower.worldRotation;
  const rslInv = Quaternion.inverse(rsl);
  const localFore = Quaternion.rotateVector(rslInv, restForeDir);
  const localGoal = Quaternion.rotateVector(
    rslInv,
    Quaternion.rotateVector(Quaternion.inverse(du), foreDir),
  );
  const lower = aimRotation(localFore, localGoal);

  return { upper, lower };
};
