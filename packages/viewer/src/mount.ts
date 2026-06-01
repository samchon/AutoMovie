import * as THREE from "three";

/**
 * Handle returned by {@link mountViewer}; call `stop()` to end the loop and
 * release the renderer.
 */
export interface IMoticaViewerHandle {
  renderer: THREE.WebGLRenderer;
  stop: () => void;
}

/**
 * Mount a render loop onto a canvas: create a `WebGLRenderer`, drive
 * `onFrame(elapsedSeconds)` each animation frame, then render `scene` from
 * `camera`.
 *
 * This is the one browser-only entry point. `onFrame` is where a
 * {@link MoticaPlayer} advances — the viewer stays a thin shell around the
 * deterministic engine. `elapsedSeconds` is measured from the first frame.
 *
 * @author Samchon
 */
export const mountViewer = (
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onFrame: (elapsedSeconds: number) => void,
): IMoticaViewerHandle => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
    onFrame((nowMs - startMs) / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    renderer,
    stop: (): void => {
      running = false;
      renderer.dispose();
    },
  };
};
