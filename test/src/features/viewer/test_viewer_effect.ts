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

/**
 * Compiled effect sampling and the instance viewer must replay the same
 * absolute fixed-step particle state without frame-history dependence.
 *
 * Scenarios:
 *
 * 1. Two times inside one fixed step produce byte-equivalent samples, while a
 *    changed zone seed changes the compiled digest and all supported effect
 *    kinds retain their identity.
 * 2. Distance LOD reduces the far sample, particle lifetimes stay bounded, a
 *    one-particle budget caps output, and times outside the cue are inactive.
 * 3. Missing zones or recipes materialize no effect, and omitted fps/event use the
 *    deterministic default clock without inventing an event.
 * 4. The active viewer exposes a bounded billboard instance batch, per-particle
 *    opacity storage, no implicit frustum culling, and its compiled debug
 *    digest.
 * 5. Updating the same viewer before cue start hides the batch, clears its
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
  TestValidator.predicate(
    "compiled effects preserve exact seeds, kinds and fixed-step replay",
    JSON.stringify(repeated) === JSON.stringify(sameStep) &&
      repeated.particles.length > 0 &&
      repeated.particles.length <= effect!.recipe.budget.maxParticles &&
      near.particles.length > far.particles.length &&
      late.particles.every((particle) => particle.ageRatio < 1) &&
      capped.particles.length === 1 &&
      before.active === false &&
      after.active === false &&
      defaultClock.fixedStepSeconds === 1 / 24 &&
      defaultClock.event === undefined &&
      effect!.digest !== differentSeed.digest &&
      kinds.join(",") === "fog,smoke,dust" &&
      materializeCompiledEffects({
        contract,
        world: effectWorld(),
        fps: 24,
        cues: [{ ...cues[0]!, zone: "missing" }],
      }).length === 0 &&
      materializeCompiledEffects({
        contract,
        world: {
          ...effectWorld(),
          effectRecipes: [],
        },
        fps: 24,
        cues,
      }).length === 0,
  );

  const built = buildInstancedEffect(effect!);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 2, 4);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  built.update(camera, 2);
  TestValidator.predicate(
    "viewer renders bounded camera-facing billboard instances with debug identity",
    built.object.count === built.stats.particles &&
      built.stats.active &&
      built.stats.particles > 0 &&
      built.stats.particles <= built.stats.cap &&
      built.object.visible &&
      built.object.frustumCulled === false &&
      built.object.geometry.getAttribute("automovieOpacity")?.count ===
        effect!.recipe.budget.maxParticles &&
      built.object.userData.automovieEffect.digest === effect!.digest,
  );
  built.update(camera, 0);
  TestValidator.predicate(
    "inactive cues hide their billboard batch",
    built.object.visible === false &&
      built.object.count === 0 &&
      built.stats.active === false,
  );
};
