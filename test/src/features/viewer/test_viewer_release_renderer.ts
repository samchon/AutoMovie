import { releaseViewerRenderer, renderCrossDissolve } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

const makeFakeRenderer = (width: number, height: number) => {
  const targets: Array<THREE.WebGLRenderTarget | null> = [];
  const size = new THREE.Vector2(width, height);
  let disposed = 0;
  const renderer = {
    autoClear: true,
    getDrawingBufferSize: (v: THREE.Vector2) => v.copy(size),
    getContextAttributes: () => ({ antialias: true }),
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
      targets.push(t);
    },
    render: () => {},
    dispose: () => {
      disposed += 1;
    },
  } as unknown as THREE.WebGLRenderer;
  return { renderer, targets, disposedCount: () => disposed };
};

const dissolve = (renderer: THREE.WebGLRenderer): void =>
  renderCrossDissolve(
    renderer,
    new THREE.Scene(),
    new THREE.Camera(),
    () => {},
    () => {},
    0.5,
  );

/**
 * The viewer-lifecycle gaps #1090 closed: #1050 gave the cross-dissolve GPU
 * state a dispose that NOTHING called (`mountViewer.stop()` disposed the
 * renderer while the dissolve FBO/quad lingered until GC), and the dissolve's
 * offscreen target was created without MSAA while the canvas renderer runs
 * `antialias: true`, so the first blend frame (alpha≈0, visually 100% outgoing)
 * popped aliased at every dissolve edge. `stop()` now routes through
 * `releaseViewerRenderer`, and the target carries the canvas's 4× sample
 * parity.
 *
 * Scenarios:
 *
 * 1. After a dissolve ran, `releaseViewerRenderer` disposes the dissolve target
 *    exactly once AND the renderer itself; a fresh dissolve afterwards
 *    re-initializes lazily.
 * 2. Negative twin: with no dissolve state, the release still disposes the
 *    renderer and throws nothing.
 * 3. The dissolve's offscreen target is created with `samples: 4`, MSAA parity
 *    with the antialiased canvas renderer.
 */
export const test_viewer_release_renderer = (): void => {
  // 1. release disposes the dissolve state and the renderer together
  const used = makeFakeRenderer(64, 32);
  dissolve(used.renderer);
  const target = used.targets[0] as THREE.WebGLRenderTarget;
  let targetDisposed = 0;
  target.addEventListener("dispose", () => {
    targetDisposed += 1;
  });
  releaseViewerRenderer(used.renderer);
  TestValidator.equals(
    "the dissolve target is disposed exactly once",
    targetDisposed,
    1,
  );
  TestValidator.equals(
    "the renderer itself is disposed",
    used.disposedCount(),
    1,
  );
  dissolve(used.renderer);
  const fresh = used.targets[used.targets.length - 2];
  TestValidator.predicate(
    "a later dissolve re-initializes lazily",
    fresh instanceof THREE.WebGLRenderTarget && fresh !== target,
  );

  // 2. negative twin: no dissolve state, release stays safe
  const untouched = makeFakeRenderer(64, 32);
  releaseViewerRenderer(untouched.renderer);
  TestValidator.equals(
    "a dissolve-less release still disposes the renderer",
    untouched.disposedCount(),
    1,
  );

  // 3. MSAA parity with the antialiased canvas
  TestValidator.equals(
    "the dissolve target carries 4x MSAA",
    target.samples,
    4,
  );
};
