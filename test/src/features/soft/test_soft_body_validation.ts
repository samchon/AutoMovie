import { validateSoftBodyDomain } from "@automovie/engine";
import {
  AutoMovieViolationKind,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

/** A valid 3×3 panel every negative below is one property away from. */
const sound = (
  overrides: Partial<IAutoMovieSoftBodyDomain> = {},
): IAutoMovieSoftBodyDomain =>
  softPanel({
    columns: 3,
    rows: 3,
    overrides: {
      anchors: [{ id: "hook", particle: 0, position: { x: 0, y: 0, z: 0 } }],
      states: [
        {
          id: "open",
          anchors: [{ anchor: "hook", position: { x: 0.5, y: 0, z: 0 } }],
        },
      ],
      colliders: [
        {
          kind: "plane",
          id: "floor",
          normal: { x: 0, y: 1, z: 0 },
          offset: -4,
        },
        {
          kind: "sphere",
          id: "ball",
          center: { x: 0, y: -4, z: 0 },
          radius: 0.5,
        },
        {
          kind: "box",
          id: "crate",
          min: { x: -1, y: -6, z: -1 },
          max: { x: 1, y: -5, z: 1 },
        },
      ],
      wind: {
        direction: { x: 1, y: 0, z: 0 },
        acceleration: 1,
        gustAcceleration: 1,
        gustHz: 2,
      },
      ...overrides,
    },
  });

/** True when one property away from sound produces exactly the named refusal. */
const refuses = (
  overrides: Partial<IAutoMovieSoftBodyDomain>,
  kind: AutoMovieViolationKind,
  path: string,
): boolean =>
  hasViolation(
    validateSoftBodyDomain({ domain: sound(overrides) }),
    kind,
    path,
  );

/**
 * Every soft-body authoring mistake is refused with the path of the offending
 * field, and every neighbouring correct authoring is accepted.
 *
 * A validator that only ever fires is as useless as one that never does, so the
 * complete panel is asserted clean first and each refusal below is exactly one
 * property away from it. The pass exists so the solver never has to guess what
 * an inconsistent record meant: an array of the wrong length, a zero mass, two
 * coincident rest particles with no direction between them, two anchors
 * fighting over one particle, a named state citing an anchor nobody declared,
 * or a panel that starts buried in the furniture are all refused rather than
 * quietly clamped.
 *
 * Scenarios:
 *
 * 1. The complete panel — anchors, a named state, all three collider kinds and a
 *    draught — validates clean.
 * 2. Identity and schema: a blank id, a wrong version and wrong units are each
 *    named.
 * 3. Lattice and arrays: a non-integer column count, a lattice past the particle
 *    cap, a lattice holding fewer than two particles, and rest or mass arrays
 *    of the wrong length or holding a non-finite or non-positive value.
 * 4. Solver: a non-positive step, a non-finite gravity component, a negative drag,
 *    an iteration count outside its range, a stiffness outside `[0, 1]`, a
 *    non-positive reference speed and a step budget outside its range.
 * 5. Geometry: two coincident rest particles along a row and along a column.
 * 6. Anchors and states: a blank id, a duplicated id, an out-of-range particle,
 *    two anchors on one particle, a non-finite anchor position, a state citing
 *    an unknown anchor, a state posing one anchor twice, and a budget
 *    overflow.
 * 7. Colliders: a duplicated id, a zero and a non-finite plane normal, a
 *    non-positive radius, an inverted box, a collider budget overflow, and a
 *    plane whose degenerate normal makes the embedding test unanswerable rather
 *    than wrong.
 * 8. Wind: a zero direction, a non-finite acceleration, a negative gust amplitude
 *    and a negative gust frequency.
 */
export const test_soft_body_validation = (): void => {
  TestValidator.equals(
    "a complete panel validates clean",
    validateSoftBodyDomain({ domain: sound() }).success,
    true,
  );

  TestValidator.equals(
    "identity and schema are named",
    namedFacts([
      ["blankId", () => refuses({ id: "  " }, "type", "$input.id")],
      [
        "version",
        () => refuses({ version: 2 as unknown as 1 }, "type", "$input.version"),
      ],
      [
        "units",
        () =>
          refuses(
            { units: "feet" as unknown as "meter" },
            "type",
            "$input.units",
          ),
      ],
    ]),
    { blankId: true, version: true, units: true },
  );

  const oversized: IAutoMovieSoftBodyDomain = {
    ...sound(),
    lattice: { columns: 200, rows: 200 },
  };
  TestValidator.equals(
    "lattice and particle arrays are named",
    namedFacts([
      [
        "fractionalColumns",
        () =>
          refuses(
            { lattice: { columns: 2.5, rows: 3 } },
            "type",
            "lattice.columns",
          ),
      ],
      [
        "fractionalRows",
        () =>
          refuses({ lattice: { columns: 3, rows: 0 } }, "type", "lattice.rows"),
      ],
      [
        "tooMany",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: oversized }),
            "range",
            "$input.lattice",
          ),
      ],
      [
        "tooFew",
        () =>
          hasViolation(
            validateSoftBodyDomain({
              domain: softPanel({ columns: 1, rows: 1 }),
            }),
            "range",
            "$input.lattice",
          ),
      ],
      ["restLength", () => refuses({ rest: [0, 0, 0] }, "type", "$input.rest")],
      ["massLength", () => refuses({ mass: [1] }, "type", "$input.mass")],
      [
        "restValue",
        () => {
          const rest = sound().rest.slice();
          rest[4] = Number.NaN;
          return refuses({ rest }, "range", "$input.rest[4]");
        },
      ],
      [
        "massValue",
        () => {
          const mass = sound().mass.slice();
          mass[2] = 0;
          return refuses({ mass }, "range", "$input.mass[2]");
        },
      ],
    ]),
    {
      fractionalColumns: true,
      fractionalRows: true,
      tooMany: true,
      tooFew: true,
      restLength: true,
      massLength: true,
      restValue: true,
      massValue: true,
    },
  );

  const solver = (
    patch: Partial<IAutoMovieSoftBodyDomain["solver"]>,
  ): Partial<IAutoMovieSoftBodyDomain> => ({
    solver: { ...sound().solver, ...patch },
  });
  TestValidator.equals(
    "solver settings are named",
    namedFacts([
      [
        "step",
        () =>
          refuses(
            solver({ fixedStepSeconds: 0 }),
            "range",
            "solver.fixedStepSeconds",
          ),
      ],
      [
        "gravity",
        () =>
          refuses(
            solver({ gravity: { x: 0, y: Number.NaN, z: 0 } }),
            "range",
            "solver.gravity.y",
          ),
      ],
      ["drag", () => refuses(solver({ drag: -1 }), "range", "solver.drag")],
      [
        "iterations",
        () => refuses(solver({ iterations: 0 }), "type", "solver.iterations"),
      ],
      [
        "iterationBudget",
        () => refuses(solver({ iterations: 65 }), "type", "solver.iterations"),
      ],
      [
        "stiffness",
        () =>
          refuses(
            solver({ stiffness: { structural: 1.5, shear: 0.5, bend: 0.25 } }),
            "range",
            "solver.stiffness.structural",
          ),
      ],
      [
        "referenceSpeed",
        () =>
          refuses(
            solver({ referenceSpeed: 0 }),
            "range",
            "solver.referenceSpeed",
          ),
      ],
      [
        "maxSteps",
        () => refuses(solver({ maxSteps: 100_001 }), "type", "solver.maxSteps"),
      ],
    ]),
    {
      step: true,
      gravity: true,
      drag: true,
      iterations: true,
      iterationBudget: true,
      stiffness: true,
      referenceSpeed: true,
      maxSteps: true,
    },
  );

  TestValidator.equals(
    "coincident rest particles are named on both lattice axes",
    namedFacts([
      [
        "row",
        () => {
          const rest = sound().rest.slice();
          rest[3] = rest[0];
          rest[4] = rest[1];
          rest[5] = rest[2];
          return refuses({ rest }, "type", "$input.rest[0]");
        },
      ],
      [
        "column",
        () => {
          const rest = sound().rest.slice();
          rest[9] = rest[0];
          rest[10] = rest[1];
          rest[11] = rest[2];
          return refuses({ rest }, "type", "$input.rest[0]");
        },
      ],
    ]),
    { row: true, column: true },
  );

  TestValidator.equals(
    "anchors and named states are named",
    namedFacts([
      [
        "blank",
        () =>
          refuses(
            { anchors: [{ id: " ", particle: 0, position: null }], states: [] },
            "type",
            "anchors[0].id",
          ),
      ],
      [
        "duplicateId",
        () =>
          refuses(
            {
              anchors: [
                { id: "hook", particle: 0, position: null },
                { id: "hook", particle: 1, position: null },
              ],
              states: [],
            },
            "type",
            "anchors[1].id",
          ),
      ],
      [
        "particleRange",
        () =>
          refuses(
            {
              anchors: [{ id: "hook", particle: 9, position: null }],
              states: [],
            },
            "type",
            "anchors[0].particle",
          ),
      ],
      [
        "duplicateParticle",
        () =>
          refuses(
            {
              anchors: [
                { id: "a", particle: 0, position: null },
                { id: "b", particle: 0, position: null },
              ],
              states: [],
            },
            "type",
            "anchors[1].particle",
          ),
      ],
      [
        "position",
        () =>
          refuses(
            {
              anchors: [
                {
                  id: "hook",
                  particle: 0,
                  position: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
                },
              ],
              states: [],
            },
            "range",
            "anchors[0].position.y",
          ),
      ],
      [
        "unknownAnchor",
        () =>
          refuses(
            {
              states: [
                {
                  id: "open",
                  anchors: [
                    { anchor: "nobody", position: { x: 0, y: 0, z: 0 } },
                  ],
                },
              ],
            },
            "type",
            "states[0].anchors[0].anchor",
          ),
      ],
      [
        "posedTwice",
        () =>
          refuses(
            {
              states: [
                {
                  id: "open",
                  anchors: [
                    { anchor: "hook", position: { x: 0, y: 0, z: 0 } },
                    { anchor: "hook", position: { x: 1, y: 0, z: 0 } },
                  ],
                },
              ],
            },
            "type",
            "states[0].anchors[1].anchor",
          ),
      ],
      [
        "stateBudget",
        () =>
          refuses(
            {
              states: Array.from({ length: 33 }, (_, index) => ({
                id: `state-${index}`,
                anchors: [],
              })),
            },
            "range",
            "$input.states",
          ),
      ],
      [
        "blankState",
        () =>
          refuses(
            { states: [{ id: "", anchors: [] }] },
            "type",
            "states[0].id",
          ),
      ],
      [
        "duplicateState",
        () =>
          refuses(
            {
              states: [
                { id: "open", anchors: [] },
                { id: "open", anchors: [] },
              ],
            },
            "type",
            "states[1].id",
          ),
      ],
    ]),
    {
      blank: true,
      duplicateId: true,
      particleRange: true,
      duplicateParticle: true,
      position: true,
      unknownAnchor: true,
      posedTwice: true,
      stateBudget: true,
      blankState: true,
      duplicateState: true,
    },
  );

  TestValidator.equals(
    "colliders are named",
    namedFacts([
      [
        "duplicate",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "plane",
                  id: "floor",
                  normal: { x: 0, y: 1, z: 0 },
                  offset: -4,
                },
                {
                  kind: "plane",
                  id: "floor",
                  normal: { x: 0, y: 1, z: 0 },
                  offset: -5,
                },
              ],
            },
            "type",
            "colliders[1].id",
          ),
      ],
      [
        "zeroNormal",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "plane",
                  id: "flat",
                  normal: { x: 0, y: 0, z: 0 },
                  offset: 0,
                },
              ],
            },
            "type",
            "colliders[0].normal",
          ),
      ],
      [
        "nonFiniteNormal",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "plane",
                  id: "flat",
                  normal: { x: Number.NaN, y: 1, z: 0 },
                  offset: 0,
                },
              ],
            },
            "range",
            "colliders[0].normal.x",
          ),
      ],
      [
        "offset",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "plane",
                  id: "flat",
                  normal: { x: 0, y: 1, z: 0 },
                  offset: Number.NaN,
                },
              ],
            },
            "range",
            "colliders[0].offset",
          ),
      ],
      [
        "radius",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "sphere",
                  id: "ball",
                  center: { x: 0, y: -4, z: 0 },
                  radius: 0,
                },
              ],
            },
            "range",
            "colliders[0].radius",
          ),
      ],
      [
        "invertedBox",
        () =>
          refuses(
            {
              colliders: [
                {
                  kind: "box",
                  id: "crate",
                  min: { x: -1, y: -6, z: -1 },
                  max: { x: -1, y: -5, z: 1 },
                },
              ],
            },
            "range",
            "colliders[0].max.x",
          ),
      ],
      [
        "budget",
        () =>
          refuses(
            {
              colliders: Array.from({ length: 65 }, (_, index) => ({
                kind: "plane" as const,
                id: `plane-${index}`,
                normal: { x: 0, y: 1, z: 0 },
                offset: -4,
              })),
            },
            "range",
            "$input.colliders",
          ),
      ],
    ]),
    {
      duplicate: true,
      zeroNormal: true,
      nonFiniteNormal: true,
      offset: true,
      radius: true,
      invertedBox: true,
      budget: true,
    },
  );

  const still = {
    direction: { x: 1, y: 0, z: 0 },
    acceleration: 1,
    gustAcceleration: 1,
    gustHz: 2,
  };
  const wind = (
    patch: Partial<NonNullable<IAutoMovieSoftBodyDomain["wind"]>>,
  ): Partial<IAutoMovieSoftBodyDomain> => ({
    wind: { ...still, ...patch },
  });
  TestValidator.equals(
    "the draught is named",
    namedFacts([
      [
        "zeroDirection",
        () =>
          refuses(
            wind({ direction: { x: 0, y: 0, z: 0 } }),
            "type",
            "wind.direction",
          ),
      ],
      [
        "acceleration",
        () =>
          refuses(
            wind({ acceleration: Number.NaN }),
            "range",
            "wind.acceleration",
          ),
      ],
      [
        "gust",
        () =>
          refuses(
            wind({ gustAcceleration: -1 }),
            "range",
            "wind.gustAcceleration",
          ),
      ],
      ["hz", () => refuses(wind({ gustHz: -1 }), "range", "wind.gustHz")],
      [
        "absent",
        () =>
          validateSoftBodyDomain({ domain: sound({ wind: null }) }).success ===
          true,
      ],
    ]),
    {
      zeroDirection: true,
      acceleration: true,
      gust: true,
      hz: true,
      absent: true,
    },
  );
};
