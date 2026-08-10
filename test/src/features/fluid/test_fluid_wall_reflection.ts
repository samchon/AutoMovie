import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

/** A basin with a symmetric bump, walled all round. */
const sloshingBasin = () => {
  const columns = 8;
  const rows = 1;
  const depth = new Array(columns * rows).fill(0.25);
  depth[3] = 0.5;
  depth[4] = 0.5;
  return flatBasin({
    columns,
    rows,
    depth: 0.25,
    overrides: { id: "sloshing", depth },
  });
};

/**
 * A `wall` edge reflects: no water crosses it, and a mirror-symmetric slosh
 * stays exactly mirror-symmetric while it bounces between the two walls.
 *
 * Exact symmetry is a strong statement about the discretization, not a cosmetic
 * one. The mirrored face's surface difference is the exact negation of the
 * original's, so its velocity is the exact negation, its flux is the exact
 * negation, and the two mirrored cells receive identical net volume. Any
 * asymmetry in the flux form, the upwind choice, or the boundary handling would
 * show up here as a difference in the last bits.
 *
 * Scenarios:
 *
 * 1. Both outermost x faces are pinned to exactly zero at every sampled step:
 *    nothing crosses a wall.
 * 2. The volume held at step 400 equals the authored volume, and the ledger
 *    records exactly zero source, drain, and outflow.
 * 3. The depth field is exactly mirror-symmetric at steps 40, 160 and 400: the
 *    wave runs out, reflects, and returns without drift.
 * 4. The wave really did move — the depth field at step 40 differs from the
 *    authored one — so the symmetry above is not the symmetry of a still pond.
 */
export const test_fluid_wall_reflection = (): void => {
  const domain = sloshingBasin();
  const authoredVolume = domain.depth.reduce(
    (sum, value) => sum + value * domain.grid.cellX * domain.grid.cellZ,
    0,
  );
  const samples = [40, 160, 400].map((step) =>
    simulateFluidDomain(domain, step),
  );

  TestValidator.equals(
    "no water crosses a wall and none is invented",
    namedFacts([
      [
        "wallsPinned",
        () =>
          samples.every(
            (state) =>
              Object.is(state.velocityX[0], 0) &&
              Object.is(state.velocityX[state.velocityX.length - 1], 0),
          ),
      ],
      [
        "zWallsPinned",
        () => samples.every((state) => state.velocityZ.every((v) => v === 0)),
      ],
      [
        "ledgerEmpty",
        () =>
          samples.every(
            (state) =>
              Object.is(state.sourceVolume, 0) &&
              Object.is(state.drainVolume, 0) &&
              Object.is(state.outflowVolume, 0),
          ),
      ],
      [
        "volumeHeld",
        () =>
          samples.every((state) => nclose(state.volume, authoredVolume, 1e-12)),
      ],
    ]),
    {
      wallsPinned: true,
      zWallsPinned: true,
      ledgerEmpty: true,
      volumeHeld: true,
    },
  );

  TestValidator.equals(
    "the reflected slosh stays exactly mirror-symmetric",
    namedFacts([
      [
        "symmetric",
        () =>
          samples.every((state) =>
            state.depth.every((value, index) =>
              Object.is(value, state.depth[state.depth.length - 1 - index]),
            ),
          ),
      ],
      [
        "moved",
        () =>
          samples[0].depth.some(
            (value, index) => value !== domain.depth[index],
          ),
      ],
    ]),
    { symmetric: true, moved: true },
  );
};
