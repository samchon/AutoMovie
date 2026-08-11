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
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Captures one bone transform after composing its declared rest-space articulation.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Carries one hierarchy-composed bone result.
 */
export interface IAutoMovieResolvedBone {
  /**
   * The bone this transform belongs to.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Retains the stable bone identity whose rest transform was evaluated.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Associates each resolved frame with its declared skeleton node.
   */
  bone: AutoMovieHumanoidBone;
  /**
   * Local rotation to set on the bone (rest rotation composed with
   * articulation).
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority Keeps articulation in the bone-local space that owns the pose control.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the local pose state applied to the resolved bone.
   */
  localRotation: IAutoMovieQuaternion;
  /**
   * Bone origin in world/model space, after walking the hierarchy.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Resolves the declared parent-local offsets into the bone's current world position.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Stores the hierarchy-composed world origin used for spatial queries.
   */
  worldPosition: IAutoMovieVector3;
  /**
   * Bone orientation in world/model space (parent world rotation ∘ local). This
   * is what an **attachment** rides. Fixing a child body's frame in this bone's
   * frame (e.g. a rider in a horse's saddle) parents the two the way a physics
   * joint does.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Accumulates rest and articulation rotations through the declared parent chain.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Stores the hierarchy-composed world orientation of the bone.
   */
  worldRotation: IAutoMovieQuaternion;
}

/**
 * Bone name or sentinel used to index skeleton roots by parent.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Distinguishes declared parent bones from the hierarchy's null-parent roots.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Provides the key space for the skeleton's parent-child walk.
 */
export type AutoMovieSkeletonParentKey = AutoMovieHumanoidBone | "__root__";

/**
 * Pose-independent hierarchy index for a skeleton's FK walk.
 *
 * Build this once when resolving many poses against the same skeleton, then
 * pass it into {@link resolvePose} and {@link reachableBoneNames}. The default
 * call path intentionally rebuilds the index from the current skeleton object,
 * so callers that mutate `skeleton.bones` never get a hidden stale cache.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Indexes the stable hierarchy used to compose every bone from its parent-local rest transform.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Holds the reusable traversal state derived from a skeleton.
 * @author Samchon
 */
export interface IAutoMovieSkeletonTopology {
  /**
   * Bones grouped by parent (`__root__` for null-parent roots).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Retains each parent-local relationship used by forward kinematics.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Supplies a deterministic child order for the hierarchy walk.
   */
  readonly childrenByParent: ReadonlyMap<
    AutoMovieSkeletonParentKey,
    readonly IAutoMovieBone[]
  >;

  /**
   * The exact bone names the FK root walk can reach.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-refusal Marks exactly the declared bones connected to a hierarchy root.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure Exposes the reachable set used to report malformed rig topology.
   */
  readonly reachableBones: ReadonlySet<AutoMovieHumanoidBone>;
}

/**
 * Index a skeleton's parent-child topology once for repeated FK work.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Builds the parent-first traversal required to compose rest transforms consistently.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Builds deterministic parent-first traversal metadata from declared hierarchy links.
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
 * has a non-null parent, so none is entered from a root: no infinite recursion
 * results, since a bone is reached only through its single parent) is **omitted
 * from the result**, and a skeleton with no root at all resolves to an empty
 * array. This is load-bearing: {@link reachableBoneNames} derives the reachable
 * set from the same walk, and graceful consumers (a physics validator gating a
 * bone, `retargetHumanoidMotion` measuring rest height) rely on the partial
 * return to report a malformed rig instead of crashing. A consumer that needs
 * every declared bone present must gate on {@link reachableBoneNames} first: the
 * total, non-throwing "which bones will resolve" query.
 *
 * `jointAxes` optionally remaps the clinical axes per bone (e.g.
 * `HUMANOID_JOINT_AXES`, so a T-pose arm's flexion swings it sagittally); a
 * bone absent from it uses the default clinical basis, so omitting it preserves
 * the baseline behavior exactly.
 *
 * `restFrames` optionally reads each joint's angles as **clinical** and maps
 * them into that bone's rest-relative space (e.g. `HUMANOID_REST_FRAME`, so
 * `+abduction` raises either arm despite the shared axis); a bone absent from
 * it, or an omitted table, is the identity. The angles are taken as the rig's
 * own.
 *
 * `topology` optionally reuses a pose-independent hierarchy index built by
 * {@link indexSkeletonTopology}. Omit it for one-off calls, especially if the
 * skeleton object may have been mutated since a prior resolve.
 *
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority Composes each bone-local authored pose through its declared parent hierarchy into one resolved state.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Evaluates the current body pose into deterministic per-bone transforms.
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
 * The bones a skeleton's forward-kinematics walk actually reaches, every bone
 * whose parent chain lands on a null-parent root. Pose-independent (it follows
 * parent links only), so it is the exact set {@link resolvePose}'s walk visits
 * and can never disagree with which bones a sampled pose resolves. A physics
 * validator gates a bone against this set BEFORE reading its resolved world
 * position: a bone can be **declared** in `skeleton.bones` yet be detached (its
 * chain never reaches a root), in which case `resolvePose` omits it and the
 * declared-set membership check alone would read a bone the FK result never
 * contains. This is the query that names the reachable set explicitly.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-refusal Returns the bones connected to a declared root before consumers read FK output.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-retarget-preservation-failure Returns the exact connected topology used to diagnose an unusable rig chain.
 * @author Samchon
 */
export const reachableBoneNames = (
  skeleton: IAutoMovieSkeleton,
  topology: IAutoMovieSkeletonTopology = indexSkeletonTopology(skeleton),
): Set<AutoMovieHumanoidBone> => new Set(topology.reachableBones);
