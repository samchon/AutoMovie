import {
  fluidStateDigest,
  sampleFluidDomain,
  simulateFluidDomain,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { exactArray, flatBasin } from "../internal/fluidFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

const seekable = () => {
  const depth = new Array(24).fill(0.25);
  depth[9] = 0.5;
  return flatBasin({
    columns: 6,
    rows: 4,
    depth: 0.25,
    overrides: {
      id: "seekable",
      depth,
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: 8,
        drag: 0.5,
        dryDepth: 0,
        referenceDepth: 0.5,
        maxSteps: 64,
      },
      sources: [
        { id: "jet", column: 1, row: 1, flowRate: 0.05, start: 0, end: null },
      ],
      drains: [
        {
          id: "return",
          column: 4,
          row: 2,
          flowRate: 0.02,
          sillLevel: 0.1,
          start: 0,
          end: null,
        },
      ],
    },
  });
};

/**
 * Seeking a fluid domain is absolute: any order of requests yields the same
 * states as playing straight through, and the same request twice yields
 * bit-identical bytes.
 *
 * This is the product contract that lets a shot be scrubbed, re-rendered from
 * the middle, or chunked across workers. It holds because a state is a pure
 * function of `(domain, step)` with nothing cached between calls — there is no
 * runtime object for a frame-order accumulation to hide in — and it is proven
 * here on a domain that is deliberately hard: a running source, a gated drain,
 * drag, and an off-centre disturbance, so every accumulating term is live.
 *
 * Scenarios:
 *
 * 1. Steps 0..16 requested in a scrambled order digest identically to the same
 *    steps requested in ascending order, field by field.
 * 2. Asking twice for the same step returns bit-identical depth, velocity and
 *    ledger arrays.
 * 3. `sampleFluidDomain` snaps a shot second down to its step: any time inside a
 *    step reads that step's state, a negative time reads step 0, and the exact
 *    step boundary reads the new step and not the old one.
 * 4. An unreachable seek is refused rather than guessed: a fractional step, a
 *    negative step, a step past the declared budget, and a non-finite sample
 *    time each throw with the domain named.
 */
export const test_fluid_seek_determinism = (): void => {
  const domain = seekable();
  const ascending = Array.from({ length: 17 }, (_, step) =>
    fluidStateDigest(simulateFluidDomain(domain, step)),
  );
  const scrambled = [13, 0, 7, 16, 2, 11, 4, 9, 15, 1, 6, 12, 3, 10, 5, 8, 14];
  TestValidator.equals(
    "an absolute seek does not care what was sampled before it",
    namedFacts([
      [
        "digestsMatch",
        () =>
          scrambled.every(
            (step) =>
              fluidStateDigest(simulateFluidDomain(domain, step)) ===
              ascending[step],
          ),
      ],
      ["digestsMove", () => new Set(ascending).size === ascending.length],
    ]),
    { digestsMatch: true, digestsMove: true },
  );

  const once = simulateFluidDomain(domain, 40);
  const twice = simulateFluidDomain(domain, 40);
  TestValidator.equals(
    "the same seek twice is bit-identical",
    namedFacts([
      ["depth", () => exactArray(once.depth, twice.depth)],
      ["velocityX", () => exactArray(once.velocityX, twice.velocityX)],
      ["velocityZ", () => exactArray(once.velocityZ, twice.velocityZ)],
      ["volume", () => Object.is(once.volume, twice.volume)],
      ["source", () => Object.is(once.sourceVolume, twice.sourceVolume)],
      ["drain", () => Object.is(once.drainVolume, twice.drainVolume)],
      ["outflow", () => Object.is(once.outflowVolume, twice.outflowVolume)],
      ["digest", () => fluidStateDigest(once) === fluidStateDigest(twice)],
    ]),
    {
      depth: true,
      velocityX: true,
      velocityZ: true,
      volume: true,
      source: true,
      drain: true,
      outflow: true,
      digest: true,
    },
  );

  const dt = domain.solver.fixedStepSeconds;
  TestValidator.equals(
    "a shot second snaps down to its fixed step",
    namedFacts([
      ["inside", () => sampleFluidDomain(domain, dt * 9.75).step === 9],
      ["boundary", () => sampleFluidDomain(domain, dt * 10).step === 10],
      ["negative", () => sampleFluidDomain(domain, -5).step === 0],
      ["zero", () => sampleFluidDomain(domain, 0).step === 0],
      [
        "sameAsSeek",
        () =>
          fluidStateDigest(sampleFluidDomain(domain, dt * 9.75)) ===
          ascending[9],
      ],
    ]),
    {
      inside: true,
      boundary: true,
      negative: true,
      zero: true,
      sameAsSeek: true,
    },
  );

  TestValidator.equals(
    "an unreachable seek is refused, never guessed",
    namedFacts([
      [
        "fractional",
        () =>
          throwsError(
            () => simulateFluidDomain(domain, 1.5),
            ["seekable", "non-negative integer"],
          ),
      ],
      [
        "negativeStep",
        () =>
          throwsError(
            () => simulateFluidDomain(domain, -1),
            ["non-negative integer"],
          ),
      ],
      [
        "pastBudget",
        () =>
          throwsError(
            () => simulateFluidDomain(domain, 65),
            ["budget stops at 64"],
          ),
      ],
      ["atBudget", () => simulateFluidDomain(domain, 64).step === 64],
      [
        "nonFiniteTime",
        () =>
          throwsError(
            () => sampleFluidDomain(domain, Number.NaN),
            ["non-finite time"],
          ),
      ],
    ]),
    {
      fractional: true,
      negativeStep: true,
      pastBudget: true,
      atBudget: true,
      nonFiniteTime: true,
    },
  );
};
