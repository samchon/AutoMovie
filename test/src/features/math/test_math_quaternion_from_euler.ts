import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, vclose } from "../internal/predicates";

/**
 * `Quaternion.fromEuler` composes intrinsic Euler degrees into a quaternion in
 * the given axis `order` — the bridge that lets the MCP boundary accept an
 * LLM-authored semantic placement rotation instead of a raw quaternion (#723).
 *
 * Scenarios:
 *
 * 1. Each single axis matches its `fromAxisAngle` and turns right-handed: Y90
 *    sends +X to −Z, X90 sends +Y to +Z, Z90 sends +X to +Y (covers axisOf and
 *    angleOf for all three of X/Y/Z).
 * 2. Zero angles are the identity.
 * 3. The `order` composes intrinsically: `XYZ` equals `qx·qy·qz` and `ZYX` equals
 *    `qz·qy·qx`, so the same angles in different orders differ.
 */
export const test_math_quaternion_from_euler = (): void => {
  const qX = Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, 90);
  const qY = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const qZ = Quaternion.fromAxisAngle({ x: 0, y: 0, z: 0 + 1 }, 90);

  // 1. single-axis parity + right-handed direction
  TestValidator.predicate(
    "Y90 matches fromAxisAngle",
    qclose(Quaternion.fromEuler({ x: 0, y: 90, z: 0, order: "XYZ" }), qY),
  );
  TestValidator.predicate(
    "X90 sends +Y to +Z",
    vclose(
      Quaternion.rotateVector(
        Quaternion.fromEuler({ x: 90, y: 0, z: 0, order: "XYZ" }),
        { x: 0, y: 1, z: 0 },
      ),
      { x: 0, y: 0, z: 1 },
    ),
  );
  TestValidator.predicate(
    "Z90 sends +X to +Y",
    vclose(
      Quaternion.rotateVector(
        Quaternion.fromEuler({ x: 0, y: 0, z: 90, order: "XYZ" }),
        { x: 1, y: 0, z: 0 },
      ),
      { x: 0, y: 1, z: 0 },
    ),
  );

  // 2. identity
  TestValidator.predicate(
    "zero angles are identity",
    qclose(
      Quaternion.fromEuler({ x: 0, y: 0, z: 0, order: "XYZ" }),
      Quaternion.identity(),
    ),
  );

  // 3. intrinsic order composition (qc0·qc1·qc2), and order matters
  TestValidator.predicate(
    "XYZ composes qx·qy·qz",
    qclose(
      Quaternion.fromEuler({ x: 90, y: 90, z: 90, order: "XYZ" }),
      Quaternion.multiply(qX, Quaternion.multiply(qY, qZ)),
    ),
  );
  TestValidator.predicate(
    "ZYX composes qz·qy·qx",
    qclose(
      Quaternion.fromEuler({ x: 90, y: 90, z: 90, order: "ZYX" }),
      Quaternion.multiply(qZ, Quaternion.multiply(qY, qX)),
    ),
  );
  TestValidator.predicate(
    "order changes the result",
    !qclose(
      Quaternion.fromEuler({ x: 90, y: 90, z: 90, order: "XYZ" }),
      Quaternion.fromEuler({ x: 90, y: 90, z: 90, order: "ZYX" }),
    ),
  );
};
