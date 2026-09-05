import {
  disposeFadeToBlack,
  renderFadeToBlackFrame,
  resolveAutoMovieFilmBeautyComposition,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts } from "../internal/predicates";

const captureError = (operation: () => void): unknown => {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error;
  }
};

const fakeRenderer = (
  width = 64,
  height = 32,
  antialias: boolean | "unreported" = true,
) => {
  const size = new THREE.Vector2(width, height);
  let target: THREE.WebGLRenderTarget | null = null;
  let autoClear = true;
  let clearColor = new THREE.Color(0x336699);
  let clearAlpha = 0.4;
  const targets: Array<THREE.WebGLRenderTarget | null> = [];
  const opacities: number[] = [];
  const toneMapped: boolean[] = [];
  const clearColors: Array<{ color: number; alpha: number }> = [];
  const renderedInto: Array<THREE.WebGLRenderTarget | null> = [];
  const restorationAttempts = { autoClear: 0, color: 0, target: 0 };
  let failAutoClear: Error | undefined;
  let failColor: Error | undefined;
  let failTarget:
    | { value: THREE.WebGLRenderTarget | null; error: Error }
    | undefined;
  let targetFailureOnRender:
    | { value: THREE.WebGLRenderTarget | null; error: Error }
    | undefined;
  const renderer = {
    get autoClear(): boolean {
      return autoClear;
    },
    set autoClear(value: boolean) {
      if (value === true && failAutoClear !== undefined) {
        restorationAttempts.autoClear += 1;
        throw failAutoClear;
      }
      autoClear = value;
    },
    getDrawingBufferSize: (output: THREE.Vector2) => output.copy(size),
    // A renderer that does not report its context attributes is the prior
    // unconditional default, AA on, exactly as the dissolve helper reads it.
    ...(antialias === "unreported"
      ? {}
      : { getContextAttributes: () => ({ antialias }) }),
    getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => {
      if (failTarget !== undefined && value === failTarget.value) {
        restorationAttempts.target += 1;
        throw failTarget.error;
      }
      target = value;
      targets.push(value);
    },
    getClearColor: (output: THREE.Color) => output.copy(clearColor),
    getClearAlpha: () => clearAlpha,
    setClearColor: (value: THREE.Color | number, alpha: number) => {
      if (value instanceof THREE.Color && failColor !== undefined) {
        restorationAttempts.color += 1;
        throw failColor;
      }
      clearColor =
        value instanceof THREE.Color ? value.clone() : new THREE.Color(value);
      clearAlpha = alpha;
      clearColors.push({ color: clearColor.getHex(), alpha });
    },
    clear: () => undefined,
    render: (scene: THREE.Scene) => {
      renderedInto.push(target);
      const mesh = scene.children[0] as THREE.Mesh | undefined;
      const material = mesh?.material;
      if (material instanceof THREE.MeshBasicMaterial)
        opacities.push(material.opacity);
      if (material instanceof THREE.MeshBasicMaterial)
        toneMapped.push(material.toneMapped);
      if (targetFailureOnRender !== undefined) {
        failTarget = targetFailureOnRender;
        targetFailureOnRender = undefined;
      }
    },
  } as unknown as THREE.WebGLRenderer;
  return {
    renderer,
    size,
    targets,
    opacities,
    toneMapped,
    clearColors,
    renderedInto,
    restorationAttempts,
    state: () => ({
      target,
      autoClear,
      clearColor: clearColor.getHex(),
      clearAlpha,
    }),
    failAutoClear: (error: Error) => {
      failAutoClear = error;
    },
    failColor: (error: Error) => {
      failColor = error;
    },
    failTargetAfterRender: (
      value: THREE.WebGLRenderTarget | null,
      error: Error,
    ) => {
      targetFailureOnRender = { value, error };
    },
  };
};

/**
 * Film beauty projection must preserve the compiler-owned fade weight and all
 * mutable renderer state.
 *
 * Scenarios:
 *
 * 1. One full-weight layer is direct, one fractional layer fades over black,
 *    and two complementary layers select the existing dissolve alpha.
 * 2. Empty, oversized, non-finite, out-of-range and non-complementary layer
 *    inputs are refused instead of clamped or drawn opaquely.
 * 3. Fade weights zero, one-half and one reach the GPU quad exactly, with black
 *    output clear and callback execution at every boundary; the offscreen
 *    target matches the renderer's antialiasing, and a renderer that reports
 *    no context attributes is treated as antialiased.
 * 4. Per-renderer targets are reused, resized and disposed independently, and
 *    disposal before creation or twice is safe.
 * 5. Target, auto-clear, clear color and clear alpha are restored after success,
 *    including a success that started on a caller-owned render target whose
 *    composite lands in that target, after primary rendering failure, after
 *    each restoration failure, and after combined failure.
 */
