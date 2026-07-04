import { Quaternion, aimRotation } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, vclose } from "../internal/predicates";

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const nX = { x: -1, y: 0, z: 0 };
const nY = { x: 0, y: -1, z: 0 };

/**
 * `aimRotation` — the shortest-arc rotation taking one direction onto another
 * (the heart of an aim/look-at driver). Verified by rotating `from` with the
 * result and checking it lands on `to`.
 *
 * Scenarios:
 *
 * 1. General case: +X → +Y rotates +X onto +Y.
 * 2. Already aligned (+X → +X) is the identity.
 * 3. Antiparallel where the first perpendicular axis is degenerate (+X → −X:
 *    cross(+X,+X)=0 ⇒ falls back to the +Y axis) still flips +X to −X.
 * 4. Antiparallel with a valid first axis (+Y → −Y) flips +Y to −Y.
 * 5. Non-unit inputs are normalized first.
 */
export const test_kinematics_aim_rotation = (): void => {
  // 1. general
  TestValidator.predicate(
    "+X → +Y aims onto +Y",
    vclose(Quaternion.rotateVector(aimRotation(X, Y), X), Y),
  );

  // 2. aligned → identity
  TestValidator.predicate(
    "aligned is identity",
    qclose(aimRotation(X, X), { x: 0, y: 0, z: 0, w: 1 }),
  );

  // 3. antiparallel, degenerate first axis (+X → −X)
  TestValidator.predicate(
    "+X → −X flips",
    vclose(Quaternion.rotateVector(aimRotation(X, nX), X), nX),
  );

  // 4. antiparallel, valid first axis (+Y → −Y)
  TestValidator.predicate(
    "+Y → −Y flips",
    vclose(Quaternion.rotateVector(aimRotation(Y, nY), Y), nY),
  );

  // 5. non-unit inputs normalized
  TestValidator.predicate(
    "non-unit inputs normalized",
    vclose(
      Quaternion.rotateVector(
        aimRotation({ x: 2, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }),
        X,
      ),
      Y,
    ),
  );
};
