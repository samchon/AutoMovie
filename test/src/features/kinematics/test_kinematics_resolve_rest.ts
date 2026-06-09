import {
  IAutoFilmResolvedBone,
  Quaternion,
  resolvePose,
} from "@autofilm/engine";
import { AutoFilmHumanoidBone } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

const at = (
  rs: IAutoFilmResolvedBone[],
  b: AutoFilmHumanoidBone,
): IAutoFilmResolvedBone => {
  const r = rs.find((x) => x.bone === b);
  if (r === undefined) throw new Error(`bone ${b} not resolved`);
  return r;
};

/**
 * With no articulation, `resolvePose` is pure rest-pose forward kinematics: it
 * walks the bone hierarchy parent-before-child, accumulating each bone's local
 * rest offset into a world position, and every bone's local rotation stays the
 * identity. Pins that the hierarchy walk and offset accumulation are correct
 * before any rotation enters the picture.
 *
 * Scenario (the test skeleton's rest offsets): hips sits at (0,1,0); each spine
 * bone adds +0.2 on Y (spine 1.2, chest 1.4, head 1.7); the left arm chains out
 * along +X (lower arm reaching 0.5). Every bone is resolved, and the chest's
 * local rotation is the identity.
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
