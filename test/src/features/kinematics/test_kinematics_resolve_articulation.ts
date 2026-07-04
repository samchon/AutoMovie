import {
  IautomovieResolvedBone,
  Quaternion,
  resolvePose,
} from "@automovie/engine";
import { automovieHumanoidBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

const at = (
  rs: IautomovieResolvedBone[],
  b: automovieHumanoidBone,
): IautomovieResolvedBone => {
  const r = rs.find((x) => x.bone === b);
  if (r === undefined) throw new Error(`bone ${b} not resolved`);
  return r;
};

/**
 * Articulating a bone must rotate its whole subtree, not just itself ??the
 * defining property of forward kinematics. This pins that a parent's rotation
 * propagates into its children's world positions.
 *
 * Scenario: twist the chest 90째 about +Y. The chest's own local rotation
 * becomes Y90, and its child the leftUpperArm ??whose rest offset is the local
 * +X vector (0.2,0,0) ??swings a quarter turn to ?뭒, so its world position
 * moves from (0.2,1.4,0) at rest to (0,1.4,??.2).
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
