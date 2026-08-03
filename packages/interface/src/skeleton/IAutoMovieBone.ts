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
 * @author Samchon
 */
export interface IAutoMovieBone {
  /** Which normalized humanoid slot this bone fills. Unique within a skeleton. */
  bone: AutoMovieHumanoidBone;

  /**
   * Parent bone in the hierarchy, or `null` for the root (`hips`). Defines the
   * space in which `rest` and articulation are expressed.
   */
  parent: AutoMovieHumanoidBone | null;

  /**
   * Rest-pose local transform relative to `parent`: the bone at 0 articulation.
   * Semantic joint angles ({@link IAutoMovieJointPose}) are applied _on top of_
   * this by the engine.
   */
  rest: IAutoMovieTransform;

  /**
   * Per-rig anatomical range-of-motion override for this joint. `null` keeps
   * the normalized humanoid default when that slot has one; a slot absent from
   * the default table is unconstrained. Supply a constraint to replace the
   * default for a stylized, non-human, or specially trained character.
   */
  constraint: IAutoMovieJointConstraint | null;
}
