import {
  IAutoMovieEffectRecipe,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { materializeCompiledEffects } from "@automovie/mcp";
import { buildInstancedEffect, sampleCompiledEffect } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { shotContract, worldDesign } from "../mcp/productionFixtures";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const effectRecipe = (
  kind: IAutoMovieEffectRecipe["kind"],
): IAutoMovieEffectRecipe => ({
  id: `${kind}-recipe`,
  kind,
  seed: 11,
  emission: { rate: 8, burst: 4, duration: 4 },
  particle: {
    lifetime: { min: 2, max: 3 },
    size: { min: 0.2, max: 0.5 },
    color: "#889988",
    opacity: { min: 0.2, max: 0.6 },
  },
  motion: {
    wind: { x: 0.1, y: 0, z: -0.1 },
    rise: 0.2,
    turbulence: 0.15,
  },
  budget: { maxParticles: 32, lodDistance: 5 },
  blend: "alpha",
});

const effectWorld = (
  kind: IAutoMovieEffectRecipe["kind"] = "smoke",
): IAutoMovieWorldDesign => ({
  ...worldDesign(),
  effectRecipes: [effectRecipe(kind)],
  effectZones: [
    {
      id: "battle-zone",
      recipe: `${kind}-recipe`,
      bounds: {
        min: { x: -2, y: 0, z: -2 },
        max: { x: 2, y: 2, z: 2 },
      },
      seed: 17,
    },
  ],
});

/** Frozen sampler used by compiled effect-stream v1 before multipart seeds. */
const legacyEffectValue = (
  seed: number,
  index: number,
  domain: number,
): number => {
  const mix = (value: number, salt: number): number => {
    const integer = Math.trunc(value);
    const low = integer >>> 0;
    const high = Math.floor(integer / 4_294_967_296) >>> 0;
    let mixed = (salt ^ low) >>> 0;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
    mixed = Math.imul(mixed ^ (mixed >>> 15) ^ high, 0x846ca68b);
    return (mixed ^ (mixed >>> 16)) >>> 0;
  };
  let state = mix(seed, domain);
  state = mix(index, state);
  state = (state + 0x6d2b79f5) >>> 0;
  let output = state;
  output = Math.imul(output ^ (output >>> 15), output | 1);
  output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
  return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
};

/**
 * Compiled effect sampling and the instance viewer must replay the same
 * absolute fixed-step particle state without frame-history dependence.
 *
 * Scenarios:
 *
 * 1. Two times inside one fixed step produce byte-equivalent samples, while a
 *    changed zone seed changes the compiled digest and all supported effect
 *    kinds retain their identity; the frozen v1 stream still determines the
 *    first particle exactly.
 * 2. Distance LOD reduces the far sample, particle lifetimes stay bounded, a
 *    one-particle budget caps output, and times outside the cue are inactive.
 * 3. Fractional duration emits no invented regular particle, and a burst expires
 *    before the regular particle whose spawn time equals its lifetime.
 * 4. Missing zones or recipes materialize no effect, and omitted fps/event use the
 *    deterministic default clock without inventing an event.
 * 5. The active viewer exposes a bounded billboard instance batch, per-particle
 *    opacity storage, no implicit frustum culling, and its compiled debug
 *    digest.
 * 6. Updating the same viewer before cue start hides the batch, clears its
 *    instance count, and reports inactive state.
 */
export const test_viewer_effect = (): void => {
  const contract: IAutoMovieShotContract = {
    ...shotContract(),
    durationSeconds: 6,
  };
  const cues = [
    {
      id: "battle-smoke",
      zone: "battle-zone",
      start: 1,
      end: 5,
      intensity: { from: 0.4, to: 0.8 },
      event: "signal-raised",
    },
  ];
  const [effect] = materializeCompiledEffects({
    contract,
    world: effectWorld(),
    fps: 24,
    cues,
  });
  const repeated = sampleCompiledEffect(effect!, 2.001);
  const sameStep = sampleCompiledEffect(effect!, 2.02);
  const near = sampleCompiledEffect(effect!, 2, 2);
  const far = sampleCompiledEffect(effect!, 2, 100);
  const late = sampleCompiledEffect(effect!, 4.5, 2);
  const before = sampleCompiledEffect(effect!, -1);
  const after = sampleCompiledEffect(effect!, 5);
  const capped = sampleCompiledEffect(
    {
      ...effect!,
      recipe: {
        ...effect!.recipe,
        budget: { ...effect!.recipe.budget, maxParticles: 1 },
      },
    },
    2,
  );
  const fractionalDuration = sampleCompiledEffect(
    {
      ...effect!,
      start: 0,
      end: 3,
      recipe: {
        ...effect!.recipe,
        emission: { rate: 0.5, burst: 1, duration: 1 },
        particle: {
          ...effect!.recipe.particle,
          lifetime: { min: 10, max: 10 },
        },
      },
    },
    2,
  );
  const exactBurstExpiry = sampleCompiledEffect(
    {
      ...effect!,
      start: 0,
      end: 3,
      recipe: {
        ...effect!.recipe,
        emission: { rate: 1, burst: 1, duration: 3 },
        particle: {
          ...effect!.recipe.particle,
          lifetime: { min: 1, max: 1 },
        },
      },
    },
    1,
  );
  const defaultClock = materializeCompiledEffects({
    contract,
    world: effectWorld(),
    cues: [{ ...cues[0]!, event: undefined }],
  })[0]!;
  const differentSeed = materializeCompiledEffects({
    contract,
    world: {
      ...effectWorld(),
      effectZones: [{ ...effectWorld().effectZones[0]!, seed: 18 }],
    },
    fps: 24,
    cues,
  })[0]!;
  const kinds = (["fog", "smoke", "dust"] as const).map(
    (kind) =>
      materializeCompiledEffects({
        contract,
        world: effectWorld(kind),
        fps: 24,
        cues,
      })[0]?.kind,
  );
  const firstParticle = repeated.particles[0]!;
  const firstLifetime =
    effect!.recipe.particle.lifetime.min *
      (1 - legacyEffectValue(effect!.seed, 0, 0x6c696665)) +
    effect!.recipe.particle.lifetime.max *
      legacyEffectValue(effect!.seed, 0, 0x6c696665);
  const firstAngle =
    legacyEffectValue(effect!.seed, 0, 0x74757262) * Math.PI * 2;
  const firstSpeed =
    effect!.recipe.motion.turbulence *
    legacyEffectValue(effect!.seed, 0, 0x73706565);
  const firstAge = repeated.time - effect!.start;
  const expectedFirstX =
    effect!.bounds.min.x *
      (1 - legacyEffectValue(effect!.seed, 0, 0x706f7358)) +
    effect!.bounds.max.x * legacyEffectValue(effect!.seed, 0, 0x706f7358) +
    (effect!.recipe.motion.wind.x + Math.cos(firstAngle) * firstSpeed) *
      firstAge;
  TestValidator.equals(
    "compiled effects preserve exact seeds, kinds and fixed-step replay",
    namedFacts([
      [
        "stringifyRepeated",
        () => JSON.stringify(repeated) === JSON.stringify(sameStep),
      ],
      ["repeatedCount", () => repeated.particles.length > 0],
      [
        "repeatedCount2",
        () => repeated.particles.length <= effect!.recipe.budget.maxParticles,
      ],
      ["nearCount", () => near.particles.length > far.particles.length],
      [
        "lateParticles",
        () => late.particles.every((particle) => particle.ageRatio < 1),
      ],
      ["cappedCount", () => capped.particles.length === 1],
      ["beforeActive", () => before.active === false],
      ["afterActive", () => after.active === false],
      [
        "fractionalDurationCount",
        () => fractionalDuration.particles.length === 1,
      ],
      [
        "fractionalDurationParticles",
        () => fractionalDuration.particles[0]?.index === 0,
      ],
      ["exactBurstExpiryCount", () => exactBurstExpiry.particles.length === 1],
      [
        "exactBurstExpiryParticles",
        () => exactBurstExpiry.particles[0]?.index === 1,
      ],
      [
        "defaultClockFixedStepSeconds",
        () => defaultClock.fixedStepSeconds === 1 / 24,
      ],
      ["defaultClockEvent", () => defaultClock.event === undefined],
      ["effectDigest", () => effect!.digest !== differentSeed.digest],
      ["kindsFog", () => kinds.join(",") === "fog,smoke,dust"],
      [
        "firstParticleAgeRatio",
        () => firstParticle.ageRatio === firstAge / firstLifetime,
      ],
      [
        "firstParticlePosition",
        () => firstParticle.position.x === expectedFirstX,
      ],
      [
        "materializeCompiledEffectsCount",
        () =>
          materializeCompiledEffects({
            contract,
            world: effectWorld(),
            fps: 24,
            cues: [{ ...cues[0]!, zone: "missing" }],
          }).length === 0,
      ],
      [
        "materializeCompiledEffectsCount2",
        () =>
          materializeCompiledEffects({
            contract,
            world: {
              ...effectWorld(),
              effectRecipes: [],
            },
            fps: 24,
            cues,
          }).length === 0,
      ],
    ]),
    {
      stringifyRepeated: true,
      repeatedCount: true,
      repeatedCount2: true,
      nearCount: true,
      lateParticles: true,
      cappedCount: true,
      beforeActive: true,
      afterActive: true,
      fractionalDurationCount: true,
      fractionalDurationParticles: true,
      exactBurstExpiryCount: true,
      exactBurstExpiryParticles: true,
      defaultClockFixedStepSeconds: true,
      defaultClockEvent: true,
      effectDigest: true,
      kindsFog: true,
      firstParticleAgeRatio: true,
      firstParticlePosition: true,
      materializeCompiledEffectsCount: true,
      materializeCompiledEffectsCount2: true,
    },
  );

  const built = buildInstancedEffect(effect!);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 2, 4);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  built.update(camera, 2);
  TestValidator.equals(
    "viewer renders bounded camera-facing billboard instances with debug identity",
    namedFacts([
      ["builtObject", () => built.object.count === built.stats.particles],
      ["builtStats", () => built.stats.active],
      ["builtStats2", () => built.stats.particles > 0],
      ["builtStats3", () => built.stats.particles <= built.stats.cap],
      ["builtObject2", () => built.object.visible],
      ["builtObject3", () => built.object.frustumCulled === false],
      [
        "builtObject4",
        () =>
          built.object.geometry.getAttribute("automovieOpacity")?.count ===
          effect!.recipe.budget.maxParticles,
      ],
      [
        "builtObject5",
        () => built.object.userData.automovieEffect.digest === effect!.digest,
      ],
    ]),
    {
      builtObject: true,
      builtStats: true,
      builtStats2: true,
      builtStats3: true,
      builtObject2: true,
      builtObject3: true,
      builtObject4: true,
      builtObject5: true,
    },
  );
  built.update(camera, 0);
  TestValidator.equals(
    "inactive cues hide their billboard batch",
    namedFacts([
      ["builtObject", () => built.object.visible === false],
      ["builtObject2", () => built.object.count === 0],
      ["builtStats", () => built.stats.active === false],
    ]),
    {
      builtObject: true,
      builtObject2: true,
      builtStats: true,
    },
  );
};
