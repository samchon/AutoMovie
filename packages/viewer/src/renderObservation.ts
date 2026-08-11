import type { IAutoMovieRenderObservation } from "@automovie/interface";
import type * as THREE from "three";

/**
 * Draw one complete frame while measuring renderer-confirmed submissions.
 *
 * `WebGLRenderer.info` is the authority for calls and triangles because it is
 * updated after camera layers, frustum culling, geometry groups, draw ranges,
 * and material visibility have selected the work that reaches the renderer.
 * Disabling its per-render reset makes the measurement frame-wide: a dissolve
 * therefore includes the outgoing draw, incoming draw, and composite pass.
 *
 * The remaining budget dimensions deliberately stay `null`. Three exposes
 * process-wide allocations for some of them and no post-culling frame count
 * for the rest; a scene traversal would be an estimate, not an observation.
 *
 * @evidence requirements/rendering/budgets.md#rendering-frame-total-budget Counts actual frame-wide submissions, including multipass transitions.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Supplies only renderer-confirmed values to the render-owned budget comparison.
 * @author Samchon
 */
export const observeAutoMovieRendererFrame = <Output>(
  renderer: THREE.WebGLRenderer,
  draw: () => Output,
): { output: Output; observed: IAutoMovieRenderObservation } => {
  const previousAutoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;
  renderer.info.reset();
  try {
    const output = draw();
    return {
      output,
      observed: {
        meshes: null,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        materials: null,
        textures: null,
        lights: null,
        shadowMaps: null,
        instanceSlots: null,
      },
    };
  } finally {
    renderer.info.autoReset = previousAutoReset;
  }
};
