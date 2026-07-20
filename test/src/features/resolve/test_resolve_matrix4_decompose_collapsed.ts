import { Matrix4 } from "@automovie/engine";
import { IAutoMovieQuaternion, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const finiteVec = (v: IAutoMovieVector3): boolean =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const finiteQuat = (q: IAutoMovieQuaternion): boolean =>
  Number.isFinite(q.x) &&
  Number.isFinite(q.y) &&
  Number.isFinite(q.z) &&
  Number.isFinite(q.w);

/**
 * `Matrix4.decompose` stays total on a **collapsed axis** (scale 0: a hidden
 * part, a folded joint): its normalizer is floored to `Number.EPSILON` so the
 * zero basis column reads `0 / EPSILON = 0` instead of `0 / 0 = NaN`, which
 * would otherwise spread through the quaternion and every descendant world
 * matrix (#719). The recovered rotation of a collapsed axis is indeterminate,
 * but the contract is finiteness, not meaning.
 *
 * Scenarios:
 *
 * 1. Each axis collapsed in turn (identity rotation, other scales nonzero):
 *    rotation and scale are finite, the collapsed scale is exactly 0 (raw, not
 *    the floor), and the surviving scales are recovered exactly.
 * 2. All three axes collapsed (zero matrix rotation block): still finite.
 * 3. Regression: a genuine near-zero-but-nonzero scale (1e-3) round-trips exactly
 *    (the floor never perturbs a real scale).
 */
export const test_resolve_matrix4_decompose_collapsed = (): void => {
  const t = { x: 1, y: 2, z: 3 };
  const identity = { x: 0, y: 0, z: 0, w: 1 };

  const axes: Array<[string, IAutoMovieVector3, "x" | "y" | "z"]> = [
    ["x collapsed", { x: 0, y: 2, z: 3 }, "x"],
    ["y collapsed", { x: 2, y: 0, z: 3 }, "y"],
    ["z collapsed", { x: 2, y: 3, z: 0 }, "z"],
  ];
  for (const [title, scale, zero] of axes) {
    const d = Matrix4.decompose(Matrix4.compose(t, identity, scale));
    TestValidator.predicate(
      `${title}: rotation finite`,
      finiteQuat(d.rotation),
    );
    TestValidator.predicate(`${title}: scale finite`, finiteVec(d.scale));
    // the collapsed axis reads exactly 0 (raw length), not the EPSILON floor
    TestValidator.equals(`${title}: collapsed scale is 0`, d.scale[zero], 0);
    TestValidator.predicate(`${title}: position finite`, finiteVec(d.position));
  }

  // 2. Fully collapsed: the whole rotation block is zero; still finite.
  const allZero = Matrix4.decompose(
    Matrix4.compose(t, identity, { x: 0, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "all collapsed: rotation finite",
    finiteQuat(allZero.rotation),
  );
  TestValidator.predicate(
    "all collapsed: scale finite",
    finiteVec(allZero.scale),
  );
  TestValidator.equals("all collapsed: scale is 0,0,0", allZero.scale, {
    x: 0,
    y: 0,
    z: 0,
  });

  // 3. Regression: a real tiny scale (1e-3, far above EPSILON ~2.2e-16)
  //    round-trips exactly: the floor is a no-op for genuine scales.
  const tiny = { x: 1e-3, y: 1e-3, z: 1e-3 };
  const rt = Matrix4.decompose(Matrix4.compose(t, identity, tiny));
  TestValidator.predicate("tiny scale x", nclose(rt.scale.x, 1e-3, 1e-9));
  TestValidator.predicate("tiny scale y", nclose(rt.scale.y, 1e-3, 1e-9));
  TestValidator.predicate("tiny scale z", nclose(rt.scale.z, 1e-3, 1e-9));
  TestValidator.predicate(
    "tiny scale rotation is identity",
    nclose(rt.rotation.w, 1, 1e-9),
  );
};
