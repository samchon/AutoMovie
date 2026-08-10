import {
  AutoMovieGuidePass,
  IAutoMovieSceneEnvironment,
} from "@automovie/interface";
import * as THREE from "three";

/**
 * Apply image lighting and background without adding scene-graph children.
 *
 * A declared image reaches the scene only when the host resolved it; an image
 * the host could not decode leaves the scene explicitly unlit and transparent
 * rather than silently falling back to a background the author did not declare.
 * The resolved texture is configured here (equirectangular mapping and the
 * decoding its own storage implies), so the caller hands over a texture object
 * this scene owns, never one a material is also writing sampling state onto.
 */
export const applySceneEnvironment = (
  scene: THREE.Scene,
  environment: IAutoMovieSceneEnvironment | null | undefined,
  texture?: THREE.Texture,
): void => {
  if (environment === null || environment === undefined) {
    scene.environment = null;
    scene.background = null;
    return;
  }
  if (environment.image !== null && texture !== undefined) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = environmentColorSpace(texture);
    // The scene's colour state is written onto the texture object here, the
    // same way `buildMaterial` writes a material slot's, so the same flag is
    // raised: a host that hands over a texture it already uploaded must upload
    // it again under the decoding this scene needs.
    texture.needsUpdate = true;
    scene.environment = texture;
    scene.background = texture;
  } else {
    scene.environment = null;
    scene.background =
      environment.background === null
        ? null
        : new THREE.Color(
            environment.background.r,
            environment.background.g,
            environment.background.b,
          );
  }
  scene.environmentIntensity = environment.intensity;
  scene.environmentRotation.set(
    0,
    (environment.rotationDeg * Math.PI) / 180,
    0,
  );
  scene.backgroundRotation.copy(scene.environmentRotation);
};

/**
 * How an environment image's texels must be decoded, read off the decoded
 * texture instead of declared beside it.
 *
 * A material binding states its own `colorSpace` because one image can serve
 * either role; an environment image cannot. An 8-bit container (PNG, JPEG,
 * WebP) is display-referred, so its texels are sRGB-encoded and a mid-gray sky
 * sampled as linear lights the room off a radiance the image never held; a
 * Radiance HDR decodes to a float texture that already carries linear radiance,
 * which is exactly what `RGBELoader` records on it. `type` is that distinction,
 * and it follows from the media the compiler already proved from the bytes, so
 * deriving the decoding here keeps one fact in one place rather than asking an
 * author to restate it and then refusing them for restating it wrong.
 */
const environmentColorSpace = (texture: THREE.Texture): THREE.ColorSpace =>
  texture.type === THREE.UnsignedByteType
    ? THREE.SRGBColorSpace
    : THREE.LinearSRGBColorSpace;

/** A reversible renderer configuration for one beauty or structural pass. */
export interface IAutoMovieRendererEnvironmentHandle {
  /** Restore every renderer property touched by the configuration. */
  restore: () => void;
}

/**
 * Configure exposure, tone mapping and shadow policy for one pass. Structural
 * passes bypass all three so their values remain geometric facts.
 *
 * Precedence, settled once here so no caller has to decide it: a scene that
 * declares an `environment` owns the renderer's curve, exposure and shadow
 * policy for its own beauty pass. `delivery` is the render spec's
 * `toneMapping`, the value a whole sequence carries, and it applies only to a
 * scene that declared no environment. Omitting it leaves the host renderer's
 * own curve, exposure and shadow policy exactly as it found them: a caller that
 * knows no delivery curve states none rather than imposing `none`, which is how
 * a pre-environment production keeps rendering what it always rendered.
 */
export const applyRendererEnvironment = (
  renderer: THREE.WebGLRenderer,
  environment: IAutoMovieSceneEnvironment | null | undefined,
  pass: AutoMovieGuidePass,
  delivery?: IAutoMovieSceneEnvironment["toneMapping"],
): IAutoMovieRendererEnvironmentHandle => {
  const prior = {
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    shadows: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
  };
  const beauty = pass === "beauty";
  if (!beauty) {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = false;
  } else if (environment !== null && environment !== undefined) {
    renderer.toneMapping = toneMapping(environment.toneMapping);
    renderer.toneMappingExposure = environment.exposure;
    renderer.shadowMap.enabled = environment.shadows.enabled;
    renderer.shadowMap.type = shadowType(environment.shadows.type);
  } else if (delivery !== undefined)
    renderer.toneMapping = toneMapping(delivery);
  let restored = false;
  return {
    restore: () => {
      if (restored) return;
      restored = true;
      renderer.toneMapping = prior.toneMapping;
      renderer.toneMappingExposure = prior.exposure;
      renderer.shadowMap.enabled = prior.shadows;
      renderer.shadowMap.type = prior.shadowType;
    },
  };
};

const toneMapping = (
  curve: IAutoMovieSceneEnvironment["toneMapping"],
): THREE.ToneMapping =>
  curve === "acesFilmic" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;

const shadowType = (
  type: IAutoMovieSceneEnvironment["shadows"]["type"],
): THREE.ShadowMapType =>
  type === "pcf"
    ? THREE.PCFShadowMap
    : type === "pcfSoft"
      ? THREE.PCFSoftShadowMap
      : THREE.VSMShadowMap;
