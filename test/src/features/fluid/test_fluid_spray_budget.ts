import { sampleFluidSpray, simulateFluidDomain } from "@automovie/engine";
import {
  IAutoMovieFluidDomain,
  IAutoMovieFluidSpray,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { fluidDomain } from "../internal/fluidFixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

const JET: IAutoMovieFluidSpray = {
  id: "jet",
  column: 1,
  row: 1,
  rate: 8,
  lifetime: 1,
  speed: 4,
  direction: { x: 0, y: 1, z: 0 },
  spread: 0,
  size: 0.1,
  seed: 42,
  maxParticles: 16,
  lodDistance: 10,
};

const misted = (sprays: IAutoMovieFluidSpray[]): IAutoMovieFluidDomain =>
  fluidDomain({
    id: "jet-basin",
    grid: {
      columns: 4,
      rows: 4,
      cellX: 0.5,
      cellZ: 0.5,
      origin: { x: 2, y: 1, z: -3 },
    },
    solver: {
      fixedStepSeconds: 0.015625,
      gravity: 8,
      drag: 0,
      dryDepth: 0,
      referenceDepth: 1,
      maxSteps: 5_000,
    },
    bed: new Array(16).fill(0),
    depth: new Array(16).fill(0.5),
    solid: new Array(16).fill(false),
    sprays,
  });

/**
 * Decorative spray follows the ballistic arc its emitter declares, is bounded
 * twice by the engine, and never touches the conserved water.
 *
 * Both bounds are enforced in the reference sample rather than left to the
 * renderer, which is what keeps a CPU reference and any GPU projection agreeing
 * about how many particles exist. The arc itself is hand-computable: with zero
 * spread the launch direction is exactly the declared axis, so particle `i` at
 * age `a` stands at `nozzle + (0, speed·a − ½·g·a², 0)`.
 *
 * With `rate = 8/s`, `lifetime = 1 s` and the sample taken at `t = 1 s`, the
 * live set is exactly the indices `1..8`: index 0 is precisely one lifetime old
 * and therefore dead, and index 8 was launched exactly now.
 *
 * Scenarios:
 *
 * 1. Eight particles are live, in ascending spawn order, and particle 6 stands at
 *    the hand-computed `y = 1.5 + 4·0.25 − 4·0.25² = 2.25` over the nozzle at
 *    the free surface, with the matching age ratio.
 * 2. The hard cap keeps the newest survivors: a cap of 3 yields exactly indices 6,
 *    7 and 8.
 * 3. Distance LOD thins deterministically: at 25 m with a 10 m LOD distance the
 *    stride is 3, so exactly indices 3 and 6 survive — and the same sample
 *    taken twice is identical.
 * 4. A spread jet still launches on the unit sphere: the ballistic term removed,
 *    every particle stands exactly `speed · age` from the nozzle.
 * 5. Boundaries: a domain with no emitter samples nothing, a sample before the
 *    first lifetime has elapsed holds only the particles born so far, and two
 *    emitters contribute in declared order.
 */
export const test_fluid_spray_budget = (): void => {
  const domain = misted([JET]);
  const state = simulateFluidDomain(domain, 64);
  const sample = sampleFluidSpray({ domain, state });
  TestValidator.equals(
    "the live set is the ballistic arc the emitter declared",
    namedFacts([
      ["time", () => Object.is(state.time, 1)],
      ["count", () => sample.particles.length === 8],
      [
        "ascending",
        () =>
          sample.particles.every((particle, at) => particle.index === at + 1),
      ],
      [
        "handComputed",
        () =>
          vclose(sample.particles[5].position, {
            x: 2.75,
            y: 2.25,
            z: -2.25,
          }),
      ],
      ["ageRatio", () => nclose(sample.particles[5].ageRatio, 0.25)],
      ["size", () => nclose(sample.particles[5].size, 0.1)],
      ["emitter", () => sample.particles[5].spray === "jet"],
      ["step", () => sample.step === 64],
      ["waterUntouched", () => state.depth.every((value) => value === 0.5)],
    ]),
    {
      time: true,
      count: true,
      ascending: true,
      handComputed: true,
      ageRatio: true,
      size: true,
      emitter: true,
      step: true,
      waterUntouched: true,
    },
  );

  const capped = sampleFluidSpray({
    domain: misted([{ ...JET, maxParticles: 3 }]),
    state,
  });
  const thinnedDomain = misted([JET]);
  const thinned = sampleFluidSpray({
    domain: thinnedDomain,
    state,
    cameraDistance: 25,
  });
  const thinnedAgain = sampleFluidSpray({
    domain: thinnedDomain,
    state,
    cameraDistance: 25,
  });
  TestValidator.equals(
    "the engine, not the renderer, enforces the cap and the LOD",
    namedFacts([
      [
        "cap",
        () =>
          capped.particles.map((particle) => particle.index).join(",") ===
          "6,7,8",
      ],
      [
        "lod",
        () =>
          thinned.particles.map((particle) => particle.index).join(",") ===
          "3,6",
      ],
      [
        "negativeDistanceThinsNothing",
        () =>
          sampleFluidSpray({
            domain,
            state,
            cameraDistance: -40,
          }).particles.length === 8,
      ],
      [
        "lodDeterministic",
        () =>
          thinnedAgain.particles.every((particle, at) =>
            vclose(particle.position, thinned.particles[at].position, 0),
          ),
      ],
    ]),
    {
      cap: true,
      lod: true,
      negativeDistanceThinsNothing: true,
      lodDeterministic: true,
    },
  );

  const spread = sampleFluidSpray({
    domain: misted([{ ...JET, spread: 0.75 }]),
    state,
  });
  TestValidator.equals(
    "a spread jet still launches on the unit sphere",
    namedFacts([
      [
        "unitDirections",
        () =>
          spread.particles.every((particle) => {
            const age = particle.ageRatio;
            const dx = particle.position.x - 2.75;
            const dy = particle.position.y - 1.5 + 0.5 * 8 * age * age;
            const dz = particle.position.z + 2.25;
            return nclose(
              Math.sqrt(dx * dx + dy * dy + dz * dz),
              4 * age,
              1e-9,
            );
          }),
      ],
      [
        "actuallySpread",
        () => spread.particles.some((particle) => particle.position.x !== 2.75),
      ],
    ]),
    { unitDirections: true, actuallySpread: true },
  );

  const bare = misted([]);
  const early = simulateFluidDomain(domain, 16);
  const twoEmitters = misted([JET, { ...JET, id: "mist", column: 2, row: 2 }]);
  TestValidator.equals(
    "the boundaries of the emitter budget",
    namedFacts([
      [
        "noEmitter",
        () =>
          sampleFluidSpray({
            domain: bare,
            state: simulateFluidDomain(bare, 64),
          }).particles.length === 0,
      ],
      [
        "beforeFirstLifetime",
        () =>
          sampleFluidSpray({ domain, state: early })
            .particles.map((particle) => particle.index)
            .join(",") === "0,1,2",
      ],
      [
        "twoEmitters",
        () =>
          sampleFluidSpray({ domain: twoEmitters, state }).particles.filter(
            (particle) => particle.spray === "mist",
          ).length === 8,
      ],
    ]),
    { noEmitter: true, beforeFirstLifetime: true, twoEmitters: true },
  );
};
