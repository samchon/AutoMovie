import { sampleTimes, windowSampleTimes } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The shared sampling clock is the engine's one frame-boundary contract: every
 * sampler (motion bakes, physics validators, the ground-IK pass) steps this
 * exact grid, so their frame boundaries can never drift apart. These oracles
 * pin the contract itself — endpoint-inclusive, `frames + 1` instants, minimum
 * one interval — and the window/duration equivalence that made the six former
 * private copies one function.
 *
 * Scenarios:
 *
 * 1. A whole-frame duration (1 s at 24 Hz) yields 25 instants `i/24` with the last
 *    exactly at the duration.
 * 2. A fractional duration (1.01 s at 24 Hz) rounds the interval count UP and
 *    clamps the final instant to the duration (endpoint-inclusive, never
 *    past).
 * 3. A sub-frame duration still yields its two endpoints (min one interval).
 * 4. `sampleTimes(d, r)` is exactly `windowSampleTimes(0, d, r)` — the delegation
 *    is the identity that keeps every consumer on one grid.
 * 5. A shifted window `[start, end]` steps `start + i/r` clamped to `end` — the
 *    foot-skate contact-window form, same arithmetic shifted.
 */
export const test_motion_sample_clock = (): void => {
  const whole = sampleTimes(1, 24);
  TestValidator.equals("1s@24Hz yields 25 instants", whole.length, 25);
  TestValidator.predicate(
    "instants sit at i/24 with the last at the duration",
    nclose(whole[0]!, 0) &&
      nclose(whole[12]!, 12 / 24) &&
      nclose(whole[24]!, 1),
  );

  const fractional = sampleTimes(1.01, 24);
  TestValidator.equals(
    "fractional duration rounds intervals up",
    fractional.length,
    26,
  );
  TestValidator.predicate(
    "final instant clamps to the duration",
    nclose(fractional[25]!, 1.01) && fractional[25]! <= 1.01,
  );

  const tiny = sampleTimes(0.01, 24);
  TestValidator.equals(
    "sub-frame duration keeps two endpoints",
    tiny.length,
    2,
  );
  TestValidator.predicate(
    "the two endpoints are 0 and the duration",
    nclose(tiny[0]!, 0) && nclose(tiny[1]!, 0.01),
  );

  const viaWindow = windowSampleTimes(0, 1.01, 24);
  TestValidator.equals(
    "sampleTimes(d, r) === windowSampleTimes(0, d, r)",
    fractional,
    viaWindow,
  );

  const window = windowSampleTimes(0.5, 1.25, 24);
  TestValidator.equals(
    "a 0.75s window at 24Hz yields 19 instants",
    window.length,
    19,
  );
  TestValidator.predicate(
    "window instants step start + i/24 clamped to end",
    nclose(window[0]!, 0.5) &&
      nclose(window[1]!, 0.5 + 1 / 24) &&
      nclose(window[18]!, 1.25),
  );

  // (end − start) × rate landing just above an integer (0.3 × 30 =
  // 9.000000000000002) must not duplicate the clamped final instant — a
  // zero-width segment downstream validators would divide by.
  const fpWindow = windowSampleTimes(0.1, 0.4, 30);
  TestValidator.predicate(
    "an FP just-above-integer window deduplicates its final instant",
    fpWindow.length === 10 &&
      nclose(fpWindow[fpWindow.length - 1]!, 0.4) &&
      fpWindow[fpWindow.length - 1] !== fpWindow[fpWindow.length - 2],
  );
};
