import {
  simulateSoftBody,
  softBodyRestConfiguration,
  softBodyStateDigest,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { exactValues, softPanel } from "../internal/softFixtures";

/** A panel in free space with no body force and every anchor left where it is. */
const undisturbed = () =>
  softPanel({
    columns: 4,
    rows: 3,
    overrides: {
      id: "still",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: 0, z: 0 },
        drag: 0,
        iterations: 4,
        stiffness: { structural: 1, shear: 1, bend: 1 },
        referenceSpeed: 4,
        maxSteps: 512,
      },
      anchors: [
        { id: "left", particle: 0, position: null },
        { id: "right", particle: 3, position: null },
      ],
    },
  });

/**
 * Cloth at rest is numerically exact: an undisturbed panel never drifts,
 * however many steps are integrated.
 *
 * This is the soft-body counterpart of the fluid solver's lake-at-rest
 * property, and it is the whole reason a rest length is measured from the rest
 * mesh with the same expression the solve measures the current distance with. A
 * solver that computed rest lengths any other way would produce a residual of
 * one ulp per constraint per sweep, and a curtain nobody touched would sag over
 * a long take.
 *
 * Scenarios:
 *
 * 1. Two hundred and fifty-six steps of an undisturbed panel leave every position
 *    bit-identical to the authored rest mesh and every velocity at exactly
 *    zero, with no strain and no contact.
 * 2. Two independent integrations to step 256 digest identically, so the whole
 *    state — positions, velocities and measurements together — is reproduced
 *    rather than merely close.
 * 3. An anchor declared with `position: null` holds its particle exactly at its
 *    own rest coordinate, which is what makes the default anchor spelling safe
 *    to use instead of restating a coordinate.
 * 4. Turning gravity on breaks the property, proving the assertion above is
 *    measuring the solver and not an accidental no-op: the same panel under
 *    gravity moves.
 */
export const test_soft_body_rest_exactness = (): void => {
  const domain = undisturbed();
  const settled = simulateSoftBody(domain, 256);
  TestValidator.equals(
    "an undisturbed panel is bit-identical to its rest mesh",
    namedFacts([
      ["positions", () => exactValues(settled.positions, domain.rest)],
      [
        "velocities",
        () => settled.velocities.every((value) => Object.is(value, 0)),
      ],
      ["strain", () => Object.is(settled.maxStrain, 0)],
      ["speed", () => Object.is(settled.maxSpeed, 0)],
      ["contacts", () => settled.contacts === 0],
      [
        "digest",
        () =>
          softBodyStateDigest(settled) ===
          softBodyStateDigest(simulateSoftBody(domain, 256)),
      ],
    ]),
    {
      positions: true,
      velocities: true,
      strain: true,
      speed: true,
      contacts: true,
      digest: true,
    },
  );

  const anchored = simulateSoftBody(domain, 1);
  TestValidator.equals(
    "a null anchor position holds the particle at its own rest coordinate",
    namedFacts([
      ["x", () => Object.is(anchored.positions[9], domain.rest[9])],
      ["y", () => Object.is(anchored.positions[10], domain.rest[10])],
      ["z", () => Object.is(anchored.positions[11], domain.rest[11])],
    ]),
    { x: true, y: true, z: true },
  );

  const falling = simulateSoftBody(
    softPanel({
      columns: 4,
      rows: 3,
      overrides: {
        id: "falling",
        anchors: [{ id: "left", particle: 0, position: null }],
      },
    }),
    64,
  );
  TestValidator.equals(
    "the same panel under gravity does move, so the rest claim measures something",
    namedFacts([
      ["moved", () => falling.positions[10] < -0.5],
      ["strained", () => falling.maxStrain > 0],
    ]),
    { moved: true, strained: true },
  );

  const gathered = softPanel({
    columns: 4,
    rows: 3,
    overrides: {
      id: "gathered",
      anchors: [{ id: "left", particle: 0, position: { x: 2, y: 1, z: 0 } }],
      states: [
        {
          id: "drawn",
          anchors: [{ anchor: "left", position: { x: -3, y: 1, z: 0.5 } }],
        },
      ],
    },
  });
  TestValidator.equals(
    "the published rest configuration is what the solve starts from",
    namedFacts([
      [
        "default",
        () =>
          exactValues(
            softBodyRestConfiguration(domain),
            simulateSoftBody(domain, 0).positions,
          ),
      ],
      [
        "anchored",
        () =>
          exactValues(
            softBodyRestConfiguration(gathered),
            simulateSoftBody(gathered, 0).positions,
          ),
      ],
      [
        "named",
        () =>
          exactValues(
            softBodyRestConfiguration(gathered, "drawn"),
            simulateSoftBody(gathered, 0, "drawn").positions,
          ),
      ],
      [
        "notTheAuthoredMesh",
        () =>
          exactValues(softBodyRestConfiguration(gathered), gathered.rest) ===
            false &&
          softBodyRestConfiguration(gathered)[0] === 2 &&
          softBodyRestConfiguration(gathered, "drawn")[0] === -3,
      ],
      [
        "undeclaredStateThrows",
        () =>
          throwsError(
            () => softBodyRestConfiguration(gathered, "shut"),
            'does not declare a named state "shut"',
          ),
      ],
    ]),
    {
      default: true,
      anchored: true,
      named: true,
      notTheAuthoredMesh: true,
      undeclaredStateThrows: true,
    },
  );
};
