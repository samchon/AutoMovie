import { simulateSoftBody, validateSoftBodyDomain } from "@automovie/engine";
import { IAutoMovieSoftCollider } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts, nclose } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

/** A weightless strip dropped straight onto whatever colliders are declared. */
const dropped = (colliders: IAutoMovieSoftCollider[]) =>
  softPanel({
    columns: 1,
    rows: 2,
    spacing: { u: 0.25, v: 0.25 },
    overrides: {
      id: "dropper",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: -8, z: 0 },
        drag: 0,
        iterations: 2,
        stiffness: { structural: 1, shear: 1, bend: 1 },
        referenceSpeed: 4,
        maxSteps: 512,
      },
      colliders,
    },
  });

/**
 * A particle escapes each collider along that collider's own geometry, and the
 * escapes are counted rather than assumed.
 *
 * Collision is where a bounded first tier is easiest to fake: clamping a
 * coordinate looks like contact until the surface is not axis-aligned. Each of
 * the three colliders is therefore checked against the geometry it claims — a
 * half-space along its normalized normal, a ball along its radius, a box out of
 * its least-penetrated face — and the count of resolutions is asserted beside
 * the positions, so a panel that never touched anything cannot report that it
 * did.
 *
 * Scenarios:
 *
 * 1. A half-space with a **non-unit** normal `(0, 2, 0)` and offset `−0.5` holds
 *    the strip at exactly `y = −0.5`: the normal is normalized rather than used
 *    as a scale, and the contact count is one per particle per step.
 * 2. A tilted half-space is escaped along its own normal, not along `y`: the
 *    resting particle satisfies `n̂ · p = offset` to within a rounding
 *    tolerance while both of its coordinates moved.
 * 3. A ball projects the particle to exactly its radius from the centre.
 * 4. A particle exactly at a ball's centre has no radius to escape along and is
 *    stated to leave upward, at exactly `centre.y + radius`, rather than
 *    dividing by zero. The same authored panel is refused by the validator,
 *    which is why the case is degenerate rather than ordinary.
 * 5. A box is escaped by its least-penetrated face, on either side of it: a strip
 *    falling onto a crate leaves through the crate's top, a strip pressed
 *    upward against a beam leaves through the beam's underside rather than
 *    being pushed out the far side, and a strip that is nowhere near the box is
 *    not touched at all and reports zero contacts.
 */
export const test_soft_body_collision = (): void => {
  const floor = simulateSoftBody(
    dropped([
      {
        kind: "plane",
        id: "floor",
        normal: { x: 0, y: 2, z: 0 },
        offset: -0.5,
      },
    ]),
    64,
  );
  TestValidator.equals(
    "a half-space with a non-unit normal still holds the panel at its offset",
    namedFacts([
      ["resting", () => Object.is(floor.positions[4], -0.5)],
      ["heldAbove", () => nclose(floor.positions[1], -0.25, 0.01)],
      ["contacts", () => floor.contacts === 1],
    ]),
    { resting: true, heldAbove: true, contacts: true },
  );

  const ramp = simulateSoftBody(
    dropped([
      { kind: "plane", id: "ramp", normal: { x: 1, y: 1, z: 0 }, offset: -0.5 },
    ]),
    64,
  );
  const unit = Math.SQRT1_2;
  TestValidator.equals(
    "a tilted half-space is escaped along its own normal",
    namedFacts([
      [
        "onPlane",
        () => nclose(unit * ramp.positions[0] + unit * ramp.positions[1], -0.5),
      ],
      ["slidX", () => ramp.positions[0] > 0],
      ["fell", () => ramp.positions[1] < 0],
    ]),
    { onPlane: true, slidX: true, fell: true },
  );

  const ball = simulateSoftBody(
    dropped([
      {
        kind: "sphere",
        id: "bolster",
        center: { x: 0, y: -1, z: 0 },
        radius: 0.375,
      },
      { kind: "plane", id: "floor", normal: { x: 0, y: 1, z: 0 }, offset: -1 },
    ]),
    64,
  );
  TestValidator.equals(
    "a ball projects the resting particle to exactly its radius",
    namedFacts([
      [
        "onSurface",
        () =>
          nclose(
            Math.sqrt(
              ball.positions[3] * ball.positions[3] +
                (ball.positions[4] + 1) * (ball.positions[4] + 1) +
                ball.positions[5] * ball.positions[5],
            ),
            0.375,
          ),
      ],
      ["onTop", () => Object.is(ball.positions[4], -0.625)],
      ["contacts", () => ball.contacts === 1],
    ]),
    { onSurface: true, onTop: true, contacts: true },
  );

  const buried = softPanel({
    columns: 1,
    rows: 2,
    overrides: {
      id: "buried",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: 0, z: 0 },
        drag: 0,
        iterations: 1,
        stiffness: { structural: 1, shear: 1, bend: 1 },
        referenceSpeed: 4,
        maxSteps: 8,
      },
      colliders: [
        {
          kind: "sphere",
          id: "core",
          center: { x: 0, y: 0, z: 0 },
          radius: 0.5,
        },
      ],
    },
  });
  const escaped = simulateSoftBody(buried, 1);
  TestValidator.equals(
    "a particle at a ball's centre leaves upward, and the authoring is refused",
    namedFacts([
      ["upward", () => Object.is(escaped.positions[1], 0.5)],
      [
        "refused",
        () =>
          hasViolation(
            validateSoftBodyDomain({ domain: buried }),
            "type",
            "colliders[0]",
          ),
      ],
    ]),
    { upward: true, refused: true },
  );

  const crate = simulateSoftBody(
    dropped([
      {
        kind: "box",
        id: "crate",
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: -0.5, z: 1 },
      },
    ]),
    64,
  );
  TestValidator.equals(
    "a box is escaped by its least-penetrated face",
    namedFacts([
      ["restsOnTop", () => Object.is(crate.positions[4], -0.5)],
      ["notPushedSideways", () => Object.is(crate.positions[3], 0)],
      ["contacts", () => crate.contacts === 1],
    ]),
    { restsOnTop: true, notPushedSideways: true, contacts: true },
  );

  const canopy = simulateSoftBody(
    softPanel({
      columns: 1,
      rows: 2,
      overrides: {
        id: "canopy",
        solver: {
          fixedStepSeconds: 0.015625,
          gravity: { x: 0, y: 8, z: 0 },
          drag: 0,
          iterations: 2,
          stiffness: { structural: 1, shear: 1, bend: 1 },
          referenceSpeed: 4,
          maxSteps: 512,
        },
        colliders: [
          {
            kind: "box",
            id: "beam",
            min: { x: -1, y: 0.5, z: -1 },
            max: { x: 1, y: 1.5, z: 1 },
          },
        ],
      },
    }),
    64,
  );
  TestValidator.equals(
    "a panel pressed up against a beam leaves by the face it entered",
    namedFacts([
      ["restsUnder", () => Object.is(canopy.positions[1], 0.5)],
      ["notPushedThrough", () => canopy.positions[1] < 1.5],
      ["contacts", () => canopy.contacts === 1],
    ]),
    { restsUnder: true, notPushedThrough: true, contacts: true },
  );

  const missed = simulateSoftBody(
    dropped([
      {
        kind: "box",
        id: "elsewhere",
        min: { x: 4, y: 4, z: 4 },
        max: { x: 5, y: 5, z: 5 },
      },
    ]),
    8,
  );
  TestValidator.equals(
    "a box nowhere near the panel is never touched",
    {
      contacts: missed.contacts,
      moved: missed.positions[1] < 0,
    },
    { contacts: 0, moved: true },
  );
};
