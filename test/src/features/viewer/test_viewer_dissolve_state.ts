import {
  disposeCrossDissolve,
  renderCrossDissolve,
  renderCrossDissolveFrames,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts } from "../internal/predicates";

const makeFakeRenderer = (width: number, height: number) => {
  const targets: Array<THREE.WebGLRenderTarget | null> = [];
  const size = new THREE.Vector2(width, height);
  let target: THREE.WebGLRenderTarget | null = null;
  let autoClear = true;
  let renderFailure: { error: unknown } | undefined;
  let autoClearRestorationFailure: { error: unknown } | undefined;
  let targetRestorationFailure:
    | { target: THREE.WebGLRenderTarget | null; error: unknown }
    | undefined;
  const restorationAttempts = {
    autoClear: 0,
    target: 0,
  };
  const renderer = {
    get autoClear(): boolean {
      return autoClear;
    },
    set autoClear(value: boolean) {
      if (value && autoClearRestorationFailure !== undefined) {
        restorationAttempts.autoClear += 1;
        throw autoClearRestorationFailure.error;
      }
      autoClear = value;
    },
    getDrawingBufferSize: (v: THREE.Vector2) => v.copy(size),
    getContextAttributes: () => ({ antialias: true }),
    getRenderTarget: () => target,
    setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
      if (
        targetRestorationFailure !== undefined &&
        t === targetRestorationFailure.target
      ) {
        restorationAttempts.target += 1;
        throw targetRestorationFailure.error;
      }
      target = t;
      targets.push(t);
    },
    render: () => {
      if (renderFailure !== undefined) throw renderFailure.error;
    },
  } as unknown as THREE.WebGLRenderer;
  return {
    renderer,
    targets,
    size,
    restorationAttempts,
    failRender: (error: unknown): void => {
      renderFailure = { error };
    },
    failAutoClearRestoration: (error: unknown): void => {
      autoClearRestorationFailure = { error };
    },
    failTargetRestoration: (
      restorationTarget: THREE.WebGLRenderTarget | null,
      error: unknown,
    ): void => {
      targetRestorationFailure = { target: restorationTarget, error };
    },
  };
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
 * frame, and a disposed renderer left its FBO orphaned, in a package whose
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
  TestValidator.equals(
    "one target per renderer, reused across calls",
    namedFacts([
      ["aTarget", () => aTarget !== null],
      ["aTargets", () => a.targets[1] === null],
      ["aTargetsATarget", () => a.targets[2] === aTarget],
      ["bTargetATarget", () => bTarget !== aTarget],
      ["aTargetWidth", () => aTarget.width === 64],
      ["bTargetWidth", () => bTarget.width === 128],
    ]),
    {
      aTarget: true,
      aTargets: true,
      aTargetsATarget: true,
      bTargetATarget: true,
      aTargetWidth: true,
      bTargetWidth: true,
    },
  );

  // 2. resize follows the owning renderer only
  a.size.set(320, 240);
  dissolve(a.renderer);
  TestValidator.equals(
    "a resize follows the owning renderer only",
    namedFacts([
      ["aTargetWidth", () => aTarget.width === 320],
      ["aTargetHeight", () => aTarget.height === 240],
      ["bTargetWidth", () => bTarget.width === 128],
    ]),
    { aTargetWidth: true, aTargetHeight: true, bTargetWidth: true },
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
  TestValidator.equals(
    "the next dissolve re-initializes a fresh target",
    namedFacts([
      ["freshInstanceofTHREE", () => fresh instanceof THREE.WebGLRenderTarget],
      [
        "freshATarget",
        () => fresh instanceof THREE.WebGLRenderTarget && fresh !== aTarget,
      ],
    ]),
    { freshInstanceofTHREE: true, freshATarget: true },
  );

  let halves = "";
  renderCrossDissolveFrames(
    b.renderer,
    () => {
      halves += "out";
    },
    () => {
      halves += "-in";
    },
    0.25,
  );
  const prior = new THREE.WebGLRenderTarget(1, 1);
  b.renderer.setRenderTarget(prior);
  renderCrossDissolveFrames(b.renderer, noop, noop, 0.5);
  const primaryOnly = makeFakeRenderer(8, 8);
  const primaryFailure = new Error("outgoing failed");
  let primaryCaught: unknown;
  try {
    renderCrossDissolveFrames(
      primaryOnly.renderer,
      () => {
        throw primaryFailure;
      },
      noop,
      0.5,
    );
  } catch (error) {
    primaryCaught = error;
  }

  const standaloneAutoClear = makeFakeRenderer(8, 8);
  const autoClearFailure = new Error("autoClear restoration failed");
  standaloneAutoClear.failAutoClearRestoration(autoClearFailure);
  let standaloneAutoClearCaught: unknown;
  try {
    renderCrossDissolveFrames(standaloneAutoClear.renderer, noop, noop, 0.5);
  } catch (error) {
    standaloneAutoClearCaught = error;
  }

  const standaloneTarget = makeFakeRenderer(8, 8);
  const targetFailure = new Error("render-target restoration failed");
  const standalonePrior = new THREE.WebGLRenderTarget(1, 1);
  standaloneTarget.renderer.setRenderTarget(standalonePrior);
  standaloneTarget.failTargetRestoration(standalonePrior, targetFailure);
  let standaloneTargetCaught: unknown;
  try {
    renderCrossDissolveFrames(standaloneTarget.renderer, noop, noop, 0.5);
  } catch (error) {
    standaloneTargetCaught = error;
  }

  const standaloneMultiple = makeFakeRenderer(8, 8);
  const standaloneMultiplePrior = new THREE.WebGLRenderTarget(1, 1);
  const standaloneAutoClearFailure = new Error(
    "standalone autoClear restoration failed",
  );
  const standaloneTargetFailure = new Error(
    "standalone render-target restoration failed",
  );
  standaloneMultiple.renderer.setRenderTarget(standaloneMultiplePrior);
  standaloneMultiple.failAutoClearRestoration(standaloneAutoClearFailure);
  standaloneMultiple.failTargetRestoration(
    standaloneMultiplePrior,
    standaloneTargetFailure,
  );
  let standaloneMultipleCaught: unknown;
  try {
    renderCrossDissolveFrames(standaloneMultiple.renderer, noop, noop, 0.5);
  } catch (error) {
    standaloneMultipleCaught = error;
  }

  const combined = makeFakeRenderer(8, 8);
  const combinedPrior = new THREE.WebGLRenderTarget(1, 1);
  const combinedPrimaryFailure = new Error("composite render failed");
  const combinedAutoClearFailure = new Error("autoClear recovery failed");
  const combinedTargetFailure = new Error("render-target recovery failed");
  combined.renderer.setRenderTarget(combinedPrior);
  combined.failRender(combinedPrimaryFailure);
  combined.failAutoClearRestoration(combinedAutoClearFailure);
  combined.failTargetRestoration(combinedPrior, combinedTargetFailure);
  let combinedCaught: unknown;
  try {
    renderCrossDissolveFrames(combined.renderer, noop, noop, 0.5);
  } catch (error) {
    combinedCaught = error;
  }
  let invalidAlpha = false;
  try {
    renderCrossDissolveFrames(primaryOnly.renderer, noop, noop, 2);
  } catch {
    invalidAlpha = true;
  }
  TestValidator.equals(
    "generic dissolve renders both halves and restores GPU state on every exit",
    namedFacts([
      ["halvesOut", () => halves === "out-in"],
      ["bTargetsAt", () => halves === "out-in" && b.targets.at(-1) === prior],
      [
        "primaryCaughtPrimaryFailure",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure,
      ],
      [
        "primaryOnlyTargetsAt",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null,
      ],
      [
        "standaloneAutoClearCaughtAutoClearFailure",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure,
      ],
      [
        "standaloneAutoClearRestorationAttemptsAutoClear",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1,
      ],
      [
        "standaloneTargetCaughtTargetFailure",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure,
      ],
      [
        "standaloneTargetRestorationAttemptsTarget",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1,
      ],
      [
        "standaloneMultipleCaughtInstanceofAggregateError",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError,
      ],
      [
        "standaloneMultipleCaughtErrorsLength",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2,
      ],
      [
        "standaloneMultipleCaughtErrors0",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure,
      ],
      [
        "standaloneMultipleCaughtErrors1",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure,
      ],
      [
        "standaloneMultipleRestorationAttemptsAutoClear",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1,
      ],
      [
        "standaloneMultipleRestorationAttemptsTarget",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1,
      ],
      [
        "combinedCaughtInstanceofAggregateError",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError,
      ],
      [
        "combinedCaughtErrorsLength",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3,
      ],
      [
        "combinedCaughtErrors0",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure,
      ],
      [
        "combinedCaughtErrors1",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure &&
          combinedCaught.errors[1] === combinedAutoClearFailure,
      ],
      [
        "combinedCaughtErrors2",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure &&
          combinedCaught.errors[1] === combinedAutoClearFailure &&
          combinedCaught.errors[2] === combinedTargetFailure,
      ],
      [
        "combinedRestorationAttemptsAutoClear",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure &&
          combinedCaught.errors[1] === combinedAutoClearFailure &&
          combinedCaught.errors[2] === combinedTargetFailure &&
          combined.restorationAttempts.autoClear === 1,
      ],
      [
        "combinedRestorationAttemptsTarget",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure &&
          combinedCaught.errors[1] === combinedAutoClearFailure &&
          combinedCaught.errors[2] === combinedTargetFailure &&
          combined.restorationAttempts.autoClear === 1 &&
          combined.restorationAttempts.target === 1,
      ],
      [
        "invalidAlpha",
        () =>
          halves === "out-in" &&
          b.targets.at(-1) === prior &&
          primaryCaught === primaryFailure &&
          primaryOnly.targets.at(-1) === null &&
          standaloneAutoClearCaught === autoClearFailure &&
          standaloneAutoClear.restorationAttempts.autoClear === 1 &&
          standaloneTargetCaught === targetFailure &&
          standaloneTarget.restorationAttempts.target === 1 &&
          standaloneMultipleCaught instanceof AggregateError &&
          standaloneMultipleCaught.errors.length === 2 &&
          standaloneMultipleCaught.errors[0] === standaloneAutoClearFailure &&
          standaloneMultipleCaught.errors[1] === standaloneTargetFailure &&
          standaloneMultiple.restorationAttempts.autoClear === 1 &&
          standaloneMultiple.restorationAttempts.target === 1 &&
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors.length === 3 &&
          combinedCaught.errors[0] === combinedPrimaryFailure &&
          combinedCaught.errors[1] === combinedAutoClearFailure &&
          combinedCaught.errors[2] === combinedTargetFailure &&
          combined.restorationAttempts.autoClear === 1 &&
          combined.restorationAttempts.target === 1 &&
          invalidAlpha,
      ],
    ]),
    {
      halvesOut: true,
      bTargetsAt: true,
      primaryCaughtPrimaryFailure: true,
      primaryOnlyTargetsAt: true,
      standaloneAutoClearCaughtAutoClearFailure: true,
      standaloneAutoClearRestorationAttemptsAutoClear: true,
      standaloneTargetCaughtTargetFailure: true,
      standaloneTargetRestorationAttemptsTarget: true,
      standaloneMultipleCaughtInstanceofAggregateError: true,
      standaloneMultipleCaughtErrorsLength: true,
      standaloneMultipleCaughtErrors0: true,
      standaloneMultipleCaughtErrors1: true,
      standaloneMultipleRestorationAttemptsAutoClear: true,
      standaloneMultipleRestorationAttemptsTarget: true,
      combinedCaughtInstanceofAggregateError: true,
      combinedCaughtErrorsLength: true,
      combinedCaughtErrors0: true,
      combinedCaughtErrors1: true,
      combinedCaughtErrors2: true,
      combinedRestorationAttemptsAutoClear: true,
      combinedRestorationAttemptsTarget: true,
      invalidAlpha: true,
    },
  );
  prior.dispose();
  standalonePrior.dispose();
  standaloneMultiplePrior.dispose();
  combinedPrior.dispose();
};
