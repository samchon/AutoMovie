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
 * @author Samchon
 */
export interface IAutoMoviePoseKeypoint {
  /** The named humanoid bone this keypoint locates. */
  bone: AutoMovieHumanoidBone;

  /** Normalized horizontal position, `0` = left frame edge, `1` = right. */
  x: number;

  /** Normalized vertical position, `0` = top frame edge, `1` = bottom. */
  y: number;

  /** Whether the joint is in front of the camera AND within the frame rectangle. */
  inFrame: boolean;
}
