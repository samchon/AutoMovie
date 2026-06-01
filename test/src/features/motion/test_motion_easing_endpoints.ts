import { ease } from "@motica/engine";
import { MoticaEasing } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Every continuous easing curve maps 0→0 and 1→1, and clamps inputs outside
 * [0,1]. Pins that interpolation never overshoots the keyframe endpoints.
 */
export const test_motion_easing_endpoints = (): void => {
  const curves: MoticaEasing[] = ["linear", "easeIn", "easeOut", "easeInOut"];
  for (const c of curves) {
    TestValidator.predicate(`${c} at 0 = 0`, nclose(ease(c, 0), 0));
    TestValidator.predicate(`${c} at 1 = 1`, nclose(ease(c, 1), 1));
    TestValidator.predicate(`${c} clamps below`, nclose(ease(c, -1), 0));
    TestValidator.predicate(`${c} clamps above`, nclose(ease(c, 2), 1));
  }
};
