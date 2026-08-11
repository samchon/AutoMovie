import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieJointPose } from "./IAutoMovieJointPose";

/**
 * A single static full-body pose: a snapshot of the skeleton's articulation at
 * one instant.
 *
 * A pose is **sparse**: `joints` lists only the bones that move away from their
 * rest pose. Every unlisted bone stays at rest. This keeps what the LLM emits
 * small and legible (a wave is a handful of joints, not all 55) and is the
 * structured-output unit that the engine validates against the target
 * skeleton's ROM before anything renders.
 *
 * A pose is also the building block of motion: a {@link IAutoMovieKeyframe} is a
 * pose plus a timestamp.
 *
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction Exposes `IAutoMoviePose` as the portable data boundary for the actor pose motion distinction requirement.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `IAutoMoviePose` for the performance actor pose gaze expression state system contract.
 * @author Samchon
 */
export interface IAutoMoviePose {
  /**
   * Which skeleton this pose articulates. The engine validates each joint
   * against this rig's bones and ROM constraints.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction Exposes `skeleton` as the portable data boundary for the actor pose motion distinction requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `skeleton` for the performance actor pose gaze expression state system contract.
   */
  skeleton: string;

  /**
   * Root placement of the whole character in its parent space. `null` = leave
   * the root where it is (identity). Use this to plant, translate, or turn the
   * whole body; per-joint bending is `joints`.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction Exposes `root` as the portable data boundary for the actor pose motion distinction requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `root` for the performance actor pose gaze expression state system contract.
   */
  root: IAutoMovieTransform | null;

  /**
   * The articulated joints. Sparse: only bones that leave their rest pose
   * appear. Each {@link IAutoMovieJointPose.bone} should appear at most once;
   * the engine treats duplicates as a conflict.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction Exposes `joints` as the portable data boundary for the actor pose motion distinction requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `joints` for the performance actor pose gaze expression state system contract.
   */
  joints: IAutoMovieJointPose[];
}
