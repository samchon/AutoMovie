import { IAutoFilmQuaternion } from "./IAutoFilmQuaternion";
import { IAutoFilmVector3 } from "./IAutoFilmVector3";

/**
 * A TRS (translate / rotate / scale) transform placing a node in its parent's
 * space.
 *
 * Mirrors glTF node transform semantics so it maps 1:1 onto `three.js`,
 * `@pixiv/three-vrm`, and glTF export. Used for scene-node placement
 * ({@link IAutoFilmSceneNode}) and the root transform of a pose
 * ({@link IAutoFilmPose}). Per-joint articulation does NOT use this — joints use
 * semantic angles ({@link IAutoFilmJointPose}); a full TRS per joint would hand
 * the LLM quaternions it cannot emit reliably.
 *
 * @author Samchon
 */
export interface IAutoFilmTransform {
  /** Translation in parent space (meters). */
  translation: IAutoFilmVector3;

  /**
   * Rotation as a unit quaternion. Engine-facing; for character joints the
   * engine derives this from semantic angles rather than asking the LLM for
   * it.
   */
  rotation: IAutoFilmQuaternion;

  /**
   * Per-axis scale factor (dimensionless, `1` = identity). Uniform scale is `{
   * x: s, y: s, z: s }`. Non-positive components are rejected by the engine.
   */
  scale: IAutoFilmVector3;
}
