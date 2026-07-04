import { aimYawPitch } from "@automovie/engine";
import { IautomovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const O: IautomovieVector3 = { x: 0, y: 0, z: 0 };
const at = (x: number, y: number, z: number): IautomovieVector3 => ({ x, y, z });

/**
 * `aimYawPitch` ??the yaw/pitch that aims from a point at a target in a frame
 * facing `facingDeg`.
 *
 * Scenarios:
 *
 * 1. A target on the origin (zero-length aim) ??both angles zero.
 * 2. Facing +Z: dead-ahead is 0/0, the +X side is +90 yaw (the actor's left), an
 *    up/down target tilts the pitch.
 * 3. Facing is undone: with the actor turned to +X, a +X target reads as straight
 *    ahead and a +Z target as ??0 (its right).
 */
export const test_kinematics_aim_yaw_pitch = (): void => {
  // 1. degenerate
  const zero = aimYawPitch(O, O, 0);
  TestValidator.predicate(
    "zero-length aim ??0/0",
    nclose(zero.yawDeg, 0) && nclose(zero.pitchDeg, 0),
  );

  // 2. facing +Z (0째)
  const ahead = aimYawPitch(O, at(0, 0, 5), 0);
  TestValidator.predicate(
    "dead ahead ??0 yaw, 0 pitch",
    nclose(ahead.yawDeg, 0) && nclose(ahead.pitchDeg, 0),
  );
  TestValidator.predicate(
    "+X target ??+90 yaw (the actor's left)",
    nclose(aimYawPitch(O, at(5, 0, 0), 0).yawDeg, 90),
  );
  TestValidator.predicate(
    "up-ahead ??+45 pitch",
    nclose(aimYawPitch(O, at(0, 5, 5), 0).pitchDeg, 45),
  );
  TestValidator.predicate(
    "down-ahead ????5 pitch",
    nclose(aimYawPitch(O, at(0, -5, 5), 0).pitchDeg, -45),
  );

  // 3. facing +X (90째) undoes into the local frame
  TestValidator.predicate(
    "facing +X, a +X target is straight ahead (0 yaw)",
    nclose(aimYawPitch(O, at(5, 0, 0), 90).yawDeg, 0),
  );
  TestValidator.predicate(
    "facing +X, a +Z target is to the right (??0 yaw)",
    nclose(aimYawPitch(O, at(0, 0, 5), 90).yawDeg, -90),
  );
};
