import { IMoticaTransform } from "../geometry/IMoticaTransform";

/**
 * A perspective camera — the viewpoint a frame is rendered from.
 *
 * The camera is what turns a posed scene into the image/video output that
 * motivates motica as a diffusion alternative: place the rig, place the camera,
 * and the deterministic renderer bakes the frame. Fields map onto `three.js`
 * `PerspectiveCamera`.
 *
 * @author Samchon
 */
export interface IMoticaCamera {
  /** Stable id. */
  id: string;

  /**
   * World placement of the camera (it looks down its local −Z, glTF
   * convention).
   */
  transform: IMoticaTransform;

  /** Vertical field of view in degrees, `(0, 180)`. */
  fovY: number;

  /** Near clip plane distance, meters. */
  near: number;

  /** Far clip plane distance, meters. Must exceed `near`. */
  far: number;
}
