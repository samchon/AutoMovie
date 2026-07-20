import * as THREE from "three";

/**
 * A **cross-dissolve** between two shots of the same scene: the render side of
 * `resolveSequencePlayback`'s `blend`. The engine says "at this instant the
 * incoming shot is at weight `alpha`, the outgoing tail rides along"; this
 * draws both and cross-fades them so a cut can dissolve instead of
 * hard-switching.
 *
 * One pass renders the **outgoing** shot to an offscreen target, a second
 * renders the **incoming** shot to the screen, and a full-screen quad
 * composites the outgoing over it at opacity `1 − alpha`: plain alpha-over
 * yields `outgoing·(1 − alpha) + incoming·alpha`, a true cross-fade. The target
 * and quad are created once **per renderer** and reused (resized with that
 * renderer's drawing buffer): module-global state let a second live viewer
 * force a render-target realloc every frame and left the first renderer's FBO
 * orphaned after its context was disposed (#1050). Call
 * {@link disposeCrossDissolve} when the renderer goes away, the same lifecycle
 * contract the render-mode handles carry (#645).
 *
 * `poseOutgoing` / `poseIncoming` each pose `scene` and aim `camera` for their
 * shot at its local time; this helper owns only the render orchestration, so
 * the demo keeps its posing logic. Call it from the viewer's frame hook and
 * return `true` so the mount loop skips its own single-pass render.
 *
 * @author Samchon
 */
interface IDissolveState {
  target: THREE.WebGLRenderTarget;
  quadScene: THREE.Scene;
  quadCamera: THREE.OrthographicCamera;
  quadMaterial: THREE.MeshBasicMaterial;
  quadGeometry: THREE.PlaneGeometry;
}

const states = new WeakMap<THREE.WebGLRenderer, IDissolveState>();

export const renderCrossDissolve = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  poseOutgoing: () => void,
  poseIncoming: () => void,
  alpha: number,
  /**
   * Wraps each half's render (#1250). A multi-pass guide capture supplies a
   * wrapper that applies the pass override (freshly per half, so the `pose`
   * overlay reflects each shot's own pose) around `render()`; the composite is
   * then a cross-fade of two guide-pass renders, the guide-space analogue of
   * the beauty cross-fade. Omitted for a plain render.
   */
  renderHalf: (render: () => void) => void = (render) => render(),
): void => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  let state = states.get(renderer);
  if (state === undefined) {
    // Match the renderer's own antialiasing, decided once per renderer. On the
    // live (AA-on) canvas, samples stop the FIRST blend frame (alpha≈0, ~100%
    // outgoing) rendering the outgoing shot aliased, a one-frame pop at every
    // dissolve edge (#1090). On the capture renderer (AA off, #1169) the target
    // must be AA-off too, or the outgoing half is MSAA-resolved (hardware-
    // dependent) and composited onto an aliased canvas, reintroducing exactly
    // the cross-host variance the capture path pins away (#1250).
    // A renderer that does not expose its context attributes is treated as
    // AA-on (the prior unconditional default); the capture renderer is a real
    // WebGLRenderer that reports `antialias: false`.
    const samples =
      renderer.getContextAttributes?.()?.antialias === false ? 0 : 4;
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const quadMaterial = new THREE.MeshBasicMaterial({
      map: target.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const quadScene = new THREE.Scene();
    quadScene.add(new THREE.Mesh(quadGeometry, quadMaterial));
    state = {
      target,
      quadScene,
      quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      quadMaterial,
      quadGeometry,
    };
    states.set(renderer, state);
  } else if (state.target.width !== size.x || state.target.height !== size.y)
    state.target.setSize(size.x, size.y);

  // outgoing → offscreen target (autoClear wipes it first)
  poseOutgoing();
  renderer.setRenderTarget(state.target);
  renderHalf(() => renderer.render(scene, camera));
  renderer.setRenderTarget(null);

  // incoming → screen
  poseIncoming();
  renderHalf(() => renderer.render(scene, camera));

  // composite the outgoing over the incoming at opacity (1 − alpha)
  state.quadMaterial.opacity = 1 - alpha;
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(state.quadScene, state.quadCamera);
  renderer.autoClear = prevAutoClear;
};

/**
 * Dispose the dissolve GPU state created for `renderer` (render target, quad
 * geometry/material). Call alongside the renderer's own disposal, exactly as a
 * render-mode handle's `restore()` (#1050). Safe to call when nothing was
 * created; the next dissolve on the same renderer re-initializes lazily.
 */
export const disposeCrossDissolve = (renderer: THREE.WebGLRenderer): void => {
  const state = states.get(renderer);
  if (state === undefined) return;
  state.target.dispose();
  state.quadGeometry.dispose();
  state.quadMaterial.dispose();
  states.delete(renderer);
};
