import { simulateSoftBody } from "@automovie/engine";
import { IAutoMovieSoftBodyDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

const COLUMNS = 5;
const ROWS = 5;

/** The authored pre-fold: alternate columns stand one sixteenth of a metre out. */
const pleat = (column: number): number => (column % 2 === 0 ? 0.0625 : 0);

/**
 * A curtain on a track: five rings across the top, a floor it may not pass
 * through, and a shallow authored pleat.
 *
 * The pleat is not decoration. A perfectly flat panel under a perfectly flat
 * body force has a perfectly flat solution, so a planar curtain gathered at the
 * top would spread sideways instead of folding — buckling needs an out-of-plane
 * asymmetry, and a real curtain gets one from how it was hung. The rest mesh
 * states it, which is exactly what the domain record is for.
 *
 * `closed` is the authored rest arrangement, so its anchors carry no explicit
 * position at all; `open` gathers the same five rings into the left quarter of
 * the track, which is what a curtain being drawn actually is.
 */
const curtain = (): IAutoMovieSoftBodyDomain => {
  const flat = softPanel({
    columns: COLUMNS,
    rows: ROWS,
    origin: { x: -0.5, y: 0, z: 0 },
  });
  const rest = flat.rest.slice();
  for (let row = 0; row < ROWS; ++row)
    for (let column = 0; column < COLUMNS; ++column)
      rest[(row * COLUMNS + column) * 3 + 2] = pleat(column);
  return softPanel({
    columns: COLUMNS,
    rows: ROWS,
    origin: { x: -0.5, y: 0, z: 0 },
    overrides: {
      id: "curtain",
      rest,
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: -8, z: 0 },
        drag: 1,
        iterations: 4,
        stiffness: { structural: 1, shear: 0.5, bend: 0.25 },
        referenceSpeed: 4,
        maxSteps: 512,
      },
      anchors: Array.from({ length: COLUMNS }, (_, column) => ({
        id: `ring-${column}`,
        particle: column,
        position: null,
      })),
      states: [
        {
          id: "open",
          anchors: Array.from({ length: COLUMNS }, (_, column) => ({
            anchor: `ring-${column}`,
            position: { x: -0.5 + column * 0.0625, y: 0, z: pleat(column) },
          })),
        },
      ],
      colliders: [
        {
          kind: "plane",
          id: "floor",
          normal: { x: 0, y: 1, z: 0 },
          offset: -0.9375,
        },
      ],
    },
  });
};

/** Extent of the panel's hem along one axis. */
const hemSpan = (positions: number[], axis: 0 | 1 | 2): number => {
  let low = Infinity;
  let high = -Infinity;
  for (let column = 0; column < COLUMNS; ++column) {
    const value = positions[((ROWS - 1) * COLUMNS + column) * 3 + axis];
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return high - low;
};

/**
 * Opening and closing a curtain is a boundary condition on its anchors, and the
 * folds, the sag and the contact with the floor are what the solver makes of
 * that condition.
 *
 * A named state is deliberately not a keyframe of the cloth. It moves the rings
 * on the track and nothing else, so no author has to decide where a crease
 * lands and two states of the same panel cannot contradict each other's
 * physics. What this case pins is that the whole chain actually happens:
 * attachment is exact, gravity produces sag, gathering the rings deepens the
 * folds instead of merely narrowing a flat sheet, and the floor under the hem
 * is not passed through.
 *
 * Scenarios:
 *
 * 1. Under either state every ring holds its stated position exactly, so the
 *    curtain never comes off its track no matter what the fabric does.
 * 2. Gravity sags the hem well below the track, and the measured strain is
 *    reported rather than assumed to be zero: a position-based solve approaches
 *    inextensibility instead of enforcing it, and the state says by how much.
 * 3. Drawing the curtain gathers it. The hem narrows across the track and, more
 *    tellingly, its depth across the pleat grows several times over: fabric
 *    that cannot compress has to go somewhere, and where it goes is into
 *    folds.
 * 4. The floor under the hem is not passed through: every particle stays at or
 *    above it and contact is reported, while the same panel with the collider
 *    removed drops straight through — so the containment is the collider's
 *    doing and not the constraint network's.
 * 5. The two states are different solves of the same domain, and each is
 *    reproducible on its own.
 */
export const test_soft_body_curtain_states = (): void => {
  const domain = curtain();
  const closed = simulateSoftBody(domain, 256);
  const open = simulateSoftBody(domain, 256, "open");
  const columns = Array.from({ length: COLUMNS }, (_, column) => column);

  TestValidator.equals(
    "every ring holds its stated position exactly under both states",
    namedFacts([
      [
        "closed",
        () =>
          columns.every(
            (column) =>
              Object.is(closed.positions[column * 3], -0.5 + column * 0.25) &&
              Object.is(closed.positions[column * 3 + 1], 0) &&
              Object.is(closed.positions[column * 3 + 2], pleat(column)),
          ),
      ],
      [
        "open",
        () =>
          columns.every(
            (column) =>
              Object.is(open.positions[column * 3], -0.5 + column * 0.0625) &&
              Object.is(open.positions[column * 3 + 1], 0) &&
              Object.is(open.positions[column * 3 + 2], pleat(column)),
          ),
      ],
    ]),
    { closed: true, open: true },
  );

  TestValidator.equals(
    "gravity sags the hem below the track and the strain is reported",
    namedFacts([
      [
        "closedSag",
        () => closed.positions[((ROWS - 1) * COLUMNS + 2) * 3 + 1] < -0.9,
      ],
      [
        "openSag",
        () => open.positions[((ROWS - 1) * COLUMNS + 2) * 3 + 1] < -0.9,
      ],
      ["strainReported", () => closed.maxStrain > 0 && closed.maxStrain < 0.1],
    ]),
    { closedSag: true, openSag: true, strainReported: true },
  );

  TestValidator.equals(
    "drawing the curtain gathers the fabric into deeper folds",
    namedFacts([
      [
        "narrower",
        () => hemSpan(open.positions, 0) < hemSpan(closed.positions, 0),
      ],
      ["closedSpread", () => hemSpan(closed.positions, 0) > 0.9],
      [
        "deeperFolds",
        () => hemSpan(open.positions, 2) > 3 * hemSpan(closed.positions, 2),
      ],
    ]),
    { narrower: true, closedSpread: true, deeperFolds: true },
  );

  TestValidator.equals(
    "the floor under the hem is not passed through",
    namedFacts([
      [
        "above",
        () =>
          closed.positions.every(
            (value, index) => index % 3 !== 1 || value >= -0.9375,
          ),
      ],
      ["touched", () => closed.contacts > 0],
      [
        "withoutFloorItDrops",
        () =>
          simulateSoftBody({ ...domain, colliders: [] }, 256).positions.some(
            (value, index) => index % 3 === 1 && value < -0.9375,
          ),
      ],
    ]),
    { above: true, touched: true, withoutFloorItDrops: true },
  );

  TestValidator.equals(
    "the two states are different solves of the same domain",
    namedFacts([
      [
        "differ",
        () => hemSpan(open.positions, 2) !== hemSpan(closed.positions, 2),
      ],
      [
        "reproducible",
        () =>
          simulateSoftBody(domain, 256, "open").positions.every(
            (value, index) => Object.is(value, open.positions[index]),
          ),
      ],
    ]),
    { differ: true, reproducible: true },
  );
};
