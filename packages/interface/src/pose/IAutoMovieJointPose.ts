import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * The articulation of a single joint, expressed as semantic clinical angles.
 *
 * This is the **LLM-facing** rotation primitive: the one thing the model
 * actually emits to move a body. It deliberately mirrors the axis decomposition
 * of {@link IAutoMovieJointConstraint} (flexion / abduction / twist) so a
 * generated angle can be validated against the joint's ROM by a direct,
 * per-axis comparison. The engine composes these three angles, about the bone's
 * local axes and on top of its rest transform, into the quaternion the renderer
 * consumes.
 *
 * Exposing degrees-per-named-axis (instead of a quaternion) is the core reason
 * an LLM can drive a body at all: "bend the left elbow 90°" is `{ bone:
 * "leftLowerArm", flexion: 90 }`, which the model produces reliably and a human
 * can read.
 *
 * Each axis is `number | null`; `null` means "no rotation on this axis"
 * (equivalent to 0, and the only valid value for an axis the joint cannot move;
 * the ROM verifier rejects a non-null angle on a `null` constraint axis).
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `IAutoMovieJointPose` as the portable data boundary for the actor joint range constraints requirement.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `IAutoMovieJointPose` for the performance rig rom control driver graph system contract.
 * @author Samchon
 */
export interface IAutoMovieJointPose {
  /**
   * Which bone this articulation applies to.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `bone` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `bone` for the performance rig rom control driver graph system contract.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Sagittal angle: flexion (+) / extension (−). `null` = unchanged.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `flexion` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `flexion` for the performance rig rom control driver graph system contract.
   */
  flexion: number | null;

  /**
   * Frontal angle: abduction (+) / adduction (−). `null` = unchanged.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `abduction` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `abduction` for the performance rig rom control driver graph system contract.
   */
  abduction: number | null;

  /**
   * Axial angle: external (+) / internal (−) rotation. `null` = unchanged.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Exposes `twist` as the portable data boundary for the actor joint range constraints requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `twist` for the performance rig rom control driver graph system contract.
   */
  twist: number | null;
}
