import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmPose,
  IAutoFilmQuaternion,
  IAutoFilmSkeleton,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoFilmJointAxes, jointToQuaternion } from "./jointToQuaternion";

/**
 * A resolved bone transform after forward kinematics: the bone's local rotation
 * (rest ∘ articulation) and its world position.
 */
export interface IAutoFilmResolvedBone {
  /** The bone this transform belongs to. */
  bone: AutoFilmHumanoidBone;
  /**
   * Local rotation to set on the bone (rest rotation composed with
   * articulation).
   */
  localRotation: IAutoFilmQuaternion;
  /** Bone origin in world/model space, after walking the hierarchy. */
  worldPosition: IAutoFilmVector3;
}

/**
 * Resolve a {@link IAutoFilmPose} against its {@link IAutoFilmSkeleton} into
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
 * @author Samchon
 */
export const resolvePose = (
  pose: IAutoFilmPose,
  skeleton: IAutoFilmSkeleton,
  jointAxes?: Partial<Record<AutoFilmHumanoidBone, IAutoFilmJointAxes>>,
): IAutoFilmResolvedBone[] => {
  const articulation = new Map<AutoFilmHumanoidBone, IAutoFilmQuaternion>();
  for (const j of pose.joints)
    articulation.set(j.bone, jointToQuaternion(j, jointAxes?.[j.bone]));

  const children = new Map<
    AutoFilmHumanoidBone | "__root__",
    IAutoFilmBone[]
  >();
  for (const b of skeleton.bones) {
    const key = b.parent ?? "__root__";
    const list = children.get(key) ?? [];
    list.push(b);
    children.set(key, list);
  }

  const resolved: IAutoFilmResolvedBone[] = [];

  // The walk receives the bone object directly (the children map already holds
  // it), so there is no name→bone lookup and no unreachable "missing bone" guard.
  const walk = (
    bone: IAutoFilmBone,
    parentWorldRot: IAutoFilmQuaternion,
    parentWorldPos: IAutoFilmVector3,
  ): void => {
    const art = articulation.get(bone.bone) ?? Quaternion.identity();
    const localRotation = Quaternion.multiply(bone.rest.rotation, art);

    const worldRot = Quaternion.multiply(parentWorldRot, localRotation);
    const worldPos = Vector3.add(
      parentWorldPos,
      Quaternion.rotateVector(parentWorldRot, bone.rest.translation),
    );

    resolved.push({ bone: bone.bone, localRotation, worldPosition: worldPos });

    for (const child of children.get(bone.bone) ?? [])
      walk(child, worldRot, worldPos);
  };

  const rootTranslation = pose.root?.translation ?? Vector3.create(0, 0, 0);
  const rootRotation = pose.root?.rotation ?? Quaternion.identity();
  for (const root of children.get("__root__") ?? [])
    walk(root, rootRotation, rootTranslation);

  return resolved;
};
