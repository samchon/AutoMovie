import * as THREE from "three";

import { disposeCrossDissolve } from "./applyDissolve";

/**
 * Release a viewer's renderer AND the auxiliary GPU state frames created for
 * it: today the cross-dissolve FBO/quad, which #1050 gave a dispose that
 * nothing wired (#1090). `mountViewer`'s `stop()` calls this; a host that owns
 * its renderer directly (a capture harness) calls it the same way. Idempotent
 * and safe when no dissolve ever ran.
 */
export const releaseViewerRenderer = (renderer: THREE.WebGLRenderer): void => {
  disposeCrossDissolve(renderer);
  renderer.dispose();
};

/**
 * Handle returned by {@link mountViewer}; call `stop()` to end the loop and
 * release the renderer, including any dissolve GPU state the frames created.
 */
export interface IAutoMovieViewerHandle {
  renderer: THREE.WebGLRenderer;
  stop: () => void;
}

/**
 * Mount a render loop onto a canvas: create a `WebGLRenderer`, drive
 * `onFrame(elapsedSeconds)` each animation frame, then render `scene` from
 * `camera`.
 *
 * This is the one browser-only entry point. `onFrame` is where a
 * {@link AutoMoviePlayer} advances: the viewer stays a thin shell around the
 * deterministic engine. `elapsedSeconds` is measured from the first frame. If
 * `onFrame` returns `true` it has **already drawn** the frame itself (e.g. a
 * multi-pass cross-dissolve composite), so the loop skips its own default
 * `render`; returning `void`/`false` keeps the plain single-pass render.
 *
 * @author Samchon
 */
export const mountViewer = (
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onFrame: (elapsedSeconds: number) => boolean | undefined,
  options?: {
    /**
     * Multisample antialiasing (#1169). Defaults to `true` for live viewing; a
     * CAPTURE path turns it off so structural guide passes (mask/pose/
     * outline/depth) read back crisp and GPU-independent. AA blends segment
     * colors across edges and varies by hardware, breaking byte-stable frames.
     * A WebGL context's AA is fixed at creation, so this is per-mount (the
     * capture route), not per-pass.
     */
    antialias?: boolean;

    /**
     * Canvas pixel ratio (#1169). Defaults to the renderer's own default; a
     * capture path pins `1` so frame pixel dimensions never follow the host's
     * device-pixel-ratio.
     */
    pixelRatio?: number;
  },
): IAutoMovieViewerHandle => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options?.antialias ?? true,
  });
  if (options?.pixelRatio !== undefined)
    renderer.setPixelRatio(options.pixelRatio);
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  let running = true;
  let startMs: number | null = null;

  const loop = (nowMs: number): void => {
    if (!running) return;
    if (startMs === null) startMs = nowMs;
    const handled = onFrame((nowMs - startMs) / 1000);
    if (handled !== true) renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    renderer,
    stop: (): void => {
      running = false;
      releaseViewerRenderer(renderer);
    },
  };
};
