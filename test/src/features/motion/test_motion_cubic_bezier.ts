import { cubicBezierEasing, ease } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * `cubicBezierEasing` solves the parametric Bézier `x(s)=t` (Newton with
 * safeguards) and returns `y(s)`. This pins its endpoints, its agreement with
 * the linear curve, the degenerate-slope safeguard, and the `ease()` fallback
 * for the `"cubicBezier"` curve name.
 *
 * Scenarios:
 *
 * 1. Linear control points [0,0,1,1] reproduce the identity curve — output ≈ input
 *    at 0.25 and 0.5 (to 1e-3, since Newton converges, not exactly).
 * 2. Any curve is pinned at its endpoints: a standard ease [0.42,0,0.58,1] returns
 *    exactly 0 at t=0 and 1 at t=1.
 * 3. Degenerate control points [0,0,0,0] make the x-curve `s³`, whose derivative
 *    `3s²` underflows the Newton slope guard (|slope| < 1e-6) for a tiny `t`;
 *    the solver must break safely (no NaN/Infinity from dividing by ~0) and
 *    still return a finite value within [0,1]. This exercises the safeguard
 *    branch a happy-path curve never reaches.
 * 4. `ease("cubicBezier", x)` — called without control points — falls back to the
 *    linear identity (the control points live on the keyframe, not here).
 */
export const test_motion_cubic_bezier = (): void => {
  // 1. linear control points ≈ identity
  TestValidator.predicate(
    "linear bezier at 0.25",
    nclose(cubicBezierEasing([0, 0, 1, 1], 0.25), 0.25, 1e-3),
  );
  TestValidator.predicate(
    "linear bezier at 0.5",
    nclose(cubicBezierEasing([0, 0, 1, 1], 0.5), 0.5, 1e-3),
  );

  // 2. endpoints pinned
  TestValidator.predicate(
    "endpoint 0",
    nclose(cubicBezierEasing([0.42, 0, 0.58, 1], 0), 0, 1e-3),
  );
  TestValidator.predicate(
    "endpoint 1",
    nclose(cubicBezierEasing([0.42, 0, 0.58, 1], 1), 1, 1e-3),
  );

  // 3. degenerate slope safeguard: result stays finite and in range
  const degenerate = cubicBezierEasing([0, 0, 0, 0], 1e-4);
  TestValidator.predicate(
    "degenerate slope stays finite & in [0,1]",
    Number.isFinite(degenerate) && degenerate >= 0 && degenerate <= 1,
  );

  // 4. ease() fallback for the cubicBezier name
  TestValidator.predicate(
    "ease(cubicBezier) falls back to linear",
    nclose(ease("cubicBezier", 0.5), 0.5),
  );

  // 5. invalid scalars reject; finite out-of-range progress still clamps
  TestValidator.predicate(
    "ease rejects nan progress",
    throws(() => {
      ease("linear", Number.NaN);
    }),
  );
  TestValidator.predicate(
    "bezier rejects nan progress",
    throws(() => {
      cubicBezierEasing([0, 0, 1, 1], Number.NaN);
    }),
  );
  const invalidControls: [string, [number, number, number, number]][] = [
    ["x1", [Number.NaN, 0, 1, 1]],
    ["y1", [0, Number.NaN, 1, 1]],
    ["x2", [0, 0, Infinity, 1]],
    ["y2", [0, 0, 1, -Infinity]],
  ];
  for (const [name, control] of invalidControls)
    TestValidator.predicate(
      `bezier rejects non-finite ${name}`,
      throws(() => {
        cubicBezierEasing(control, 0.5);
      }),
    );
  TestValidator.predicate(
    "ease clamps finite low",
    nclose(ease("linear", -1), 0),
  );
  TestValidator.predicate(
    "bezier clamps finite high",
    nclose(cubicBezierEasing([0, 0, 1, 1], 2), 1, 1e-3),
  );
};
