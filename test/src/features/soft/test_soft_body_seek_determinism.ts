import {
  sampleSoftBody,
  simulateSoftBody,
  softBodyStateDigest,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { exactValues, softPanel } from "../internal/softFixtures";

/** A panel with every accumulating term live: gravity, drag, wind, contact. */
const seekable = () =>
  softPanel({
    columns: 4,
    rows: 4,
    origin: { x: -0.375, y: 0, z: 0 },
    overrides: {
      id: "seekable",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: -8, z: 0 },
        drag: 0.75,
        iterations: 3,
        stiffness: { structural: 1, shear: 0.5, bend: 0.25 },
        referenceSpeed: 4,
        maxSteps: 64,
      },
      anchors: [
        { id: "hook", particle: 0, position: null },
        { id: "hem", particle: 3, position: null },
      ],
      states: [
        {
          id: "gathered",
          anchors: [{ anchor: "hem", position: { x: -0.25, y: 0, z: 0 } }],
        },
      ],
      colliders: [
        {
          kind: "plane",
          id: "floor",
          normal: { x: 0, y: 1, z: 0 },
          offset: -1.5,
        },
      ],
      wind: {
        direction: { x: 0.5, y: 0, z: 1 },
        acceleration: 1,
        gustAcceleration: 3,
        gustHz: 6,
      },
    },
  });

/**
 * Seeking a soft body is absolute: any order of requests yields the same states
 * as playing straight through, and the same request twice yields bit-identical
 * bytes.
 *
 * This is the product contract that lets a shot be scrubbed, re-rendered from
 * the middle, or chunked across workers. It holds because a state is a pure
 * function of `(domain, step, namedState)` with nothing cached between calls —
 * there is no runtime object for a frame-order accumulation to hide in — and it
 * is proven here on a panel that is deliberately hard: gravity, drag, a gusting
 * draught, a reflecting floor and two anchors.
 *
 * Scenarios:
 *
 * 1. Steps 0..16 requested in a scrambled order digest identically to the same
 *    steps requested in ascending order, and the digests actually move, so the
 *    match is not the match of a state that never changed.
 * 2. Asking twice for the same step returns bit-identical position, velocity and
 *    measurement arrays.
 * 3. A named state is part of the identity of a state: the same step under
 *    `gathered` differs from the default, and both are individually stable.
 * 4. `sampleSoftBody` snaps a shot second down to its step: any time inside a step
 *    reads that step's state, a negative time reads step 0, and the exact step
 *    boundary reads the new step and not the old one.
 * 5. An unreachable seek is refused rather than guessed: a fractional step, a
 *    negative step, a step past the declared budget, a non-finite sample time
 *    and an undeclared named state each throw with the domain named, while the
 *    exact budget boundary is reachable.
 */
export const test_soft_body_seek_determinism = (): void => {
  const domain = seekable();
  const ascending = Array.from({ length: 17 }, (_, step) =>
    softBodyStateDigest(simulateSoftBody(domain, step)),
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
              softBodyStateDigest(simulateSoftBody(domain, step)) ===
              ascending[step],
          ),
      ],
      ["digestsMove", () => new Set(ascending).size === ascending.length],
    ]),
    { digestsMatch: true, digestsMove: true },
  );

  const once = simulateSoftBody(domain, 48);
  const twice = simulateSoftBody(domain, 48);
  TestValidator.equals(
    "the same seek twice is bit-identical",
    namedFacts([
      ["positions", () => exactValues(once.positions, twice.positions)],
      ["velocities", () => exactValues(once.velocities, twice.velocities)],
      ["speed", () => Object.is(once.maxSpeed, twice.maxSpeed)],
      ["strain", () => Object.is(once.maxStrain, twice.maxStrain)],
      ["contacts", () => once.contacts === twice.contacts],
      [
        "digest",
        () => softBodyStateDigest(once) === softBodyStateDigest(twice),
      ],
    ]),
    {
      positions: true,
      velocities: true,
      speed: true,
      strain: true,
      contacts: true,
      digest: true,
    },
  );

  const gathered = simulateSoftBody(domain, 48, "gathered");
  TestValidator.equals(
    "a named state is part of the identity of a solved state",
    namedFacts([
      [
        "differs",
        () => softBodyStateDigest(gathered) !== softBodyStateDigest(once),
      ],
      [
        "stable",
        () =>
          softBodyStateDigest(simulateSoftBody(domain, 48, "gathered")) ===
          softBodyStateDigest(gathered),
      ],
      ["named", () => gathered.state === "gathered"],
      ["default", () => once.state === null],
    ]),
    { differs: true, stable: true, named: true, default: true },
  );

  const dt = domain.solver.fixedStepSeconds;
  TestValidator.equals(
    "a shot second snaps down to its fixed step",
    namedFacts([
      ["inside", () => sampleSoftBody(domain, dt * 9.75).step === 9],
      ["boundary", () => sampleSoftBody(domain, dt * 10).step === 10],
      ["negative", () => sampleSoftBody(domain, -5).step === 0],
      ["zero", () => sampleSoftBody(domain, 0).step === 0],
      [
        "sameAsSeek",
        () =>
          softBodyStateDigest(sampleSoftBody(domain, dt * 9.75)) ===
          ascending[9],
      ],
      [
        "namedSample",
        () => sampleSoftBody(domain, dt * 3, "gathered").state === "gathered",
      ],
    ]),
    {
      inside: true,
      boundary: true,
      negative: true,
      zero: true,
      sameAsSeek: true,
      namedSample: true,
    },
  );

  TestValidator.equals(
    "an unreachable seek is refused, never guessed",
    namedFacts([
      [
        "fractional",
        () =>
          throwsError(
            () => simulateSoftBody(domain, 1.5),
            ["seekable", "non-negative integer"],
          ),
      ],
      [
        "negativeStep",
        () =>
          throwsError(
            () => simulateSoftBody(domain, -1),
            ["non-negative integer"],
          ),
      ],
      [
        "pastBudget",
        () =>
          throwsError(
            () => simulateSoftBody(domain, 65),
            ["budget stops at 64"],
          ),
      ],
      ["atBudget", () => simulateSoftBody(domain, 64).step === 64],
      [
        "nonFiniteTime",
        () =>
          throwsError(
            () => sampleSoftBody(domain, Number.NaN),
            ["non-finite time"],
          ),
      ],
      [
        "unknownState",
        () =>
          throwsError(
            () => simulateSoftBody(domain, 1, "shut"),
            ['does not declare a named state "shut"'],
          ),
      ],
    ]),
    {
      fractional: true,
      negativeStep: true,
      pastBudget: true,
      atBudget: true,
      nonFiniteTime: true,
      unknownState: true,
    },
  );
};
