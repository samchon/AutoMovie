import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { atLeast, flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const strand = (props: { bed: number[]; depth: number[]; dryDepth?: number }) =>
  flatBasin({
    columns: props.bed.length,
    rows: 1,
    depth: 0,
    overrides: {
      id: "strand",
      bed: props.bed,
      depth: props.depth,
      solid: new Array(props.bed.length).fill(false),
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: 8,
        drag: 0,
        dryDepth: props.dryDepth ?? 0,
        referenceDepth: 1,
        maxSteps: 5_000,
      },
    },
  });

/**
 * Water wets a dry cell it can actually reach, refuses to climb ground standing
 * above its own surface, and never leaves a cell holding a negative depth.
 *
 * The three together are the wetting-and-drying contract. Without the first, a
 * spilled basin would never spread; without the second, a shallow pool would
 * silently pump itself up a step it could not reach and invent surface area;
 * without the third, the flux form would hand the renderer an impossible
 * negative depth and the mass balance would still appear to close.
 *
 * Scenarios:
 *
 * 1. A column of water beside three dry cells over a flat bed spreads into all of
 *    them, and the total volume is unchanged.
 * 2. No depth is ever negative across the sampled steps.
 * 3. Negative twin — the same water beside a bed step standing 2 m above it never
 *    wets those cells: their depth is exactly zero at step 600, and the face
 *    between the wet and the raised cell stays exactly zero.
 * 4. `dryDepth` is a real threshold, not decoration: a 0.05 m film in a cell whose
 *    domain calls anything at or under 0.10 m dry cannot itself feed the next
 *    cell along, which stays exactly zero after the first step.
 */
export const test_fluid_dry_cell_wetting = (): void => {
  const spreading = strand({ bed: [0, 0, 0, 0], depth: [0.5, 0, 0, 0] });
  const authored = 0.5 * 0.25;
  const states = [1, 20, 120, 600].map((step) =>
    simulateFluidDomain(spreading, step),
  );
  const settled = states[states.length - 1];
  TestValidator.equals(
    "water spreads into reachable dry cells without losing any",
    namedFacts([
      ["allWet", () => settled.depth.every((value) => value > 0)],
      ["volumeHeld", () => nclose(settled.volume, authored, 1e-12)],
      ["nonNegative", () => states.every((state) => atLeast(state.depth, 0))],
    ]),
    { allWet: true, volumeHeld: true, nonNegative: true },
  );

  const stepped = simulateFluidDomain(
    strand({ bed: [0, 0, 2, 2], depth: [0.5, 0.5, 0, 0] }),
    600,
  );
  TestValidator.equals(
    "water never climbs ground standing above its own surface",
    namedFacts([
      ["shoreDry", () => Object.is(stepped.depth[2], 0)],
      ["farShoreDry", () => Object.is(stepped.depth[3], 0)],
      ["faceSilent", () => Object.is(stepped.velocityX[2], 0)],
      ["volumeHeld", () => nclose(stepped.volume, 0.25, 1e-12)],
    ]),
    { shoreDry: true, farShoreDry: true, faceSilent: true, volumeHeld: true },
  );

  const filmed = simulateFluidDomain(
    strand({ bed: [0, 0, 0, 0], depth: [0.5, 0.05, 0, 0], dryDepth: 0.1 }),
    1,
  );
  TestValidator.equals(
    "a sub-threshold film is dry and cannot feed the next cell",
    namedFacts([
      ["filmFed", () => filmed.depth[1] > 0.05],
      ["nextStaysDry", () => Object.is(filmed.depth[2], 0)],
      ["nextFaceSilent", () => Object.is(filmed.velocityX[2], 0)],
    ]),
    { filmFed: true, nextStaysDry: true, nextFaceSilent: true },
  );
};
