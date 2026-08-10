import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const SIDE = 7;
const MID = 3;

const courtyardChannel = () => {
  const cells = SIDE * SIDE;
  const solid = new Array(cells).fill(false);
  const depth = new Array(cells).fill(0.25);
  for (let row = 2; row <= 4; ++row)
    for (let column = 2; column <= 4; ++column) {
      solid[row * SIDE + column] = true;
      depth[row * SIDE + column] = 0;
    }
  return flatBasin({
    columns: SIDE,
    rows: SIDE,
    depth: 0.25,
    overrides: {
      id: "courtyard-channel",
      solid,
      depth,
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: 8,
        drag: 0.25,
        dryDepth: 0,
        referenceDepth: 0.5,
        maxSteps: 5_000,
      },
      sources: [
        {
          id: "feed",
          column: 0,
          row: MID,
          flowRate: 0.04,
          start: 0,
          end: null,
        },
      ],
      drains: [
        {
          id: "return",
          column: SIDE - 1,
          row: MID,
          flowRate: 0.04,
          sillLevel: 0.25,
          start: 0,
          end: null,
        },
      ],
    },
  });
};

/**
 * A circulating channel: water fed at one side of a courtyard must travel round
 * a solid planted island to reach the return on the opposite side, and it does
 * so symmetrically on both arms.
 *
 * This is the two-dimensional case the one-row scenarios cannot reach. A feed
 * and a return facing each other across an impassable block force the flow onto
 * both `x` and `z` faces, and because the island and the two flows are mirror
 * symmetric about the middle row, the exact mirror symmetry of the result is a
 * free and very strict oracle: any asymmetry in the `z` momentum, the upwind
 * choice, or the limiter would break it in the last bits.
 *
 * Scenarios:
 *
 * 1. Water reaches the far side of the island, raising the level there past the
 *    return's sill so the return — shut at the authored level — opens. The
 *    island diverts the channel rather than damming it.
 * 2. Both arms carry flow: at least one `z` face velocity is non-zero, which a
 *    purely one-dimensional solve could never produce.
 * 3. The depth field is exactly mirror symmetric about the middle row at every
 *    sampled step.
 * 4. The books close: `volume = authored + source − drain`, with outflow exactly
 *    zero because the courtyard is walled.
 */
export const test_fluid_channel_circulation = (): void => {
  const domain = courtyardChannel();
  const authored = domain.depth.reduce((sum, value) => sum + value * 0.25, 0);
  const states = [40, 200, 800].map((step) =>
    simulateFluidDomain(domain, step),
  );
  const last = states[states.length - 1];
  const mirror = (state: (typeof states)[number]): boolean => {
    for (let row = 0; row < SIDE; ++row)
      for (let column = 0; column < SIDE; ++column)
        if (
          !Object.is(
            state.depth[row * SIDE + column],
            state.depth[(SIDE - 1 - row) * SIDE + column],
          )
        )
          return false;
    return true;
  };

  TestValidator.equals(
    "the channel carries water round the island on both arms",
    namedFacts([
      ["reachedFarSide", () => last.depth[MID * SIDE + SIDE - 2] > 0.25],
      ["returnOpened", () => last.drainVolume > 0],
      ["twoDimensional", () => last.velocityZ.some((value) => value !== 0)],
      ["alsoOneDimensional", () => last.velocityX.some((value) => value !== 0)],
      ["islandDry", () => Object.is(last.depth[MID * SIDE + MID], 0)],
    ]),
    {
      reachedFarSide: true,
      returnOpened: true,
      twoDimensional: true,
      alsoOneDimensional: true,
      islandDry: true,
    },
  );

  TestValidator.equals(
    "both arms stay exactly mirror symmetric and the books close",
    namedFacts([
      ["symmetric", () => states.every(mirror)],
      [
        "massBalance",
        () =>
          states.every((state) =>
            nclose(
              state.volume,
              authored + state.sourceVolume - state.drainVolume,
              1e-9,
            ),
          ),
      ],
      ["drainDrew", () => last.drainVolume > 0],
      ["outflowZero", () => Object.is(last.outflowVolume, 0)],
    ]),
    {
      symmetric: true,
      massBalance: true,
      drainDrew: true,
      outflowZero: true,
    },
  );
};
