import { simulateFluidDomain } from "@automovie/engine";
import {
  IAutoMovieFluidDrain,
  IAutoMovieFluidSource,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const fountain = (props: {
  sources?: IAutoMovieFluidSource[];
  drains?: IAutoMovieFluidDrain[];
}) =>
  flatBasin({
    columns: 6,
    rows: 6,
    depth: 0.25,
    overrides: {
      id: "fountain-basin",
      sources: props.sources ?? [],
      drains: props.drains ?? [],
    },
  });

const SOURCE: IAutoMovieFluidSource = {
  id: "jet",
  column: 3,
  row: 3,
  flowRate: 0.05,
  start: 0,
  end: null,
};
const DRAIN: IAutoMovieFluidDrain = {
  id: "return",
  column: 1,
  row: 1,
  flowRate: 0.05,
  sillLevel: 0.125,
  start: 0,
  end: null,
};

/**
 * A fountain basin's `source → drain` circulation balances its books, and every
 * gate that can close a declared flow closes it.
 *
 * Mass balance is the whole contract of the flux form: interior faces cancel,
 * so the only ways a walled basin's volume can change are a declared source and
 * a declared drain, and both are counted as they are applied — the drain after
 * the positivity limiter has scaled it, never before.
 *
 * Scenarios:
 *
 * 1. With a jet and a return running, the ledger closes: `volume = authored +
 *    source − drain` to within a nanolitre, and outflow stays exactly zero
 *    because every edge is a wall.
 * 2. The source delivered exactly `rate · dt · steps`, taken from the rate rather
 *    than from the run.
 * 3. Negative twin — a drain whose sill stands above the water never opens: its
 *    recorded volume is exactly zero while the jet still fills the basin.
 * 4. Negative twin — a flow whose window has closed stops running: the volume
 *    booked at step 400 equals the volume booked at the window's end, and a
 *    flow whose window has not opened yet has moved nothing. Both halves are
 *    pinned for a source and for a drain, because a window that only gated
 *    inflows would leave a basin draining after its return valve shut.
 * 5. The positivity limiter scales an over-eager drain to exactly the water the
 *    cell holds: one 1×1 m cell holding 0.5 m³ against a 64 m³/s drain empties
 *    to exactly zero, books exactly 0.5 m³, and then stays shut on its sill.
 */
export const test_fluid_source_drain_ledger = (): void => {
  const steps = 400;
  const running = fountain({ sources: [SOURCE], drains: [DRAIN] });
  const authored = 36 * 0.25 * 0.25;
  const state = simulateFluidDomain(running, steps);
  TestValidator.equals(
    "a circulating basin balances its books",
    namedFacts([
      [
        "massBalance",
        () =>
          nclose(
            state.volume,
            authored + state.sourceVolume - state.drainVolume,
            1e-9,
          ),
      ],
      ["outflowZero", () => Object.is(state.outflowVolume, 0)],
      [
        "sourceDelivered",
        () =>
          nclose(
            state.sourceVolume,
            SOURCE.flowRate * running.solver.fixedStepSeconds * steps,
            1e-12,
          ),
      ],
      ["drainDrew", () => state.drainVolume > 0],
    ]),
    {
      massBalance: true,
      outflowZero: true,
      sourceDelivered: true,
      drainDrew: true,
    },
  );

  const shutSill = simulateFluidDomain(
    fountain({
      sources: [SOURCE],
      drains: [{ ...DRAIN, sillLevel: 0.5 }],
    }),
    steps,
  );
  TestValidator.equals(
    "a drain above the water never opens",
    namedFacts([
      ["drainZero", () => Object.is(shutSill.drainVolume, 0)],
      ["sourceStillRuns", () => shutSill.sourceVolume > 0],
    ]),
    { drainZero: true, sourceStillRuns: true },
  );

  const dt = running.solver.fixedStepSeconds;
  const windowed = fountain({ sources: [{ ...SOURCE, end: 1 }] });
  const atClose = simulateFluidDomain(windowed, Math.round(1 / dt));
  const later = simulateFluidDomain(windowed, steps);
  const notYet = simulateFluidDomain(
    fountain({ sources: [{ ...SOURCE, start: 1_000 }] }),
    steps,
  );
  const windowedDrain = fountain({ drains: [{ ...DRAIN, end: 1 }] });
  const drainAtClose = simulateFluidDomain(windowedDrain, Math.round(1 / dt));
  const drainLater = simulateFluidDomain(windowedDrain, steps);
  const drainNotYet = simulateFluidDomain(
    fountain({ drains: [{ ...DRAIN, start: 1_000 }] }),
    steps,
  );
  TestValidator.equals(
    "an activity window opens and closes a declared flow",
    namedFacts([
      ["closed", () => Object.is(later.sourceVolume, atClose.sourceVolume)],
      ["deliveredWhileOpen", () => atClose.sourceVolume > 0],
      ["notYetOpened", () => Object.is(notYet.sourceVolume, 0)],
      [
        "drainClosed",
        () => Object.is(drainLater.drainVolume, drainAtClose.drainVolume),
      ],
      ["drainDrewWhileOpen", () => drainAtClose.drainVolume > 0],
      ["drainNotYetOpened", () => Object.is(drainNotYet.drainVolume, 0)],
    ]),
    {
      closed: true,
      deliveredWhileOpen: true,
      notYetOpened: true,
      drainClosed: true,
      drainDrewWhileOpen: true,
      drainNotYetOpened: true,
    },
  );

  const overEager = flatBasin({
    columns: 1,
    rows: 1,
    depth: 0.5,
    overrides: {
      id: "sump",
      grid: {
        columns: 1,
        rows: 1,
        cellX: 1,
        cellZ: 1,
        origin: { x: 0, y: 0, z: 0 },
      },
      drains: [
        {
          id: "sump-drain",
          column: 0,
          row: 0,
          flowRate: 64,
          sillLevel: 0,
          start: 0,
          end: null,
        },
      ],
    },
  });
  const emptied = simulateFluidDomain(overEager, 1);
  const stayed = simulateFluidDomain(overEager, 200);
  TestValidator.equals(
    "the limiter scales a drain to exactly the water available",
    namedFacts([
      ["emptiedExactly", () => Object.is(emptied.depth[0], 0)],
      ["bookedExactly", () => Object.is(emptied.drainVolume, 0.5)],
      ["stayedEmpty", () => Object.is(stayed.depth[0], 0)],
      ["stayedBooked", () => Object.is(stayed.drainVolume, 0.5)],
    ]),
    {
      emptiedExactly: true,
      bookedExactly: true,
      stayedEmpty: true,
      stayedBooked: true,
    },
  );
};
