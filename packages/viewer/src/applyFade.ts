import * as THREE from "three";

/**
 * The minimum film-layer shape needed to decide beauty composition.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Keeps the compiler-owned layer weight intact at the viewer boundary.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Selects composition from the already sampled frame rather than resampling an edit.
 * @author Samchon
 */
export interface IAutoMovieFilmBeautyLayer {
  /** Linear beauty contribution in `[0, 1]`. */
  weight: number;
}

/**
 * Closed beauty-composition decision for one sampled film frame.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Names fade and dissolve as beauty-only compositions so a structural pass is never handed one.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Preserves the compiler-owned one- or two-layer schedule without inventing a fallback.
 */
export type AutoMovieFilmBeautyComposition<
  Layer extends IAutoMovieFilmBeautyLayer = IAutoMovieFilmBeautyLayer,
> =
  | { kind: "direct"; layer: Layer }
  | { kind: "fade"; layer: Layer; weight: number }
  | {
      kind: "dissolve";
      outgoing: Layer;
      incoming: Layer;
      alpha: number;
    };

/**
 * Resolve a compiler-sampled beauty layer list into one explicit compositor.
 *
 * One fractional layer means color over black, while two complementary layers
 * retain the existing cross-dissolve. Invalid weights and cardinalities are
 * refused by name instead of being clamped or rendered as an opaque shot.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Decides continuous color composition for sampled beauty layers only, leaving structural passes to the dominant-layer rule.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Consumes the compiler's exact transition weights without a private sampler.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Distinguishes direct, fade, and dissolve schedules at the projection boundary.
 */
export const resolveAutoMovieFilmBeautyComposition = <
  Layer extends IAutoMovieFilmBeautyLayer,
>(
  layers: readonly Layer[],
): AutoMovieFilmBeautyComposition<Layer> => {
  if (layers.length !== 1 && layers.length !== 2)
    throw new Error(
      `Film beauty composition requires one fade/cut layer or two dissolve layers, but received ${layers.length}.`,
    );
  for (const layer of layers)
    if (
      Number.isFinite(layer.weight) === false ||
      layer.weight < 0 ||
      layer.weight > 1
    )
      throw new Error(
        `Film beauty layer weight ${layer.weight} must be finite and inside [0, 1].`,
      );
  if (layers.length === 1)
    return layers[0]!.weight === 1
      ? { kind: "direct", layer: layers[0]! }
      : { kind: "fade", layer: layers[0]!, weight: layers[0]!.weight };
  const [outgoing, incoming] = layers as readonly [Layer, Layer];
  if (outgoing.weight + incoming.weight !== 1)
    throw new Error(
      `Film dissolve layer weights must sum to one, but received ${outgoing.weight} and ${incoming.weight}.`,
    );
  return { kind: "dissolve", outgoing, incoming, alpha: incoming.weight };
};

interface IFadeState {
  target: THREE.WebGLRenderTarget;
  quadScene: THREE.Scene;
  quadCamera: THREE.OrthographicCamera;
  quadMaterial: THREE.MeshBasicMaterial;
  quadGeometry: THREE.PlaneGeometry;
}

class FadeStateRestorationError extends AggregateError {}

const states = new WeakMap<THREE.WebGLRenderer, IFadeState>();

/**
 * Render one beauty frame over black at its compiler-owned linear weight.
 *
 * The callback is rendered into an sRGB offscreen target, then one full-screen
 * alpha-over pass applies the weight uniformly to opaque and transparent scene
 * content. Renderer target, auto-clear, clear color and clear alpha are restored
 * on success and every failure path.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-beauty-structural-distinction Multiplies only the beauty picture by its sampled weight, the one effect the structural products must never inherit.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Keeps the renderer-owned target and state inside one explicit lifecycle.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Projects a one-layer fade without changing the sampled schedule.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Restores mutable renderer state after both successful and failed composition.
 */
export const renderFadeToBlackFrame = (
  renderer: THREE.WebGLRenderer,
  renderFrame: () => void,
  weight: number,
): void => {
  if (Number.isFinite(weight) === false || weight < 0 || weight > 1)
    throw new Error("Film fade weight must be finite and inside [0, 1].");
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  let state = states.get(renderer);
  if (state === undefined) {
    const samples =
      renderer.getContextAttributes?.()?.antialias === false ? 0 : 4;
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const quadMaterial = new THREE.MeshBasicMaterial({
      map: target.texture,
      color: 0xffffff,
      opacity: weight,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
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

  const previousTarget = renderer.getRenderTarget();
  const previousAutoClear = renderer.autoClear;
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  let failure: { error: unknown } | undefined;
  try {
    renderer.setRenderTarget(state.target);
    renderer.clear(true, true, true);
    renderFrame();
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    state.quadMaterial.opacity = weight;
    renderer.autoClear = false;
    renderer.render(state.quadScene, state.quadCamera);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    restoreFadeRendererState(
      renderer,
      previousAutoClear,
      previousTarget,
      previousClearColor,
      previousClearAlpha,
      failure,
    );
  }
};

/**
 * Dispose renderer-owned fade resources. Calling it before creation or twice is
 * safe, and the next fade recreates a fresh target lazily.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-lifecycle Releases fade targets and materials with the owning renderer.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Prevents one renderer lifecycle from retaining another frame's GPU state.
 */
export const disposeFadeToBlack = (renderer: THREE.WebGLRenderer): void => {
  const state = states.get(renderer);
  if (state === undefined) return;
  state.target.dispose();
  state.quadGeometry.dispose();
  state.quadMaterial.dispose();
  states.delete(renderer);
};

const restoreFadeRendererState = (
  renderer: THREE.WebGLRenderer,
  previousAutoClear: boolean,
  previousTarget: THREE.WebGLRenderTarget | null,
  previousClearColor: THREE.Color,
  previousClearAlpha: number,
  failure: { error: unknown } | undefined,
): void => {
  const restorationFailures: unknown[] = [];
  try {
    renderer.autoClear = previousAutoClear;
  } catch (error) {
    restorationFailures.push(error);
  }
  try {
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  } catch (error) {
    restorationFailures.push(error);
  }
  try {
    renderer.setRenderTarget(previousTarget);
  } catch (error) {
    restorationFailures.push(error);
  }
  if (restorationFailures.length === 0) return;
  if (failure === undefined && restorationFailures.length === 1)
    throw restorationFailures[0];
  throw new FadeStateRestorationError(
    failure === undefined
      ? restorationFailures
      : [failure.error, ...restorationFailures],
    failure === undefined
      ? "Film-fade renderer-state restoration failed."
      : "Film-fade renderer-state restoration failed after rendering failed.",
  );
};
