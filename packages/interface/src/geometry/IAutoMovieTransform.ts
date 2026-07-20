import { IAutoMovieQuaternion } from "./IAutoMovieQuaternion";
import { IAutoMovieVector3 } from "./IAutoMovieVector3";

/**
 * A TRS (translate / rotate / scale) transform placing a node in its parent's
 * space.
 *
 * Mirrors glTF node transform semantics so it maps 1:1 onto `three.js`,
 * `@pixiv/three-vrm`, and glTF export. Used for scene-node placement
 * ({@link IAutoMovieSceneNode}) and the root transform of a pose
 * ({@link IAutoMoviePose}). Per-joint articulation does NOT use this: joints
 * use semantic angles ({@link IAutoMovieJointPose}); a full TRS per joint would
 * hand the LLM quaternions it cannot emit reliably.
 *
 * @author Samchon
 */
export interface IAutoMovieTransform {
  /** Translation in parent space (meters). */
  translation: IAutoMovieVector3;

  /**
   * Rotation as a unit quaternion. Engine-facing; for character joints the
   * engine derives this from semantic angles rather than asking the LLM for
   * it.
   */
  rotation: IAutoMovieQuaternion;

  /**
   * Per-axis scale factor (dimensionless, `1` = identity). Uniform scale is `{
   * x: s, y: s, z: s }`. Non-positive components are rejected by the engine.
   */
  scale: IAutoMovieVector3;
}
