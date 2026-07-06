import * as THREE from "three";

/** Minimal renderer shape needed to capture one deterministic viewer frame. */
export interface IAutoMovieViewerSnapshotRenderer {
  /** Render the scene from the camera before the canvas is read. */
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  /** Canvas-like element owned by the renderer. */
  domElement: {
    width: number;
    height: number;
    toDataURL: (type?: string, quality?: number) => string;
  };
}

/** Options for reading one rendered viewer frame as an inline image. */
export interface IAutoMovieViewerSnapshotOptions {
  /** Image MIME type. Defaults to `image/png`. */
  mimeType?: string;
  /** Encoder quality for formats that support it. */
  quality?: number;
}

/** Captured viewer frame. */
export interface IAutoMovieViewerSnapshot {
  /** Canvas pixel width. */
  width: number;
  /** Canvas pixel height. */
  height: number;
  /** MIME type requested for the snapshot. */
  mimeType: string;
  /** Inline image payload returned by the renderer canvas. */
  dataUrl: string;
}

/**
 * Render and read a viewer frame through a headless-friendly renderer surface.
 *
 * A real `THREE.WebGLRenderer` satisfies this shape, but tests and render
 * workers can inject a Playwright-backed or fake renderer without importing
 * browser globals.
 *
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
