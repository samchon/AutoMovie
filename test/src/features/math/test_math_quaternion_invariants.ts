import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";
import { makeRng, randomUnitQuaternion } from "../internal/random";

/**
 * Property-based invariants for quaternion algebra, probed over 256 seeded
 * random rotations. Hand fixtures pin specific known cases; these assert the
 * algebraic laws hold for the whole rotation sphere, catching the corner a
 * fixture never enumerates. Seeded, so any counterexample replays exactly.
 *
 * Scenarios (each over 256 samples from a fixed seed):
 *
 * 1. Unit preservation: the product and the slerp of two unit quaternions stay
 *    unit-length: the group is closed on the unit sphere.
 * 2. Slerp endpoints: `slerp(a, b, 0)` is `a` and `slerp(a, b, 1)` is `b` (up to
 *    sign: a quaternion and its negation are the same rotation).
 * 3. Normalize idempotence: normalizing an already-unit quaternion is a no-op.
 * 4. Multiply associativity: `(a·b)·c` equals `a·(b·c)` up to sign.
 */
export const test_math_quaternion_invariants = (): void => {
  const rng = makeRng(0x51ed7a17);
  for (let i = 0; i < 256; ++i) {
    const a = randomUnitQuaternion(rng);
    const b = randomUnitQuaternion(rng);
    const c = randomUnitQuaternion(rng);
    const t = rng();

    TestValidator.predicate(
      `multiply stays unit #${i}`,
      qunit(Quaternion.multiply(a, b)),
    );
    TestValidator.predicate(
      `slerp stays unit #${i}`,
      qunit(Quaternion.slerp(a, b, t)),
    );

    TestValidator.predicate(
      `slerp at 0 is a #${i}`,
      qclose(Quaternion.slerp(a, b, 0), a),
    );
    TestValidator.predicate(
      `slerp at 1 is b #${i}`,
      qclose(Quaternion.slerp(a, b, 1), b),
    );

    const n = Quaternion.normalize(a);
    TestValidator.predicate(
      `normalize is idempotent #${i}`,
      qclose(Quaternion.normalize(n), n),
    );

    TestValidator.predicate(
      `multiply is associative #${i}`,
      qclose(
        Quaternion.multiply(Quaternion.multiply(a, b), c),
        Quaternion.multiply(a, Quaternion.multiply(b, c)),
      ),
    );
  }
};
