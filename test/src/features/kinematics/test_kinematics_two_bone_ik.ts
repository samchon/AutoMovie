import { solveTwoBoneIK } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Analytic two-bone IK (law of cosines). Pinned against hand geometry.
 *
 * Scenarios:
 *
 * 1. Right-angle reach: equal unit bones to distance ?? ??bend 90째, lift 45째, in
 *    reach.
 * 2. Fully extended at max reach (distance = sum) ??bend 180째, lift 0째, not
 *    clamped (the shell is inclusive).
 * 3. Distance 0 with equal bones ??fully folded (bend 0째), lift short-circuits to
 *    0 (the d===0 guard).
 * 4. Goal beyond reach (distance > sum) ??clamped, bend 180째 (extended).
 * 5. Goal inside the inner shell (distance < |upper?뭠ower|) ??clamped, bend 0째
 *    (folded).
 */
export const test_kinematics_two_bone_ik = (): void => {
  // 1. right angle
  const a = solveTwoBoneIK(1, 1, Math.SQRT2);
  TestValidator.predicate("bend 90", nclose(a.bend, 90, 1e-4));
  TestValidator.predicate("lift 45", nclose(a.lift, 45, 1e-4));
  TestValidator.equals("in reach", a.clamped, false);

  // 2. max reach, straight
  const b = solveTwoBoneIK(1, 1, 2);
  TestValidator.predicate("bend 180", nclose(b.bend, 180, 1e-4));
  TestValidator.predicate("lift 0", nclose(b.lift, 0, 1e-4));
  TestValidator.equals("max is in reach", b.clamped, false);

  // 3. distance 0, equal bones ??folded, d===0 guard
  const c = solveTwoBoneIK(1, 1, 0);
  TestValidator.predicate("folded bend 0", nclose(c.bend, 0, 1e-4));
  TestValidator.predicate("lift 0 (guard)", nclose(c.lift, 0));
  TestValidator.equals("0 within shell", c.clamped, false);

  // 4. beyond reach ??clamped, extended
  const d = solveTwoBoneIK(2, 1, 5);
  TestValidator.equals("too far clamped", d.clamped, true);
  TestValidator.predicate("clamped to straight", nclose(d.bend, 180, 1e-4));

  // 5. inside inner shell ??clamped, folded
  const e = solveTwoBoneIK(2, 1, 0.5);
  TestValidator.equals("too near clamped", e.clamped, true);
  TestValidator.predicate("clamped to folded", nclose(e.bend, 0, 1e-4));
};
