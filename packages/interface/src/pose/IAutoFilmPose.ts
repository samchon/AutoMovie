import { IAutoFilmTransform } from "../geometry/IAutoFilmTransform";
import { IAutoFilmJointPose } from "./IAutoFilmJointPose";

/**
 * A single static full-body pose — a snapshot of the skeleton's articulation at
 * one instant.
 *
 * A pose is **sparse**: `joints` lists only the bones that move away from their
 * rest pose. Every unlisted bone stays at rest. This keeps what the LLM emits
 * small and legible (a wave is a handful of joints, not all 55) and is the
 * structured-output unit that the engine validates against the target
 * skeleton's ROM before anything renders.
 *
 * A pose is also the building block of motion: a {@link IAutoFilmKeyframe} is a
 * pose plus a timestamp.
 *
 * @author Samchon
 */
export interface IAutoFilmPose {
  /**
   * Which skeleton this pose articulates. The engine validates each joint
   * against this rig's bones and ROM constraints.
   */
  skeleton: string;

  /**
   * Root placement of the whole character in its parent space. `null` = leave
   * the root where it is (identity). Use this to plant, translate, or turn the
   * whole body; per-joint bending is `joints`.
   */
  root: IAutoFilmTransform | null;

  /**
   * The articulated joints. Sparse — only bones that leave their rest pose
   * appear. Each {@link IAutoFilmJointPose.bone} should appear at most once; the
   * engine treats duplicates as a conflict.
   */
  joints: IAutoFilmJointPose[];
}
