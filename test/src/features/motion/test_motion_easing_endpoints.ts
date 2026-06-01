import { ease } from "@motica/engine";
import { MoticaEasing } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Every continuous easing curve must map 0→0 and 1→1 and clamp inputs outside
 * [0,1]. This pins that keyframe interpolation lands exactly on each keyframe's
 * pose at the segment boundaries and never overshoots, whatever curve shape is
 * chosen between them.
 *
 * Scenario: across linear, easeIn, easeOut, and easeInOut, each curve returns 0
 * at t=0 and 1 at t=1, and clamps a below-range input (−1) to 0 and an
 * above-range input (2) to 1.
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
