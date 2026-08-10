import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { atLeast, flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const spillway = (open: boolean) =>
  flatBasin({
    columns: 8,
    rows: 2,
    depth: 0.5,
    overrides: {
      id: open ? "spillway" : "tank",
      boundaries: {
        xMin: "wall",
        xMax: open ? "open" : "wall",
        zMin: "wall",
        zMax: "wall",
      },
    },
  });

/**
 * An `open` edge spills the basin and books every cubic metre that left; the
 * identical basin closed by a `wall` loses nothing at all.
 *
 * The pair is the point. An open edge is modelled as a permanently dry
 * neighbour at the boundary cell's own bed, so water pours off the rim and can
 * never seep back in, and the volume it carried is added to the ledger rather
 * than vanishing. The walled twin one property away proves the outflow is the
 * boundary condition doing work and not a leak in the flux form.
 *
 * The run is deliberately violent — no drag, half a metre of head against an
 * open rim — so the positivity limiter engages: the boundary cell tries to
 * discharge more than it holds and must be scaled back to exactly what it has.
 *
 * Scenarios:
 *
 * 1. The open basin loses water: its volume at step 600 is far below the authored
 *    2 m³ (16 cells of 0.25 m² holding 0.5 m each) and its recorded outflow is
 *    positive.
 * 2. Mass balance closes: `volume = authored + source − drain − outflow` to within
 *    a nanolitre, with the source and drain terms exactly zero.
 * 3. No depth ever goes negative, at any of the sampled steps, despite the
 *    boundary cells being emptied faster than they can refill.
 * 4. The walled twin keeps exactly its authored volume and books exactly zero
 *    outflow.
 */
export const test_fluid_open_outflow = (): void => {
  const open = spillway(true);
  const authored = open.depth.reduce(
    (sum, value) => sum + value * open.grid.cellX * open.grid.cellZ,
    0,
  );
  const states = [1, 40, 200, 600].map((step) =>
    simulateFluidDomain(open, step),
  );
  const last = states[states.length - 1];

  TestValidator.equals(
    "an open rim spills the basin and books what left",
    namedFacts([
      ["authoredVolume", () => nclose(authored, 2, 1e-12)],
      ["drained", () => last.volume < authored * 0.5],
      ["outflowPositive", () => last.outflowVolume > 0],
      [
        "massBalance",
        () =>
          states.every((state) =>
            nclose(
              state.volume,
              authored +
                state.sourceVolume -
                state.drainVolume -
                state.outflowVolume,
              1e-9,
            ),
          ),
      ],
      [
        "noPhantomFlows",
        () =>
          states.every(
            (state) =>
              Object.is(state.sourceVolume, 0) &&
              Object.is(state.drainVolume, 0),
          ),
      ],
      ["nonNegative", () => states.every((state) => atLeast(state.depth, 0))],
    ]),
    {
      authoredVolume: true,
      drained: true,
      outflowPositive: true,
      massBalance: true,
      noPhantomFlows: true,
      nonNegative: true,
    },
  );

  const walled = simulateFluidDomain(spillway(false), 600);
  TestValidator.equals(
    "the walled twin one property away loses nothing",
    namedFacts([
      ["outflowZero", () => Object.is(walled.outflowVolume, 0)],
      ["volumeHeld", () => nclose(walled.volume, authored, 1e-12)],
      ["stillWater", () => walled.depth.every((value) => value === 0.5)],
    ]),
    { outflowZero: true, volumeHeld: true, stillWater: true },
  );
};
