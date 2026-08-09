import { mixSeed } from "./math/random";
/**
 * Sample a compiled primitive effect from its absolute fixed-step clock.
 *
 * Spawn identity depends only on compiled bytes and particle index. Call
 * scheduling, wall time, worker count and GPU randomness cannot change it.
 */
export const sampleCompiledEffect = (effect, time, cameraDistance = 0) => {
    const step = effect.fixedStepSeconds;
    const sampledTime = Math.floor(Math.max(0, time) / step + 1e-9) * step;
    if (sampledTime < effect.start || sampledTime >= effect.end)
        return { time: sampledTime, active: false, intensity: 0, particles: [] };
    const cueProgress = (sampledTime - effect.start) / Math.max(step, effect.end - effect.start);
    const intensity = effect.intensity.from +
        (effect.intensity.to - effect.intensity.from) * cueProgress;
    const recipe = effect.recipe;
    const emissionElapsed = Math.min(sampledTime - effect.start, recipe.emission.duration);
    const regularSpawned = Math.floor(emissionElapsed * recipe.emission.rate + 1e-9);
    const maximumLifetime = recipe.particle.lifetime.max;
    const earliestRegular = Math.max(0, Math.floor(Math.max(0, sampledTime - effect.start - maximumLifetime) *
        recipe.emission.rate));
    const candidates = [
        ...Array.from({ length: recipe.emission.burst }, (_, index) => index),
        ...Array.from({ length: Math.max(0, regularSpawned - earliestRegular) }, (_, offset) => recipe.emission.burst + earliestRegular + offset),
    ];
    const thinned = cameraDistance > recipe.budget.lodDistance
        ? candidates.filter((index) => index % 4 === 0)
        : candidates;
    const particles = [];
    for (const index of thinned) {
        const regular = index - recipe.emission.burst;
        const spawnTime = regular < 0
            ? effect.start
            : effect.start + (regular + 1) / recipe.emission.rate;
        const age = sampledTime - spawnTime;
        const lifetime = interpolate(recipe.particle.lifetime.min, recipe.particle.lifetime.max, effectValue(effect.seed, index, 0x6c696665));
        if (age < 0 || age >= lifetime)
            continue;
        const ageRatio = age / lifetime;
        const initial = {
            x: interpolate(effect.bounds.min.x, effect.bounds.max.x, effectValue(effect.seed, index, 0x706f7358)),
            y: interpolate(effect.bounds.min.y, effect.bounds.max.y, effectValue(effect.seed, index, 0x706f7359)),
            z: interpolate(effect.bounds.min.z, effect.bounds.max.z, effectValue(effect.seed, index, 0x706f735a)),
        };
        const turbulenceAngle = effectValue(effect.seed, index, 0x74757262) * Math.PI * 2;
        const turbulenceSpeed = recipe.motion.turbulence * effectValue(effect.seed, index, 0x73706565);
        const opacity = interpolate(recipe.particle.opacity.min, recipe.particle.opacity.max, effectValue(effect.seed, index, 0x6f706163)) *
            intensity *
            Math.sin(Math.PI * ageRatio);
        particles.push({
            index,
            position: {
                x: initial.x +
                    (recipe.motion.wind.x + Math.cos(turbulenceAngle) * turbulenceSpeed) *
                        age,
                y: initial.y + (recipe.motion.wind.y + recipe.motion.rise) * age,
                z: initial.z +
                    (recipe.motion.wind.z + Math.sin(turbulenceAngle) * turbulenceSpeed) *
                        age,
            },
            size: interpolate(recipe.particle.size.min, recipe.particle.size.max, effectValue(effect.seed, index, 0x73697a65)),
            opacity,
            ageRatio,
        });
        if (particles.length === recipe.budget.maxParticles)
            break;
    }
    return { time: sampledTime, active: true, intensity, particles };
};
const interpolate = (from, to, ratio) => from * (1 - ratio) + to * ratio;
/**
 * Preserve the compiled-effect v1 stream while the public multi-part sampler
 * serves new domains. The effect digest does not carry a sampler version, so
 * changing this fold would make identical compiled bytes replay differently.
 */
const effectValue = (seed, index, domain) => {
    let state = mixSeed(seed, domain);
    state = mixSeed(index, state);
    state = (state + 0x6d2b79f5) >>> 0;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};
//# sourceMappingURL=effect.js.map