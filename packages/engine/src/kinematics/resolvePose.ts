import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { IAutoMovieJointAxes, jointToQuaternion } from "./jointToQuaternion";

const ROOT_PARENT = "__root__";

/**
 * A resolved bone transform after forward kinematics: the bone's local rotation
 * (rest ∘ articulation) and its world position.
 */
export interface IAutoMovieResolvedBone {
  /** The bone this transform belongs to. */
  bone: AutoMovieHumanoidBone;
  /**
   * Local rotation to set on the bone (rest rotation composed with
   * articulation).
   */
  localRotation: IAutoMovieQuaternion;
  /** Bone origin in world/model space, after walking the hierarchy. */
  worldPosition: IAutoMovieVector3;
  /**
   * Bone orientation in world/model space (parent world rotation ∘ local). This
   * is what an **attachment** rides — fixing a child body's frame in this
   * bone's frame (e.g. a rider in a horse's saddle) parents the two the way a
   * physics joint does.
   */
  worldRotation: IAutoMovieQuaternion;
}

export type AutoMovieSkeletonParentKey = AutoMovieHumanoidBone | "__root__";

/**
 * Pose-independent hierarchy index for a skeleton's FK walk.
 *
 * Build this once when resolving many poses against the same skeleton, then
 * pass it into {@link resolvePose} and {@link reachableBoneNames}. The default
 * call path intentionally rebuilds the index from the current skeleton object,
 * so callers that mutate `skeleton.bones` never get a hidden stale cache.
 *
 * @author Samchon
 */
export interface IAutoMovieSkeletonTopology {
  /** Bones grouped by parent (`__root__` for null-parent roots). */
  readonly childrenByParent: ReadonlyMap<
    AutoMovieSkeletonParentKey,
    readonly IAutoMovieBone[]
  >;

  /** The exact bone names the FK root walk can reach. */
  readonly reachableBones: ReadonlySet<AutoMovieHumanoidBone>;
}

/**
 * Index a skeleton's parent-child topology once for repeated FK work.
 *
 * @author Samchon
 */
export const indexSkeletonTopology = (
  skeleton: IAutoMovieSkeleton,
): IAutoMovieSkeletonTopology => {
  const childrenByParent = new Map<
    AutoMovieSkeletonParentKey,
    IAutoMovieBone[]
  >();
  for (const bone of skeleton.bones) {
    const key = bone.parent ?? ROOT_PARENT;
    const children = childrenByParent.get(key) ?? [];
    children.push(bone);
    childrenByParent.set(key, children);
  }

  const reachableBones = new Set<AutoMovieHumanoidBone>();
  const walk = (bone: IAutoMovieBone): void => {
    reachableBones.add(bone.bone);
    for (const child of childrenByParent.get(bone.bone) ?? []) walk(child);
  };
  for (const root of childrenByParent.get(ROOT_PARENT) ?? []) walk(root);

  return { childrenByParent, reachableBones };
};

/**
 * Resolve a {@link IAutoMoviePose} against its {@link IAutoMovieSkeleton} into
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
 * so a parent's world transform is always available when a child is resolved.
 *
 * **Contract: only root-reachable bones are resolved.** The walk starts from
 * null-parent roots and follows the parent links, so a bone with an orphaned
 * parent reference, a detached sub-tree, or a cyclic parent chain (every member
 * has a non-null parent, so none is entered from a root — no infinite recursion
 * results, since a bone is reached only through its single parent) is **omitted
 * from the result**, and a skeleton with no root at all resolves to an empty
 * array. This is load-bearing: {@link reachableBoneNames} derives the reachable
 * set from the same walk, and graceful consumers (a physics validator gating a
 * bone, `retargetHumanoidMotion` measuring rest height) rely on the partial
 * return to report a malformed rig instead of crashing. A consumer that needs
 * every declared bone present must gate on {@link reachableBoneNames} first —
 * the total, non-throwing "which bones will resolve" query.
 *
 * `jointAxes` optionally remaps the clinical axes per bone (e.g.
 * `HUMANOID_JOINT_AXES`, so a T-pose arm's flexion swings it sagittally); a
 * bone absent from it uses the default clinical basis, so omitting it preserves
 * the baseline behavior exactly.
 *
 * `restFrames` optionally reads each joint's angles as **clinical** and maps
 * them into that bone's rest-relative space (e.g. `HUMANOID_REST_FRAME`, so
 * `+abduction` raises either arm despite the shared axis); a bone absent from
 * it, or an omitted table, is the identity — the angles are taken as the rig's
 * own.
 *
 * `topology` optionally reuses a pose-independent hierarchy index built by
 * {@link indexSkeletonTopology}. Omit it for one-off calls, especially if the
 * skeleton object may have been mutated since a prior resolve.
 *
 * @author Samchon
 */
export const resolvePose = (
  pose: IAutoMoviePose,
  skeleton: IAutoMovieSkeleton,
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
  topology: IAutoMovieSkeletonTopology = indexSkeletonTopology(skeleton),
): IAutoMovieResolvedBone[] => {
  const articulation = new Map<AutoMovieHumanoidBone, IAutoMovieQuaternion>();
  for (const j of pose.joints)
    articulation.set(
      j.bone,
      jointToQuaternion(j, jointAxes?.[j.bone], restFrames?.[j.bone]),
    );

  const resolved: IAutoMovieResolvedBone[] = [];

  // The walk receives the bone object directly (the children map already holds
  // it), so there is no name→bone lookup during the descent.
  const walk = (
    bone: IAutoMovieBone,
    parentWorldRot: IAutoMovieQuaternion,
    parentWorldPos: IAutoMovieVector3,
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

    for (const child of topology.childrenByParent.get(bone.bone) ?? [])
      walk(child, worldRot, worldPos);
  };

  const rootTranslation = pose.root?.translation ?? Vector3.create(0, 0, 0);
  const rootRotation = pose.root?.rotation ?? Quaternion.identity();
  for (const root of topology.childrenByParent.get(ROOT_PARENT) ?? [])
    walk(root, rootRotation, rootTranslation);

  return resolved;
};

/**
 * The bones a skeleton's forward-kinematics walk actually reaches — every bone
 * whose parent chain lands on a null-parent root. Pose-independent (it follows
 * parent links only), so it is the exact set {@link resolvePose}'s walk visits
 * and can never disagree with which bones a sampled pose resolves. A physics
 * validator gates a bone against this set BEFORE reading its resolved world
 * position: a bone can be **declared** in `skeleton.bones` yet be detached (its
 * chain never reaches a root), in which case `resolvePose` omits it and the
 * declared-set membership check alone would read a bone the FK result never
 * contains. This is the query that names the reachable set explicitly.
 *
 * @author Samchon
 */
export const reachableBoneNames = (
  skeleton: IAutoMovieSkeleton,
  topology: IAutoMovieSkeletonTopology = indexSkeletonTopology(skeleton),
): Set<AutoMovieHumanoidBone> => new Set(topology.reachableBones);
