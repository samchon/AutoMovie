import { Quaternion, Vector3, lookRotation } from "@autofilm/engine";
import { IAutoFilmVector3 } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, qunit, vclose } from "../internal/predicates";

const FORWARD: IAutoFilmVector3 = { x: 0, y: 0, z: -1 };
const RIGHT: IAutoFilmVector3 = { x: 1, y: 0, z: 0 };

/**
 * Pins the up-stabilized camera aim that replaced the shortest-arc rotation:
 * the demo's orbit shot exposed a rolled horizon, because a shortest arc from
 * −Z has no notion of "up". `lookRotation` must point −Z down the requested
 * direction AND keep the camera's local X horizontal (no roll) for every
 * direction — including the straight-up/down degenerates and the quaternion
 * conversion's non-w branches.
 *
 * Scenarios (each direction: forward lands on it, unit quaternion, and the
 * rotated X axis stays level):
 *
 * 1. Straight ahead (−Z) → identity.
 * 2. Behind (+Z), pure sides (±X) — the 180° family that leaves the w-trace.
 * 3. Compound diagonals (the orbit path's actual aims).
 * 4. Straight down and straight up — the up-parallel degenerates, resolved against
 *    the +Z reference (roll is unconstrained there, so only the forward mapping
 *    is pinned).
 */
export const test_film_camera_look_rotation = (): void => {
  const level: IAutoFilmVector3[] = [
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 2.2, y: 0.33, z: -1.35 },
    { x: -1.35, y: 0.33, z: 2.2 },
    { x: 0.5, y: -0.8, z: 0.5 },
    { x: -0.5, y: 0.8, z: -0.5 },
  ];
  for (const direction of level) {
    const q = lookRotation(direction);
    TestValidator.predicate(`unit ${JSON.stringify(direction)}`, qunit(q));
    TestValidator.predicate(
      `forward lands ${JSON.stringify(direction)}`,
      vclose(Quaternion.rotateVector(q, FORWARD), Vector3.normalize(direction)),
    );
    TestValidator.predicate(
      `horizon level ${JSON.stringify(direction)}`,
      nclose(Quaternion.rotateVector(q, RIGHT).y, 0, 1e-9),
    );
  }
  TestValidator.predicate(
    "identity straight ahead",
    nclose(lookRotation({ x: 0, y: 0, z: -1 }).w, 1),
  );

  for (const direction of [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
  ]) {
    const q = lookRotation(direction);
    TestValidator.predicate(
      `degenerate forward ${JSON.stringify(direction)}`,
      vclose(Quaternion.rotateVector(q, FORWARD), direction),
    );
  }
};
