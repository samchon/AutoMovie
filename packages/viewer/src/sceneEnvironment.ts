import {
  AutoMovieGuidePass,
  IAutoMovieSceneEnvironment,
} from "@automovie/interface";
import * as THREE from "three";

/** Apply image lighting and background without adding scene-graph children. */
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

/** A reversible renderer configuration for one beauty or structural pass. */
export interface IAutoMovieRendererEnvironmentHandle {
  /** Restore every renderer property touched by the configuration. */
  restore: () => void;
}

/**
 * Configure exposure, tone mapping and shadow policy for one pass. Structural
 * passes bypass all three so their values remain geometric facts.
 */
export const applyRendererEnvironment = (
  renderer: THREE.WebGLRenderer,
  environment: IAutoMovieSceneEnvironment | null | undefined,
  pass: AutoMovieGuidePass,
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
    renderer.toneMapping =
      environment.toneMapping === "acesFilmic"
        ? THREE.ACESFilmicToneMapping
        : THREE.NoToneMapping;
    renderer.toneMappingExposure = environment.exposure;
    renderer.shadowMap.enabled = environment.shadows.enabled;
    renderer.shadowMap.type = shadowType(environment.shadows.type);
  }
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

const shadowType = (
  type: IAutoMovieSceneEnvironment["shadows"]["type"],
): THREE.ShadowMapType =>
  type === "pcf"
    ? THREE.PCFShadowMap
    : type === "pcfSoft"
      ? THREE.PCFSoftShadowMap
      : THREE.VSMShadowMap;
