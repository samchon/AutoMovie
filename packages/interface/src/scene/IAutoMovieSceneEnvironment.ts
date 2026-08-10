import { IAutoMovieColor } from "../color/IAutoMovieColor";

/** Image-based lighting, background, exposure, tone mapping, and shadows. */
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
   */
  image: string | null;
  /** Solid background when `image` is null, or null for transparent black. */
  background: IAutoMovieColor | null;
  /** Non-negative image-based-light intensity. */
  intensity: number;
  /** Finite world-Y rotation of the environment in degrees. */
  rotationDeg: number;
  /** Positive renderer exposure multiplier. */
  exposure: number;
  /**
   * Beauty-pass tone mapping; structural passes always bypass it.
   *
   * Authoritative over {@link IAutoMovieRenderSpec.toneMapping} for every scene
   * that declares an environment: the curve belongs with the exposure and image
   * lighting it is chosen against, and one render spec spans many scenes.
   */
  toneMapping: "none" | "acesFilmic";
  /** Renderer shadow-map policy for physical scene lights. */
  shadows: {
    /** Whether shadow maps are rendered in beauty passes. */
    enabled: boolean;
    /** Deterministic Three.js shadow-filter family. */
    type: "pcf" | "pcfSoft" | "vsm";
  };
}
