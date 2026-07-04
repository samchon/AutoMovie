import {
  automovieHumanoidBone,
  IautomovieBone,
  IautomoviePose,
  IautomovieQuaternion,
  IautomovieSkeleton,
  IautomovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IautomovieRestFrame } from "../rom/restFrame";
import { IautomovieJointAxes, jointToQuaternion } from "./JointToQuaternion";

/**
 * A resolved bone transform after forward kinematics: the bone's local rotation
 * (rest ??articulation) and its world position.
 */
export interface IautomovieResolvedBone {
  /** The bone this transform belongs to. */
  bone: automovieHumanoidBone;
  /**
   * Local rotation to set on the bone (rest rotation composed with
   * articulation).
   */
  localRotation: IautomovieQuaternion;
  /** Bone origin in world/model space, after walking the hierarchy. */
  worldPosition: IautomovieVector3;
  /**
   * Bone orientation in world/model space (parent world rotation ??local). This
   * is what an **attachment** rides ??fixing a child body's frame in this
   * bone's frame (e.g. a rider in a horse's saddle) parents the two the way a
   * physics joint does.
   */
  worldRotation: IautomovieQuaternion;
}

/**
 * Resolve a {@link IautomoviePose} against its {@link IautomovieSkeleton} into
 * per-bone transforms (forward kinematics).
 *
 * For each bone it composes the rest-pose local rotation with the pose's
 * articulation ({@link jointToQuaternion}), then walks the parent hierarchy to
 * accumulate world positions. The result feeds two consumers:
 *
 * - The **renderer**, which sets each bone's `localRotation` and lets the scene
 *   graph compute world transforms (so `worldPosition` is informational
 *   there);
 * - **physics-style validators**, which need world positions (e.g. foot-ground
 *   contact, centre of mass).
 *
 * Bones are processed parent-before-child via a topological walk from the root,
 * so a parent's world transform is always available when a child is resolved. A
 * skeleton with no root bone (every bone parented) resolves to an empty array.
 *
 * `jointAxes` optionally remaps the clinical axes per bone (e.g.
 * `HUMANOID_JOINT_AXES`, so a T-pose arm's flexion swings it sagittally); a
 * bone absent from it uses the default clinical basis, so omitting it preserves
 * the baseline behavior exactly.
 *
 * `restFrames` optionally reads each joint's angles as **clinical** and maps
 * them into that bone's rest-relative space (e.g. `HUMANOID_REST_FRAME`, so
 * `+abduction` raises either arm despite the shared axis); a bone absent from
 * it, or an omitted table, is the identity ??the angles are taken as the rig's
 * own.
 *
 * @author Samchon
 */
export const resolvePose = (
  pose: IautomoviePose,
  skeleton: IautomovieSkeleton,
  jointAxes?: Partial<Record<automovieHumanoidBone, IautomovieJointAxes>>,
  restFrames?: Partial<Record<automovieHumanoidBone, IautomovieRestFrame>>,
): IautomovieResolvedBone[] => {
  const articulation = new Map<automovieHumanoidBone, IautomovieQuaternion>();
  for (const j of pose.joints)
    articulation.set(
      j.bone,
      jointToQuaternion(j, jointAxes?.[j.bone], restFrames?.[j.bone]),
    );

  const children = new Map<
    automovieHumanoidBone | "__root__",
    IautomovieBone[]
  >();
  for (const b of skeleton.bones) {
    const key = b.parent ?? "__root__";
    const list = children.get(key) ?? [];
    list.push(b);
    children.set(key, list);
  }

  const resolved: IautomovieResolvedBone[] = [];

  // The walk receives the bone object directly (the children map already holds
  // it), so there is no name?뭕one lookup and no unreachable "missing bone" guard.
  const walk = (
    bone: IautomovieBone,
    parentWorldRot: IautomovieQuaternion,
    parentWorldPos: IautomovieVector3,
  ): void => {
    const art = articulation.get(bone.bone) ?? Quaternion.identity();
    const localRotation = Quaternion.multiply(bone.rest.rotation, art);

    const worldRot = Quaternion.multiply(parentWorldRot, localRotation);
    const worldPos = Vector3.add(
      parentWorldPos,
      Quaternion.rotateVector(parentWorldRot, bone.rest.translation),
    );

    resolved.push({
      bone: bone.bone,
      localRotation,
      worldPosition: worldPos,
      worldRotation: worldRot,
    });

    for (const child of children.get(bone.bone) ?? [])
      walk(child, worldRot, worldPos);
  };

  const rootTranslation = pose.root?.translation ?? Vector3.create(0, 0, 0);
  const rootRotation = pose.root?.rotation ?? Quaternion.identity();
  for (const root of children.get("__root__") ?? [])
    walk(root, rootRotation, rootTranslation);

  return resolved;
};
