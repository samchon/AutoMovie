import {
  IAutoMovieCompiledEffect,
  IAutoMovieVector3,
} from "@automovie/interface";

import { mixSeed } from "./math/random";

/**
 * One exact live billboard derived from a compiled effect stream.
 *
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Carries the deterministic state of one live particle.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Exposes the bounded lifecycle sample consumed by projection.
 */
export interface IAutoMovieEffectParticle {
  /**
   * Stable zero-based spawn identity.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Keeps each deterministic spawn independently addressable.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Carries the stable index from which spawn variation is derived.
   */
  index: number;
  /**
   * Fixed-step sampled world position.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Records the particle state at the requested step.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Makes the live particle position available to deterministic projection.
   */
  position: IAutoMovieVector3;
  /**
   * World billboard size in meters.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Retains the authored particle size throughout its lifetime.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Carries the bounded drawable extent of the particle.
   */
  size: number;
  /**
   * Bounded sampled alpha.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Reports the sampled visibility state of the live particle.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Exposes the lifecycle-derived opacity without hidden renderer state.
   */
  opacity: number;
  /**
   * Normalized lifetime progress.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Makes the particle's bounded lifetime progress explicit.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Identifies the sampled position within the particle lifecycle.
   */
  ageRatio: number;
}

/**
 * One bounded deterministic effect sample.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Represents a complete reconstructed effect answer at an absolute time.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Carries the reconstructed state without playback cursor history.
 */
export interface IAutoMovieEffectSample {
  /**
   * Fixed-step shot time actually sampled.
   *
   * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-step-boundary Exposes the exact fixed-step boundary used for the answer.
   * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Records the deterministic film-time mapping chosen by the sampler.
   */
  time: number;
  /**
   * Whether the cue is active at that step.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Distinguishes an inactive cue from an empty live population.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Carries the lifecycle state at the sampled boundary.
   */
  active: boolean;
  /**
   * Sampled cue intensity.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state Exposes the bounded cue state that shapes particle visibility.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-lifecycle-contact-consequence Carries the deterministic lifecycle amplitude for projection.
   */
  intensity: number;
  /**
   * Live particles after deterministic distance thinning and hard cap.
   *
   * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Preserves the repeatable live spawn population.
   * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Returns the interval-derived population after bounded selection.
   */
  particles: IAutoMovieEffectParticle[];
}

/**
 * Sample a compiled primitive effect from its absolute fixed-step clock.
 *
 * Spawn identity depends only on compiled bytes and particle index. Call
 * scheduling, wall time, worker count and GPU randomness cannot change it.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-seek-reconstruction Derives the complete sample from absolute time without cursor history.
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn Keys every spawned particle from compiled seed and stable particle index.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#arbitrary-seek-reconstruction-contract Reconstructs the same active set for repeated and out-of-order samples.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#deterministic-particle-spawn-interval Uses fixed-step emission intervals and stable index-derived variation.
 */
export const sampleCompiledEffect = (
  effect: IAutoMovieCompiledEffect,
  time: number,
  cameraDistance = 0,
): IAutoMovieEffectSample => {
  const step = effect.fixedStepSeconds;
  const sampledTime = Math.floor(Math.max(0, time) / step + 1e-9) * step;
  if (sampledTime < effect.start || sampledTime >= effect.end)
    return { time: sampledTime, active: false, intensity: 0, particles: [] };
  const cueProgress =
    (sampledTime - effect.start) / Math.max(step, effect.end - effect.start);
  const intensity =
    effect.intensity.from +
    (effect.intensity.to - effect.intensity.from) * cueProgress;
  const recipe = effect.recipe;
  const emissionElapsed = Math.min(
    sampledTime - effect.start,
    recipe.emission.duration,
  );
  const regularSpawned = Math.floor(
    emissionElapsed * recipe.emission.rate + 1e-9,
  );
  const maximumLifetime = recipe.particle.lifetime.max;
  const earliestRegular = Math.max(
    0,
    Math.floor(
      Math.max(0, sampledTime - effect.start - maximumLifetime) *
        recipe.emission.rate,
    ),
  );
  const candidates = [
    ...Array.from({ length: recipe.emission.burst }, (_, index) => index),
    ...Array.from(
      { length: Math.max(0, regularSpawned - earliestRegular) },
      (_, offset) => recipe.emission.burst + earliestRegular + offset,
    ),
  ];
  const thinned =
    cameraDistance > recipe.budget.lodDistance
      ? candidates.filter((index) => index % 4 === 0)
      : candidates;
  const particles: IAutoMovieEffectParticle[] = [];
  for (const index of thinned) {
    const regular = index - recipe.emission.burst;
    const spawnTime =
      regular < 0
        ? effect.start
        : effect.start + (regular + 1) / recipe.emission.rate;
    const age = sampledTime - spawnTime;
    const lifetime = interpolate(
      recipe.particle.lifetime.min,
      recipe.particle.lifetime.max,
      effectValue(effect.seed, index, 0x6c696665),
    );
    if (age < 0 || age >= lifetime) continue;
    const ageRatio = age / lifetime;
    const initial = {
      x: interpolate(
        effect.bounds.min.x,
        effect.bounds.max.x,
        effectValue(effect.seed, index, 0x706f7358),
      ),
      y: interpolate(
        effect.bounds.min.y,
        effect.bounds.max.y,
        effectValue(effect.seed, index, 0x706f7359),
      ),
      z: interpolate(
        effect.bounds.min.z,
        effect.bounds.max.z,
        effectValue(effect.seed, index, 0x706f735a),
      ),
    };
    const turbulenceAngle =
      effectValue(effect.seed, index, 0x74757262) * Math.PI * 2;
    const turbulenceSpeed =
      recipe.motion.turbulence * effectValue(effect.seed, index, 0x73706565);
    const opacity =
      interpolate(
        recipe.particle.opacity.min,
        recipe.particle.opacity.max,
        effectValue(effect.seed, index, 0x6f706163),
      ) *
      intensity *
      Math.sin(Math.PI * ageRatio);
    particles.push({
      index,
      position: {
        x:
          initial.x +
          (recipe.motion.wind.x + Math.cos(turbulenceAngle) * turbulenceSpeed) *
            age,
        y: initial.y + (recipe.motion.wind.y + recipe.motion.rise) * age,
        z:
          initial.z +
          (recipe.motion.wind.z + Math.sin(turbulenceAngle) * turbulenceSpeed) *
            age,
      },
      size: interpolate(
        recipe.particle.size.min,
        recipe.particle.size.max,
        effectValue(effect.seed, index, 0x73697a65),
      ),
      opacity,
      ageRatio,
    });
    if (particles.length === recipe.budget.maxParticles) break;
  }
  return { time: sampledTime, active: true, intensity, particles };
};

const interpolate = (from: number, to: number, ratio: number): number =>
  from * (1 - ratio) + to * ratio;

/**
 * Preserve the compiled-effect v1 stream while the public multi-part sampler
 * serves new domains. The effect digest does not carry a sampler version, so
 * changing this fold would make identical compiled bytes replay differently.
 */
const effectValue = (seed: number, index: number, domain: number): number => {
  let state = mixSeed(seed, domain);
  state = mixSeed(index, state);
  state = (state + 0x6d2b79f5) >>> 0;
  let output = state;
  output = Math.imul(output ^ (output >>> 15), output | 1);
  output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
  return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};
