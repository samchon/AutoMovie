import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * One named humanoid joint projected to screen space (#1168): the exact
 * OpenPose-style keypoint automovie can emit because it already knows every
 * bone's exact 3D world position. `x`/`y` are normalized to the frame (`[0,
 * 1]`, top-left origin), resolution-independent so a host scales them to
 * whatever it renders at.
 *
 * A joint behind the camera or outside the frame rectangle is still projected
 * (never silently clamped: a clamped off-screen point reads as a false edge
 * keypoint and corrupts ControlNet conditioning) but flagged `inFrame: false`,
 * so a consumer keeps it or drops it deliberately.
 *
 * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `IAutoMoviePoseKeypoint` as the portable data boundary for the camera path time sampling requirement.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `IAutoMoviePoseKeypoint` for the clv camera path direct sampling system contract.
 * @author Samchon
 */
export interface IAutoMoviePoseKeypoint {
  /**
   * The named humanoid bone this keypoint locates.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `bone` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `bone` for the clv camera path direct sampling system contract.
   */
  bone: AutoMovieHumanoidBone;

  /**
   * Normalized horizontal position, `0` = left frame edge, `1` = right.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `x` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `x` for the clv camera path direct sampling system contract.
   */
  x: number;

  /**
   * Normalized vertical position, `0` = top frame edge, `1` = bottom.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `y` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `y` for the clv camera path direct sampling system contract.
   */
  y: number;

  /**
   * Whether the joint is in front of the camera AND within the frame rectangle.
   *
   * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Exposes `inFrame` as the portable data boundary for the camera path time sampling requirement.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling Types `inFrame` for the clv camera path direct sampling system contract.
   */
  inFrame: boolean;
}
