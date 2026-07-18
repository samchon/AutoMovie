import { sampleMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  joint,
  keyframe,
  makeExpression,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const rest = makePose([joint("leftLowerArm", { flexion: 0 })]);

/**
 * A `null` expression keyframe is the NEUTRAL (rest) face, blended toward like
 * a resting joint axis (`lerpAxis` null → 0), not a "hold the other keyframe"
 * skip. An expression authored only at the far keyframe therefore RAMPS in from
 * neutral across the segment instead of popping to full at the segment start,
 * and one authored only at the near keyframe fades back out to neutral — the
 * same unauthored-side convention the pose path uses (#1245-round-2 R2-8).
 *
 * Scenarios:
 *
 * 1. Neutral → happy(1): the sampled intensity ramps (0.5 at t=0.5, ~full near the
 *    end), rather than sitting at full from the segment start.
 * 2. Happy(1) → neutral: the intensity fades out symmetrically (0.5 at t=0.5).
 * 3. Neutral → neutral: no expression is sampled (null).
 */
export const test_motion_sample_expression_neutral = (): void => {
  // 1. an expression authored only at the FAR keyframe ramps in from neutral
  const rampIn = makeMotion(
    [
      keyframe(0, rest, "linear", null),
      keyframe(1, rest, "linear", makeExpression("happy", 1)),
    ],
    1,
  );
  const early = sampleMotion(rampIn, 0.1).expression;
  const mid = sampleMotion(rampIn, 0.5).expression;
  TestValidator.equals("ramp keeps the authored preset", mid!.preset, "happy");
  TestValidator.predicate(
    "the intensity ramps from neutral, not a pop to full",
    early !== null && early.intensity < 0.2 && nclose(mid!.intensity, 0.5),
  );

  // 2. an expression authored only at the NEAR keyframe fades out to neutral
  const fadeOut = makeMotion(
    [
      keyframe(0, rest, "linear", makeExpression("happy", 1)),
      keyframe(1, rest, "linear", null),
    ],
    1,
  );
  TestValidator.predicate(
    "the intensity fades toward neutral",
    nclose(sampleMotion(fadeOut, 0.5).expression!.intensity, 0.5) &&
      sampleMotion(fadeOut, 0.9).expression!.intensity < 0.2,
  );

  // 3. neither side authored → no expression
  const none = makeMotion(
    [keyframe(0, rest, "linear", null), keyframe(1, rest, "linear", null)],
    1,
  );
  TestValidator.equals(
    "an unauthored segment samples no expression",
    sampleMotion(none, 0.5).expression,
    null,
  );
};
