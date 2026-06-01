import { cubicBezierEasing } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * `cubicBezierEasing` with control points [0,0,1,1] reproduces the linear
 * curve, and any curve pins the endpoints at 0 and 1.
 */
export const test_motion_cubic_bezier = (): void => {
  TestValidator.predicate(
    "bezier ~linear at 0.25",
    nclose(cubicBezierEasing([0, 0, 1, 1], 0.25), 0.25, 1e-3),
  );
  TestValidator.predicate(
    "bezier ~linear at 0.5",
    nclose(cubicBezierEasing([0, 0, 1, 1], 0.5), 0.5, 1e-3),
  );
  TestValidator.predicate(
    "bezier endpoint 0",
    nclose(cubicBezierEasing([0.42, 0, 0.58, 1], 0), 0, 1e-3),
  );
  TestValidator.predicate(
    "bezier endpoint 1",
    nclose(cubicBezierEasing([0.42, 0, 0.58, 1], 1), 1, 1e-3),
  );
};
