import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { exactArray, fluidDomain } from "../internal/fluidFixtures";
import { namedFacts } from "../internal/predicates";

/**
 * The shallow-water step reproduces hand-computed arithmetic exactly, which is
 * simultaneously the oracle for the governing equations and the cross-platform
 * determinism proof.
 *
 * Every authored number is a dyadic rational, so each intermediate value is
 * exactly representable in IEEE-754 doubles and the expectations below are what
 * _any_ conforming machine must produce, Windows and POSIX alike. They are
 * taken from the equations by hand, never from what the code emitted.
 *
 * Two cells, `dx = dz = 1 m`, `g = 8 m/s²`, `dt = 1/8 s`, no drag, walls all
 * round, `h = [1.5, 0.5]` over a flat bed.
 *
 * Step 1 momentum, `u ← u − dt·g·Δη/dx`: `u = 0 − 0.125·8·(0.5 − 1.5)/1 = +1`.
 * Step 1 flux, upwind from the deeper donor: `Q = u·h·dz·dt = 1·1.5·1·0.125 =
 * 0.1875 m³`, so `h = [1.3125, 0.6875]`.
 *
 * Step 2 momentum: `u = 1 − 0.125·8·(0.6875 − 1.3125)/1 = 1.625`. Flux
 * `1.625·1.3125·1·0.125 = 0.2666015625 m³`, so `h = [1.0458984375,
 * 0.9541015625]`.
 *
 * Scenarios:
 *
 * 1. Step 0 is the authored state at rest: the depths as written, every face
 *    velocity exactly zero, volume exactly 2 m³.
 * 2. Step 1 equals the hand-computed depths and the single interior face velocity,
 *    with both walls pinned to zero.
 * 3. Step 2 equals the hand-computed depths and velocity, proving the momentum
 *    term accumulates across steps rather than restarting.
 * 4. A closed basin neither gains nor loses water: volume is exactly 2 m³ at every
 *    one of those steps and the ledger is exactly zero.
 */
export const test_fluid_shallow_water_hand_math = (): void => {
  const domain = fluidDomain();

  const initial = simulateFluidDomain(domain, 0);
  TestValidator.equals(
    "step 0 is the authored state at rest",
    namedFacts([
      ["depth", () => exactArray(initial.depth, [1.5, 0.5])],
      ["velocityX", () => exactArray(initial.velocityX, [0, 0, 0])],
      ["velocityZ", () => exactArray(initial.velocityZ, [0, 0, 0, 0])],
      ["volume", () => Object.is(initial.volume, 2)],
      ["time", () => Object.is(initial.time, 0)],
    ]),
    {
      depth: true,
      velocityX: true,
      velocityZ: true,
      volume: true,
      time: true,
    },
  );

  const first = simulateFluidDomain(domain, 1);
  TestValidator.equals(
    "step 1 matches the hand-computed momentum and flux",
    namedFacts([
      ["depth", () => exactArray(first.depth, [1.3125, 0.6875])],
      ["velocityX", () => exactArray(first.velocityX, [0, 1, 0])],
      ["velocityZ", () => exactArray(first.velocityZ, [0, 0, 0, 0])],
      ["volume", () => Object.is(first.volume, 2)],
      ["time", () => Object.is(first.time, 0.125)],
    ]),
    {
      depth: true,
      velocityX: true,
      velocityZ: true,
      volume: true,
      time: true,
    },
  );

  const second = simulateFluidDomain(domain, 2);
  TestValidator.equals(
    "step 2 accumulates momentum exactly as the equations say",
    namedFacts([
      ["depth", () => exactArray(second.depth, [1.0458984375, 0.9541015625])],
      ["velocityX", () => exactArray(second.velocityX, [0, 1.625, 0])],
      ["volume", () => Object.is(second.volume, 2)],
    ]),
    { depth: true, velocityX: true, volume: true },
  );

  TestValidator.equals(
    "a closed basin keeps an exactly empty ledger",
    namedFacts([
      ["source", () => Object.is(second.sourceVolume, 0)],
      ["drain", () => Object.is(second.drainVolume, 0)],
      ["outflow", () => Object.is(second.outflowVolume, 0)],
      ["domain", () => second.domain === "pond"],
      ["step", () => second.step === 2],
    ]),
    { source: true, drain: true, outflow: true, domain: true, step: true },
  );
};
