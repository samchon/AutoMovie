import { IAutoMovieColor } from "../color/IAutoMovieColor";

/**
 * Image-based lighting, background, exposure, tone mapping, and shadows.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `IAutoMovieSceneEnvironment` as the portable data boundary for the lighting image based environment requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `IAutoMovieSceneEnvironment` for the clv environment image spatial variation system contract.
 */
export interface IAutoMovieSceneEnvironment {
  /**
   * Equirectangular HDR/LDR asset id, or null for no image-based lighting.
   *
   * Unlike a material's texture binding this states no decoding intent, because
   * an environment image has only one: a Radiance HDR already holds linear
   * radiance, and an 8-bit PNG, JPEG or WebP holds sRGB-encoded colour. The
   * engine proves the media from the registered bytes and the viewer decodes on
   * that fact, so the same image bound as a linear material measurement
   * elsewhere is refused as a contradiction rather than decoded two ways.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `image` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `image` for the clv environment image spatial variation system contract.
   */
  image: string | null;
  /**
   * Solid background when `image` is null, or null for transparent black.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `background` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `background` for the clv environment image spatial variation system contract.
   */
  background: IAutoMovieColor | null;
  /**
   * Non-negative image-based-light intensity.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `intensity` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `intensity` for the clv environment image spatial variation system contract.
   */
  intensity: number;
  /**
   * Finite world-Y rotation of the environment in degrees.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `rotationDeg` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `rotationDeg` for the clv environment image spatial variation system contract.
   */
  rotationDeg: number;
  /**
   * Positive renderer exposure multiplier.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `exposure` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `exposure` for the clv environment image spatial variation system contract.
   */
  exposure: number;
  /**
   * Beauty-pass tone mapping; structural passes always bypass it.
   *
   * Authoritative over {@link IAutoMovieRenderSpec.toneMapping} for every scene
   * that declares an environment: the curve belongs with the exposure and image
   * lighting it is chosen against, and one render spec spans many scenes.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `toneMapping` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `toneMapping` for the clv environment image spatial variation system contract.
   */
  toneMapping: "none" | "acesFilmic";
  /**
   * Renderer shadow-map policy for physical scene lights.
   *
   * The master switch, and it outranks the lights: `enabled: false` renders no
   * shadow map for this scene's beauty pass however many of its lights declare
   * `castShadow`, and the render budget prices them the same way. A light's
   * `castShadow` and `shadow` settings therefore state what that light WOULD
   * cast; this states whether the scene pays for any of it, which is what lets
   * a draft drop the whole cost without editing every light in the set.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-image-based-environment Exposes `shadows` as the portable data boundary for the lighting image based environment requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `shadows` for the clv environment image spatial variation system contract.
   */
  shadows: {
    /** Whether shadow maps are rendered in beauty passes. */
    enabled: boolean;
    /** Deterministic Three.js shadow-filter family. */
    type: "pcf" | "pcfSoft" | "vsm";
  };
}
