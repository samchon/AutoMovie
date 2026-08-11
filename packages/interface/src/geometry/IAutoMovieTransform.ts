import { IAutoMovieQuaternion } from "./IAutoMovieQuaternion";
import { IAutoMovieVector3 } from "./IAutoMovieVector3";

/**
 * A TRS (translate / rotate / scale) transform placing a node in its parent's
 * space.
 *
 * Mirrors glTF node transform semantics so it maps 1:1 onto `three.js` and
 * glTF host adapters. Used for scene-node placement
 * ({@link IAutoMovieSceneNode}) and the root transform of a pose
 * ({@link IAutoMoviePose}). Per-joint articulation does NOT use this: joints use
 * semantic angles ({@link IAutoMovieJointPose}); a full TRS per joint would hand
 * the LLM quaternions it cannot emit reliably.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Exposes `IAutoMovieTransform` as the portable data boundary for the external identity spatial coordinates units requirement.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `IAutoMovieTransform` for the interchange spatial transform chain system contract.
 * @author Samchon
 */
export interface IAutoMovieTransform {
  /**
   * Translation in parent space (meters).
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Exposes `translation` as the portable data boundary for the external identity spatial coordinates units requirement.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `translation` for the interchange spatial transform chain system contract.
   */
  translation: IAutoMovieVector3;

  /**
   * Rotation as a unit quaternion. Engine-facing; for character joints the
   * engine derives this from semantic angles rather than asking the LLM for
   * it.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Exposes `rotation` as the portable data boundary for the external identity spatial coordinates units requirement.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `rotation` for the interchange spatial transform chain system contract.
   */
  rotation: IAutoMovieQuaternion;

  /**
   * Per-axis scale factor (dimensionless, `1` = identity). Uniform scale is `{
   * x: s, y: s, z: s }`. Non-positive components are rejected by the engine.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Exposes `scale` as the portable data boundary for the external identity spatial coordinates units requirement.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `scale` for the interchange spatial transform chain system contract.
   */
  scale: IAutoMovieVector3;
}
