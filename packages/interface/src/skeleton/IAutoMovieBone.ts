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
   * Rest-pose local transform relative to `parent` — the bone at 0
   * articulation. Semantic joint angles ({@link IAutoMovieJointPose}) are
   * applied _on top of_ this by the engine.
   */
  rest: IAutoMovieTransform;

  /**
   * Anatomical range of motion for this joint. `null` = unconstrained (no ROM
   * check; e.g. a stylized rig or a slot where limits are unknown). Supplying a
   * constraint is what enables the engine's Tier-2 ROM verifier.
   */
  constraint: IAutoMovieJointConstraint | null;
}
