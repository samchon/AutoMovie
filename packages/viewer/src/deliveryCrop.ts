import { resolveAutoMovieDeliveryCrop } from "@automovie/engine";
import { IAutoMovieDeliveryCrop } from "@automovie/interface";
import * as THREE from "three";

/**
 * Apply one normalized delivery crop to a `three.js` perspective camera.
 *
 * The crop is a digital gate window: it changes only the projection matrix,
 * while the renderer keeps the complete output raster. Omission and the whole
 * `0,0,1,1` window clear any prior view offset and reproduce the uncropped
 * projection exactly.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Applies the production's selected delivery window to the camera that draws the delivered pixels.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Uses the same normalized top-left crop boundaries as deterministic image-space projection and acceptance.
 */
export const applyAutoMovieDeliveryCrop = (
  camera: THREE.PerspectiveCamera,
  crop: IAutoMovieDeliveryCrop | undefined,
): void => {
  const resolved = resolveAutoMovieDeliveryCrop(crop);
  if (
    resolved.left === 0 &&
    resolved.top === 0 &&
    resolved.right === 1 &&
    resolved.bottom === 1
  )
    camera.clearViewOffset();
  else {
    const fullWidth = camera.aspect;
    camera.setViewOffset(
      fullWidth,
      1,
      resolved.left * fullWidth,
      resolved.top,
      (resolved.right - resolved.left) * fullWidth,
      resolved.bottom - resolved.top,
    );
  }
  camera.updateProjectionMatrix();
};
