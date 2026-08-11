import * as THREE from "three";

/**
 * Minimal renderer shape needed to capture one deterministic viewer frame.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
 * @author Samchon
 */
export interface IAutoMovieViewerSnapshotRenderer {
  /**
   * Render the scene from the camera before the canvas is read.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  /**
   * Canvas-like element owned by the renderer.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  domElement: {
    width: number;
    height: number;
    toDataURL: (type?: string, quality?: number) => string;
  };
}

/**
 * Options for reading one rendered viewer frame as an inline image.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
 * @author Samchon
 */
export interface IAutoMovieViewerSnapshotOptions {
  /**
   * Image MIME type. Defaults to `image/png`.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  mimeType?: string;
  /**
   * Encoder quality for formats that support it.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  quality?: number;
}

/**
 * Captured viewer frame.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
 * @author Samchon
 */
export interface IAutoMovieViewerSnapshot {
  /**
   * Canvas pixel width.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  width: number;
  /**
   * Canvas pixel height.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  height: number;
  /**
   * MIME type requested for the snapshot.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  mimeType: string;
  /**
   * Inline image payload returned by the renderer canvas.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
   */
  dataUrl: string;
}

/**
 * Render and read a viewer frame through a headless-friendly renderer surface.
 *
 * A real `THREE.WebGLRenderer` satisfies this shape, but tests and render
 * workers can inject a Playwright-backed or fake renderer without importing
 * browser globals.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-multiview-products Captures this surface with explicit product dimensions and view.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Implements the capture as one render-product observation.
 * @author Samchon
 */
export const captureViewerSnapshot = (
  renderer: IAutoMovieViewerSnapshotRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: IAutoMovieViewerSnapshotOptions = {},
): IAutoMovieViewerSnapshot => {
  const mimeType = options.mimeType ?? "image/png";
  renderer.render(scene, camera);
  return {
    width: renderer.domElement.width,
    height: renderer.domElement.height,
    mimeType,
    dataUrl: renderer.domElement.toDataURL(mimeType, options.quality),
  };
};
