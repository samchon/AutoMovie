import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { AutoMovieHumanoidBone } from "./AutoMovieHumanoidBone";
import { IAutoMovieJointConstraint } from "./IAutoMovieJointConstraint";

/**
 * One bone in a {@link IAutoMovieSkeleton}: its identity, parent, rest pose, and
 * anatomical range of motion.
 *
 * A bone binds together (a) the normalized humanoid slot it fills (`bone`), (b)
 * where it sits in the hierarchy (`parent`), (c) its neutral local transform
 * (`rest`, the 0-articulation pose), and (d) the ROM the engine validates poses
 * against (`constraint`). For a _generated_ character the geometry phase
 * produces these; for an _imported_ glTF/VRM the ingest package derives them.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `IAutoMovieBone` as the portable data boundary for the actor humanoid mapping requirement.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `IAutoMovieBone` for the performance rig semantic joint mapping system contract.
 * @author Samchon
 */
export interface IAutoMovieBone {
  /**
   * Which normalized humanoid slot this bone fills. Unique within a skeleton.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `bone` as the portable data boundary for the actor humanoid mapping requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `bone` for the performance rig semantic joint mapping system contract.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Parent bone in the hierarchy, or `null` for the root (`hips`). Defines the
   * space in which `rest` and articulation are expressed.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `parent` as the portable data boundary for the actor humanoid mapping requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `parent` for the performance rig semantic joint mapping system contract.
   */
  parent: AutoMovieHumanoidBone | null;

  /**
   * Rest-pose local transform relative to `parent`: the bone at 0 articulation.
   * Semantic joint angles ({@link IAutoMovieJointPose}) are applied _on top of_
   * this by the engine.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Exposes `rest` as the bone's explicit rest-pose transform.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Types `rest` as the deformation binding's declared rest basis.
   */
  rest: IAutoMovieTransform;

  /**
   * Per-rig anatomical range-of-motion override for this joint. `null` keeps
   * the normalized humanoid default when that slot has one; a slot absent from
   * the default table is unconstrained. Supply a constraint to replace the
   * default for a stylized, non-human, or specially trained character.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `constraint` as the declared joint range and coupled behavior.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `constraint` as the rig's explicit ROM contract.
   */
  constraint: IAutoMovieJointConstraint | null;
}
