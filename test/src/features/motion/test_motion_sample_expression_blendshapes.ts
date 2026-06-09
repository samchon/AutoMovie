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
 * When keyframe expressions carry fine-grained ARKit blendshapes (not just a
 * preset), expression sampling blends each channel's weight by the eased
 * factor, unioning channels that appear on only one side. Pins the
 * channel-merge path the preset-only sampling tests never reach.
 *
 * Scenario: a 1s clip from `happy` with `jawOpen`=1.0, `mouthSmileLeft`=0.4 to
 * `happy` with `jawOpen`=0.0 (no `mouthSmileLeft`). At t=0.5: `jawOpen` blends
 * 1.0→0.0 to 0.5, and `mouthSmileLeft` (present only at the start) decays
 * 0.4·(1−0.5) = 0.2.
 */
export const test_motion_sample_expression_blendshapes = (): void => {
  const clip = makeMotion(
    [
      keyframe(
        0,
        rest,
        "linear",
        makeExpression("happy", 1, [
          { channel: "jawOpen", weight: 1 },
          { channel: "mouthSmileLeft", weight: 0.4 },
        ]),
      ),
      keyframe(
        1,
        rest,
        "linear",
        makeExpression("happy", 1, [{ channel: "jawOpen", weight: 0 }]),
      ),
    ],
    1,
  );
  const blended = sampleMotion(clip, 0.5).expression;
  TestValidator.predicate(
    "blendshapes present",
    blended !== null && blended.blendshapes !== null,
  );

  const channels = new Map(
    (blended!.blendshapes ?? []).map((c) => [c.channel, c.weight]),
  );
  TestValidator.predicate(
    "jawOpen blends to 0.5",
    nclose(channels.get("jawOpen") ?? -1, 0.5),
  );
  TestValidator.predicate(
    "one-sided mouthSmileLeft decays to 0.2",
    nclose(channels.get("mouthSmileLeft") ?? -1, 0.2),
  );
};
