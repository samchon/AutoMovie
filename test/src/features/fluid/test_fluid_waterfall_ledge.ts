import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { atLeast, flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

const ledge = (overrides = {}) =>
  flatBasin({
    columns: 6,
    rows: 1,
    depth: 0,
    overrides: {
      id: "water-wall",
      bed: [1, 1, 1, 0, 0, 0],
      depth: [0.5, 0.5, 0.5, 0, 0, 0],
      solid: new Array(6).fill(false),
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: 8,
        drag: 0,
        dryDepth: 0,
        referenceDepth: 1.5,
        maxSteps: 5_000,
      },
      ...overrides,
    },
  });

/**
 * A falling water wall: an upper pool discharges over a 1 m ledge into a dry
 * lower basin, and the water that leaves the top is exactly the water that
 * arrives at the bottom.
 *
 * The ledge is the case a depth-only pressure term gets wrong. Reading the free
 * surface `η = b + h` is what makes the upper pool see a 1.5 m head against dry
 * ground at 0 m and pour over it, while the lake-at-rest case over the same
 * uneven bed stays perfectly still.
 *
 * Scenarios:
 *
 * 1. The lower basin, authored bone dry, is wet after 400 steps and the upper pool
 *    has lost head.
 * 2. The face at the lip carries a positive velocity: the water is going over the
 *    ledge, in the `+x` direction the bed steps down in.
 * 3. Nothing is created or destroyed by the fall: the volume at every sampled step
 *    equals the authored 0.375 m³ and no depth is negative.
 * 4. A non-finite state is refused, not drawn: a bed at infinity and a depth of
 *    NaN each throw at the first step, naming the domain.
 */
export const test_fluid_waterfall_ledge = (): void => {
  const domain = ledge();
  const authored = 3 * 0.5 * 0.25;
  const states = [1, 60, 400].map((step) => simulateFluidDomain(domain, step));
  const last = states[states.length - 1];
  TestValidator.equals(
    "the pool pours over the ledge and the fall conserves it",
    namedFacts([
      ["authored", () => nclose(authored, 0.375, 1e-15)],
      ["lowerWet", () => last.depth[3] > 0 && last.depth[5] > 0],
      ["upperFell", () => last.depth[0] < 0.5],
      ["lipFlows", () => last.velocityX[3] > 0],
      [
        "volumeHeld",
        () => states.every((state) => nclose(state.volume, authored, 1e-12)),
      ],
      ["nonNegative", () => states.every((state) => atLeast(state.depth, 0))],
      ["noLedger", () => Object.is(last.outflowVolume, 0)],
    ]),
    {
      authored: true,
      lowerWet: true,
      upperFell: true,
      lipFlows: true,
      volumeHeld: true,
      nonNegative: true,
      noLedger: true,
    },
  );

  TestValidator.equals(
    "a non-finite state is named at the step it appeared",
    namedFacts([
      [
        "infiniteBed",
        () =>
          throwsError(
            () =>
              simulateFluidDomain(ledge({ bed: [Infinity, 1, 1, 0, 0, 0] }), 8),
            ["water-wall", "non-finite state at step 1"],
          ),
      ],
      [
        "nanDepth",
        () =>
          throwsError(
            () =>
              simulateFluidDomain(
                ledge({ depth: [Number.NaN, 0.5, 0.5, 0, 0, 0] }),
                8,
              ),
            ["non-finite state at step 1"],
          ),
      ],
    ]),
    { infiniteBed: true, nanDepth: true },
  );
};
