import { sampleMotion } from "@autofilm/engine";
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
 * Expression sampling interpolates the _face_ alongside the body. When adjacent
 * keyframes share a preset it blends intensity smoothly; when the presets
 * differ — there is no meaningful blend between, say, happy and angry — it
 * switches at the segment midpoint.
 *
 * Scenarios:
 *
 * 1. Same preset (happy 0 → happy 1): intensity blends to 0.5 at t=0.5.
 * 2. Different presets (happy → angry): the first holds before the midpoint (t=0.4
 *    → happy) and the second takes over after it (t=0.6 → angry).
 */
export const test_motion_sample_expression = (): void => {
  const blend = makeMotion(
    [
      keyframe(0, rest, "linear", makeExpression("happy", 0)),
      keyframe(1, rest, "linear", makeExpression("happy", 1)),
    ],
    1,
  );
  const mid = sampleMotion(blend, 0.5).expression;
  TestValidator.predicate("expression present", mid !== null);
  TestValidator.predicate(
    "intensity blends to 0.5",
    nclose(mid!.intensity, 0.5),
  );

  const swap = makeMotion(
    [
      keyframe(0, rest, "linear", makeExpression("happy", 1)),
      keyframe(1, rest, "linear", makeExpression("angry", 1)),
    ],
    1,
  );
  TestValidator.equals(
    "before midpoint → first preset",
    sampleMotion(swap, 0.4).expression!.preset,
    "happy",
  );
  TestValidator.equals(
    "after midpoint → second preset",
    sampleMotion(swap, 0.6).expression!.preset,
    "angry",
  );
};
