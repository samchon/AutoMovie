import { Quaternion, aimRotation } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, throwsError, vclose } from "../internal/predicates";

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const nX = { x: -1, y: 0, z: 0 };
const nY = { x: 0, y: -1, z: 0 };

/** 0.05° in radians — inside the OLD quatFromTo identity deadzone. */
const TINY = (0.05 * Math.PI) / 180;

/**
 * `aimRotation` — the shortest-arc rotation taking one direction onto another
 * (the heart of an aim/look-at driver AND the analytic two-bone lowering, hence
 * `reachPose`/`legPlant`). Verified by rotating `from` with the result and
 * checking it lands on `to`.
 *
 * Scenarios:
 *
 * 1. General case: +X → +Y rotates +X onto +Y.
 * 2. Already aligned (+X → +X) is the identity.
 * 3. Antiparallel where the first perpendicular axis is degenerate (+X → −X:
 *    `|a.x| >= 0.9` ⇒ the +Y-axis branch) still flips +X to −X.
 * 4. Antiparallel with the `|a.x| < 0.9` branch (+Y → −Y) flips +Y to −Y.
 * 5. Non-unit inputs are normalized first.
 * 6. **Deadzone-free (#643/#720):** a target 0.05° off-axis — inside the old `cos
 *
 * > 0.999999`deadzone — now aims EXACTLY at the target instead of snapping to the
 * > identity. Because`aimRotation`is the shared core
 * > of`twoBoneChainArticulation`, this is the sub-0.081° correction
 * > `reachPose`(an arm putting a hand on a lever) and`legPlant` (a foot plant)
 * > used to silently drop.
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
  TestValidator.predicate(
    "NaN from vector rejects",
    throwsError(
      () => aimRotation({ x: Number.NaN, y: 0, z: 0 }, Y),
      ["aimRotation from.x", "finite", "NaN"],
    ),
  );
  TestValidator.predicate(
    "infinite to vector rejects",
    throwsError(
      () => aimRotation(X, { x: 0, y: Infinity, z: 0 }),
      ["aimRotation to.y", "finite", "Infinity"],
    ),
  );

  // 6. deadzone-free: a 0.05° off-axis target (inside the old identity deadzone)
  //    is aimed at EXACTLY. from = −Z, to = 0.05° rotated toward +X: rotating
  //    `from` by the result must land on `to` (x = sin 0.05° ≈ 8.7e-4 ≠ 0, which
  //    the old cos > 0.999999 snap would have left at 0).
  const from = { x: 0, y: 0, z: -1 };
  const to = { x: Math.sin(TINY), y: 0, z: -Math.cos(TINY) };
  const aimed = Quaternion.rotateVector(aimRotation(from, to), from);
  TestValidator.predicate(
    "0.05° off-axis is aimed exactly (no deadzone snap)",
    vclose(aimed, to),
  );
  TestValidator.predicate(
    "the rotation is real — not the old identity (x ≈ sin 0.05° ≠ 0)",
    aimed.x > 1e-4,
  );
};
