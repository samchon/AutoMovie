import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const COLUMNS = 6;
const ROWS = 6;
const PILLAR_COLUMN = 3;
const PILLAR_ROW = 3;
const PILLAR = PILLAR_ROW * COLUMNS + PILLAR_COLUMN;

const withPillar = () => {
  const solid = new Array(COLUMNS * ROWS).fill(false);
  solid[PILLAR] = true;
  const depth = new Array(COLUMNS * ROWS).fill(0.25);
  depth[PILLAR] = 0;
  return flatBasin({
    columns: COLUMNS,
    rows: ROWS,
    depth: 0.25,
    overrides: {
      id: "pillared-pond",
      solid,
      depth,
      sources: [
        {
          id: "inlet",
          column: 0,
          row: PILLAR_ROW,
          flowRate: 0.05,
          start: 0,
          end: null,
        },
      ],
    },
  });
};

/**
 * A solid cell is a pier standing in the pond: it holds no water, every face
 * touching it reflects, and the flow routes around it instead of through it.
 *
 * A pillar is the smallest interesting obstacle because it is surrounded on all
 * four sides, so a scheme that leaked through solid matter in any single
 * direction — or that let the obstacle quietly accumulate depth from its
 * neighbours — would fail here rather than in a shape where one wrong face
 * happens to face a wall.
 *
 * Scenarios:
 *
 * 1. The pillar holds exactly zero water at every sampled step, even while a jet
 *    on the far side of the pond is raising the surface around it.
 * 2. All four faces of the pillar carry exactly zero velocity: the reflecting
 *    condition, on the inside of the lattice rather than at its rim.
 * 3. Water still reaches the cell directly behind the pillar, so the obstacle
 *    diverts the flow rather than damming the pond.
 * 4. Mass balance closes around the obstacle: nothing is lost inside it.
 */
export const test_fluid_obstacle_pillar = (): void => {
  const domain = withPillar();
  const authored = domain.depth.reduce((sum, value) => sum + value * 0.25, 0);
  const states = [1, 60, 400].map((step) => simulateFluidDomain(domain, step));
  const last = states[states.length - 1];
  const behind = PILLAR_ROW * COLUMNS + PILLAR_COLUMN + 1;

  TestValidator.equals(
    "a pier holds no water and reflects on every side",
    namedFacts([
      [
        "pillarDry",
        () => states.every((state) => Object.is(state.depth[PILLAR], 0)),
      ],
      [
        "westFace",
        () =>
          states.every((state) =>
            Object.is(
              state.velocityX[PILLAR_ROW * (COLUMNS + 1) + PILLAR_COLUMN],
              0,
            ),
          ),
      ],
      [
        "eastFace",
        () =>
          states.every((state) =>
            Object.is(
              state.velocityX[PILLAR_ROW * (COLUMNS + 1) + PILLAR_COLUMN + 1],
              0,
            ),
          ),
      ],
      [
        "southFace",
        () =>
          states.every((state) =>
            Object.is(state.velocityZ[PILLAR_ROW * COLUMNS + PILLAR_COLUMN], 0),
          ),
      ],
      [
        "northFace",
        () =>
          states.every((state) =>
            Object.is(
              state.velocityZ[(PILLAR_ROW + 1) * COLUMNS + PILLAR_COLUMN],
              0,
            ),
          ),
      ],
    ]),
    {
      pillarDry: true,
      westFace: true,
      eastFace: true,
      southFace: true,
      northFace: true,
    },
  );

  TestValidator.equals(
    "the flow routes around the pier and the books still close",
    namedFacts([
      ["reachedBehind", () => last.depth[behind] > 0.25],
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
      ["outflowZero", () => Object.is(last.outflowVolume, 0)],
    ]),
    { reachedBehind: true, massBalance: true, outflowZero: true },
  );
};
