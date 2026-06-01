import { IMoticaResolvedBone, resolvePose } from "@motica/engine";
import { MoticaHumanoidBone } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  makePose,
} from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const at = (
  rs: IMoticaResolvedBone[],
  b: MoticaHumanoidBone,
): IMoticaResolvedBone => {
  const r = rs.find((x) => x.bone === b);
  if (r === undefined) throw new Error(`bone ${b} not resolved`);
  return r;
};

/**
 * A pose's optional root transform places the whole character in the world — it
 * seeds the hierarchy walk, so it offsets every resolved bone uniformly. Pins
 * that planting or translating the model root moves the entire skeleton
 * together.
 *
 * Scenario: a root translation of (+1,0,0) shifts every bone's world position
 * by +1 on X — hips from (0,1,0) to (1,1,0), and the leftLowerArm from
 * (0.5,1.4,0) to (1.5,1.4,0).
 */
export const test_kinematics_resolve_root = (): void => {
  const skeleton = createSkeleton();
  const shifted = resolvePose(
    makePose([], { ...IDENTITY_TRANSFORM, translation: { x: 1, y: 0, z: 0 } }),
    skeleton,
  );
  TestValidator.predicate(
    "root shift moves hips",
    vclose(at(shifted, "hips").worldPosition, { x: 1, y: 1, z: 0 }),
  );
  TestValidator.predicate(
    "root shift moves leftLowerArm",
    vclose(at(shifted, "leftLowerArm").worldPosition, { x: 1.5, y: 1.4, z: 0 }),
  );
};
