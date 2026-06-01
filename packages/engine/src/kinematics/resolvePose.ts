import {
  IMoticaPose,
  IMoticaQuaternion,
  IMoticaSkeleton,
  IMoticaVector3,
  MoticaHumanoidBone,
} from "@motica/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { jointToQuaternion } from "./jointToQuaternion";

/**
 * A resolved bone transform after forward kinematics: the bone's local rotation
 * (rest ∘ articulation) and its world position.
 */
export interface IMoticaResolvedBone {
  /** The bone this transform belongs to. */
  bone: MoticaHumanoidBone;
  /**
   * Local rotation to set on the bone (rest rotation composed with
   * articulation).
   */
  localRotation: IMoticaQuaternion;
  /** Bone origin in world/model space, after walking the hierarchy. */
  worldPosition: IMoticaVector3;
}

/**
 * Resolve a {@link IMoticaPose} against its {@link IMoticaSkeleton} into per-bone
 * transforms (forward kinematics).
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
 * so a parent's world transform is always available when a child is resolved.
 *
 * @author Samchon
 */
export const resolvePose = (
  pose: IMoticaPose,
  skeleton: IMoticaSkeleton,
): IMoticaResolvedBone[] => {
  const articulation = new Map<MoticaHumanoidBone, IMoticaQuaternion>();
  for (const j of pose.joints) articulation.set(j.bone, jointToQuaternion(j));

  const byBone = new Map(skeleton.bones.map((b) => [b.bone, b]));
  const children = new Map<
    MoticaHumanoidBone | "__root__",
    typeof skeleton.bones
  >();
  for (const b of skeleton.bones) {
    const key = b.parent ?? "__root__";
    const list = children.get(key) ?? [];
    list.push(b);
    children.set(key, list);
  }

  const resolved: IMoticaResolvedBone[] = [];
  const worldRotOf = new Map<MoticaHumanoidBone, IMoticaQuaternion>();
  const worldPosOf = new Map<MoticaHumanoidBone, IMoticaVector3>();

  const walk = (
    boneName: MoticaHumanoidBone,
    parentWorldRot: IMoticaQuaternion,
    parentWorldPos: IMoticaVector3,
  ): void => {
    const bone = byBone.get(boneName);
    if (bone === undefined) return;

    const restRot = bone.rest.rotation;
    const art = articulation.get(boneName) ?? Quaternion.identity();
    const localRotation = Quaternion.multiply(restRot, art);

    // world rotation/position of this bone's origin
    const worldRot = Quaternion.multiply(parentWorldRot, localRotation);
    const worldPos = Vector3.add(
      parentWorldPos,
      Quaternion.rotateVector(parentWorldRot, bone.rest.translation),
    );
    worldRotOf.set(boneName, worldRot);
    worldPosOf.set(boneName, worldPos);

    resolved.push({ bone: boneName, localRotation, worldPosition: worldPos });

    for (const child of children.get(boneName) ?? [])
      walk(child.bone, worldRot, worldPos);
  };

  const rootTranslation = pose.root?.translation ?? Vector3.create(0, 0, 0);
  const rootRotation = pose.root?.rotation ?? Quaternion.identity();
  for (const root of children.get("__root__") ?? [])
    walk(root.bone, rootRotation, rootTranslation);

  return resolved;
};
