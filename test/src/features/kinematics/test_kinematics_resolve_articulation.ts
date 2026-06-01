import { IMoticaResolvedBone, Quaternion, resolvePose } from "@motica/engine";
import { MoticaHumanoidBone } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

const at = (
  rs: IMoticaResolvedBone[],
  b: MoticaHumanoidBone,
): IMoticaResolvedBone => {
  const r = rs.find((x) => x.bone === b);
  if (r === undefined) throw new Error(`bone ${b} not resolved`);
  return r;
};

/**
 * Articulating a parent bone rotates its descendants. Scenario: twist the chest
 * 90° about +Y; the leftUpperArm's local +X offset (0.2,0,0) swings to −Z, so
 * its world position moves from (0.2,1.4,0) to (0,1.4,−0.2).
 */
export const test_kinematics_resolve_articulation = (): void => {
  const skeleton = createSkeleton();
  const posed = resolvePose(
    makePose([joint("chest", { twist: 90 })]),
    skeleton,
  );

  TestValidator.predicate(
    "chest local rotation == Y90",
    qclose(
      at(posed, "chest").localRotation,
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
    ),
  );
  TestValidator.predicate(
    "child arm swings with chest twist",
    vclose(at(posed, "leftUpperArm").worldPosition, { x: 0, y: 1.4, z: -0.2 }),
  );
};
