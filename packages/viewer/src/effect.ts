import { sampleCompiledEffect } from "@automovie/engine";
import { IAutoMovieCompiledEffect } from "@automovie/interface";
import * as THREE from "three";

/**
 * Current bounded viewer evidence for one deterministic effect cue.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
 */
export interface IAutoMovieEffectViewerStats {
  /**
   * Whether the cue is active at the sampled fixed step.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  active: boolean;
  /**
   * Live billboards after LOD and cap enforcement.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  particles: number;
  /**
   * Configured hard live-particle cap.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  cap: number;
  /**
   * Sampled cue intensity.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  intensity: number;
}

/**
 * Built deterministic billboard emitter.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
 */
export interface IAutoMovieEffectViewerObject {
  /**
   * Add this mesh to the shot scene.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  object: THREE.InstancedMesh;
  /**
   * Current bounded effect summary.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  stats: IAutoMovieEffectViewerStats;
  /**
   * Sample one absolute shot time and face particles toward the camera.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
   */
  update(camera: THREE.PerspectiveCamera, time: number): void;
}

/**
 * Build one compiler-owned effect stream as bounded billboard instances.
 *
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Displays this surface from the deterministic compiled particle sample.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Materializes the same deterministic spawn interval for the viewer.
 */
export const buildInstancedEffect = (
  effect: IAutoMovieCompiledEffect,
): IAutoMovieEffectViewerObject => {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const opacity = new THREE.InstancedBufferAttribute(
    new Float32Array(effect.recipe.budget.maxParticles),
    1,
  );
  geometry.setAttribute("automovieOpacity", opacity);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      automovieColor: { value: new THREE.Color(effect.recipe.particle.color) },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexShader: `
      attribute float automovieOpacity;
      varying float vAutomovieOpacity;
      varying vec2 vAutomovieUv;
      void main() {
        vAutomovieOpacity = automovieOpacity;
        vAutomovieUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix *
          vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 automovieColor;
      varying float vAutomovieOpacity;
      varying vec2 vAutomovieUv;
      void main() {
        float radius = length(vAutomovieUv - vec2(0.5));
        float feather = 1.0 - smoothstep(0.28, 0.5, radius);
        gl_FragColor = vec4(automovieColor, vAutomovieOpacity * feather);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    effect.recipe.budget.maxParticles,
  );
  mesh.name = `effect:${effect.zone}:${effect.id}`;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.userData.automovieEffect = {
    zone: effect.zone,
    kind: effect.kind,
    digest: effect.digest,
  };
  const stats: IAutoMovieEffectViewerStats = {
    active: false,
    particles: 0,
    cap: effect.recipe.budget.maxParticles,
    intensity: 0,
  };
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const cameraQuaternion = new THREE.Quaternion();
  return {
    object: mesh,
    stats,
    update(camera, time): void {
      const center = new THREE.Vector3(
        (effect.bounds.min.x + effect.bounds.max.x) / 2,
        (effect.bounds.min.y + effect.bounds.max.y) / 2,
        (effect.bounds.min.z + effect.bounds.max.z) / 2,
      );
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      camera.getWorldQuaternion(cameraQuaternion);
      const sample = sampleCompiledEffect(
        effect,
        time,
        cameraPosition.distanceTo(center),
      );
      sample.particles.forEach((particle, index) => {
        scale.set(particle.size, particle.size, particle.size);
        matrix.compose(
          new THREE.Vector3(
            particle.position.x,
            particle.position.y,
            particle.position.z,
          ),
          cameraQuaternion,
          scale,
        );
        mesh.setMatrixAt(index, matrix);
        opacity.setX(index, particle.opacity);
      });
      mesh.count = sample.particles.length;
      mesh.visible = sample.active && mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      opacity.needsUpdate = true;
      stats.active = sample.active;
      stats.particles = sample.particles.length;
      stats.intensity = sample.intensity;
    },
  };
};

export { sampleCompiledEffect } from "@automovie/engine";
