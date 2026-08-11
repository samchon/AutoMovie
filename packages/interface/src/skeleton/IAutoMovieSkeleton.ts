import { IAutoMovieBone } from "./IAutoMovieBone";

/**
 * A normalized humanoid skeleton: the rig a pose or motion targets.
 *
 * The skeleton is the contract between _what exists_ (which bones, their
 * hierarchy, their ROM) and _what an animation does_ (which bones it rotates).
 * Because bones are keyed by the closed {@link AutoMovieHumanoidBone} enum, a
 * motion authored against one skeleton retargets onto any other that shares the
 * humanoid convention, the basis of automovie's "author once, play on any VRM"
 * portability.
 *
 * Whether the skeleton was generated (geometry phase) or imported (ingest of a
 * user's glTF/VRM/FBX), it arrives here in the same normalized shape, so the
 * pose/motion/expression layers never need to know its origin.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Carries the normalized humanoid skeleton whose semantic bones make a motion portable across model-specific rigs.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Defines the public skeleton as the semantic-to-concrete rig mapping boundary.
 * @author Samchon
 */
export interface IAutoMovieSkeleton {
  /**
   * Stable id so poses, motions, and scene nodes can cite this rig.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Gives the normalized semantic mapping a stable rig identity for motion targets.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Identifies the concrete rig binding that resolves semantic joint keys.
   */
  id: string;

  /**
   * The bones, hierarchy, rest pose, and ROM. At least one bone (`hips`, the
   * root) is required. Each {@link IAutoMovieBone.bone} appears at most once.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Carries the normalized bone hierarchy and rest transforms against which deformation is interpreted.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Supplies the hierarchy and rest-state portion of the public deformation-binding record.
   */
  bones: IAutoMovieBone[];
}
