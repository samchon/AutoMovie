import { IMoticaResolvedBone, Quaternion, resolvePose } from "@motica/engine";
import { MoticaHumanoidBone } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";
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
 * At rest (no articulation) `resolvePose` accumulates each bone's local offset
 * down the hierarchy into world positions, and every local rotation is
 * identity. Scenario: hips(0,1,0) → +0.2 per spine bone, arm offsets along +X.
 */
export const test_kinematics_resolve_rest = (): void => {
  const skeleton = createSkeleton();
  const rest = resolvePose(makePose([]), skeleton);

  TestValidator.equals(
    "all bones resolved",
    rest.length,
    skeleton.bones.length,
  );
  TestValidator.predicate(
    "hips world",
    vclose(at(rest, "hips").worldPosition, { x: 0, y: 1, z: 0 }),
  );
  TestValidator.predicate(
    "spine world",
    vclose(at(rest, "spine").worldPosition, { x: 0, y: 1.2, z: 0 }),
  );
  TestValidator.predicate(
    "chest world",
    vclose(at(rest, "chest").worldPosition, { x: 0, y: 1.4, z: 0 }),
  );
  TestValidator.predicate(
    "head world",
    vclose(at(rest, "head").worldPosition, { x: 0, y: 1.7, z: 0 }),
  );
  TestValidator.predicate(
    "leftLowerArm world",
    vclose(at(rest, "leftLowerArm").worldPosition, { x: 0.5, y: 1.4, z: 0 }),
  );
  TestValidator.predicate(
    "rest local rotation is identity",
    qclose(at(rest, "chest").localRotation, Quaternion.identity()),
  );
};
