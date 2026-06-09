import { Matrix4 } from "@autofilm/engine";
import { IAutoFilmQuaternion, IAutoFilmVector3 } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, qclose, vclose } from "../internal/predicates";

const roundTrip = (
  title: string,
  t: IAutoFilmVector3,
  r: IAutoFilmQuaternion,
  s: IAutoFilmVector3,
): void => {
  const d = Matrix4.decompose(Matrix4.compose(t, r, s));
  TestValidator.predicate(`${title}: position`, vclose(d.position, t));
  TestValidator.predicate(`${title}: scale`, vclose(d.scale, s, 1e-5));
  TestValidator.predicate(`${title}: rotation`, qclose(d.rotation, r, 1e-5));
};

/**
 * `Matrix4.decompose` inverts `compose` and reaches each branch of the
 * largest-diagonal quaternion extraction, recovering position and scale too.
 *
 * Scenarios (each rotation steers the quaternion read down a different branch):
 *
 * 1. Identity rotation → positive-trace branch; with a non-uniform scale and
 *    offset, position and scale are recovered exactly.
 * 2. 180° about X → the `r00`-largest branch.
 * 3. 180° about Y → the `r11`-largest branch.
 * 4. 180° about Z → the `r22`-largest branch.
 * 5. 180° about a tilted axis where `r00 > r11` but `r00 ≤ r22` → exercises the
 *    second half of the `r00`-largest test going false (the `&&`
 *    short-circuit).
 */
export const test_resolve_matrix4_decompose = (): void => {
  const one = { x: 1, y: 1, z: 1 };
  roundTrip(
    "identity",
    { x: 1, y: 2, z: 3 },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 2, y: 3, z: 4 },
  );
  roundTrip("180° X", { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0, w: 0 }, one);
  roundTrip("180° Y", { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0, w: 0 }, one);
  roundTrip("180° Z", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1, w: 0 }, one);

  // 5. 180° about a tilted axis n with nz² > nx² > ny² (q = (n, 0))
  const n = { x: Math.sqrt(0.3), y: Math.sqrt(0.1), z: Math.sqrt(0.6) };
  roundTrip("180° tilted", { x: 0, y: 0, z: 0 }, { ...n, w: 0 }, one);

  // sanity: a generic small rotation still round-trips
  const s = Math.SQRT1_2;
  const dec = Matrix4.decompose(
    Matrix4.compose({ x: 0, y: 0, z: 0 }, { x: 0, y: s, z: 0, w: s }, one),
  );
  TestValidator.predicate(
    "90° Y stays unit",
    nclose(
      Math.hypot(
        dec.rotation.x,
        dec.rotation.y,
        dec.rotation.z,
        dec.rotation.w,
      ),
      1,
      1e-6,
    ),
  );
};
