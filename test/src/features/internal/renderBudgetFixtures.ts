import {
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieCompiledShotSource,
  IAutoMovieRenderBudget,
  IAutoMovieSceneEnvironment,
} from "@automovie/interface";

import { modelsFixture, sceneFixture } from "./renderFixtures";

/**
 * Builders for the render-job budget preflight.
 *
 * A preflight reads a compiled shot, so the fixture is one: the render-report
 * fixture's scene and models, plus whichever simulated declarations a scenario
 * needs. Nothing here re-states geometry, because the point of these cases is
 * the conversion and the verdict, never a second copy of the cost model the
 * inventory already owns.
 */
export const compiledShotFixture = (
  overrides: Partial<IAutoMovieCompiledShotSource> = {},
): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [],
    scene: sceneFixture(),
    motions: [],
    models: modelsFixture(),
    formations: [],
    instanceSets: [],
    formationMotions: [],
    formationSlotMotions: [],
    effects: [],
    shot: {},
    ...overrides,
  }) as unknown as IAutoMovieCompiledShotSource;

/** A scene render environment with an explicit curve, exposure and shadows. */
export const sceneEnvironmentFixture = (
  overrides: Partial<IAutoMovieSceneEnvironment> = {},
): IAutoMovieSceneEnvironment => ({
  image: null,
  background: { r: 0, g: 0, b: 0, a: 1, hex: null },
  intensity: 1,
  rotationDeg: 0,
  exposure: 1.5,
  toneMapping: "acesFilmic",
  shadows: { enabled: true, type: "pcfSoft" },
  ...overrides,
});

/** One render budget whose limits a scenario states explicitly. */
export const renderBudgetFixture = (props: {
  tier: string;
  limits: IAutoMovieRenderBudget["limits"];
}): IAutoMovieRenderBudget => ({
  version: 1,
  tier: props.tier,
  limits: props.limits,
});

/** The one asset the render-report fixture's stone material binds. */
export const RENDER_BUDGET_ASSETS = [
  { path: "textures/stone.png", digest: `sha256:${"a".repeat(64)}` as const },
];

/**
 * A swiftshader-shaped capture graphics probe.
 *
 * Typed as the capture runtime's own `graphics`, so the preflight accepting it
 * is proof that what the scaffold's capture host actually records is what the
 * renderer identity reads, rather than a shape written to fit.
 */
export const GRAPHICS_FIXTURE: IAutoMovieCaptureRuntimeIdentity["graphics"] = {
  requestedBackend: "angle:swiftshader",
  api: "webgl2",
  vendor: "Google Inc. (Google)",
  renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))",
};
