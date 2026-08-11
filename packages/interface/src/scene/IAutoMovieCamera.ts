import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";

/**
 * A perspective camera: the viewpoint a frame is rendered from.
 *
 * The camera is what turns a posed scene into the image/video output that
 * motivates automovie as a diffusion alternative: place the rig, place the
 * camera, and the deterministic renderer bakes the frame. Fields map onto
 * `three.js` `PerspectiveCamera`.
 *
 * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `IAutoMovieCamera` as the portable data boundary for the camera focal fov requirement.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `IAutoMovieCamera` for the clv lens basis consistency system contract.
 * @author Samchon
 */
export interface IAutoMovieCamera {
  /**
   * Stable id.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `id` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `id` for the clv lens basis consistency system contract.
   */
  id: string;

  /**
   * World placement of the camera (it looks down its local −Z, glTF
   * convention).
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `transform` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `transform` for the clv lens basis consistency system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Vertical field of view in degrees, `(0, 180)`.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `fovY` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `fovY` for the clv lens basis consistency system contract.
   */
  fovY: number;

  /**
   * Near clip plane distance, meters.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `near` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `near` for the clv lens basis consistency system contract.
   */
  near: number;

  /**
   * Far clip plane distance, meters. Must exceed `near`.
   *
   * @evidence requirements/camera/projection-lens-and-sensor.md#camera-focal-fov Exposes `far` as the portable data boundary for the camera focal fov requirement.
   * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-lens-basis-consistency Types `far` for the clv lens basis consistency system contract.
   */
  far: number;
}
