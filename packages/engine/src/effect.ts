import {
  IAutoMovieCompiledEffect,
  IAutoMovieVector3,
} from "@automovie/interface";

import { seededValue } from "./math/random";

/** One exact live billboard derived from a compiled effect stream. */
export interface IAutoMovieEffectParticle {
  /** Stable zero-based spawn identity. */
  index: number;
  /** Fixed-step sampled world position. */
  position: IAutoMovieVector3;
  /** World billboard size in meters. */
  size: number;
  /** Bounded sampled alpha. */
  opacity: number;
  /** Normalized lifetime progress. */
  ageRatio: number;
}

/** One bounded deterministic effect sample. */
export interface IAutoMovieEffectSample {
  /** Fixed-step shot time actually sampled. */
  time: number;
  /** Whether the cue is active at that step. */
  active: boolean;
  /** Sampled cue intensity. */
  intensity: number;
  /** Live particles after deterministic distance thinning and hard cap. */
  particles: IAutoMovieEffectParticle[];
}

/**
 * Sample a compiled primitive effect from its absolute fixed-step clock.
 *
 * Spawn identity depends only on compiled bytes and particle index. Call
 * scheduling, wall time, worker count and GPU randomness cannot change it.
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
      seededValue(effect.seed, index, 0x6c696665),
    );
    if (age < 0 || age >= lifetime) continue;
    const ageRatio = age / lifetime;
    const initial = {
      x: interpolate(
        effect.bounds.min.x,
        effect.bounds.max.x,
        seededValue(effect.seed, index, 0x706f7358),
      ),
      y: interpolate(
        effect.bounds.min.y,
        effect.bounds.max.y,
        seededValue(effect.seed, index, 0x706f7359),
      ),
      z: interpolate(
        effect.bounds.min.z,
        effect.bounds.max.z,
        seededValue(effect.seed, index, 0x706f735a),
      ),
    };
    const turbulenceAngle =
      seededValue(effect.seed, index, 0x74757262) * Math.PI * 2;
    const turbulenceSpeed =
      recipe.motion.turbulence * seededValue(effect.seed, index, 0x73706565);
    const opacity =
      interpolate(
        recipe.particle.opacity.min,
        recipe.particle.opacity.max,
        seededValue(effect.seed, index, 0x6f706163),
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
        seededValue(effect.seed, index, 0x73697a65),
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
