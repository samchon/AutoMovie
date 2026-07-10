import { disposeCrossDissolve, renderCrossDissolve } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

const makeFakeRenderer = (width: number, height: number) => {
  const targets: Array<THREE.WebGLRenderTarget | null> = [];
  const size = new THREE.Vector2(width, height);
  const renderer = {
    autoClear: true,
    getDrawingBufferSize: (v: THREE.Vector2) => v.copy(size),
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
      targets.push(t);
    },
    render: () => {},
  } as unknown as THREE.WebGLRenderer;
  return { renderer, targets, size };
};

const noop = (): void => {};

const dissolve = (renderer: THREE.WebGLRenderer): void =>
  renderCrossDissolve(
    renderer,
    new THREE.Scene(),
    new THREE.Camera(),
    noop,
    noop,
    0.5,
  );

/**
 * The cross-dissolve GPU state (offscreen target, quad) used to be
 * MODULE-GLOBAL with no dispose path (#1050): a second live viewer with a
 * different drawing-buffer size forced a render-target realloc every dissolve
 * frame, and a disposed renderer left its FBO orphaned — in a package whose
 * render modes already carry a create/dispose lifecycle (#645). The state is
 * now keyed per renderer with an explicit `disposeCrossDissolve`.
 *
 * Scenarios:
 *
 * 1. The same renderer reuses ONE render target across dissolve calls, and two
 *    renderers with different buffer sizes each keep their own (no setSize
 *    ping-pong: sizes stay per-renderer).
 * 2. A drawing-buffer resize on one renderer resizes only that renderer's target.
 * 3. `disposeCrossDissolve` disposes the target exactly once, is safe to call
 *    twice (and before anything was created), and the next dissolve
 *    re-initializes a fresh target.
 */
export const test_viewer_dissolve_state = (): void => {
  // 1. per-renderer identity
  const a = makeFakeRenderer(64, 32);
  const b = makeFakeRenderer(128, 64);
  disposeCrossDissolve(a.renderer); // safe before anything exists
  dissolve(a.renderer);
  dissolve(a.renderer);
  dissolve(b.renderer);
  const aTarget = a.targets[0] as THREE.WebGLRenderTarget;
  const bTarget = b.targets[0] as THREE.WebGLRenderTarget;
  TestValidator.predicate(
    "one target per renderer, reused across calls",
    aTarget !== null &&
      a.targets[1] === null && // reset to screen after the offscreen pass
      a.targets[2] === aTarget &&
      bTarget !== aTarget &&
      aTarget.width === 64 &&
      bTarget.width === 128,
  );

  // 2. resize follows the owning renderer only
  a.size.set(320, 240);
  dissolve(a.renderer);
  TestValidator.predicate(
    "a resize follows the owning renderer only",
    aTarget.width === 320 && aTarget.height === 240 && bTarget.width === 128,
  );

  // 3. dispose exactly once, twice-safe, lazy re-init afterwards
  let disposed = 0;
  aTarget.addEventListener("dispose", () => {
    disposed += 1;
  });
  disposeCrossDissolve(a.renderer);
  disposeCrossDissolve(a.renderer);
  TestValidator.equals("target disposed exactly once", disposed, 1);
  dissolve(a.renderer);
  const fresh = a.targets[a.targets.length - 2];
  TestValidator.predicate(
    "the next dissolve re-initializes a fresh target",
    fresh instanceof THREE.WebGLRenderTarget && fresh !== aTarget,
  );
};