export const test_viewer_film_fade = (): void => {
  const directLayer = { shot: "shot-a", weight: 1 };
  const fadedLayer = { shot: "shot-a", weight: 0.5 };
  const outgoing = { shot: "shot-a", weight: 0.25 };
  const incoming = { shot: "shot-b", weight: 0.75 };
  const direct = resolveAutoMovieFilmBeautyComposition([directLayer]);
  const fade = resolveAutoMovieFilmBeautyComposition([fadedLayer]);
  const dissolve = resolveAutoMovieFilmBeautyComposition([outgoing, incoming]);
  TestValidator.equals(
    "film beauty composition preserves sampled layer identity and weight",
    namedFacts([
      [
        "direct",
        () => direct.kind === "direct" && direct.layer === directLayer,
      ],
      [
        "fade",
        () =>
          fade.kind === "fade" &&
          fade.layer === fadedLayer &&
          fade.weight === 0.5,
      ],
      [
        "dissolve",
        () =>
          dissolve.kind === "dissolve" &&
          dissolve.outgoing === outgoing &&
          dissolve.incoming === incoming &&
          dissolve.alpha === 0.75,
      ],
    ]),
    { direct: true, fade: true, dissolve: true },
  );

  const invalid = [
    captureError(() => resolveAutoMovieFilmBeautyComposition([])),
    captureError(() =>
      resolveAutoMovieFilmBeautyComposition([
        { weight: 1 },
        { weight: 0 },
        { weight: 0 },
      ]),
    ),
    captureError(() =>
      resolveAutoMovieFilmBeautyComposition([{ weight: Number.NaN }]),
    ),
    captureError(() =>
      resolveAutoMovieFilmBeautyComposition([{ weight: -0.1 }]),
    ),
    captureError(() =>
      resolveAutoMovieFilmBeautyComposition([{ weight: 1.1 }]),
    ),
    captureError(() =>
      resolveAutoMovieFilmBeautyComposition([{ weight: 0.2 }, { weight: 0.7 }]),
    ),
  ];
  TestValidator.predicate(
    "malformed film beauty schedules are refused",
    invalid.every((error) => error instanceof Error),
  );

  const first = fakeRenderer();
  const second = fakeRenderer(128, 72, false);
  const unreported = fakeRenderer(8, 8, "unreported");
  disposeFadeToBlack(first.renderer);
  let callbacks = 0;
  for (const weight of [0, 0.5, 1])
    renderFadeToBlackFrame(
      first.renderer,
      () => {
        callbacks += 1;
      },
      weight,
    );
  renderFadeToBlackFrame(second.renderer, () => undefined, 0.5);
  renderFadeToBlackFrame(unreported.renderer, () => undefined, 0.5);
  const firstTarget = first.targets[0] as THREE.WebGLRenderTarget;
  const secondTarget = second.targets[0] as THREE.WebGLRenderTarget;
  const unreportedTarget = unreported.targets[0] as THREE.WebGLRenderTarget;
  TestValidator.equals(
    "fade sends exact weights through renderer-local targets over black",
    namedFacts([
      ["callbacks", () => callbacks === 3],
      [
        "weights",
        () => JSON.stringify(first.opacities) === JSON.stringify([0, 0.5, 1]),
      ],
      [
        "noSecondToneMap",
        () => first.toneMapped.every((value) => value === false),
      ],
      [
        "blackClear",
        () =>
          first.clearColors.some(
            (entry) => entry.color === 0 && entry.alpha === 1,
          ),
      ],
      [
        "targetReused",
        () =>
          first.targets
            .filter((value) => value !== null)
            .every((value) => value === firstTarget),
      ],
      ["rendererLocal", () => firstTarget !== secondTarget],
      ["aaOn", () => firstTarget.samples === 4],
      ["aaOff", () => secondTarget.samples === 0],
      ["aaUnreportedIsOn", () => unreportedTarget.samples === 4],
      [
        "stateRestored",
        () =>
          JSON.stringify(first.state()) ===
          JSON.stringify({
            target: null,
            autoClear: true,
            clearColor: 0x336699,
            clearAlpha: 0.4,
          }),
      ],
    ]),
    {
      callbacks: true,
      weights: true,
      noSecondToneMap: true,
      blackClear: true,
      targetReused: true,
      rendererLocal: true,
      aaOn: true,
      aaOff: true,
      aaUnreportedIsOn: true,
      stateRestored: true,
    },
  );

  // A capture host composes into its own render target; the fade must land
  // there and leave that target selected rather than switching to the screen.
  const hosted = fakeRenderer();
  const hostTarget = new THREE.WebGLRenderTarget(4, 4);
  hosted.renderer.setRenderTarget(hostTarget);
  renderFadeToBlackFrame(hosted.renderer, () => undefined, 0.25);
  TestValidator.equals(
    "fade composes into a caller-owned render target and keeps it selected",
    namedFacts([
      [
        "compositeTarget",
        () =>
          hosted.renderedInto.length === 1 &&
          hosted.renderedInto[0] === hostTarget,
      ],
      ["selectedAfter", () => hosted.state().target === hostTarget],
      ["weight", () => hosted.opacities[0] === 0.25],
      [
        "clearRestored",
        () =>
          hosted.state().clearColor === 0x336699 &&
          hosted.state().clearAlpha === 0.4,
      ],
    ]),
    {
      compositeTarget: true,
      selectedAfter: true,
      weight: true,
      clearRestored: true,
    },
  );
  hostTarget.dispose();

  first.size.set(320, 180);
  renderFadeToBlackFrame(first.renderer, () => undefined, 0.5);
  TestValidator.equals(
    "fade target follows only its renderer drawing buffer",
    namedFacts([
      ["width", () => firstTarget.width === 320],
      ["height", () => firstTarget.height === 180],
      ["otherWidth", () => secondTarget.width === 128],
    ]),
    { width: true, height: true, otherWidth: true },
  );
  let targetDisposals = 0;
  firstTarget.addEventListener("dispose", () => {
    targetDisposals += 1;
  });
  disposeFadeToBlack(first.renderer);
  disposeFadeToBlack(first.renderer);
  renderFadeToBlackFrame(first.renderer, () => undefined, 0.5);
  // One fade pushes three targets: the fade target, the previous target the
  // quad is composited into, and the previous target again from restoration.
  const freshTarget = first.targets.at(-3);
  TestValidator.equals(
    "fade disposal is idempotent and permits lazy recreation",
    namedFacts([
      ["oneDisposal", () => targetDisposals === 1],
      [
        "fresh",
        () =>
          freshTarget instanceof THREE.WebGLRenderTarget &&
          freshTarget !== firstTarget,
      ],
    ]),
    { oneDisposal: true, fresh: true },
  );

  const primary = fakeRenderer();
  const primaryFailure = new Error("frame rendering failed");
  const primaryCaught = captureError(() =>
    renderFadeToBlackFrame(
      primary.renderer,
      () => {
        throw primaryFailure;
      },
      0.5,
    ),
  );
  const auto = fakeRenderer();
  const autoFailure = new Error("autoClear restoration failed");
  auto.failAutoClear(autoFailure);
  const autoCaught = captureError(() =>
    renderFadeToBlackFrame(auto.renderer, () => undefined, 0.5),
  );
  const color = fakeRenderer();
  const colorFailure = new Error("clear color restoration failed");
  color.failColor(colorFailure);
  const colorCaught = captureError(() =>
    renderFadeToBlackFrame(color.renderer, () => undefined, 0.5),
  );
  const target = fakeRenderer();
  const priorTarget = new THREE.WebGLRenderTarget(2, 2);
  target.renderer.setRenderTarget(priorTarget);
  const targetFailure = new Error("target restoration failed");
  target.failTargetAfterRender(priorTarget, targetFailure);
  const targetCaught = captureError(() =>
    renderFadeToBlackFrame(target.renderer, () => undefined, 0.5),
  );
  const multiple = fakeRenderer();
  const multipleAuto = new Error("multiple autoClear failed");
  const multipleColor = new Error("multiple clear color failed");
  multiple.failAutoClear(multipleAuto);
  multiple.failColor(multipleColor);
  const multipleCaught = captureError(() =>
    renderFadeToBlackFrame(multiple.renderer, () => undefined, 0.5),
  );
  const combined = fakeRenderer();
  const combinedPrimary = new Error("combined render failed");
  const combinedAuto = new Error("combined autoClear failed");
  const combinedColor = new Error("combined clear color failed");
  combined.failAutoClear(combinedAuto);
  combined.failColor(combinedColor);
  const combinedCaught = captureError(() =>
    renderFadeToBlackFrame(
      combined.renderer,
      () => {
        throw combinedPrimary;
      },
      0.5,
    ),
  );
  const invalidWeight = captureError(() =>
    renderFadeToBlackFrame(
      primary.renderer,
      () => undefined,
      Number.POSITIVE_INFINITY,
    ),
  );
  TestValidator.equals(
    "fade restores every mutable renderer state on all exits",
    namedFacts([
      ["primary", () => primaryCaught === primaryFailure],
      ["primaryTarget", () => primary.state().target === null],
      ["auto", () => autoCaught === autoFailure],
      ["autoAttempt", () => auto.restorationAttempts.autoClear === 1],
      ["color", () => colorCaught === colorFailure],
      ["colorAttempt", () => color.restorationAttempts.color === 1],
      ["target", () => targetCaught === targetFailure],
      ["targetAttempt", () => target.restorationAttempts.target === 1],
      [
        "multiple",
        () =>
          multipleCaught instanceof AggregateError &&
          multipleCaught.errors[0] === multipleAuto &&
          multipleCaught.errors[1] === multipleColor,
      ],
      [
        "combined",
        () =>
          combinedCaught instanceof AggregateError &&
          combinedCaught.errors[0] === combinedPrimary &&
          combinedCaught.errors[1] === combinedAuto &&
          combinedCaught.errors[2] === combinedColor,
      ],
      ["invalidWeight", () => invalidWeight instanceof Error],
    ]),
    {
      primary: true,
      primaryTarget: true,
      auto: true,
      autoAttempt: true,
      color: true,
      colorAttempt: true,
      target: true,
      targetAttempt: true,
      multiple: true,
      combined: true,
      invalidWeight: true,
    },
  );
};
