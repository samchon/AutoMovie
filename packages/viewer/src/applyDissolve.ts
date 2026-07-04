import * as THREE from "three";

/**
 * A **cross-dissolve** between two shots of the same scene — the render side of
 * `resolveSequencePlayback`'s `blend`. The engine says "at this instant the
 * incoming shot is at weight `alpha`, the outgoing tail rides along"; this draws
 * both and cross-fades them so a cut can dissolve instead of hard-switching.
 *
 * One pass renders the **outgoing** shot to an offscreen target, a second
 * renders the **incoming** shot to the screen, and a full-screen quad composites
 * the outgoing over it at opacity `1 − alpha` — plain alpha-over yields
 * `outgoing·(1 − alpha) + incoming·alpha`, a true cross-fade. The target and
 * quad are created once and reused (resized with the drawing buffer).
 *
 * `poseOutgoing` / `poseIncoming` each pose `scene` and aim `camera` for their
 * shot at its local time; this helper owns only the render orchestration, so the
 * demo keeps its posing logic. Call it from the viewer's frame hook and return
 * `true` so the mount loop skips its own single-pass render.
 *
 * @author Samchon
 */
let target: THREE.WebGLRenderTarget | null = null;
let quadScene: THREE.Scene | null = null;
let quadCamera: THREE.OrthographicCamera | null = null;
let quadMaterial: THREE.MeshBasicMaterial | null = null;

export const renderCrossDissolve = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  poseOutgoing: () => void,
  poseIncoming: () => void,
  alpha: number,
): void => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (target === null) {
    target = new THREE.WebGLRenderTarget(size.x, size.y);
    target.texture.colorSpace = THREE.SRGBColorSpace;
  } else if (target.width !== size.x || target.height !== size.y)
    target.setSize(size.x, size.y);
  if (quadMaterial === null || quadScene === null || quadCamera === null) {
    quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quadMaterial = new THREE.MeshBasicMaterial({
      map: target.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    quadScene = new THREE.Scene();
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMaterial));
  }

  // outgoing → offscreen target (autoClear wipes it first)
  poseOutgoing();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  // incoming → screen
  poseIncoming();
  renderer.render(scene, camera);

  // composite the outgoing over the incoming at opacity (1 − alpha)
  quadMaterial.opacity = 1 - alpha;
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(quadScene, quadCamera);
  renderer.autoClear = prevAutoClear;
};
