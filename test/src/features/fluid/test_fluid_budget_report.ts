import {
  fluidCourantNumber,
  fluidDomainBudget,
  fluidStateDigest,
  simulateFluidDomain,
  validateWaterFeatures,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  basinEnvironment,
  flatBasin,
  fluidDomain,
} from "../internal/fluidFixtures";
import { namedFacts, nclose } from "../internal/predicates";

const emitter = (id: string, maxParticles: number) => ({
  id,
  column: 0,
  row: 0,
  rate: 8,
  lifetime: 1,
  speed: 2,
  direction: { x: 0, y: 1, z: 0 },
  spread: 0,
  size: 0.05,
  seed: 1,
  maxParticles,
  lodDistance: 10,
});

/**
 * A fluid domain states its own bounded cost before a single step is
 * integrated, and a state's digest is the compact evidence a run reproduced.
 *
 * Both exist so a production can be judged rather than trusted: a compiler
 * report can refuse an unaffordable water feature up front, and two machines
 * can compare eight characters instead of shipping arrays to each other.
 *
 * Scenarios:
 *
 * 1. The budget of a 6×4 lattice is the hand-computed 24 cells, 58 velocity faces,
 *    656 state bytes, and 24 × `maxSteps` worst-case cell updates; the spray
 *    cap is the sum of the emitters' own caps.
 * 2. The Courant number equals the hand-computed `dt·√(g·H)·√(1/dx² + 1/dz²)` and
 *    is the same number the budget reports.
 * 3. A domain with no emitter reports a spray cap of exactly zero, so water
 *    without mist costs nothing extra.
 * 4. The digest is eight hex characters, identical for identical states, and
 *    different when a single depth moves by one ulp — the sensitivity that
 *    makes it evidence rather than decoration.
 * 5. A production with no water at all is inert: validating an empty set of
 *    features against an empty set of domains succeeds and reports nothing.
 */
export const test_fluid_budget_report = (): void => {
  const domain = flatBasin({
    columns: 6,
    rows: 4,
    depth: 0.25,
    overrides: {
      id: "budgeted",
      sprays: [emitter("mist", 128), emitter("veil", 64)],
    },
  });
  const budget = fluidDomainBudget(domain);
  TestValidator.equals(
    "the lattice states its own bounded cost",
    namedFacts([
      ["domain", () => budget.domain === "budgeted"],
      ["cells", () => budget.cells === 24],
      ["faces", () => budget.faces === 7 * 4 + 6 * 5],
      ["stateBytes", () => budget.stateBytes === 8 * (24 + 58)],
      ["maxSteps", () => budget.maxSteps === domain.solver.maxSteps],
      [
        "worstCase",
        () => budget.worstCaseCellUpdates === 24 * domain.solver.maxSteps,
      ],
      ["sprayCap", () => budget.sprayParticleCap === 192],
    ]),
    {
      domain: true,
      cells: true,
      faces: true,
      stateBytes: true,
      maxSteps: true,
      worstCase: true,
      sprayCap: true,
    },
  );

  const expectedCourant =
    domain.solver.fixedStepSeconds *
    Math.sqrt(domain.solver.gravity * domain.solver.referenceDepth) *
    Math.sqrt(
      1 / (domain.grid.cellX * domain.grid.cellX) +
        1 / (domain.grid.cellZ * domain.grid.cellZ),
    );
  const bare = fluidDomainBudget(fluidDomain());
  TestValidator.equals(
    "the stability number is reported, not implied",
    namedFacts([
      ["courant", () => nclose(budget.courant, expectedCourant, 0)],
      [
        "sameAsFunction",
        () => nclose(fluidCourantNumber(domain), expectedCourant, 0),
      ],
      ["belowLimit", () => budget.courant <= 1],
      ["noSpray", () => bare.sprayParticleCap === 0],
      ["twoCells", () => bare.cells === 2],
    ]),
    {
      courant: true,
      sameAsFunction: true,
      belowLimit: true,
      noSpray: true,
      twoCells: true,
    },
  );

  const state = simulateFluidDomain(domain, 12);
  const nudged = {
    ...state,
    depth: state.depth.map((value, index) =>
      index === 5 ? value + Number.EPSILON * value : value,
    ),
  };
  TestValidator.equals(
    "the digest is sensitive evidence, not decoration",
    namedFacts([
      ["length", () => fluidStateDigest(state).length === 8],
      ["hex", () => /^[0-9a-f]{8}$/.test(fluidStateDigest(state))],
      [
        "stable",
        () =>
          fluidStateDigest(state) ===
          fluidStateDigest(simulateFluidDomain(domain, 12)),
      ],
      ["sensitive", () => fluidStateDigest(state) !== fluidStateDigest(nudged)],
      [
        "stepSensitive",
        () =>
          fluidStateDigest(state) !==
          fluidStateDigest(simulateFluidDomain(domain, 13)),
      ],
    ]),
    {
      length: true,
      hex: true,
      stable: true,
      sensitive: true,
      stepSensitive: true,
    },
  );

  const dry = validateWaterFeatures({
    environment: basinEnvironment(),
    features: [],
    domains: [],
  });
  TestValidator.equals(
    "a production with no water is untouched by the fluid contract",
    dry.success,
    true,
  );
};
