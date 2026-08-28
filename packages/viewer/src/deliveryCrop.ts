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

/**
 * Recover the normalized delivery window currently installed on a camera.
 *
 * Population culling and LOD selection run after the camera projection has
 * been installed. Reading the same Three.js view offset keeps those decisions
 * on the delivered window instead of silently reverting to the source gate.
 * A disabled or whole view is returned as omission, matching the public crop
 * contract's geometric no-op.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes the active delivery window to every viewer projection consumer.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Reconstructs the canonical normalized crop from the renderer's installed projection state.
 */
export const readAutoMovieDeliveryCrop = (
  camera: THREE.PerspectiveCamera,
): IAutoMovieDeliveryCrop | undefined => {
  const view = camera.view;
  if (view === null || view.enabled === false) return undefined;
  const crop = resolveAutoMovieDeliveryCrop({
    left: view.offsetX / view.fullWidth,
    top: view.offsetY / view.fullHeight,
    right: (view.offsetX + view.width) / view.fullWidth,
    bottom: (view.offsetY + view.height) / view.fullHeight,
  });
  return crop.left === 0 &&
    crop.top === 0 &&
    crop.right === 1 &&
    crop.bottom === 1
    ? undefined
    : crop;
};
